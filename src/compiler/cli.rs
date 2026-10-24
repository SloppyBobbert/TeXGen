use std::{
    collections::HashSet,
    ffi::OsString,
    fs, io,
    os::unix::{fs::FileTypeExt, process::ExitStatusExt},
    path::{Path, PathBuf},
    process::{ExitStatus, Output},
    sync::Mutex,
};

use serde_json::Value;
use tokio::{process::Command, sync::watch, time::Instant};

use super::{
    MAX_DIAGNOSTIC_BYTES, MAX_PDF_BYTES,
    assets::{Assets, BUNDLE_TARGET, FORMAT_TARGET},
    files::Space,
    lifecycle::Engine,
    process, scratch_bytes, spec,
};

#[derive(Debug)]
pub enum Failure {
    Io(io::Error),
    Process(process::Failure),
    Exit(Output),
    Metadata,
    Ownership,
    Controls,
    CreationUncertain,
}

impl std::fmt::Display for Failure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Self::Exit(output) = self {
            write!(
                formatter,
                "Compiler process failed: {}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            )
        } else {
            write!(formatter, "{self:?}")
        }
    }
}

// This adapter is not an isolation proof. Application compilation remains gated separately.
pub struct Client {
    program: PathBuf,
    host: String,
    assets: Assets,
    pending_creates: Mutex<HashSet<String>>,
}

impl Client {
    pub fn local(socket: &Path, assets: Assets) -> io::Result<Self> {
        if !socket.is_absolute() || !fs::metadata(socket)?.file_type().is_socket() {
            return Err(io::Error::other(
                "The compiler requires a local Unix socket.",
            ));
        }
        let socket = fs::canonicalize(socket)?;
        let path = socket
            .to_str()
            .filter(|path| !path.chars().any(|c| c.is_control() || c == '?' || c == '#'))
            .ok_or_else(|| io::Error::other("The Docker socket path is not supported."))?;
        Ok(Self {
            program: "/usr/local/bin/docker".into(),
            host: format!("unix://{path}"),
            assets,
            pending_creates: Mutex::default(),
        })
    }

    pub async fn check_image(
        &self,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<(), Failure> {
        let output = checked(
            self.call(
                vec!["image".into(), "inspect".into(), spec::IMAGE.into()],
                deadline,
                cancelled,
            )
            .await?,
        )?;
        let objects: Vec<Value> =
            serde_json::from_slice(&output.stdout).map_err(|_| Failure::Metadata)?;
        if objects.len() != 1 {
            return Err(Failure::Metadata);
        }
        verify_image(&objects[0])
    }

    async fn call(
        &self,
        args: Vec<OsString>,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<Output, Failure> {
        let mut command = Command::new(&self.program);
        command.arg("--host").arg(&self.host).args(args);
        for name in [
            "DOCKER_CONTEXT",
            "DOCKER_HOST",
            "DOCKER_TLS_VERIFY",
            "DOCKER_CERT_PATH",
            "DOCKER_API_VERSION",
        ] {
            command.env_remove(name);
        }
        process::run(&mut command, deadline, cancelled)
            .await
            .map_err(Failure::Process)
    }

    async fn find(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<Option<String>, Failure> {
        let output = checked(
            self.call(
                vec![
                    "container".into(),
                    "ls".into(),
                    "--all".into(),
                    "--no-trunc".into(),
                    "--filter".into(),
                    format!("name=^/{}$", spec::container_name(space.lease())).into(),
                    "--format".into(),
                    "{{.ID}}".into(),
                ],
                deadline,
                cancelled,
            )
            .await?,
        )?;
        if output.stdout.iter().all(u8::is_ascii_whitespace) {
            Ok(None)
        } else {
            identifier(&output.stdout).map(Some)
        }
    }

    async fn inspect(
        &self,
        space: &Space,
        id: &str,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<Value, Failure> {
        let output = checked(
            self.call(
                vec!["inspect".into(), "--type=container".into(), id.into()],
                deadline,
                cancelled,
            )
            .await?,
        )?;
        owned_inspection(space, id, &output.stdout)
    }
}

fn checked(output: Output) -> Result<Output, Failure> {
    if output.status.success() {
        Ok(output)
    } else {
        Err(Failure::Exit(output))
    }
}

fn identifier(bytes: &[u8]) -> Result<String, Failure> {
    let id = std::str::from_utf8(bytes)
        .map_err(|_| Failure::Metadata)?
        .trim();
    if id.len() != 64
        || !id
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(Failure::Metadata);
    }
    Ok(id.to_owned())
}

fn owned_inspection(space: &Space, id: &str, bytes: &[u8]) -> Result<Value, Failure> {
    if bytes.len() > MAX_DIAGNOSTIC_BYTES {
        return Err(Failure::Metadata);
    }
    identifier(id.as_bytes())?;
    let mut data: Vec<Value> = serde_json::from_slice(bytes).map_err(|_| Failure::Metadata)?;
    if data.len() != 1 {
        return Err(Failure::Metadata);
    }
    let data = data.remove(0);
    if data["Id"] != id
        || data["Image"] != spec::IMAGE
        || data["Name"] != format!("/{}", spec::container_name(space.lease()))
        || data["Config"]["Labels"]["texgen.application"] != "rust-web"
        || data["Config"]["Labels"]["texgen.job"] != space.lease().id()
    {
        return Err(Failure::Ownership);
    }
    Ok(data)
}

fn empty_array(value: &Value) -> bool {
    value.is_null() || value.as_array().is_some_and(Vec::is_empty)
}

fn verify_controls(space: &Space, assets: &Assets, data: &Value) -> Result<(), Failure> {
    use serde_json::json;
    let required = [
        ("/Config/User", json!("10001:10001")),
        ("/Config/WorkingDir", json!("/scratch")),
        ("/Config/Entrypoint", json!(["/compiler/tectonic"])),
        ("/Config/Cmd", json!(spec::COMPILE_ARGS)),
        ("/Config/Tty", json!(false)),
        ("/Config/OpenStdin", json!(false)),
        ("/State/Running", json!(false)),
        ("/HostConfig/ReadonlyRootfs", json!(true)),
        ("/HostConfig/NetworkMode", json!("none")),
        ("/HostConfig/IpcMode", json!("none")),
        ("/HostConfig/Memory", json!(536870912)),
        ("/HostConfig/MemorySwap", json!(536870912)),
        ("/HostConfig/NanoCpus", json!(1000000000)),
        ("/HostConfig/PidsLimit", json!(32)),
        ("/HostConfig/Privileged", json!(false)),
        ("/HostConfig/CapDrop", json!(["ALL"])),
        ("/HostConfig/LogConfig/Type", json!("none")),
        (
            "/HostConfig/Ulimits",
            json!([{"Name": "fsize", "Soft": MAX_PDF_BYTES, "Hard": MAX_PDF_BYTES}]),
        ),
    ];
    if required
        .iter()
        .any(|(path, expected)| data.pointer(path) != Some(expected))
    {
        return Err(Failure::Controls);
    }
    let host = &data["HostConfig"];
    for field in [
        "CapAdd",
        "Binds",
        "VolumesFrom",
        "Devices",
        "DeviceRequests",
        "DeviceCgroupRules",
    ] {
        if !empty_array(&host[field]) {
            return Err(Failure::Controls);
        }
    }
    for field in ["PidMode", "UTSMode", "UsernsMode"] {
        if host[field].as_str().is_none_or(|value| !value.is_empty()) {
            return Err(Failure::Controls);
        }
    }
    let options = host["SecurityOpt"].as_array().ok_or(Failure::Controls)?;
    if options.len() != 1
        || !matches!(
            options[0].as_str(),
            Some("no-new-privileges" | "no-new-privileges=true")
        )
    {
        return Err(Failure::Controls);
    }
    let env = data["Config"]["Env"].as_array().ok_or(Failure::Controls)?;
    if [
        "HOME=/scratch",
        "XDG_CACHE_HOME=/scratch",
        "TECTONIC_CACHE_DIR=/scratch",
    ]
    .iter()
    .any(|entry| !env.iter().any(|value| value == entry))
    {
        return Err(Failure::Controls);
    }
    let scratch = scratch_bytes(space.source_bytes().map_err(Failure::Io)?)
        .map_err(io::Error::other)
        .map_err(Failure::Io)?;
    let tmpfs = host["Tmpfs"].as_object().ok_or(Failure::Controls)?;
    if tmpfs.len() != 1
        || tmpfs.get("/scratch").and_then(Value::as_str)
            != Some(
                format!("rw,noexec,nosuid,nodev,size={scratch},uid=10001,gid=10001,mode=0700")
                    .as_str(),
            )
    {
        return Err(Failure::Controls);
    }
    let mounts = data["Mounts"].as_array().ok_or(Failure::Controls)?;
    let binds: Vec<_> = mounts
        .iter()
        .filter(|mount| mount["Type"] == "bind")
        .collect();
    if binds.len() != 4 || mounts.len() > 5 {
        return Err(Failure::Controls);
    }
    for (path, target, writable) in [
        (space.input_path(), "/scratch/input.tex", false),
        (space.output_path(), "/scratch/input.pdf", true),
        (assets.bundle.clone(), BUNDLE_TARGET, false),
        (assets.format.clone(), FORMAT_TARGET, false),
    ] {
        if binds
            .iter()
            .filter(|mount| {
                mount["Source"].as_str() == path.to_str()
                    && mount["Destination"] == target
                    && mount["RW"] == writable
            })
            .count()
            != 1
        {
            return Err(Failure::Controls);
        }
    }
    if mounts
        .iter()
        .filter(|mount| mount["Type"] != "bind")
        .any(|mount| {
            mount["Type"] != "tmpfs"
                || mount["Destination"] != "/scratch"
                || mount["RW"] != true
                || mount["Source"]
                    .as_str()
                    .is_some_and(|source| !source.is_empty())
        })
    {
        return Err(Failure::Controls);
    }
    Ok(())
}

fn verify_image(data: &Value) -> Result<(), Failure> {
    if data["Id"] != spec::IMAGE
        || data["Os"] != "linux"
        || data["Architecture"] != "arm64"
        || data["Config"]["User"] != "10001:10001"
        || data["Config"]["Entrypoint"] != serde_json::json!(["/compiler/tectonic"])
        || !data["Config"]["Volumes"].is_null()
    {
        return Err(Failure::Controls);
    }
    Ok(())
}

#[test]
fn runtime_image_metadata_requires_the_exact_retained_image_and_fixed_entrypoint() {
    let valid = serde_json::json!({"Id":spec::IMAGE, "Os":"linux", "Architecture":"arm64",
        "Config":{"User":"10001:10001", "Entrypoint":["/compiler/tectonic"], "Volumes":null}});
    assert!(verify_image(&valid).is_ok());
    for (key, value) in [
        ("Id", serde_json::json!("other")),
        ("Architecture", serde_json::json!("amd64")),
        ("Config", serde_json::json!({"User":"root"})),
    ] {
        let mut invalid = valid.clone();
        invalid[key] = value;
        assert!(verify_image(&invalid).is_err());
    }
}

impl Engine for Client {
    type Error = Failure;

    async fn create(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<(), Failure> {
        let args = spec::create_arguments(space, &self.assets).map_err(Failure::Io)?;
        self.pending_creates
            .lock()
            .map_err(|_| Failure::CreationUncertain)?
            .insert(space.lease().id().to_owned());
        let output = checked(self.call(args, deadline, cancelled.clone()).await?)?;
        let id = identifier(&output.stdout)?;
        self.pending_creates
            .lock()
            .map_err(|_| Failure::CreationUncertain)?
            .remove(space.lease().id());
        let data = self.inspect(space, &id, deadline, cancelled).await?;
        verify_controls(space, &self.assets, &data)
    }

    async fn start(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> Result<Output, Failure> {
        let id = self
            .find(space, deadline, cancelled.clone())
            .await?
            .ok_or(Failure::Metadata)?;
        let data = self
            .inspect(space, &id, deadline, cancelled.clone())
            .await?;
        verify_controls(space, &self.assets, &data)?;
        if data["State"]["Running"] != false {
            return Err(Failure::Controls);
        }
        let mut output = checked(
            self.call(
                vec!["start".into(), "--attach".into(), id.clone().into()],
                deadline,
                cancelled.clone(),
            )
            .await?,
        )?;
        let ended = self.inspect(space, &id, deadline, cancelled).await?;
        if ended["State"]["Running"] != false
            || ended["State"]["Status"] != "exited"
            || ended["State"]["Error"] != ""
        {
            return Err(Failure::Metadata);
        }
        let code = ended["State"]["ExitCode"]
            .as_u64()
            .filter(|code| *code <= 255)
            .ok_or(Failure::Metadata)?;
        output.status = ExitStatus::from_raw((code as i32) << 8);
        Ok(output)
    }

    async fn remove(&self, space: &Space, deadline: Instant) -> Result<(), Failure> {
        // Cleanup must finish even after the request owner has cancelled the job.
        let (_sender, cancelled) = watch::channel(false);
        if let Some(id) = self.find(space, deadline, cancelled.clone()).await? {
            self.inspect(space, &id, deadline, cancelled.clone())
                .await?;
            checked(
                self.call(
                    vec!["rm".into(), "--force".into(), id.into()],
                    deadline,
                    cancelled.clone(),
                )
                .await?,
            )?;
            if self.find(space, deadline, cancelled).await?.is_some() {
                return Err(Failure::Metadata);
            }
        }
        // An empty list does not settle a create request whose reply was lost.
        if self
            .pending_creates
            .lock()
            .map_err(|_| Failure::CreationUncertain)?
            .contains(space.lease().id())
        {
            return Err(Failure::CreationUncertain);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::{files::tests::Root, jobs::Jobs};
    use serde_json::json;

    #[test]
    fn foreign_labels_never_establish_container_ownership() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let id = "1".repeat(64);
        let data = json!([{
            "Id": id, "Image": spec::IMAGE,
            "Name": format!("/{}", spec::container_name(space.lease())),
            "Config": {"Labels": {"texgen.application": "rust-web", "texgen.job": "foreign"}}
        }]);
        let rejected = owned_inspection(&space, &id, &serde_json::to_vec(&data).unwrap()).is_err();
        space.cleanup().unwrap();
        assert!(rejected);
    }

    fn inspection(space: &Space) -> Value {
        let input_path = space.input_path();
        let assets = Assets::fixture(input_path.parent().and_then(Path::parent).unwrap());
        let scratch = scratch_bytes(space.source_bytes().unwrap()).unwrap();
        json!({
            "Id": "1".repeat(64), "Image": spec::IMAGE,
            "Name": format!("/{}", spec::container_name(space.lease())),
            "Config": {
                "Labels": {"texgen.application": "rust-web", "texgen.job": space.lease().id()},
                "User": "10001:10001", "WorkingDir": "/scratch", "Entrypoint": ["/compiler/tectonic"],
                "Cmd": spec::COMPILE_ARGS, "Tty": false, "OpenStdin": false,
                "Env": ["HOME=/scratch", "XDG_CACHE_HOME=/scratch", "TECTONIC_CACHE_DIR=/scratch"]
            },
            "HostConfig": {
                "ReadonlyRootfs": true, "NetworkMode": "none", "IpcMode": "none",
                "Memory": 536870912, "MemorySwap": 536870912, "NanoCpus": 1000000000,
                "PidsLimit": 32, "Privileged": false, "CapDrop": ["ALL"], "CapAdd": null,
                "Binds": null, "VolumesFrom": null, "Devices": null, "DeviceRequests": null,
                "DeviceCgroupRules": null, "PidMode": "", "UTSMode": "", "UsernsMode": "",
                "SecurityOpt": ["no-new-privileges"], "LogConfig": {"Type": "none"},
                "Ulimits": [{"Name": "fsize", "Soft": MAX_PDF_BYTES, "Hard": MAX_PDF_BYTES}],
                "Tmpfs": {"/scratch": format!("rw,noexec,nosuid,nodev,size={scratch},uid=10001,gid=10001,mode=0700")}
            },
            "Mounts": [
                {"Type": "bind", "Source": space.input_path(), "Destination": "/scratch/input.tex", "RW": false},
                {"Type": "bind", "Source": space.output_path(), "Destination": "/scratch/input.pdf", "RW": true},
                {"Type": "bind", "Source": assets.bundle, "Destination": BUNDLE_TARGET, "RW": false},
                {"Type": "bind", "Source": assets.format, "Destination": FORMAT_TARGET, "RW": false}
            ],
            "State": {"Running": false, "Status": "created", "ExitCode": 0, "Error": "", "OOMKilled": false}
        })
    }

    #[test]
    fn ownership_requires_the_exact_id_image_name_and_both_labels() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let data = inspection(&space);
        let id = "1".repeat(64);
        assert!(
            owned_inspection(
                &space,
                &id,
                &serde_json::to_vec(&json!([data.clone()])).unwrap()
            )
            .is_ok()
        );
        for (pointer, value) in [
            ("/Id", json!("2".repeat(64))),
            ("/Image", json!("other-image")),
            ("/Name", json!("/other-job")),
            ("/Config/Labels/texgen.application", json!("foreign")),
            ("/Config/Labels/texgen.job", json!("foreign")),
        ] {
            let mut changed = data.clone();
            *changed.pointer_mut(pointer).unwrap() = value;
            assert!(matches!(
                owned_inspection(&space, &id, &serde_json::to_vec(&json!([changed])).unwrap()),
                Err(Failure::Ownership)
            ));
        }
        for bytes in [b"null".as_slice(), b"[]", b"[{},{}]", b"not-json"] {
            assert!(owned_inspection(&space, &id, bytes).is_err());
        }
        assert!(owned_inspection(&space, &id, &vec![b' '; MAX_DIAGNOSTIC_BYTES + 1]).is_err());
        space.cleanup().unwrap();
    }

    #[test]
    fn metadata_must_match_the_requested_process_and_resource_controls() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let data = inspection(&space);
        let assets = Assets::fixture(&root.0);
        verify_controls(&space, &assets, &data).unwrap();
        for (pointer, value) in [
            ("/Config/User", json!("0")),
            ("/Config/Cmd", json!(["--version"])),
            ("/Config/Entrypoint", json!(["/bin/sh"])),
            ("/Config/Env", json!([])),
            ("/Config/Tty", json!(true)),
            ("/Config/OpenStdin", json!(true)),
            ("/HostConfig/ReadonlyRootfs", json!(false)),
            ("/HostConfig/NetworkMode", json!("host")),
            ("/HostConfig/IpcMode", json!("host")),
            ("/HostConfig/Memory", json!(0)),
            ("/HostConfig/MemorySwap", json!(-1)),
            ("/HostConfig/NanoCpus", json!(0)),
            ("/HostConfig/PidsLimit", json!(0)),
            ("/HostConfig/Privileged", json!(true)),
            ("/HostConfig/CapDrop", json!([])),
            ("/HostConfig/CapAdd", json!(["SYS_ADMIN"])),
            ("/HostConfig/LogConfig/Type", json!("json-file")),
            ("/HostConfig/Ulimits", json!([])),
            ("/HostConfig/SecurityOpt", json!(["seccomp=unconfined"])),
            ("/HostConfig/Binds", json!(["/:/host"])),
            ("/HostConfig/Devices", json!([{}])),
            ("/HostConfig/DeviceRequests", json!([{}])),
            ("/HostConfig/DeviceCgroupRules", json!(["a *:* rwm"])),
            ("/HostConfig/VolumesFrom", json!(["other"])),
            ("/HostConfig/PidMode", json!("host")),
            ("/HostConfig/UTSMode", json!("host")),
            ("/HostConfig/UsernsMode", json!("host")),
            ("/HostConfig/Tmpfs", json!({"/scratch": "size=1g"})),
            ("/Mounts/0/RW", json!(true)),
            ("/Mounts/0/Source", json!("/foreign")),
            ("/Mounts/1/Destination", json!("/host")),
        ] {
            let mut changed = data.clone();
            *changed.pointer_mut(pointer).unwrap() = value;
            assert!(
                verify_controls(&space, &assets, &changed).is_err(),
                "Accepted changed control: {pointer}"
            );
        }
        let mut changed = data.clone();
        changed["Mounts"]
            .as_array_mut()
            .unwrap()
            .push(json!({"Type":"bind","Source":"/","Destination":"/host","RW":true}));
        assert!(verify_controls(&space, &assets, &changed).is_err());
        space.cleanup().unwrap();
    }

    #[test]
    fn identifiers_are_full_single_lowercase_container_ids() {
        assert!(identifier(format!("{}\n", "a".repeat(64)).as_bytes()).is_ok());
        for id in [
            "a".repeat(12),
            "g".repeat(64),
            "A".repeat(64),
            format!("{}\n{}", "a".repeat(64), "b".repeat(64)),
            "--force".to_owned(),
        ] {
            assert!(identifier(id.as_bytes()).is_err());
        }
    }

    #[test]
    fn a_client_requires_a_real_local_unix_socket_without_contacting_a_daemon() {
        let root = Root::new();
        let socket = root.0.join("daemon.sock");
        let _listener = std::os::unix::net::UnixListener::bind(&socket).unwrap();
        let assets = Assets::fixture(&root.0);
        let client = Client::local(&socket, assets.clone()).unwrap();
        assert_eq!(
            client.host,
            format!("unix://{}", fs::canonicalize(&socket).unwrap().display())
        );
        assert_eq!(client.program, Path::new("/usr/local/bin/docker"));
        let file = root.0.join("not-a-socket");
        fs::write(&file, b"file").unwrap();
        assert!(Client::local(&file, assets.clone()).is_err());
        assert!(Client::local(Path::new("relative.sock"), assets).is_err());
    }

    fn fake_client(root: &Root, space: &Space, mode: &str) -> Client {
        use std::os::unix::fs::PermissionsExt;
        let mut created = inspection(space);
        if mode == "foreign" {
            created["Config"]["Labels"]["texgen.job"] = json!("foreign");
        }
        if mode == "controls" {
            created["HostConfig"]["Memory"] = json!(0);
        }
        let mut ended = created.clone();
        ended["State"]["Status"] = json!("exited");
        ended["State"]["ExitCode"] = json!(if mode == "exit7" { 7 } else { 0 });
        fs::write(
            root.0.join("created.json"),
            serde_json::to_vec(&json!([created])).unwrap(),
        )
        .unwrap();
        fs::write(
            root.0.join("ended.json"),
            serde_json::to_vec(&json!([ended])).unwrap(),
        )
        .unwrap();
        fs::write(root.0.join("mode"), format!("{mode}\n")).unwrap();
        fs::write(
            root.0.join("output-path"),
            format!("{}\n", space.output_path().display()),
        )
        .unwrap();
        let program = root.0.join("fake-docker");
        fs::write(&program, r#"#!/bin/sh
set -eu
base=${0%/*}
[ "$1" = --host ] && [ "$2" = unix:///texgen-fake.sock ] || exit 90
shift 2
printf '%s\n' "$1" >> "$base/commands"
IFS= read -r mode < "$base/mode"
id=1111111111111111111111111111111111111111111111111111111111111111
case "$1" in
  create)
    if [ "$mode" = create-delayed ]; then
      : > "$base/create-submitted"
      exec /bin/sleep 10
    fi
    : > "$base/created"
    [ "$mode" != partial ] || exit 42
    printf '%s\n' "$id"
    ;;
  container)
    [ "$mode" != list-error ] || exit 42
    if [ "$mode" = create-delayed ] && [ ! -f "$base/created" ]; then
      : > "$base/created"
      exit 0
    fi
    if [ -f "$base/created" ] && [ ! -f "$base/deleted" ]; then printf '%s\n' "$id"; fi
    ;;
  inspect)
    if [ -f "$base/started" ]; then /bin/cat "$base/ended.json"; else /bin/cat "$base/created.json"; fi
    ;;
  start)
    : > "$base/started"
    if [ "$mode" = start-slow ]; then exec /bin/sleep 1; fi
    IFS= read -r destination < "$base/output-path"
    printf 'candidate bytes' > "$destination"
    printf 'fake diagnostics'
    ;;
  rm)
    [ "$mode" != remove-error ] || exit 42
    [ "$2" = --force ] && [ "$3" = "$id" ] || exit 91
    : > "$base/deleted"
    ;;
  *) exit 92 ;;
esac
"#).unwrap();
        fs::set_permissions(&program, fs::Permissions::from_mode(0o700)).unwrap();
        Client {
            program,
            host: "unix:///texgen-fake.sock".to_owned(),
            assets: Assets::fixture(&root.0),
            pending_creates: Mutex::default(),
        }
    }

    #[tokio::test]
    async fn delayed_creation_after_cancel_and_an_empty_listing_keeps_files_and_blocks_admission() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let input = space.input_path();
        let owner = space.lease().cancel_on_drop();
        let client = fake_client(&root, &space, "create-delayed");
        let cancel = async {
            // Parallel process fixtures can delay the fake CLI's first write.
            tokio::time::timeout(tokio::time::Duration::from_secs(5), async {
                while !root.0.join("create-submitted").exists() {
                    tokio::time::sleep(tokio::time::Duration::from_millis(1)).await;
                }
            })
            .await
            .unwrap();
            drop(owner);
        };
        let (outcome, ()) =
            tokio::join!(crate::compiler::lifecycle::execute(&client, space), cancel);
        assert!(matches!(
            &outcome,
            crate::compiler::lifecycle::Outcome::Blocked { .. }
        ));
        assert!(input.exists());
        assert!(root.0.join("created").exists());
        assert!(!root.0.join("deleted").exists());
        assert_eq!(
            fs::read_to_string(root.0.join("commands")).unwrap(),
            "create\ncontainer\n"
        );
        drop(outcome);
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn fake_executable_exercises_create_start_remove_and_absence_confirmation() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let input = space.input_path();
        let client = fake_client(&root, &space, "normal");
        match crate::compiler::lifecycle::execute(&client, space).await {
            crate::compiler::lifecycle::Outcome::Finished(Ok(candidate)) => {
                assert_eq!(candidate.bytes, b"candidate bytes");
                assert_eq!(candidate.diagnostics.stdout, b"fake diagnostics");
            }
            _ => panic!("The fake CLI lifecycle failed."),
        }
        assert_eq!(
            fs::read_to_string(root.0.join("commands")).unwrap(),
            "create\ninspect\ncontainer\ninspect\nstart\ninspect\ncontainer\ninspect\nrm\ncontainer\n"
        );
        assert!(!input.exists());
        assert!(jobs.begin().is_ok());
    }

    #[tokio::test]
    async fn foreign_metadata_never_reaches_start_or_remove() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let client = fake_client(&root, &space, "foreign");
        assert!(matches!(
            crate::compiler::lifecycle::execute(&client, space).await,
            crate::compiler::lifecycle::Outcome::Blocked {
                failure: crate::compiler::lifecycle::Failure::Engine(Failure::Ownership),
                ..
            }
        ));
        assert!(!root.0.join("started").exists());
        assert!(!root.0.join("deleted").exists());
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn bad_controls_and_partial_create_failures_remove_only_the_owned_container() {
        for mode in ["controls", "partial"] {
            let root = Root::new();
            let jobs = Jobs::default();
            let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
            space.prepare("source").unwrap();
            let input = space.input_path();
            let client = fake_client(&root, &space, mode);
            let outcome = crate::compiler::lifecycle::execute(&client, space).await;
            assert!(!root.0.join("started").exists());
            assert!(root.0.join("deleted").exists());
            if mode == "partial" {
                assert!(matches!(
                    &outcome,
                    crate::compiler::lifecycle::Outcome::Blocked {
                        failure: crate::compiler::lifecycle::Failure::Engine(
                            Failure::CreationUncertain
                        ),
                        ..
                    }
                ));
                assert!(input.exists());
                drop(outcome);
                assert!(matches!(
                    jobs.begin(),
                    Err(crate::compiler::jobs::Failure::Unavailable)
                ));
            } else {
                assert!(matches!(
                    outcome,
                    crate::compiler::lifecycle::Outcome::Finished(Err(
                        crate::compiler::lifecycle::Failure::Engine(_)
                    ))
                ));
                assert!(!input.exists());
                assert!(jobs.begin().is_ok());
            }
        }
    }

    #[tokio::test]
    async fn listing_or_removal_errors_are_not_treated_as_container_absence() {
        for mode in ["list-error", "remove-error"] {
            let root = Root::new();
            let jobs = Jobs::default();
            let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
            space.prepare("source").unwrap();
            let client = fake_client(&root, &space, mode);
            assert!(matches!(
                crate::compiler::lifecycle::execute(&client, space).await,
                crate::compiler::lifecycle::Outcome::Blocked { .. }
            ));
            assert!(!root.0.join("deleted").exists());
            assert!(matches!(
                jobs.begin(),
                Err(crate::compiler::jobs::Failure::Unavailable)
            ));
        }
    }

    #[tokio::test]
    async fn container_exit_status_is_used_even_when_the_cli_reports_success() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let client = fake_client(&root, &space, "exit7");
        match crate::compiler::lifecycle::execute(&client, space).await {
            crate::compiler::lifecycle::Outcome::Finished(Err(
                crate::compiler::lifecycle::Failure::Compile(output),
            )) => assert_eq!(output.status.code(), Some(7)),
            _ => panic!("Container failure became a successful candidate."),
        }
        assert!(root.0.join("deleted").exists());
        assert!(jobs.begin().is_ok());
    }

    #[tokio::test]
    async fn cleanup_ignores_owner_cancellation_and_does_not_delete_an_absent_container() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let client = fake_client(&root, &space, "normal");
        client
            .create(
                &space,
                space.lease().deadline(),
                space.lease().cancellation(),
            )
            .await
            .unwrap();
        jobs.cancel(space.lease().id()).unwrap();
        client
            .remove(&space, space.lease().deadline())
            .await
            .unwrap();
        client
            .remove(&space, space.lease().deadline())
            .await
            .unwrap();
        assert!(root.0.join("deleted").exists());
        assert_eq!(
            fs::read_to_string(root.0.join("commands"))
                .unwrap()
                .lines()
                .filter(|line| *line == "rm")
                .count(),
            1
        );
        space.cleanup().unwrap();
    }

    #[tokio::test]
    async fn a_timed_out_cli_is_reaped_before_owned_container_cleanup() {
        let root = Root::new();
        let mut space = Space::create(&root.0, Jobs::default().begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let client = fake_client(&root, &space, "start-slow");
        client
            .create(
                &space,
                space.lease().deadline(),
                space.lease().cancellation(),
            )
            .await
            .unwrap();
        let result = client
            .start(
                &space,
                Instant::now() + tokio::time::Duration::from_millis(30),
                space.lease().cancellation(),
            )
            .await;
        assert!(matches!(
            result,
            Err(Failure::Process(process::Failure::TimedOut))
        ));
        client
            .remove(&space, space.lease().deadline())
            .await
            .unwrap();
        assert!(root.0.join("deleted").exists());
        space.cleanup().unwrap();
    }
}
