use std::sync::atomic::{AtomicBool, Ordering};

pub struct Session {
    launch: String,
    cookie: String,
    claimed: AtomicBool,
}

impl Session {
    pub fn new() -> Result<Self, getrandom::Error> {
        Ok(Self {
            launch: random_secret()?,
            cookie: random_secret()?,
            claimed: AtomicBool::new(false),
        })
    }

    pub fn launch_fragment(&self) -> String {
        format!("#launch={}", self.launch)
    }

    pub fn claim(&self, authorization: &str) -> bool {
        let Some(token) = authorization.strip_prefix("Bearer ") else {
            return false;
        };
        equal_secret(token, &self.launch)
            && self
                .claimed
                .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .is_ok()
    }

    pub fn cookie_header(&self) -> String {
        format!(
            "texgen_session={}; Path=/api; HttpOnly; SameSite=Strict",
            self.cookie
        )
    }

    pub fn authorizes(&self, cookies: &str) -> bool {
        cookies.split(';').any(|part| {
            part.trim()
                .strip_prefix("texgen_session=")
                .is_some_and(|value| equal_secret(value, &self.cookie))
        })
    }
}

fn random_secret() -> Result<String, getrandom::Error> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes)?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn equal_secret(left: &str, right: &str) -> bool {
    left.len() == right.len()
        && left
            .bytes()
            .zip(right.bytes())
            .fold(0_u8, |difference, (a, b)| difference | (a ^ b))
            == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_is_single_use_and_cookies_are_independent() {
        let session = Session::new().unwrap();
        assert_eq!(session.launch.len(), 64);
        assert_ne!(session.launch, session.cookie);
        assert!(!session.claim("Bearer wrong"));
        assert!(session.claim(&format!("Bearer {}", session.launch)));
        assert!(!session.claim(&format!("Bearer {}", session.launch)));
        assert!(session.authorizes(&format!("other=value; texgen_session={}", session.cookie)));
        assert!(!session.authorizes(&format!("texgen_session={}x", session.cookie)));
        assert!(!session.authorizes(&format!("texgen_session={}", session.launch)));
    }
}
