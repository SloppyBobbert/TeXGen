use std::{
    fmt::Display,
    fs, io,
    os::unix::fs::{DirBuilderExt, PermissionsExt},
    path::PathBuf,
    sync::Arc,
};

use tokio::sync::{Mutex, oneshot};
use tokio::task::JoinHandle;

use super::{
    files::Space,
    jobs::{self, CancelOnDrop, Jobs},
    lifecycle::{self, Candidate, Engine, Outcome},
};

#[derive(Debug)]
pub enum Failure {
    Identity,
    Unavailable,
    Admission(jobs::Failure),
    Files(io::Error),
    Compile(String),
}

struct Running {
    request: String,
    job: String,
}

#[derive(Default)]
struct State {
    active: Option<Running>,
    worker: Option<JoinHandle<()>>,
    blocked: Option<Space>,
    closing: bool,
}

pub struct Compiler<E> {
    engine: E,
    root: PathBuf,
    jobs: Jobs,
    state: Mutex<State>,
}

pub struct Ticket {
    receiver: oneshot::Receiver<Result<Candidate, Failure>>,
    _cancel_on_drop: CancelOnDrop,
}

impl Ticket {
    pub async fn finish(&mut self) -> Result<Candidate, Failure> {
        (&mut self.receiver)
            .await
            .map_err(|_| Failure::Unavailable)?
    }
}

impl<E> Compiler<E>
where
    E: Engine + Send + 'static,
    E::Error: Display,
{
    // Production callers must construct the engine with verified immutable assets.
    pub fn new(root: PathBuf, engine: E) -> io::Result<Arc<Self>> {
        match fs::DirBuilder::new().mode(0o700).create(&root) {
            Err(error) if error.kind() != io::ErrorKind::AlreadyExists => return Err(error),
            _ => {}
        }
        let metadata = fs::symlink_metadata(&root)?;
        if !metadata.is_dir()
            || metadata.permissions().mode() & 0o077 != 0
            || fs::read_dir(&root)?.next().is_some()
        {
            return Err(io::Error::other(
                "The compiler job root is not private and empty. Preserve it for cleanup review.",
            ));
        }
        Ok(Arc::new(Self {
            engine,
            root: fs::canonicalize(root)?,
            jobs: Jobs::default(),
            state: Mutex::new(State::default()),
        }))
    }

    pub async fn begin(
        self: &Arc<Self>,
        request: String,
        source: String,
    ) -> Result<Ticket, Failure> {
        if request.len() != 64
            || !request
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return Err(Failure::Identity);
        }
        let mut state = self.state.lock().await;
        if state.closing || state.blocked.is_some() {
            return Err(Failure::Unavailable);
        }
        let lease = self.jobs.begin().map_err(Failure::Admission)?;
        let owner = lease.cancel_on_drop();
        let job = lease.id().to_owned();
        state.active = Some(Running {
            request,
            job: job.clone(),
        });
        let (sender, receiver) = oneshot::channel();
        let compiler = Arc::clone(self);
        state.worker = Some(tokio::spawn(async move {
            let result = compiler.execute(lease, &source).await;
            let mut state = compiler.state.lock().await;
            if state
                .active
                .as_ref()
                .is_some_and(|active| active.job == job)
            {
                state.active = None;
            }
            drop(state);
            let _ = sender.send(result);
        }));
        Ok(Ticket {
            receiver,
            _cancel_on_drop: owner,
        })
    }

    async fn execute(&self, lease: jobs::Lease, source: &str) -> Result<Candidate, Failure> {
        let mut space = Space::create(&self.root, lease).map_err(Failure::Files)?;
        if let Err(error) = space.prepare(source) {
            if space.cleanup().is_err() {
                space.lease().stop_admission();
                self.state.lock().await.blocked = Some(space);
                return Err(Failure::Unavailable);
            }
            return Err(Failure::Files(error));
        }
        match lifecycle::execute(&self.engine, space).await {
            Outcome::Finished(result) => {
                let candidate = result.map_err(|error| {
                    Failure::Compile(match error {
                        lifecycle::Failure::Engine(error) => error.to_string(),
                        lifecycle::Failure::Compile(output) => format!(
                            "{}{}",
                            String::from_utf8_lossy(&output.stdout),
                            String::from_utf8_lossy(&output.stderr)
                        ),
                        lifecycle::Failure::Cancelled => "Compilation was cancelled.".into(),
                        lifecycle::Failure::TimedOut => "Compilation exceeded its deadline.".into(),
                        lifecycle::Failure::DiagnosticsLimit => {
                            "Compiler diagnostics exceeded their byte limit.".into()
                        }
                        lifecycle::Failure::Files(error) => error.to_string(),
                    })
                })?;
                let diagnostics = format!(
                    "{}{}",
                    String::from_utf8_lossy(&candidate.diagnostics.stdout),
                    String::from_utf8_lossy(&candidate.diagnostics.stderr)
                )
                .to_lowercase();
                if diagnostics.contains("overfull \\hbox")
                    || diagnostics.contains("overfull \\vbox")
                {
                    return Err(Failure::Compile("The compiler detected an overfull layout. The source and last valid PDF are unchanged.".into()));
                }
                Ok(candidate)
            }
            Outcome::Blocked { space, .. } => {
                self.state.lock().await.blocked = Some(space);
                Err(Failure::Unavailable)
            }
        }
    }

    pub async fn cancel(&self, request: &str) -> Result<bool, Failure> {
        let state = self.state.lock().await;
        if let Some(active) = &state.active
            && active.request == request
        {
            return self.jobs.cancel(&active.job).map_err(Failure::Admission);
        }
        Ok(false)
    }

    pub async fn shutdown(&self) -> Result<(), Failure> {
        let worker = {
            let mut state = self.state.lock().await;
            state.closing = true;
            if let Some(active) = &state.active {
                self.jobs.cancel(&active.job).map_err(Failure::Admission)?;
            }
            state.worker.take()
        };
        if let Some(worker) = worker {
            worker.await.map_err(|_| Failure::Unavailable)?;
        }
        if self.state.lock().await.blocked.is_some() {
            return Err(Failure::Unavailable);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compiler::files::tests::Root;
    use std::{
        os::unix::process::ExitStatusExt,
        process::{ExitStatus, Output},
        sync::atomic::{AtomicUsize, Ordering},
    };
    use tokio::{
        sync::{Notify, watch},
        time::Instant,
    };

    struct Fake {
        started: Arc<Notify>,
        removed: Arc<AtomicUsize>,
        release: watch::Receiver<bool>,
        fail_remove: bool,
        diagnostics: Vec<u8>,
    }
    impl Engine for Fake {
        type Error = &'static str;
        async fn create(
            &self,
            _: &Space,
            _: Instant,
            _: watch::Receiver<bool>,
        ) -> Result<(), Self::Error> {
            Ok(())
        }
        async fn start(
            &self,
            space: &Space,
            _: Instant,
            mut cancelled: watch::Receiver<bool>,
        ) -> Result<Output, Self::Error> {
            self.started.notify_one();
            let mut release = self.release.clone();
            while !*release.borrow() && !*cancelled.borrow() {
                tokio::select! { _ = release.changed() => {}, _ = cancelled.changed() => {} }
            }
            fs::write(space.output_path(), b"candidate").unwrap();
            Ok(Output {
                status: ExitStatus::from_raw(0),
                stdout: self.diagnostics.clone(),
                stderr: vec![],
            })
        }
        async fn remove(&self, _: &Space, _: Instant) -> Result<(), Self::Error> {
            self.removed.fetch_add(1, Ordering::SeqCst);
            if self.fail_remove {
                Err("uncertain cleanup")
            } else {
                Ok(())
            }
        }
    }
    fn fixture(
        root: &Root,
        fail_remove: bool,
    ) -> (
        Arc<Compiler<Fake>>,
        watch::Sender<bool>,
        Arc<Notify>,
        Arc<AtomicUsize>,
    ) {
        let (release, receiver) = watch::channel(false);
        let started = Arc::new(Notify::new());
        let removed = Arc::new(AtomicUsize::new(0));
        let compiler = Compiler::new(
            root.0.clone(),
            Fake {
                started: started.clone(),
                removed: removed.clone(),
                release: receiver,
                fail_remove,
                diagnostics: vec![],
            },
        )
        .unwrap();
        (compiler, release, started, removed)
    }
    fn owner(letter: char) -> String {
        letter.to_string().repeat(64)
    }

    #[tokio::test]
    async fn detected_overfull_layout_is_rejected_after_cleanup() {
        let root = Root::new();
        let (mut compiler, release, _, removed) = fixture(&root, false);
        Arc::get_mut(&mut compiler).unwrap().engine.diagnostics =
            b"Overfull \\hbox (20pt too wide)".to_vec();
        release.send_replace(true);
        let mut ticket = compiler.begin(owner('a'), "source".into()).await.unwrap();
        assert!(
            matches!(ticket.finish().await, Err(Failure::Compile(message)) if message.contains("overfull"))
        );
        assert_eq!(removed.load(Ordering::SeqCst), 1);
        assert!(fs::read_dir(&root.0).unwrap().next().is_none());
        compiler.shutdown().await.unwrap();
    }

    #[tokio::test]
    async fn one_request_owns_cancellation_and_stale_owners_cannot_cancel_its_replacement() {
        let root = Root::new();
        let (compiler, _release, started, removed) = fixture(&root, false);
        let mut first = compiler.begin(owner('a'), "source".into()).await.unwrap();
        started.notified().await;
        assert!(matches!(
            compiler.begin(owner('b'), "other".into()).await,
            Err(Failure::Admission(jobs::Failure::Busy))
        ));
        assert!(!compiler.cancel(&owner('b')).await.unwrap());
        assert!(compiler.cancel(&owner('a')).await.unwrap());
        assert!(first.finish().await.is_err());
        assert_eq!(removed.load(Ordering::SeqCst), 1);
        assert!(fs::read_dir(&root.0).unwrap().next().is_none());
        let mut next = compiler
            .begin(owner('b'), "replacement".into())
            .await
            .unwrap();
        assert!(!compiler.cancel(&owner('a')).await.unwrap());
        compiler.cancel(&owner('b')).await.unwrap();
        assert!(next.finish().await.is_err());
        compiler.shutdown().await.unwrap();
    }

    #[tokio::test]
    async fn dropped_http_owner_cancels_but_the_worker_finishes_cleanup() {
        let root = Root::new();
        let (compiler, _release, started, removed) = fixture(&root, false);
        let ticket = compiler.begin(owner('a'), "source".into()).await.unwrap();
        started.notified().await;
        drop(ticket);
        compiler.shutdown().await.unwrap();
        assert_eq!(removed.load(Ordering::SeqCst), 1);
        assert!(fs::read_dir(&root.0).unwrap().next().is_none());
        assert!(matches!(
            compiler.begin(owner('b'), "source".into()).await,
            Err(Failure::Unavailable)
        ));
    }

    #[tokio::test]
    async fn shutdown_cancels_a_still_owned_job_and_waits_for_cleanup() {
        let root = Root::new();
        let (compiler, release, started, removed) = fixture(&root, false);
        let mut ticket = compiler.begin(owner('a'), "source".into()).await.unwrap();
        started.notified().await;
        tokio::time::timeout(std::time::Duration::from_secs(1), compiler.shutdown())
            .await
            .unwrap()
            .unwrap();
        assert!(!*release.borrow());
        assert!(ticket.finish().await.is_err());
        assert_eq!(removed.load(Ordering::SeqCst), 1);
        assert!(fs::read_dir(&root.0).unwrap().next().is_none());
        assert!(matches!(
            compiler.begin(owner('b'), "source".into()).await,
            Err(Failure::Unavailable)
        ));
        compiler.shutdown().await.unwrap();
    }

    #[tokio::test]
    async fn uncertain_cleanup_retains_files_and_permanently_blocks_admission() {
        let root = Root::new();
        let (compiler, release, _, _) = fixture(&root, true);
        release.send_replace(true);
        let mut ticket = compiler.begin(owner('a'), "source".into()).await.unwrap();
        assert!(matches!(ticket.finish().await, Err(Failure::Unavailable)));
        assert!(fs::read_dir(&root.0).unwrap().next().is_some());
        assert!(matches!(
            compiler.begin(owner('b'), "source".into()).await,
            Err(Failure::Unavailable)
        ));
        assert!(compiler.shutdown().await.is_err());
    }

    #[tokio::test]
    async fn success_returns_only_a_candidate_after_cleanup_and_preserves_source() {
        let root = Root::new();
        let (compiler, release, _, removed) = fixture(&root, false);
        release.send_replace(true);
        let mut ticket = compiler
            .begin(owner('a'), "raw source".into())
            .await
            .unwrap();
        assert_eq!(ticket.finish().await.unwrap().bytes, b"candidate");
        assert_eq!(removed.load(Ordering::SeqCst), 1);
        assert!(fs::read_dir(&root.0).unwrap().next().is_none());
        compiler.shutdown().await.unwrap();
    }
}
