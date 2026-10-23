#![cfg(unix)]

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use std::{
    fs,
    os::unix::{fs::DirBuilderExt, process::ExitStatusExt},
    path::PathBuf,
    process::{ExitStatus, Output},
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
};
use texgen::{
    ADDRESS, ORIGIN,
    compiler::{files::Space, jobs::Jobs, lifecycle::Engine, service::Compiler},
    session::Session,
    web,
};
use tokio::{
    sync::{Notify, watch},
    time::Instant,
};
use tower::ServiceExt;

struct Fake {
    release: watch::Receiver<bool>,
    started: Arc<Notify>,
    removed: Arc<AtomicUsize>,
    source: Arc<Mutex<String>>,
}
impl Engine for Fake {
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
        mut cancelled: watch::Receiver<bool>,
    ) -> Result<Output, Self::Error> {
        *self.source.lock().unwrap() = fs::read_to_string(space.input_path()).unwrap();
        self.started.notify_one();
        let mut release = self.release.clone();
        while !*release.borrow() && !*cancelled.borrow() {
            tokio::select! { _ = release.changed() => {}, _ = cancelled.changed() => {} }
        }
        fs::write(space.output_path(), b"candidate").unwrap();
        Ok(Output {
            status: ExitStatus::from_raw(0),
            stdout: vec![],
            stderr: vec![],
        })
    }
    async fn remove(&self, _: &Space, _: Instant) -> Result<(), Self::Error> {
        self.removed.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}
struct Fixture {
    app: Router,
    cookie: String,
    compiler: Arc<Compiler<Fake>>,
    root: PathBuf,
    release: watch::Sender<bool>,
    started: Arc<Notify>,
    removed: Arc<AtomicUsize>,
    source: Arc<Mutex<String>>,
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
async fn fixture() -> Fixture {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/compiler-http-tests")
        .join(Jobs::default().begin().unwrap().id());
    fs::DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(&root)
        .unwrap();
    let (release, receiver) = watch::channel(false);
    let started = Arc::new(Notify::new());
    let removed = Arc::new(AtomicUsize::new(0));
    let source = Arc::new(Mutex::new(String::new()));
    let compiler = Compiler::new(
        root.clone(),
        Fake {
            release: receiver,
            started: started.clone(),
            removed: removed.clone(),
            source: source.clone(),
        },
    )
    .unwrap();
    let session = Arc::new(Session::new().unwrap());
    let token = session
        .launch_fragment()
        .trim_start_matches("#launch=")
        .to_owned();
    let app = web::app_with_compiler(session, PathBuf::from("ui/dist"), compiler.clone());
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/session")
                .header("host", ADDRESS)
                .header("origin", ORIGIN)
                .header("x-texgen-client", "1")
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {token}"))
                .body(Body::from("{}"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    let cookie = response.headers()["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_owned();
    Fixture {
        app,
        cookie,
        compiler,
        root,
        release,
        started,
        removed,
        source,
    }
}
fn request(path: &str, cookie: &str, value: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(path)
        .header("host", ADDRESS)
        .header("origin", ORIGIN)
        .header("x-texgen-client", "1")
        .header("content-type", "application/json")
        .header("cookie", cookie)
        .body(Body::from(value.to_string()))
        .unwrap()
}
fn document() -> Value {
    serde_json::from_str(include_str!("fixtures/document.json")).unwrap()
}
fn compile(id: &str) -> Value {
    json!({"document":document(), "revision":7, "requestId":id})
}
fn id(letter: char) -> String {
    letter.to_string().repeat(64)
}

#[tokio::test]
async fn protected_compile_echoes_ownership_and_returns_only_cleaned_candidate_bytes() {
    let f = fixture().await;
    f.release.send_replace(true);
    let mut data = compile(&id('a'));
    data["document"]["content"] = json!({"mode":"raw", "source":"raw \\input bytes\r\nunchanged"});
    data["document"]
        .as_object_mut()
        .unwrap()
        .remove("modeRecovery");
    let response = f
        .app
        .clone()
        .oneshot(request("/api/compile", &f.cookie, data.clone()))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["content-type"], "application/pdf");
    assert_eq!(
        response.headers()["x-texgen-document-id"],
        data["document"]["id"].as_str().unwrap()
    );
    assert_eq!(response.headers()["x-texgen-revision"], "7");
    assert_eq!(response.headers()["x-texgen-request-id"], id('a'));
    assert_eq!(
        *f.source.lock().unwrap(),
        data["document"]["content"]["source"].as_str().unwrap()
    );
    let csp = response.headers()["content-security-policy"]
        .to_str()
        .unwrap();
    assert!(csp.contains("worker-src 'self'") && !csp.contains("unsafe-eval"));
    assert_eq!(
        axum::body::to_bytes(response.into_body(), 1024)
            .await
            .unwrap(),
        b"candidate"[..]
    );
    assert_eq!(f.removed.load(Ordering::SeqCst), 1);
    assert!(fs::read_dir(&f.root).unwrap().next().is_none());
    f.compiler.shutdown().await.unwrap();
}

#[tokio::test]
async fn unauthorized_and_invalid_compiles_never_enter_the_engine() {
    let f = fixture().await;
    assert_eq!(
        f.app
            .clone()
            .oneshot(request("/api/compile", "", compile(&id('a'))))
            .await
            .unwrap()
            .status(),
        StatusCode::UNAUTHORIZED
    );
    let mut invalid = compile(&id('a'));
    invalid["revision"] = json!(9_007_199_254_740_992_u64);
    assert_eq!(
        f.app
            .clone()
            .oneshot(request("/api/compile", &f.cookie, invalid))
            .await
            .unwrap()
            .status(),
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        f.app
            .clone()
            .oneshot(request("/api/compile", &f.cookie, compile("bad")))
            .await
            .unwrap()
            .status(),
        StatusCode::BAD_REQUEST
    );
    assert_eq!(f.removed.load(Ordering::SeqCst), 0);
    assert!(fs::read_dir(&f.root).unwrap().next().is_none());
    f.compiler.shutdown().await.unwrap();
}

#[tokio::test]
async fn simultaneous_http_jobs_are_rejected_and_only_the_owner_can_cancel() {
    let f = fixture().await;
    let app = f.app.clone();
    let first = request("/api/compile", &f.cookie, compile(&id('a')));
    let running = tokio::spawn(async move { app.oneshot(first).await.unwrap() });
    f.started.notified().await;
    assert_eq!(
        f.app
            .clone()
            .oneshot(request("/api/compile", &f.cookie, compile(&id('b'))))
            .await
            .unwrap()
            .status(),
        StatusCode::CONFLICT
    );
    assert_eq!(
        f.app
            .clone()
            .oneshot(request(
                "/api/compile/cancel",
                &f.cookie,
                json!({"requestId":id('b')})
            ))
            .await
            .unwrap()
            .status(),
        StatusCode::ACCEPTED
    );
    assert_eq!(f.removed.load(Ordering::SeqCst), 0);
    assert_eq!(
        f.app
            .clone()
            .oneshot(request(
                "/api/compile/cancel",
                &f.cookie,
                json!({"requestId":id('a')})
            ))
            .await
            .unwrap()
            .status(),
        StatusCode::ACCEPTED
    );
    assert_eq!(
        running.await.unwrap().status(),
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(f.removed.load(Ordering::SeqCst), 1);
    assert!(fs::read_dir(&f.root).unwrap().next().is_none());
    f.compiler.shutdown().await.unwrap();
}
