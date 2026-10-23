use std::{future::Future, io, process::Output};

use tokio::{
    sync::watch,
    time::{Duration, Instant},
};

use super::{MAX_DIAGNOSTIC_BYTES, files::Space};

// Implementations must honor deadlines and cancellation, and reap their child processes.
pub trait Engine: Sync {
    type Error: Send;

    fn create(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    fn start(
        &self,
        space: &Space,
        deadline: Instant,
        cancelled: watch::Receiver<bool>,
    ) -> impl Future<Output = Result<Output, Self::Error>> + Send;
    fn remove(
        &self,
        space: &Space,
        deadline: Instant,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

#[derive(Debug)]
pub enum Failure<E> {
    Engine(E),
    Cancelled,
    TimedOut,
    Compile(Output),
    DiagnosticsLimit,
    Files(io::Error),
}

// These bytes must pass PDF validation before publication.
pub struct Candidate {
    pub bytes: Vec<u8>,
    pub diagnostics: Output,
}

#[must_use = "Retain blocked job files until container cleanup is confirmed."]
pub enum Outcome<E> {
    Finished(Result<Candidate, Failure<E>>),
    Blocked { space: Space, failure: Failure<E> },
}

fn interruption<E>(cancelled: &watch::Receiver<bool>, deadline: Instant) -> Option<Failure<E>> {
    if *cancelled.borrow() {
        Some(Failure::Cancelled)
    } else if Instant::now() >= deadline {
        Some(Failure::TimedOut)
    } else {
        None
    }
}

pub async fn execute<E: Engine>(engine: &E, mut space: Space) -> Outcome<E::Error> {
    let deadline = space.lease().deadline();
    // Reserve five seconds for container removal within the original job deadline.
    let execution_deadline = deadline - Duration::from_secs(5);
    let cancelled = space.lease().cancellation();
    let mut attempted = false;
    let execution = if let Some(failure) = interruption(&cancelled, execution_deadline) {
        Err(failure)
    } else {
        attempted = true;
        match engine
            .create(&space, execution_deadline, cancelled.clone())
            .await
        {
            Err(error) => Err(Failure::Engine(error)),
            Ok(()) => {
                if let Some(failure) = interruption(&cancelled, execution_deadline) {
                    Err(failure)
                } else {
                    engine
                        .start(&space, execution_deadline, cancelled.clone())
                        .await
                        .map_err(Failure::Engine)
                }
            }
        }
    };
    if attempted && let Err(error) = engine.remove(&space, deadline).await {
        space.lease().stop_admission();
        return Outcome::Blocked {
            space,
            failure: Failure::Engine(error),
        };
    }
    let result = execution.and_then(|diagnostics| {
        if let Some(failure) = interruption(&cancelled, deadline) {
            return Err(failure);
        }
        if diagnostics
            .stdout
            .len()
            .checked_add(diagnostics.stderr.len())
            .is_none_or(|length| length > MAX_DIAGNOSTIC_BYTES)
        {
            return Err(Failure::DiagnosticsLimit);
        }
        if !diagnostics.status.success() {
            return Err(Failure::Compile(diagnostics));
        }
        space
            .read_output()
            .map(|bytes| Candidate { bytes, diagnostics })
            .map_err(Failure::Files)
    });
    if let Err(error) = space.cleanup() {
        space.lease().stop_admission();
        return Outcome::Blocked {
            space,
            failure: Failure::Files(error),
        };
    }
    if result.is_ok()
        && let Some(failure) = interruption(&cancelled, deadline)
    {
        return Outcome::Finished(Err(failure));
    }
    Outcome::Finished(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::{files::tests::Root, jobs::Jobs};
    use std::{fs, os::unix::process::ExitStatusExt, process::ExitStatus, sync::Mutex};

    struct Fake {
        fail_at: &'static str,
        events: Mutex<Vec<&'static str>>,
    }

    impl Fake {
        fn new(fail_at: &'static str) -> Self {
            Self {
                fail_at,
                events: Mutex::new(Vec::new()),
            }
        }
    }

    impl Engine for Fake {
        type Error = &'static str;

        async fn create(
            &self,
            space: &Space,
            deadline: Instant,
            _cancelled: watch::Receiver<bool>,
        ) -> Result<(), Self::Error> {
            self.events.lock().unwrap().push("create");
            assert_eq!(space.lease().deadline() - deadline, Duration::from_secs(5));
            if self.fail_at == "cancel-create" {
                drop(space.lease().cancel_on_drop());
            }
            if self.fail_at == "create" {
                Err("create failed")
            } else {
                Ok(())
            }
        }

        async fn start(
            &self,
            space: &Space,
            _deadline: Instant,
            _cancelled: watch::Receiver<bool>,
        ) -> Result<Output, Self::Error> {
            self.events.lock().unwrap().push("start");
            if self.fail_at == "pending-start" {
                return std::future::pending().await;
            }
            if self.fail_at == "start" {
                return Err("start failed");
            }
            if self.fail_at != "empty" {
                fs::write(space.output_path(), b"candidate bytes").unwrap();
            }
            let status = ExitStatus::from_raw(if self.fail_at == "nonzero" { 7 << 8 } else { 0 });
            let stdout = if self.fail_at == "diagnostics" {
                vec![0; MAX_DIAGNOSTIC_BYTES + 1]
            } else {
                Vec::new()
            };
            Ok(Output {
                status,
                stdout,
                stderr: Vec::new(),
            })
        }

        async fn remove(&self, space: &Space, deadline: Instant) -> Result<(), Self::Error> {
            self.events.lock().unwrap().push("remove");
            assert_eq!(space.lease().deadline(), deadline);
            if self.fail_at == "cancel-remove" {
                drop(space.lease().cancel_on_drop());
            }
            if self.fail_at == "files" {
                let directory = space.input_path().parent().unwrap().to_path_buf();
                fs::rename(&directory, directory.with_extension("parked")).unwrap();
                fs::write(&directory, b"not a directory").unwrap();
            }
            if self.fail_at == "remove" {
                Err("cleanup failed")
            } else {
                Ok(())
            }
        }
    }

    #[tokio::test]
    async fn success_removes_the_container_and_job_files_before_returning_bytes() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let input = space.input_path();
        let engine = Fake::new("");
        match execute(&engine, space).await {
            Outcome::Finished(Ok(candidate)) => assert_eq!(candidate.bytes, b"candidate bytes"),
            _ => panic!("A successful job did not return its candidate output."),
        }
        assert_eq!(
            *engine.events.lock().unwrap(),
            ["create", "start", "remove"]
        );
        assert!(!input.exists());
        assert!(jobs.begin().is_ok());
    }

    #[tokio::test]
    async fn dropping_an_unpolled_worker_blocks_new_jobs_without_deleting_files() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let input = space.input_path();
        let engine = Fake::new("");
        drop(execute(&engine, space));
        assert!(input.exists());
        assert!(engine.events.lock().unwrap().is_empty());
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn dropping_a_suspended_worker_blocks_new_jobs_without_assuming_removal() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let input = space.input_path();
        let engine = Fake::new("pending-start");
        let mut worker = Box::pin(execute(&engine, space));
        let pending = std::future::poll_fn(|context| {
            std::task::Poll::Ready(worker.as_mut().poll(context).is_pending())
        })
        .await;
        assert!(pending);
        drop(worker);
        assert!(input.exists());
        assert_eq!(*engine.events.lock().unwrap(), ["create", "start"]);
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn create_and_start_failures_still_require_container_removal() {
        for fault in ["create", "start"] {
            let root = Root::new();
            let jobs = Jobs::default();
            let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
            space.prepare("source").unwrap();
            let input = space.input_path();
            let engine = Fake::new(fault);
            assert!(matches!(
                execute(&engine, space).await,
                Outcome::Finished(Err(Failure::Engine(_)))
            ));
            let expected = if fault == "create" {
                vec!["create", "remove"]
            } else {
                vec!["create", "start", "remove"]
            };
            assert_eq!(*engine.events.lock().unwrap(), expected);
            assert!(!input.exists());
            assert!(jobs.begin().is_ok());
        }
    }

    #[tokio::test]
    async fn failed_container_cleanup_blocks_admission_even_after_the_result_is_dropped() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let input = space.input_path();
        let engine = Fake::new("remove");
        match execute(&engine, space).await {
            Outcome::Blocked {
                space,
                failure: Failure::Engine("cleanup failed"),
            } => {
                assert!(input.exists());
                drop(space);
            }
            _ => panic!("Uncertain container cleanup did not block the job."),
        }
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn failed_file_cleanup_blocks_admission() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        assert!(matches!(
            execute(&Fake::new("files"), space).await,
            Outcome::Blocked {
                failure: Failure::Files(_),
                ..
            }
        ));
        assert!(matches!(
            jobs.begin(),
            Err(crate::compiler::jobs::Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn cancelled_work_does_not_create_a_container() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        jobs.cancel(space.lease().id()).unwrap();
        let engine = Fake::new("");
        assert!(matches!(
            execute(&engine, space).await,
            Outcome::Finished(Err(Failure::Cancelled))
        ));
        assert!(engine.events.lock().unwrap().is_empty());
        assert!(jobs.begin().is_ok());
    }

    #[tokio::test]
    async fn cancellation_after_creation_skips_start_but_not_cleanup() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        let engine = Fake::new("cancel-create");
        assert!(matches!(
            execute(&engine, space).await,
            Outcome::Finished(Err(Failure::Cancelled))
        ));
        assert_eq!(*engine.events.lock().unwrap(), ["create", "remove"]);
        assert!(jobs.begin().is_ok());
    }

    #[tokio::test]
    async fn cancellation_during_cleanup_prevents_candidate_publication() {
        let root = Root::new();
        let jobs = Jobs::default();
        let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
        space.prepare("source").unwrap();
        assert!(matches!(
            execute(&Fake::new("cancel-remove"), space).await,
            Outcome::Finished(Err(Failure::Cancelled))
        ));
        assert!(jobs.begin().is_ok());
    }

    #[tokio::test]
    async fn compiler_errors_empty_output_and_excessive_diagnostics_are_not_candidates() {
        for fault in ["nonzero", "empty", "diagnostics"] {
            let root = Root::new();
            let jobs = Jobs::default();
            let mut space = Space::create(&root.0, jobs.begin().unwrap()).unwrap();
            space.prepare("source").unwrap();
            let engine = Fake::new(fault);
            match (fault, execute(&engine, space).await) {
                ("nonzero", Outcome::Finished(Err(Failure::Compile(output)))) => {
                    assert_eq!(output.status.code(), Some(7))
                }
                ("empty", Outcome::Finished(Err(Failure::Files(_))))
                | ("diagnostics", Outcome::Finished(Err(Failure::DiagnosticsLimit))) => {}
                _ => panic!("Invalid compiler output became a candidate."),
            }
            assert_eq!(engine.events.lock().unwrap().last(), Some(&"remove"));
            assert!(jobs.begin().is_ok());
        }
    }
}
