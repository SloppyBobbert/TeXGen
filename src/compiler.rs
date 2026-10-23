#[cfg(unix)]
pub mod assets;
#[cfg(unix)]
pub mod cli;
#[cfg(unix)]
pub mod files;
#[cfg(unix)]
pub mod http;
pub mod jobs;
#[cfg(unix)]
pub mod lifecycle;
pub mod process;
#[cfg(unix)]
pub mod runtime;
#[cfg(unix)]
pub mod service;
#[cfg(unix)]
pub mod spec;

const MIB: usize = 1024 * 1024;

pub const MAX_SOURCE_BYTES: usize = 20 * MIB;
pub const MAX_PDF_BYTES: usize = 10 * MIB;
pub const MAX_DIAGNOSTIC_BYTES: usize = 64 * 1024;
pub const MAX_JOB_BYTES: usize = 64 * MIB;

pub fn scratch_bytes(source_bytes: usize) -> Result<usize, &'static str> {
    if source_bytes > MAX_SOURCE_BYTES {
        return Err("The rendered source exceeds the compiler input limit.");
    }
    let remaining = MAX_JOB_BYTES - source_bytes - MAX_PDF_BYTES - MAX_DIAGNOSTIC_BYTES;
    Ok(remaining / MIB * MIB)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn input_output_and_scratch_fit_the_job_storage_limit() {
        for source_bytes in [0, 500_000, MAX_SOURCE_BYTES] {
            let scratch = scratch_bytes(source_bytes).unwrap();
            assert_eq!(scratch % MIB, 0);
            assert!(scratch > 0);
            assert!(source_bytes + MAX_PDF_BYTES + MAX_DIAGNOSTIC_BYTES + scratch <= MAX_JOB_BYTES);
        }
    }

    #[test]
    fn oversized_source_is_rejected_before_budget_arithmetic() {
        assert!(scratch_bytes(MAX_SOURCE_BYTES + 1).is_err());
        assert!(scratch_bytes(usize::MAX).is_err());
    }
}
