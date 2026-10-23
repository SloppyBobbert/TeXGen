use std::sync::{Arc, Mutex, Weak};

use tokio::{
    sync::watch,
    time::{Duration, Instant},
};

#[derive(Debug)]
pub enum Failure {
    Busy,
    Unavailable,
    Entropy(getrandom::Error),
}

#[derive(Clone, Default)]
pub struct Jobs {
    current: Arc<Mutex<Admission>>,
}

#[derive(Default)]
struct Admission {
    job: Option<Weak<State>>,
    blocked: bool,
}

struct State {
    id: String,
    deadline: Instant,
    cancel: watch::Sender<bool>,
}

// Keep the lease until container and file cleanup finish.
pub struct Lease {
    state: Arc<State>,
    admission: Arc<Mutex<Admission>>,
}

pub struct CancelOnDrop {
    state: Weak<State>,
}

impl Jobs {
    pub fn begin(&self) -> Result<Lease, Failure> {
        let mut current = self.current.lock().map_err(|_| Failure::Unavailable)?;
        if current.blocked {
            return Err(Failure::Unavailable);
        }
        if current.job.as_ref().and_then(Weak::upgrade).is_some() {
            return Err(Failure::Busy);
        }
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes).map_err(Failure::Entropy)?;
        let (cancel, _) = watch::channel(false);
        let state = Arc::new(State {
            id: bytes.iter().map(|byte| format!("{byte:02x}")).collect(),
            deadline: Instant::now() + Duration::from_secs(60),
            cancel,
        });
        current.job = Some(Arc::downgrade(&state));
        Ok(Lease {
            state,
            admission: self.current.clone(),
        })
    }

    pub fn cancel(&self, id: &str) -> Result<bool, Failure> {
        let current = self.current.lock().map_err(|_| Failure::Unavailable)?;
        if let Some(state) = current.job.as_ref().and_then(Weak::upgrade)
            && state.id == id
        {
            state.cancel.send_replace(true);
            return Ok(true);
        }
        Ok(false)
    }
}

impl Lease {
    pub fn stop_admission(&self) {
        // A poisoned admission lock already rejects all work.
        if let Ok(mut admission) = self.admission.lock() {
            admission.blocked = true;
        }
        self.state.cancel.send_replace(true);
    }

    pub fn id(&self) -> &str {
        &self.state.id
    }

    pub fn deadline(&self) -> Instant {
        self.state.deadline
    }

    pub fn cancellation(&self) -> watch::Receiver<bool> {
        self.state.cancel.subscribe()
    }

    pub fn cancel_on_drop(&self) -> CancelOnDrop {
        CancelOnDrop {
            state: Arc::downgrade(&self.state),
        }
    }
}

impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        if let Some(state) = self.state.upgrade() {
            state.cancel.send_replace(true);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_second_job_is_rejected_until_the_first_lease_ends() {
        let jobs = Jobs::default();
        let lease = jobs.begin().unwrap();
        assert!(matches!(jobs.begin(), Err(Failure::Busy)));
        drop(lease);
        assert!(jobs.begin().is_ok());
    }

    #[test]
    fn uncertain_cleanup_disables_new_jobs_even_if_the_failed_lease_is_dropped() {
        let jobs = Jobs::default();
        let lease = jobs.begin().unwrap();
        lease.stop_admission();
        drop(lease);
        assert!(matches!(jobs.clone().begin(), Err(Failure::Unavailable)));
    }

    #[test]
    fn cancellation_does_not_release_the_worker_slot() {
        let jobs = Jobs::default();
        let lease = jobs.begin().unwrap();
        assert!(!jobs.cancel("not-the-active-job").unwrap());
        assert!(!*lease.cancellation().borrow());
        assert!(jobs.cancel(lease.id()).unwrap());
        assert!(*lease.cancellation().borrow());
        assert!(matches!(jobs.begin(), Err(Failure::Busy)));
        drop(lease);
        assert!(jobs.begin().is_ok());
    }

    #[test]
    fn dropping_the_request_owner_cancels_without_releasing_admission() {
        let jobs = Jobs::default();
        let lease = jobs.begin().unwrap();
        let owner = lease.cancel_on_drop();
        drop(owner);
        assert!(*lease.cancellation().borrow());
        assert!(matches!(jobs.begin(), Err(Failure::Busy)));
    }

    #[test]
    fn an_old_request_owner_cannot_cancel_a_new_job() {
        let jobs = Jobs::default();
        let lease = jobs.begin().unwrap();
        let previous_id = lease.id().to_owned();
        let owner = lease.cancel_on_drop();
        drop(lease);
        let replacement = jobs.begin().unwrap();
        drop(owner);
        assert_ne!(replacement.id(), previous_id);
        assert!(!jobs.cancel(&previous_id).unwrap());
        assert!(!*replacement.cancellation().borrow());
    }

    #[test]
    fn a_lease_has_an_application_generated_id_and_bounded_deadline() {
        let lease = Jobs::default().begin().unwrap();
        assert_eq!(lease.id().len(), 64);
        assert!(lease.id().bytes().all(|byte| byte.is_ascii_hexdigit()));
        let remaining = lease.deadline().saturating_duration_since(Instant::now());
        assert!(!remaining.is_zero());
        assert!(remaining <= Duration::from_secs(60));
    }

    #[test]
    fn cloned_admission_handles_share_the_same_slot() {
        let jobs = Jobs::default();
        let lease = jobs.begin().unwrap();
        assert!(matches!(jobs.clone().begin(), Err(Failure::Busy)));
        drop(lease);
        assert!(jobs.clone().begin().is_ok());
    }

    #[test]
    fn concurrent_requests_admit_exactly_one_job() {
        let jobs = Jobs::default();
        let barrier = Arc::new(std::sync::Barrier::new(8));
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let jobs = jobs.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    jobs.begin()
                })
            })
            .collect();
        let results: Vec<_> = workers
            .into_iter()
            .map(|worker| worker.join().unwrap())
            .collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(
            results
                .iter()
                .filter(|result| matches!(result, Err(Failure::Busy)))
                .count(),
            7
        );
    }
}
