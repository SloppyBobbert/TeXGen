use std::{
    fs::{self, DirBuilder, File, OpenOptions},
    io::{self, Read, Seek, SeekFrom, Write},
    os::unix::fs::{DirBuilderExt, OpenOptionsExt, PermissionsExt},
    path::{Path, PathBuf},
};

use super::{MAX_PDF_BYTES, MAX_SOURCE_BYTES, jobs::Lease};

pub struct Space {
    lease: Lease,
    directory: PathBuf,
    output: Option<File>,
    source_bytes: Option<usize>,
    cleaned: bool,
}

impl Space {
    pub fn create(root: &Path, lease: Lease) -> io::Result<Self> {
        if !fs::symlink_metadata(root)?.is_dir() {
            return Err(io::Error::other("The job root must be a real directory."));
        }
        let directory = fs::canonicalize(root)?.join(lease.id());
        DirBuilder::new().mode(0o700).create(&directory)?;
        Ok(Self {
            lease,
            directory,
            output: None,
            source_bytes: None,
            cleaned: false,
        })
    }

    pub fn lease(&self) -> &Lease {
        &self.lease
    }

    pub fn input_path(&self) -> PathBuf {
        self.directory.join("input.tex")
    }

    pub fn output_path(&self) -> PathBuf {
        self.directory.join("output.pdf")
    }

    pub fn source_bytes(&self) -> io::Result<usize> {
        self.source_bytes
            .ok_or_else(|| io::Error::other("The job input is not ready."))
    }

    pub fn prepare(&mut self, source: &str) -> io::Result<()> {
        if source.len() > MAX_SOURCE_BYTES {
            return Err(io::Error::other(
                "The compiler source exceeds the input limit.",
            ));
        }
        let mut input = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o444)
            .open(self.input_path())?;
        input.write_all(source.as_bytes())?;
        input.set_permissions(fs::Permissions::from_mode(0o444))?;
        let output = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(self.output_path())?;
        self.output = Some(output);
        // The container user can write this file, but cannot traverse its private host directory.
        self.output
            .as_ref()
            .unwrap()
            .set_permissions(fs::Permissions::from_mode(0o666))?;
        self.source_bytes = Some(source.len());
        Ok(())
    }

    pub fn read_output(&mut self) -> io::Result<Vec<u8>> {
        let output = self
            .output
            .as_mut()
            .ok_or_else(|| io::Error::other("The job output is not ready."))?;
        let metadata = output.metadata()?;
        if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_PDF_BYTES as u64 {
            return Err(io::Error::other(
                "The compiler output is empty or exceeds its limit.",
            ));
        }
        output.seek(SeekFrom::Start(0))?;
        let mut bytes = Vec::new();
        output
            .take((MAX_PDF_BYTES + 1) as u64)
            .read_to_end(&mut bytes)?;
        if bytes.is_empty() || bytes.len() > MAX_PDF_BYTES {
            return Err(io::Error::other(
                "The compiler output is empty or exceeds its limit.",
            ));
        }
        Ok(bytes)
    }

    // The caller must first confirm that the container has stopped and was removed.
    pub fn cleanup(&mut self) -> io::Result<()> {
        self.output = None;
        self.source_bytes = None;
        match fs::remove_dir_all(&self.directory) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
            _ => {}
        }
        self.cleaned = true;
        Ok(())
    }
}

impl Drop for Space {
    fn drop(&mut self) {
        // Drop cannot confirm container removal or safely delete mounted files.
        if !self.cleaned {
            self.lease.stop_admission();
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::compiler::{MAX_PDF_BYTES, jobs::Jobs};

    pub(crate) struct Root(pub(crate) PathBuf);

    impl Root {
        pub(crate) fn new() -> Self {
            let lease = Jobs::default().begin().unwrap();
            let path = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("target/compiler-file-tests")
                .join(&lease.id()[..24]);
            DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(&path)
                .unwrap();
            Self(path)
        }
    }

    impl Drop for Root {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn oversized_output_is_rejected_before_publication() {
        let root = Root::new();
        let lease = Jobs::default().begin().unwrap();
        let mut space = Space::create(&root.0, lease).unwrap();
        space.prepare("source").unwrap();
        space
            .output
            .as_mut()
            .unwrap()
            .set_len((MAX_PDF_BYTES + 1) as u64)
            .unwrap();
        let rejected = space.read_output().is_err();
        space.cleanup().unwrap();
        assert!(rejected);
    }

    #[test]
    fn private_paths_preserve_source_bytes_and_set_container_file_permissions() {
        let root = Root::new();
        let lease = Jobs::default().begin().unwrap();
        let id = lease.id().to_owned();
        let mut space = Space::create(&root.0, lease).unwrap();
        let source = "raw source\r\n\\alpha{}\n";
        space.prepare(source).unwrap();
        assert_eq!(space.lease().id(), id);
        assert_eq!(space.source_bytes().unwrap(), source.len());
        assert_eq!(space.input_path(), root.0.join(&id).join("input.tex"));
        assert_eq!(fs::read(space.input_path()).unwrap(), source.as_bytes());
        assert_eq!(
            fs::metadata(&space.directory).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(space.input_path())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o444
        );
        assert_eq!(
            fs::metadata(space.output_path())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o666
        );
        space.cleanup().unwrap();
    }

    #[test]
    fn oversized_source_is_rejected_before_creating_input_or_output() {
        let root = Root::new();
        let lease = Jobs::default().begin().unwrap();
        let mut space = Space::create(&root.0, lease).unwrap();
        assert!(space.prepare(&"x".repeat(MAX_SOURCE_BYTES + 1)).is_err());
        assert!(space.source_bytes().is_err());
        assert!(!space.input_path().exists());
        assert!(!space.output_path().exists());
        space.cleanup().unwrap();
    }

    #[test]
    fn repeated_preparation_cannot_replace_existing_source() {
        let root = Root::new();
        let lease = Jobs::default().begin().unwrap();
        let mut space = Space::create(&root.0, lease).unwrap();
        space.prepare("keep").unwrap();
        assert!(space.prepare("replacement").is_err());
        assert_eq!(fs::read(space.input_path()).unwrap(), b"keep");
        space.cleanup().unwrap();
    }

    #[test]
    fn output_at_the_exact_byte_limit_is_accepted_but_empty_output_is_not() {
        let root = Root::new();
        let lease = Jobs::default().begin().unwrap();
        let mut space = Space::create(&root.0, lease).unwrap();
        space.prepare("source").unwrap();
        assert!(space.read_output().is_err());
        space
            .output
            .as_mut()
            .unwrap()
            .set_len(MAX_PDF_BYTES as u64)
            .unwrap();
        assert_eq!(space.read_output().unwrap().len(), MAX_PDF_BYTES);
        space.cleanup().unwrap();
    }

    #[test]
    fn output_reads_keep_the_owned_descriptor_and_cleanup_does_not_follow_links() {
        let root = Root::new();
        let sentinel = root.0.join("sentinel");
        fs::write(&sentinel, b"outside the job").unwrap();
        let lease = Jobs::default().begin().unwrap();
        let mut space = Space::create(&root.0, lease).unwrap();
        space.prepare("source").unwrap();
        space.output.as_mut().unwrap().write_all(b"output").unwrap();
        fs::remove_file(space.output_path()).unwrap();
        std::os::unix::fs::symlink(&sentinel, space.output_path()).unwrap();
        assert_eq!(space.read_output().unwrap(), b"output");
        space.cleanup().unwrap();
        assert_eq!(fs::read(&sentinel).unwrap(), b"outside the job");
    }

    #[test]
    fn a_symlink_job_root_is_rejected_without_creating_a_job() {
        let root = Root::new();
        let real = root.0.join("real");
        fs::create_dir(&real).unwrap();
        let link = root.0.join("link");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let lease = Jobs::default().begin().unwrap();
        let id = lease.id().to_owned();
        assert!(Space::create(&link, lease).is_err());
        assert!(!real.join(id).exists());
    }

    #[test]
    fn cleanup_failure_keeps_admission_until_the_space_is_recovered_and_dropped() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let parked = root.0.join("parked");
        fs::rename(&space.directory, &parked).unwrap();
        fs::write(&space.directory, b"not a directory").unwrap();
        assert!(space.cleanup().is_err());
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Busy)
        ));
        fs::remove_file(&space.directory).unwrap();
        fs::rename(&parked, &space.directory).unwrap();
        space.cleanup().unwrap();
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Busy)
        ));
        drop(space);
        assert!(jobs.begin().is_ok());
    }
}
