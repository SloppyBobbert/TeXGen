#![cfg(unix)]

use std::{
    fs::{self, DirBuilder, OpenOptions},
    io::Write,
    os::unix::fs::{DirBuilderExt, OpenOptionsExt},
    path::Path,
};

use serde_json::{Value, json};
use texgen::{
    compiler::{
        assets::Assets,
        cli::Client,
        files::Space,
        jobs::Jobs,
        lifecycle::{self, Outcome},
        process, spec,
    },
    document::{Content, Document, Latex},
    render,
};

#[path = "support/compiler_browser.rs"]
mod protected_browser;

#[tokio::test]
#[ignore = "Uses installed Chrome and a replay engine only; no Docker execution."]
async fn protected_browser_preflight() {
    protected_browser::preflight().await;
}

#[tokio::test]
#[ignore = "Requires the final retained-image attempt through the bounded controller."]
async fn approved_browser_fixture() {
    protected_browser::run().await;
}

fn fixture(case: &str) -> Document {
    let mut document: Document =
        serde_json::from_str(include_str!("fixtures/document.json")).unwrap();
    if case != "canonical" {
        let source = match case {
            "raw" => r"\documentclass{article}\begin{document}TeXGen raw fixture.\end{document}",
            "hostile" => include_str!("fixtures/hostile.tex"),
            "layout" => {
                r"\documentclass{article}\begin{document}\noindent\hbox to 1pt{TeXGen overfull diagnostic fixture.}\par\end{document}"
            }
            "timeout" | "cancel" => {
                r"\documentclass{article}\begin{document}\loop\iftrue\repeat\end{document}"
            }
            _ => panic!("The fixture is not approved."),
        };
        document.content = Content::Raw {
            source: Latex(source.replace("__HOST_PROJECT__", env!("CARGO_MANIFEST_DIR"))),
        };
        document.mode_recovery = None;
    }
    document.validate().unwrap();
    document
}

async fn assert_running(socket: &str, record: &Value) {
    let mut command = tokio::process::Command::new("/usr/local/bin/docker");
    command.args([
        "--host",
        &format!("unix://{socket}"),
        "inspect",
        "--type=container",
        record["containerName"].as_str().unwrap(),
    ]);
    for name in [
        "DOCKER_CONTEXT",
        "DOCKER_HOST",
        "DOCKER_TLS_VERIFY",
        "DOCKER_CERT_PATH",
        "DOCKER_API_VERSION",
    ] {
        command.env_remove(name);
    }
    let (_sender, receiver) = tokio::sync::watch::channel(false);
    let output = process::run(
        &mut command,
        tokio::time::Instant::now() + tokio::time::Duration::from_secs(5),
        receiver,
    )
    .await
    .unwrap();
    assert!(output.status.success());
    let data: Vec<Value> = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(data.len(), 1);
    assert_eq!(data[0]["Image"], spec::IMAGE);
    assert_eq!(
        data[0]["Name"],
        format!("/{}", record["containerName"].as_str().unwrap())
    );
    assert_eq!(
        data[0]["Config"]["Labels"]["texgen.application"],
        "rust-web"
    );
    assert_eq!(data[0]["Config"]["Labels"]["texgen.job"], record["job"]);
    assert_eq!(data[0]["State"]["Running"], true);
}

// Run only through the approved probe controller; ordinary Cargo tests never execute Docker.
async fn approved_fixture(case: &str) {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("target/stage6-probes");
    let approval: Value =
        serde_json::from_slice(&fs::read(root.join("approval.json")).unwrap()).unwrap();
    assert_eq!(approval["approved"], true);
    assert_eq!(approval["image"], spec::IMAGE);
    assert_eq!(approval["maxAttempts"], 16);
    assert_eq!(approval["controllerRequired"], true);
    let source = render::tex(&fixture(case)).unwrap();
    let jobs = Jobs::default();
    let started = tokio::time::Instant::now();
    let lease = jobs.begin().unwrap();
    let socket = approval["socket"].as_str().unwrap();
    let payload = Path::new(env!("CARGO_MANIFEST_DIR")).join("target/stage6-assets/payload");
    let assets = Assets::verify(
        &payload,
        tokio::time::Instant::now() + tokio::time::Duration::from_secs(10),
        lease.cancellation(),
    )
    .await
    .unwrap();
    let client = Client::local(Path::new(socket), assets).unwrap();
    let previous = fs::read_to_string(root.join("attempts.jsonl")).unwrap_or_else(|error| {
        assert_eq!(error.kind(), std::io::ErrorKind::NotFound);
        String::new()
    });
    let events: Vec<Value> = previous
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert!(
        events.len() < 16,
        "The approved attempt count is exhausted."
    );
    let number = events.len() + 1;
    let attempt = root.join(format!("attempt-{number:02}"));
    let record = json!({
        "attempt": number, "case": case, "job": lease.id(),
        "containerName": spec::container_name(&lease), "image": spec::IMAGE,
    });
    let mut active = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(root.join("active.json"))
        .unwrap();
    serde_json::to_writer(&mut active, &record).unwrap();
    active.sync_all().unwrap();
    let mut journal = OpenOptions::new()
        .append(true)
        .create(true)
        .mode(0o600)
        .open(root.join("attempts.jsonl"))
        .unwrap();
    writeln!(journal, "{record}").unwrap();
    journal.sync_all().unwrap();
    DirBuilder::new().mode(0o700).create(&attempt).unwrap();
    let mut space = Space::create(&attempt, lease).unwrap();
    space.prepare(&source).unwrap();
    let execution = lifecycle::execute(&client, space);
    tokio::pin!(execution);
    let outcome = if case == "cancel" {
        tokio::select! {
            result = &mut execution => result,
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(2)) => {
                assert_running(socket, &record).await;
                jobs.cancel(record["job"].as_str().unwrap()).unwrap();
                execution.await
            }
        }
    } else {
        execution.await
    };
    match outcome {
        Outcome::Finished(Ok(candidate)) => {
            assert!(
                candidate.bytes.starts_with(b"%PDF-"),
                "The candidate does not have a PDF header."
            );
            assert!(
                candidate.bytes.windows(5).any(|bytes| bytes == b"%%EOF"),
                "The candidate has no PDF end marker."
            );
            let diagnostics = format!(
                "{}{}",
                String::from_utf8_lossy(&candidate.diagnostics.stdout),
                String::from_utf8_lossy(&candidate.diagnostics.stderr)
            );
            if case == "layout" {
                assert!(
                    diagnostics.to_lowercase().contains("overfull \\hbox"),
                    "The real engine did not expose its overfull diagnostic."
                );
            }
            fs::write(attempt.join("diagnostics.txt"), diagnostics).unwrap();
            fs::write(attempt.join("candidate.pdf"), &candidate.bytes).unwrap();
            fs::write(attempt.join("result.json"), serde_json::to_vec_pretty(&json!({
                "status": "candidate", "attempt": number, "case": case,
                "bytes": candidate.bytes.len(), "pdfMetadataVerified": false,
                "diagnosticBytes": candidate.diagnostics.stdout.len() + candidate.diagnostics.stderr.len(),
            })).unwrap()).unwrap();
            println!(
                "Approved attempt {number}: {case} produced {} candidate bytes; PDF metadata remains unverified.",
                candidate.bytes.len()
            );
        }
        Outcome::Finished(Err(error)) => {
            let expected = (case == "timeout"
                && matches!(
                    &error,
                    lifecycle::Failure::Engine(texgen::compiler::cli::Failure::Process(
                        process::Failure::TimedOut
                    ))
                ))
                || (case == "cancel"
                    && matches!(
                        &error,
                        lifecycle::Failure::Cancelled
                            | lifecycle::Failure::Engine(texgen::compiler::cli::Failure::Process(
                                process::Failure::Cancelled
                            ))
                    ));
            assert!(
                expected,
                "Approved attempt {number} failed unexpectedly: {error:?}"
            );
            let elapsed = started.elapsed().as_secs_f64();
            assert!(elapsed < 60.0, "The job exceeded its original deadline.");
            fs::write(
                attempt.join("result.json"),
                serde_json::to_vec_pretty(&json!({
                    "status": "expected-failure", "attempt": number, "case": case,
                    "elapsedSeconds": elapsed, "containerRemovalConfirmed": true,
                }))
                .unwrap(),
            )
            .unwrap();
            println!(
                "Approved attempt {number}: {case} stopped and cleanup finished in {elapsed:.3} seconds."
            );
        }
        Outcome::Blocked { failure, .. } => {
            panic!("Approved attempt {number} has uncertain cleanup: {failure:?}")
        }
    }
}

#[tokio::test]
#[ignore = "Requires explicit retained-image approval and the bounded probe controller."]
async fn approved_canonical_fixture() {
    approved_fixture("canonical").await;
}

#[tokio::test]
#[ignore = "Requires explicit retained-image approval and the bounded probe controller."]
async fn approved_raw_fixture() {
    approved_fixture("raw").await;
}

#[tokio::test]
#[ignore = "Requires explicit retained-image approval and the bounded probe controller."]
async fn approved_timeout_fixture() {
    approved_fixture("timeout").await;
}

#[tokio::test]
#[ignore = "Requires explicit retained-image approval and the bounded probe controller."]
async fn approved_cancel_fixture() {
    approved_fixture("cancel").await;
}

#[tokio::test]
#[ignore = "Requires explicit retained-image approval and the bounded probe controller."]
async fn approved_hostile_fixture() {
    approved_fixture("hostile").await;
}

#[tokio::test]
#[ignore = "Requires explicit retained-image approval and the bounded probe controller."]
async fn approved_layout_fixture() {
    approved_fixture("layout").await;
}

#[test]
fn live_fixtures_use_the_canonical_document_and_renderer_contract() {
    for case in ["canonical", "raw", "timeout", "cancel", "hostile", "layout"] {
        let document = fixture(case);
        let original = document.clone();
        let source = render::tex(&document).unwrap();
        assert_eq!(document, original);
        assert!(!source.is_empty());
        if let Content::Raw { source: raw } = document.content {
            assert_eq!(source, raw.0);
        }
    }
}
