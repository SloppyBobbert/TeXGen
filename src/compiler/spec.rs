use std::{ffi::OsString, io, path::Path};

use super::{
    MAX_PDF_BYTES,
    assets::{Assets, BUNDLE_TARGET, FORMAT_TARGET},
    files::Space,
    jobs::Lease,
    scratch_bytes,
};

pub const IMAGE: &str = "sha256:e5d0bc4192004f06fc32f2df5bca1dc90b5918daeb6c8072313493d21edf3b31";
pub const COMPILE_ARGS: [&str; 10] = [
    "--print",
    "--untrusted",
    "--only-cached",
    "--bundle",
    BUNDLE_TARGET,
    "--outfmt",
    "pdf",
    "--outdir",
    "/scratch",
    "/scratch/input.tex",
];

pub fn container_name(lease: &Lease) -> String {
    format!("texgen-{}", lease.id())
}

fn bind_file(path: &Path, destination: &str, readonly: bool) -> io::Result<OsString> {
    let source = path
        .to_str()
        .filter(|source| {
            path.is_absolute()
                && !source
                    .chars()
                    .any(|c| c.is_control() || c == ',' || c == '"')
        })
        .ok_or_else(|| io::Error::other("The compiler path cannot be used as a file mount."))?;
    let suffix = if readonly { ",readonly" } else { "" };
    Ok(format!("type=bind,src={source},dst={destination}{suffix}").into())
}

pub fn create_arguments(space: &Space, assets: &Assets) -> io::Result<Vec<OsString>> {
    let scratch = scratch_bytes(space.source_bytes()?).map_err(io::Error::other)?;
    let mut args = vec![
        "create".into(),
        "--name".into(),
        container_name(space.lease()).into(),
        "--label=texgen.application=rust-web".into(),
        format!("--label=texgen.job={}", space.lease().id()).into(),
        "--pull=never".into(),
        "--network=none".into(),
        "--read-only".into(),
        "--user=10001:10001".into(),
        "--env=XDG_CACHE_HOME=/scratch".into(),
        "--env=TECTONIC_CACHE_DIR=/scratch".into(),
        "--cpus=1".into(),
        "--memory=512m".into(),
        "--memory-swap=512m".into(),
        "--pids-limit=32".into(),
        "--cap-drop=ALL".into(),
        "--security-opt=no-new-privileges".into(),
        "--log-driver=none".into(),
        "--ipc=none".into(),
        format!("--ulimit=fsize={MAX_PDF_BYTES}:{MAX_PDF_BYTES}").into(),
        format!(
            "--tmpfs=/scratch:rw,noexec,nosuid,nodev,size={scratch},uid=10001,gid=10001,mode=0700"
        )
        .into(),
        "--mount".into(),
        bind_file(&space.input_path(), "/scratch/input.tex", true)?,
        "--mount".into(),
        bind_file(&space.output_path(), "/scratch/input.pdf", false)?,
        "--mount".into(),
        bind_file(&assets.bundle, BUNDLE_TARGET, true)?,
        "--mount".into(),
        bind_file(&assets.format, FORMAT_TARGET, true)?,
        IMAGE.into(),
    ];
    args.extend(COMPILE_ARGS.map(OsString::from));
    Ok(args)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::{files::tests::Root, jobs::Jobs};

    #[test]
    fn container_creation_requests_the_fixed_isolation_controls() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let assets = Assets::fixture(&root.0);
        let args = create_arguments(&space, &assets).unwrap();
        space.cleanup().unwrap();
        for required in [
            "--pull=never",
            "--network=none",
            "--read-only",
            "--user=10001:10001",
            "--cpus=1",
            "--memory=512m",
            "--memory-swap=512m",
            "--pids-limit=32",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--log-driver=none",
            "--ipc=none",
        ] {
            assert!(
                args.iter().any(|arg| arg == required),
                "Missing control: {required}"
            );
        }
    }

    #[test]
    fn only_owned_job_files_and_verified_runtime_files_are_mounted() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let assets = Assets::fixture(&root.0);
        let args = create_arguments(&space, &assets).unwrap();
        let mounts: Vec<_> = args
            .windows(2)
            .filter(|pair| pair[0] == "--mount")
            .map(|pair| pair[1].clone())
            .collect();
        assert_eq!(
            mounts,
            vec![
                bind_file(&space.input_path(), "/scratch/input.tex", true).unwrap(),
                bind_file(&space.output_path(), "/scratch/input.pdf", false).unwrap(),
                bind_file(&assets.bundle, BUNDLE_TARGET, true).unwrap(),
                bind_file(&assets.format, FORMAT_TARGET, true).unwrap(),
            ]
        );
        assert!(
            args.iter()
                .any(|arg| arg == "--ulimit=fsize=10485760:10485760")
        );
        assert!(
            args.iter()
                .any(|arg| arg == format!("--label=texgen.job={}", space.lease().id()).as_str())
        );
        assert!(
            args.iter()
                .any(|arg| arg == container_name(space.lease()).as_str())
        );
        let scratch = scratch_bytes(space.source_bytes().unwrap()).unwrap();
        let expected = format!(
            "--tmpfs=/scratch:rw,noexec,nosuid,nodev,size={scratch},uid=10001,gid=10001,mode=0700"
        );
        assert!(args.iter().any(|arg| arg == expected.as_str()));
        space.cleanup().unwrap();
    }

    #[test]
    fn the_image_is_pinned_and_compiler_input_is_untrusted_and_offline() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let assets = Assets::fixture(&root.0);
        let args = create_arguments(&space, &assets).unwrap();
        let image = args.iter().position(|arg| arg == IMAGE).unwrap();
        let expected: Vec<OsString> = [
            "--print",
            "--untrusted",
            "--only-cached",
            "--bundle",
            "/scratch/runtime-bundle.zip",
            "--outfmt",
            "pdf",
            "--outdir",
            "/scratch",
            "/scratch/input.tex",
        ]
        .into_iter()
        .map(OsString::from)
        .collect();
        assert_eq!(&args[image + 1..], expected);
        space.cleanup().unwrap();
    }

    #[test]
    fn unprepared_or_cleaned_spaces_cannot_create_a_container() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        let assets = Assets::fixture(&root.0);
        assert!(create_arguments(&space, &assets).is_err());
        space.prepare("source").unwrap();
        space.cleanup().unwrap();
        assert!(create_arguments(&space, &assets).is_err());
    }

    #[test]
    fn ambiguous_mount_paths_are_rejected_without_a_shell_or_csv_escape() {
        for path in [
            "relative/input.tex",
            "/tmp/a,b/input.tex",
            "/tmp/a\"b/input.tex",
            "/tmp/a\nb/input.tex",
        ] {
            assert!(bind_file(Path::new(path), "/scratch/input.tex", true).is_err());
        }
        assert_eq!(
            bind_file(Path::new("/tmp/a b/input.tex"), "/scratch/input.tex", true).unwrap(),
            "type=bind,src=/tmp/a b/input.tex,dst=/scratch/input.tex,readonly"
        );
    }
}
