use std::{path::PathBuf, process::Stdio, sync::Arc, time::Duration};

use texgen::{ADDRESS, ORIGIN, session::Session, web};
use tokio::{net::TcpListener, process::Command};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    #[cfg(unix)]
    let enable_compiler = texgen::compiler::runtime::requested(&arguments)?;
    #[cfg(not(unix))]
    if !arguments.is_empty() {
        return Err("Compiler opt-in is supported only on Unix hosts.".into());
    }
    #[cfg(unix)]
    let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
    // Bind before creating credentials or opening the browser.
    let listener = TcpListener::bind(ADDRESS).await.map_err(|error| {
        format!("Cannot use {ORIGIN}: {error}. Stop the other process, then start TeXGen again.")
    })?;
    let _ = texgen::catalog::bundled();
    let session =
        Arc::new(Session::new().map_err(|_| "Session authorization could not be created.")?);
    let assets = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/dist");
    if !assets.join("index.html").is_file() {
        return Err("The UI build is missing. Run npm --prefix ui run build first.".into());
    }
    #[cfg(unix)]
    let compiler = if enable_compiler {
        let socket = std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join(".docker/run/docker.sock"));
        match socket {
            Some(socket) => match texgen::compiler::runtime::prepare(
                std::path::Path::new(env!("CARGO_MANIFEST_DIR")),
                &socket,
            )
            .await
            {
                Ok(compiler) => Some(compiler),
                Err(error) => {
                    eprintln!(
                        "PDF compilation remains disabled: {error}. Source editing and exports remain available."
                    );
                    None
                }
            },
            None => {
                eprintln!(
                    "PDF compilation remains disabled: HOME is not available for the local Docker socket."
                );
                None
            }
        }
    } else {
        None
    };
    #[cfg(unix)]
    let router = match &compiler {
        Some(compiler) => web::app_with_compiler(session.clone(), assets, compiler.clone()),
        None => web::app(session.clone(), assets),
    };
    #[cfg(not(unix))]
    let router = web::app(session.clone(), assets);
    if std::env::var_os("TEXGEN_NO_BROWSER").is_none() {
        let status = tokio::time::timeout(
            Duration::from_secs(10),
            Command::new("/usr/bin/open")
                .arg(format!("{ORIGIN}/{}", session.launch_fragment()))
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .kill_on_drop(true)
                .status(),
        )
        .await
        .map_err(|_| "The browser launch timed out. Restart the launcher.")??;
        if !status.success() {
            return Err("The browser did not open. Check macOS browser settings, then restart the launcher.".into());
        }
    }
    #[cfg(unix)]
    let signal_compiler = compiler.clone();
    println!(
        "TeXGen is ready at {ORIGIN}. PDF compilation requires an available, explicitly opted-in local compiler."
    );
    let result = axum::serve(listener, router)
        .with_graceful_shutdown(async move {
            #[cfg(unix)]
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {},
                _ = terminate.recv() => {},
            }
            #[cfg(not(unix))]
            let _ = tokio::signal::ctrl_c().await;
            #[cfg(unix)]
            if let Some(compiler) = signal_compiler
                && compiler.shutdown().await.is_err()
            {
                eprintln!(
                    "Compiler cleanup is uncertain. Preserve the private job directory for review."
                );
            }
        })
        .await;
    #[cfg(unix)]
    if let Some(compiler) = compiler {
        compiler
            .shutdown()
            .await
            .map_err(|_| "Compiler cleanup is uncertain; preserve its private job directory.")?;
    }
    result?;
    Ok(())
}
