use serde_json::{Value, json};
use std::{
    fmt::Display,
    fs::{self, DirBuilder, OpenOptions},
    io::Write,
    os::unix::{
        fs::{DirBuilderExt, OpenOptionsExt},
        process::ExitStatusExt,
    },
    path::{Path, PathBuf},
    process::{ExitStatus, Output},
    sync::Arc,
};
use texgen::{
    ADDRESS, ORIGIN,
    compiler::{
        assets::Assets,
        cli::{Client, Failure},
        files::Space,
        jobs::Jobs,
        lifecycle::Engine,
        process,
        service::Compiler,
        spec,
    },
    session::Session,
    web,
};
use tokio::{
    sync::{oneshot, watch},
    time::{Duration, Instant},
};

struct Recorded {
    client: Client,
    root: PathBuf,
    number: usize,
}
impl Engine for Recorded {
    type Error = Failure;
    async fn create(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<(), Failure> {
        let record = json!({"attempt":self.number, "case":"browser", "job":space.lease().id(),
            "containerName":spec::container_name(space.lease()), "image":spec::IMAGE});
        let mut active = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(self.root.join("active.json"))
            .map_err(Failure::Io)?;
        serde_json::to_writer(&mut active, &record)
            .map_err(std::io::Error::other)
            .map_err(Failure::Io)?;
        active.sync_all().map_err(Failure::Io)?;
        let mut journal = OpenOptions::new()
            .append(true)
            .mode(0o600)
            .open(self.root.join("attempts.jsonl"))
            .map_err(Failure::Io)?;
        writeln!(journal, "{record}").map_err(Failure::Io)?;
        journal.sync_all().map_err(Failure::Io)?;
        self.client.create(space, deadline, cancelled).await
    }
    async fn start(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<Output, Failure> {
        self.client.start(space, deadline, cancelled).await
    }
    async fn remove(&self, space: &Space, deadline: Instant) -> Result<(), Failure> {
        self.client.remove(space, deadline).await
    }
}

async fn browser_session<E>(attempt: &Path, engine: E) -> Value
where
    E: Engine + Send + 'static,
    E::Error: Display,
{
    let project = Path::new(env!("CARGO_MANIFEST_DIR"));
    let compiler = Compiler::new(attempt.join("jobs"), engine).unwrap();
    let listener = tokio::net::TcpListener::bind(ADDRESS).await.unwrap();
    let session = Arc::new(Session::new().unwrap());
    let mut launch = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(attempt.join("launch.txt"))
        .unwrap();
    write!(launch, "{ORIGIN}/{}", session.launch_fragment()).unwrap();
    launch.sync_all().unwrap();
    drop(launch);
    let app = web::app_with_compiler(session, project.join("ui/dist"), compiler.clone());
    let (shutdown, receiver) = oneshot::channel();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = receiver.await;
            })
            .await
            .unwrap();
    });
    let (_sender, cancelled) = watch::channel(false);
    let mut browser = tokio::process::Command::new("python3");
    browser
        .arg(project.join("scripts/verify_compiler_browser.py"))
        .arg(attempt);
    let result = process::run(
        &mut browser,
        Instant::now() + Duration::from_secs(100),
        cancelled,
    )
    .await;
    let cleanup = compiler.shutdown().await;
    let _ = shutdown.send(());
    server.await.unwrap();
    cleanup.unwrap();
    let output = result.unwrap();
    assert!(
        output.status.success(),
        "Browser verification failed: {}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value =
        serde_json::from_slice(&fs::read(attempt.join("browser-report.json")).unwrap()).unwrap();
    assert_eq!(report["actualPages"], 2);
    assert_eq!(report["productionCspVerified"], true);
    assert_eq!(report["compileClicks"], 1);
    assert!(fs::read_dir(attempt.join("jobs")).unwrap().next().is_none());
    report
}

pub async fn run() {
    let project = Path::new(env!("CARGO_MANIFEST_DIR"));
    let root = project.join("target/stage6-probes");
    let approval: Value =
        serde_json::from_slice(&fs::read(root.join("approval.json")).unwrap()).unwrap();
    assert_eq!(approval["approved"], true);
    assert_eq!(approval["controllerRequired"], true);
    assert_eq!(approval["image"], spec::IMAGE);
    assert_eq!(approval["maxAttempts"], 16);
    let events: Vec<Value> = fs::read_to_string(root.join("attempts.jsonl"))
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(
        events.len(),
        15,
        "This fixture is reserved for the final approved attempt."
    );
    assert!(!root.join("active.json").exists());
    let number = 16;
    let attempt = root.join("attempt-16");
    DirBuilder::new().mode(0o700).create(&attempt).unwrap();
    let (_sender, cancelled) = watch::channel(false);
    let assets = Assets::verify(
        &project.join("target/stage6-assets/payload"),
        Instant::now() + Duration::from_secs(10),
        cancelled,
    )
    .await
    .unwrap();
    let client = Client::local(Path::new(approval["socket"].as_str().unwrap()), assets).unwrap();
    browser_session(
        &attempt,
        Recorded {
            client,
            root: root.clone(),
            number,
        },
    )
    .await;
    let active: Value =
        serde_json::from_slice(&fs::read(root.join("active.json")).unwrap()).unwrap();
    assert_eq!(active["attempt"], number);
    assert_eq!(active["case"], "browser");
    fs::write(
        attempt.join("result.json"),
        serde_json::to_vec_pretty(&json!({
            "status":"candidate", "attempt":number, "case":"browser", "pdfMetadataVerified":true,
            "actualPages":2, "productionCspVerified":true, "containerRemovalConfirmed":true,
            "bytes":fs::metadata(attempt.join("candidate.pdf")).unwrap().len(),
        }))
        .unwrap(),
    )
    .unwrap();
    println!(
        "Approved attempt 16: protected UI compiled and parsed both pages, retained overflow and edits, and exported the outdated PDF with confirmed cleanup."
    );
}

struct Replay {
    bytes: Vec<u8>,
}
impl Engine for Replay {
    type Error = &'static str;
    async fn create(
        &self,
        _: &Space,
        _: Instant,
        _: watch::Receiver<bool>,
    ) -> Result<(), Self::Error> {
        Ok(())
    }
    async fn start(
        &self,
        space: &Space,
        _: Instant,
        _: watch::Receiver<bool>,
    ) -> Result<Output, Self::Error> {
        fs::write(space.output_path(), &self.bytes).map_err(|_| "Replay output failed")?;
        Ok(Output {
            status: ExitStatus::from_raw(0),
            stdout: vec![],
            stderr: vec![],
        })
    }
    async fn remove(&self, _: &Space, _: Instant) -> Result<(), Self::Error> {
        Ok(())
    }
}

pub async fn preflight() {
    let project = Path::new(env!("CARGO_MANIFEST_DIR"));
    let root = project.join("target/stage6-probes");
    let ledger = fs::read(root.join("attempts.jsonl")).unwrap();
    let nonce = Jobs::default().begin().unwrap().id()[..16].to_owned();
    let attempt = root.join(format!("browser-preflight-{nonce}"));
    DirBuilder::new().mode(0o700).create(&attempt).unwrap();
    let mut command = tokio::process::Command::new("/usr/bin/osascript");
    let code = "ObjC.import('Foundation'); ObjC.import('PDFKit'); function run(args) { const input = $.NSURL.fileURLWithPath(args[0]); const output = $.PDFDocument.alloc.init; for (let i=0;i<2;i++) { const document = $.PDFDocument.alloc.initWithURL(input); output.insertPageAtIndex(document.pageAtIndex(0),i); } if (Number(output.pageCount) !== 2 || !output.writeToURL($.NSURL.fileURLWithPath(args[1]))) throw new Error('The replay fixture could not be written.'); return 'Two-page replay fixture created.'; }";
    command
        .args(["-l", "JavaScript", "-e", code, "--"])
        .arg(root.join("attempt-03/candidate.pdf"))
        .arg(attempt.join("replay.pdf"));
    let (_sender, cancelled) = watch::channel(false);
    let output = process::run(
        &mut command,
        Instant::now() + Duration::from_secs(20),
        cancelled,
    )
    .await
    .unwrap();
    assert!(
        output.status.success(),
        "Replay fixture failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let result = browser_session(
        &attempt,
        Replay {
            bytes: fs::read(attempt.join("replay.pdf")).unwrap(),
        },
    )
    .await;
    assert_eq!(
        fs::read(root.join("attempts.jsonl")).unwrap(),
        ledger,
        "Replay must not change the image attempt ledger."
    );
    fs::write(
        project.join("target/stage6-protected-browser-preflight.json"),
        serde_json::to_vec_pretty(
            &json!({"engine":"replay", "compilerImageAttemptsUsed":0, "report":result}),
        )
        .unwrap(),
    )
    .unwrap();
    println!(
        "Protected production-CSP browser preflight passed with replay only; no compiler image executed."
    );
}
