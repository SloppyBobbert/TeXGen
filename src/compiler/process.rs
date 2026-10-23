use std::{
    io,
    process::{Output, Stdio},
    sync::atomic::{AtomicUsize, Ordering},
};

use tokio::{
    io::{AsyncRead, AsyncReadExt},
    process::Command,
    sync::watch,
    time::{Instant, sleep_until},
};

use super::MAX_DIAGNOSTIC_BYTES;

#[derive(Debug)]
pub enum Failure {
    Io(io::Error),
    TimedOut,
    Cancelled,
    OutputLimit,
}

async fn read_bounded(
    mut stream: impl AsyncRead + Unpin,
    total: &AtomicUsize,
) -> Result<Vec<u8>, Failure> {
    let mut output = Vec::new();
    let mut buffer = [0_u8; 4096];
    loop {
        let count = stream.read(&mut buffer).await.map_err(Failure::Io)?;
        if count == 0 {
            return Ok(output);
        }
        let previous = total.fetch_add(count, Ordering::Relaxed);
        if previous > MAX_DIAGNOSTIC_BYTES - count {
            return Err(Failure::OutputLimit);
        }
        output.extend_from_slice(&buffer[..count]);
    }
}

pub async fn run(
    command: &mut Command,
    deadline: Instant,
    mut cancelled: watch::Receiver<bool>,
) -> Result<Output, Failure> {
    if *cancelled.borrow() || cancelled.has_changed().is_err() {
        return Err(Failure::Cancelled);
    }
    if Instant::now() >= deadline {
        return Err(Failure::TimedOut);
    }
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(Failure::Io)?;
    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");
    let total = AtomicUsize::new(0);
    let readers =
        async { tokio::try_join!(read_bounded(stdout, &total), read_bounded(stderr, &total)) };
    tokio::pin!(readers);
    let mut status = None;
    let mut streams = None;
    let failure = loop {
        tokio::select! {
            biased;
            changed = cancelled.changed() => {
                if changed.is_err() || *cancelled.borrow() {
                    break Failure::Cancelled;
                }
            },
            _ = sleep_until(deadline) => break Failure::TimedOut,
            result = &mut readers, if streams.is_none() => match result {
                Ok(output) => streams = Some(output),
                Err(error) => break error,
            },
            result = child.wait(), if status.is_none() => match result {
                Ok(exit) => status = Some(exit),
                Err(error) => break Failure::Io(error),
            },
        }
        if let Some(status) = status
            && let Some((stdout, stderr)) = streams.take()
        {
            return Ok(Output {
                status,
                stdout,
                stderr,
            });
        }
    };
    if let Err(error) = child.kill().await {
        if child.try_wait().map_err(Failure::Io)?.is_none() {
            return Err(Failure::Io(error));
        }
        child.wait().await.map_err(Failure::Io)?;
    }
    Err(failure)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::MAX_DIAGNOSTIC_BYTES;
    use tokio::time::Duration;

    #[tokio::test]
    async fn output_past_the_diagnostic_limit_is_rejected() {
        let (_sender, receiver) = watch::channel(false);
        let mut command = Command::new("/usr/bin/head");
        command
            .arg("-c")
            .arg((MAX_DIAGNOSTIC_BYTES + 1).to_string())
            .arg("/dev/zero");
        let result = run(
            &mut command,
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await;
        assert!(matches!(result, Err(Failure::OutputLimit)));
    }

    #[tokio::test]
    async fn output_at_the_exact_limit_is_retained() {
        let (_sender, receiver) = watch::channel(false);
        let mut command = Command::new("/usr/bin/head");
        command
            .arg("-c")
            .arg(MAX_DIAGNOSTIC_BYTES.to_string())
            .arg("/dev/zero");
        let output = run(
            &mut command,
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await
        .unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout.len(), MAX_DIAGNOSTIC_BYTES);
        assert!(output.stderr.is_empty());
    }

    #[tokio::test]
    async fn stdout_and_stderr_share_one_limit() {
        let (_sender, receiver) = watch::channel(false);
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "head -c 32768 /dev/zero; head -c 32769 /dev/zero >&2"]);
        let result = run(
            &mut command,
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await;
        assert!(matches!(result, Err(Failure::OutputLimit)));
    }

    #[tokio::test]
    async fn failed_commands_keep_their_exit_status_and_diagnostics() {
        let (_sender, receiver) = watch::channel(false);
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "printf error >&2; exit 7"]);
        let output = run(
            &mut command,
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await
        .unwrap();
        assert_eq!(output.status.code(), Some(7));
        assert_eq!(output.stderr, b"error");
    }

    #[tokio::test]
    async fn timeout_kills_and_waits_for_the_child() {
        let (_sender, receiver) = watch::channel(false);
        let mut command = Command::new("/bin/sleep");
        command.arg("1");
        let started = Instant::now();
        let result = run(&mut command, started + Duration::from_millis(30), receiver).await;
        assert!(matches!(result, Err(Failure::TimedOut)));
        assert!(started.elapsed() < Duration::from_secs(1));
    }

    #[tokio::test]
    async fn cancellation_stops_a_running_child() {
        let (sender, receiver) = watch::channel(false);
        let cancel = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(30)).await;
            sender.send(true).unwrap();
        });
        let mut command = Command::new("/bin/sleep");
        command.arg("1");
        let result = run(
            &mut command,
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await;
        cancel.await.unwrap();
        assert!(matches!(result, Err(Failure::Cancelled)));
    }

    #[tokio::test]
    async fn cancelled_or_expired_work_does_not_start_a_process() {
        let (_sender, receiver) = watch::channel(true);
        let mut command = Command::new("/texgen-test/no-such-program");
        assert!(matches!(
            run(
                &mut command,
                Instant::now() + Duration::from_secs(5),
                receiver
            )
            .await,
            Err(Failure::Cancelled)
        ));
        let (_sender, receiver) = watch::channel(false);
        assert!(matches!(
            run(&mut command, Instant::now(), receiver).await,
            Err(Failure::TimedOut)
        ));
    }

    #[tokio::test]
    async fn a_closed_owner_cancels_before_process_creation() {
        let (sender, receiver) = watch::channel(false);
        drop(sender);
        let mut command = Command::new("/texgen-test/no-such-program");
        assert!(matches!(
            run(
                &mut command,
                Instant::now() + Duration::from_secs(5),
                receiver
            )
            .await,
            Err(Failure::Cancelled)
        ));
    }

    #[tokio::test]
    async fn a_false_update_does_not_cancel_work() {
        let (sender, receiver) = watch::channel(false);
        sender.send(false).unwrap();
        let mut command = Command::new("/usr/bin/printf");
        command.arg("ready");
        let output = run(
            &mut command,
            Instant::now() + Duration::from_secs(5),
            receiver,
        )
        .await
        .unwrap();
        assert_eq!(output.stdout, b"ready");
    }
}
