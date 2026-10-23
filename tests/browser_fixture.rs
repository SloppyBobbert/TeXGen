use std::{fs::OpenOptions, io::Write, os::unix::fs::OpenOptionsExt, path::PathBuf, sync::Arc};

use texgen::{ADDRESS, ORIGIN, session::Session, web};

#[tokio::test]
#[ignore = "Persistent fixture for the real-browser harness. No browser download is permitted."]
async fn serve_browser_fixture() {
    let path = std::env::var_os("TEXGEN_TEST_LAUNCH_FILE")
        .expect("A private new launch file is required.");
    let listener = tokio::net::TcpListener::bind(ADDRESS).await.unwrap();
    let session = Arc::new(Session::new().unwrap());
    let assets = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/dist");
    assert!(assets.join("index.html").is_file());
    let mut private_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .unwrap();
    write!(private_file, "{ORIGIN}/{}", session.launch_fragment()).unwrap();
    drop(private_file);
    axum::serve(listener, web::app(session, assets))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .unwrap();
}
