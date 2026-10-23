use std::{
    fs, io,
    path::{Path, PathBuf},
};

use tokio::{process::Command, sync::watch, time::Instant};

use super::process;

pub const BUNDLE_TARGET: &str = "/scratch/runtime-bundle.zip";
pub const FORMAT_NAME: &str =
    "6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c-latex-33.fmt";
pub const FORMAT_TARGET: &str = "/scratch/formats/6ffe055852f8faf66c0acbe1a7fb27f87b869a90bad1204f3bf4d9683f597c7c-latex-33.fmt";

#[derive(Debug)]
pub enum Failure {
    Io(io::Error),
    Process(process::Failure),
    Integrity,
}

#[derive(Clone)]
pub struct Assets {
    pub(crate) bundle: PathBuf,
    pub(crate) format: PathBuf,
}

impl Assets {
    pub async fn verify(
        root: &Path,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<Self, Failure> {
        if !fs::symlink_metadata(root).map_err(Failure::Io)?.is_dir() {
            return Err(Failure::Integrity);
        }
        let root = fs::canonicalize(root).map_err(Failure::Io)?;
        let assets = Self {
            bundle: root.join("bundle.zip"),
            format: root.join("formats/Tectonic/formats").join(FORMAT_NAME),
        };
        verify_file(
            &assets.bundle,
            14568158,
            "7547dfdbc9650b30588c107defddf25d4d8cf47712d7ba750d1ba5c1afb6acdb",
            deadline,
            cancelled.clone(),
        )
        .await?;
        verify_file(
            &assets.format,
            24451466,
            "a86ffcac335474fb9fae47cd9986b929719dc3ddf29bfb31123ecc1790ef6bbb",
            deadline,
            cancelled,
        )
        .await?;
        Ok(assets)
    }

    #[cfg(test)]
    pub(crate) fn fixture(root: &Path) -> Self {
        let bundle = root.join("bundle.zip");
        let format = root.join("latex-33.fmt");
        fs::write(&bundle, b"test runtime bundle").unwrap();
        fs::write(&format, b"test runtime format").unwrap();
        Self { bundle, format }
    }
}

async fn verify_file(
    path: &Path,
    size: u64,
    digest: &str,
    deadline: Instant,
    cancelled: watch::Receiver<bool>,
) -> Result<(), Failure> {
    let metadata = fs::symlink_metadata(path).map_err(Failure::Io)?;
    if !metadata.is_file() || metadata.len() != size {
        return Err(Failure::Integrity);
    }
    let mut command = Command::new("/usr/bin/openssl");
    command
        .args(["dgst", "-sha256", "-r"])
        .arg(path)
        .env("OPENSSL_CONF", "/dev/null")
        .env_remove("OPENSSL_MODULES")
        .env_remove("OPENSSL_ENGINES");
    let output = process::run(&mut command, deadline, cancelled)
        .await
        .map_err(Failure::Process)?;
    if !output.status.success()
        || std::str::from_utf8(&output.stdout)
            .ok()
            .and_then(|text| text.split_whitespace().next())
            != Some(digest)
    {
        return Err(Failure::Integrity);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::files::tests::Root;
    use tokio::time::Duration;

    #[tokio::test]
    async fn a_wrong_digest_cannot_become_a_trusted_runtime_file() {
        let root = Root::new();
        let path = root.0.join("asset");
        fs::write(&path, b"abc").unwrap();
        let (_sender, receiver) = watch::channel(false);
        let result = verify_file(
            &path,
            3,
            &"0".repeat(64),
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await;
        assert!(matches!(result, Err(Failure::Integrity)));
    }

    #[tokio::test]
    async fn valid_bytes_match_the_expected_size_and_sha256() {
        let root = Root::new();
        let path = root.0.join("asset");
        fs::write(&path, b"abc").unwrap();
        let digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        let (_sender, receiver) = watch::channel(false);
        assert!(
            verify_file(
                &path,
                3,
                digest,
                Instant::now() + Duration::from_secs(5),
                receiver
            )
            .await
            .is_ok()
        );
        let (_sender, receiver) = watch::channel(false);
        assert!(matches!(
            verify_file(
                &path,
                4,
                digest,
                Instant::now() + Duration::from_secs(5),
                receiver
            )
            .await,
            Err(Failure::Integrity)
        ));
    }

    #[tokio::test]
    async fn a_symlink_is_not_accepted_as_a_pinned_runtime_asset() {
        let root = Root::new();
        let target = root.0.join("target");
        let path = root.0.join("link");
        fs::write(&target, b"abc").unwrap();
        std::os::unix::fs::symlink(&target, &path).unwrap();
        let (_sender, receiver) = watch::channel(false);
        assert!(matches!(
            verify_file(
                &path,
                3,
                "unused",
                Instant::now() + Duration::from_secs(5),
                receiver
            )
            .await,
            Err(Failure::Integrity)
        ));
    }
}
