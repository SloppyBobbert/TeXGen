use std::{
    io::ErrorKind,
    net::TcpListener,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[test]
fn occupied_port_stops_before_browser_launch_or_credential_output() {
    let occupied = match TcpListener::bind(texgen::ADDRESS) {
        Ok(listener) => Some(listener),
        Err(error) if error.kind() == ErrorKind::AddrInUse => None,
        Err(error) => panic!("The stable test port cannot be checked: {error}"),
    };
    let mut child = Command::new(env!("CARGO_BIN_EXE_texgen"))
        .env("TEXGEN_NO_BROWSER", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(5);
    while child.try_wait().unwrap().is_none() {
        if Instant::now() >= deadline {
            child.kill().unwrap();
            child.wait().unwrap();
            panic!("The port-conflict check did not exit before its deadline.");
        }
        thread::sleep(Duration::from_millis(10));
    }
    let output = child.wait_with_output().unwrap();
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
    let error = String::from_utf8(output.stderr).unwrap();
    assert!(error.contains("Cannot use http://127.0.0.1:3737"));
    assert!(!error.contains("#launch="));
    assert!(!error.contains("Bearer"));
    drop(occupied);
}
