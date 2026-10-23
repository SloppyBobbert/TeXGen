# Stage 6 compiler-control checks

## Status

The compiler-control helpers have passed local tests. The application compiler remains disabled.
The Docker adapter has passed code-only checks. Its complete regression rerun remains pending.
Actual isolation checks, offline TeX compilation, and PDF validation remain pending.
These results do not clear the earlier image-build budget failure.

## Implemented scope

- `src/compiler.rs` budgets rendered source, PDF output, diagnostics, and scratch within 64 MiB.
- `src/compiler/process.rs` limits combined stdout and stderr to 64 KiB. It closes stdin and handles cancellation and timeout.
- `src/compiler/jobs.rs` admits one job without a job queue. Request-owner loss signals cancellation without releasing the worker slot.
- `src/compiler/files.rs` creates private directories with application-generated IDs. It preserves source bytes and retains the original output descriptor.
- `src/compiler/spec.rs` constructs arguments for the retained image. It requests fixed resource limits and two file-only mounts.
- `src/compiler/lifecycle.rs` coordinates an engine through creation, execution, removal, and file cleanup.
- `tests/compiler_source.rs` checks rendering of 990,000 carets without content loss or a source-budget rejection.

Cleanup uncertainty disables further admission for that admission pool. Dropping the failed result does not reset this state.
The caller must retain blocked files for recovery. There is no automatic reset method.
Dropping an unclean job space also disables admission. This includes unpolled and suspended worker futures.
Drop does not delete mounted files or claim that a container stopped.

The lifecycle reserves five seconds for removal within the original 60-second deadline.
Engine implementations must honor the supplied deadlines, handle cancellation, and reap their child processes.
The lifecycle awaits cleanup. It does not abort an engine future to simulate cleanup.

Output bytes remain a candidate until a separate PDF validation gate passes.
A nonempty bounded file is not proof of a valid PDF.

## Recorded red checks

The following tests ran and failed at their intended assertions before their implementations were added:

- Diagnostic overflow: `approved-command-1792390456576280000.log`.
- Second-job rejection: `approved-command-1792434188372626000.log`.
- Oversized output-file rejection: `approved-command-1792434658044836000.log`.
- Required container controls: `approved-command-1792435108831620000.log`.
- Admission after uncertain cleanup: `approved-command-1792435352085084000.log`.
- Successful lifecycle cleanup: `approved-command-1792435453651395000.log`.
- Dropped-worker admission safety: `approved-command-1792436204047115000.log`.

The earlier storage-budget test attempt did not run. The output monitor rejected startup.
It is not red-test evidence.

## Passed checks

The initial process and storage slice passed 11 compiler checks, one source-expansion check, and strict release-profile Clippy.
Evidence: `approved-command-1792433847542388000.log`.

The admission slice then passed the full Rust suite, strict Clippy, and formatting.
Evidence: `approved-command-1792434473452989000.log`.

The file slice passed eight checks and strict Clippy.
Evidence: `approved-command-1792434756628829000.log`.

The latest focused run passed all 40 compiler checks and strict Clippy.
Evidence: `approved-command-1792435575491185000.log`.
It ended at 446,722,048 monitored bytes, below the unchanged 512 MiB allowance.
The complete Rust suite, strict Clippy, formatting, and whitespace checks then passed.
Evidence: `approved-command-1792435859386032000.log`, ending at 446,963,712 monitored bytes.

The worker-drop correction passed all 42 compiler checks and strict Clippy.
Evidence: `approved-command-1792436244657023000.log`, ending at 446,980,096 monitored bytes.
Its complete Rust suite, strict Clippy, formatting, and whitespace checks passed in `approved-command-1792436330786146000.log`.
That run ended at 446,984,192 monitored bytes.

`src/compiler/cli.rs` then passed 12 metadata and fake-executable checks with strict Clippy.
Evidence: `approved-command-1792441067336156000.log`, ending at 447,553,536 monitored bytes.
These checks reject foreign ownership, incorrect controls, partial-create failures, and ambiguous cleanup results.
They also check container exit status, cleanup after cancellation, and timeout before owned cleanup.

`scripts/stage6_probe.py` passed its ownership, JSON, and preservation self-checks under normal and optimized Python.
The live fixture contract check passed. Both actual Docker fixture tests remained ignored.
Evidence: `approved-command-1792441670166093000.log`, ending at 449,761,280 monitored bytes.
The complete regression run for the adapter and controller is pending.

All command logs are under `/Users/brandontran/TeXGen-backups/pre-rust-2026-10-17/`.
Commands used locked, offline Cargo and release-profile artifacts through the approved monitor.
No Docker or TeX process ran during these checks. No image was built or pulled.
No package was installed. No commit, staging, push, or deployment occurred.

## Automatic-checker budget incident

An automatic Rust checker created a separate 200,712,192-byte debug profile outside the approved monitor.
The following monitored test stopped before execution because the output allowance had been exceeded.
Only the new generated `target/debug` directory was removed.
Project `.pi-lens.json` now excludes automatic Rust scans and disables autofix. Rust LSP denial remains active.
A subsequent Rust edit did not recreate the debug profile.

Explicit Rust tests, formatting, and strict release-profile Clippy remain required through the approved monitor.
No global configuration changed. The allowance was not increased or reset.

## External-editor budget blocker

A later check stopped before Cargo ran because Neovim's Rust analyzer created a 63,393,792-byte debug cache.
Process ancestry identified workspace analyzer PID 96826 under Neovim, not the agent.
The user explicitly approved stopping only that analyzer and deleting its new debug cache.
The process identity and working directory were checked again before termination.
Neovim remained running. Only the new `target/debug` cache was removed.
No source, release artifact, original worktree, global setting, or allowance changed.

## Remaining gates

1. Complete the adapter's full code-only regression gate before real image tests.
   The adapter checks exact IDs, image, name, both ownership labels, and requested controls.
   Successful list responses establish absence; daemon errors do not.
2. The user has approved up to 16 sequential retained-image test jobs after the Docker adapter passes code-only checks.
   Keep the approved limits and original-object preservation rules. No pull, build, or download is authorized.
   A read-only locally generated probe executable may be at most 4 KiB. No job has used this new approval yet.
3. Check actual kernel enforcement, timeout, cancellation, and cleanup. Requested CLI controls are not enforcement evidence.
4. Compile canonical, raw, and adversarial fixtures offline. Check package compatibility and real PDF metadata.
5. Keep compiler APIs and browser PDF controls disabled until these gates pass.
6. Repeat the full workflow, clean-host checks, and original-state preservation checks before release.

The current tests use harmless native process fixtures and a fake lifecycle engine.
A killed Docker client does not prove that its container stopped.
Original-worktree preservation comparisons and browser checks were not repeated in this slice.
