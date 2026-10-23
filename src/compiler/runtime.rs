use std::{path::Path, sync::Arc};
use tokio::{
    sync::watch,
    time::{Duration, Instant},
};

use super::{assets::Assets, cli::Client, service::Compiler};

pub fn requested(arguments: &[String]) -> Result<bool, &'static str> {
    match arguments {
        [] => Ok(false),
        [flag] if flag == "--compiler" => Ok(true),
        _ => Err(
            "Use no argument for source editing, or --compiler to opt into the verified local compiler.",
        ),
    }
}

// This preparation inspects files and image metadata; it never creates a container.
pub async fn prepare(project: &Path, socket: &Path) -> Result<Arc<Compiler<Client>>, String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    let (_sender, cancelled) = watch::channel(false);
    let assets = Assets::verify(
        &project.join("target/stage6-assets/payload"),
        deadline,
        cancelled.clone(),
    )
    .await
    .map_err(|error| {
        format!("Compiler assets are unavailable or failed verification: {error:?}")
    })?;
    let client = Client::local(socket, assets)
        .map_err(|error| format!("The local Docker socket is unavailable: {error}"))?;
    client
        .check_image(deadline, cancelled)
        .await
        .map_err(|error| {
            format!("The retained compiler image is unavailable or differs: {error}")
        })?;
    Compiler::new(project.join("target/compiler-jobs"), client).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compilation_requires_exact_explicit_opt_in() {
        assert_eq!(requested(&[]), Ok(false));
        assert_eq!(requested(&["--compiler".into()]), Ok(true));
        assert!(requested(&["--compile".into()]).is_err());
        assert!(requested(&["--compiler".into(), "--compiler".into()]).is_err());
    }

    #[tokio::test]
    async fn missing_assets_fail_before_a_socket_or_docker_process_is_used() {
        let root = crate::compiler::files::tests::Root::new();
        let error = prepare(&root.0, Path::new("not-an-absolute-socket"))
            .await
            .err()
            .unwrap();
        assert!(error.contains("assets"));
        assert!(std::fs::read_dir(&root.0).unwrap().next().is_none());
    }
}
