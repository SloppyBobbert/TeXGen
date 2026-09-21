# Independent production/security review — round 3

**FAIL — 95% (19/20).** Findings: **1 must-fix, 0 should-fix, 0 consider**. Failed checklist item: **17**. The score clears 94%, but the must-fix finding prevents acceptance.

## Identity and review method

- Worktree: `/Users/brandontran/TeXGen/.slim/worktrees/document-sections`.
- Branch: `fix/document-sections`; HEAD/base: `114b4ca7c02a19952fb454a13db91f5d5e743139`.
- All **35 implementation file SHA-256 values match** `specs/verifications/e01s03-review-round3-manifest.json`.
- Independently reproduced aggregate **`5067515e926227a7cc064eef34b8bd55bfba972fec15ffe52a3c07bae61f534e`**, calculated from compact, sorted JSON of the path-to-SHA-256 mapping.
- Complete patch: 137,038 bytes; SHA-256 `e3b499e13e81f208a594a17f34a46bc5d4cf58e7e265eba932f40d62953803ad`. Every tracked patch block matches `git diff 114b4ca -- <path>`; every added-file block matches its actual file contents.
- Read all 35 implementation files, using bounded patch reads for added files and full current-source reads for modified behavior. The approved frontend lock received hash and structured comparison: unchanged root/direct requirements, 41 changed versions, one addition (`@humanfs/types`), no removals or major-version changes.
- Read the production specification, round-3 checks, final checks and review-response context. Traced compiler selection/admission, throttle registration, rendering, ownership, frontend retry behavior and verification callers. Did not read another reviewer's report or monitoring reports.
- No tests, containers, installations, network requests or delegates were run. No source, metadata or Git state was changed. The Git index was empty at both inspections. This report is the only written artifact, outside the worktree.

## Finding

### R3-B-1 — Must-fix: preflight supervisors still survive cancellation of the outer shell

**Location:** `scripts/verify-production.sh:39-43`, with cleanup/signal handlers installed only at `:65-67`; `scripts/verification_support.py:57-75`.

The repaired `run()` and `capture()` now correctly keep `active_pid` in the outer shell. However, the initial `compose config --quiet`, captured `compose config --images`, and every `docker image inspect` run **before** the restoration handler and INT/TERM traps are installed. The only EXIT handler then present removes the snapshot directory; it does not stop `active_pid`.

If cancellation targets only the outer verifier PID during one of these calls, the supervisor receives no forwarded signal. Its command was started in a new session, so it is not killed with the outer shell. The supervisor and command can continue until the 600-second deadline. An inherited stderr pipe can also keep a calling process waiting after the shell terminates. These are read-only preflight commands, so this does not establish a database mutation or leftover Docker container, but it still violates the verifier's complete child-cleanup/cancellation contract and leaves the accepted outer-PID failure class on reachable paths.

The round-3 regressions cover browser and captured lookup cancellation after startup/budget escalation, not these earlier calls. This finding is from static control-flow inspection; I did not run a reproduction.

**Minimal repair:** install an early, non-mutating cancellation/EXIT handler before the first supervised preflight call. It should terminate and wait for the active supervisor, remove the private snapshot, and exit nonzero. Keep database validation before any handler that may run `compose up`; do not solve this by moving the mutating restoration handler ahead of validation. Reuse that child-stop logic in the later restoration handler. Add one fake-Docker outer-PID cancellation regression at an image-inspection or configuration-capture stage, requiring descendant termination, snapshot removal, nonzero exit and no mutating Docker commands, without increasing the existing bound.

## Twenty-item checklist

| # | Result | Check and evidence |
|---|---|---|
| 1 | PASS | Source identity and scope: all 35 hashes, aggregate, branch/base and patch-to-source equality verified. |
| 2 | PASS | Separate Linux runtime targets: production uses nonroot Gunicorn/static Nginx; existing development targets remain defaults. |
| 3 | PASS | Production configuration: rejects DEBUG, weak keys, SQLite, wildcard hosts and local compiler; local HTTP is limited to loopback hosts. |
| 4 | PASS | Private proxy boundary: no backend TCP publication, UID/GID-restricted Unix socket, overwritten forwarding headers, Django does not separately trust raw scheme headers. |
| 5 | PASS | Database privilege and startup ordering: separately quoted application password, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION role, migrations/static collection gate backend startup. |
| 6 | PASS | Shared throttling concurrency: PostgreSQL row locking and unique primary key serialize admission; first-insert and existing-row cases have dedicated PostgreSQL tests. |
| 7 | PASS | Throttle integration: normal API defaults and explicit compile throttle both route through shared admission; database errors fail closed, health remains exempt, expiry deletion rechecks age. |
| 8 | PASS | Compile accounting: READY precedes quota, START follows quota, canceled pre-admission work does not execute, accepted failure remains charged. |
| 9 | PASS | Raw/manual authority: existing source-mode selection and shared renderer remain intact; full raw documents pass through unchanged. |
| 10 | PASS | Ownership and unsafe writes: owner-filtered retrieval/update and administrator-only template mutations remain; frontend retries only GET/HEAD, not unsafe writes. |
| 11 | PASS | Compiler isolation: no compiler image change; network-none, read-only root, restricted writable storage, dropped capabilities, process/memory/swap/CPU/output/restart controls retained. |
| 12 | PASS | Runtime deadlines: approved READY wait 5 seconds; connection 1, compile 15, worker 30 unchanged; no runtime retry addition. |
| 13 | PASS | Dependency scope: approved Gunicorn/Nginx/pip pins and exact frontend candidate; Python constraints explicitly do not claim artifact-hash reproducibility. |
| 14 | PASS | CI implementation: pinned actions, coverage floor, required PostgreSQL cases, migration drift, audits, strict frontend checks and final production verifier; acquisition is outside the no-download verifier. Fresh CI result remains pending. |
| 15 | PASS | Browser assertions: Save visibility, request/status/title, dialog, toast, saved status and reload assertions are unconditional; verifier forces one worker and zero retries. |
| 16 | PASS | Pre-migration database isolation: ambient Compose substitutions rejected, backend and migration URLs restricted to owned database without URL options, private snapshots reused with literal-dollar escaping. |
| 17 | FAIL | Cancellation coverage is incomplete before restoration traps are installed. See R3-B-1. Browser and later captured-lookup repairs themselves are correct. |
| 18 | PASS | Created Docker resource cleanup: names/UUID labels assigned before creation, outer cleanup repeats discovery, each owned removal attempted despite prior failures, unrelated resources are not selected. |
| 19 | PASS | Fault recovery and budget restoration: outage probes verify fail-closed behavior and recovery; later exit handling restores dependencies and live budget 60 and preserves failure status. Test-only budget 600 is disclosed. |
| 20 | PASS | Tests and maintenance: focused fake-process/Docker regressions, standard-library helpers and explicit limitations; parent execution evidence is substantial but is not represented as reviewer-run testing. |

## Reviewed implementation inventory

1. `.github/workflows/ci.yml`
2. `.gitignore`
3. `backend/Dockerfile`
4. `backend/Dockerfile.dockerignore`
5. `backend/api/compilation/service.py`
6. `backend/api/compilation/sidecar.py`
7. `backend/api/migrations/0016_request_throttle_window.py`
8. `backend/api/models.py`
9. `backend/api/request_throttle.py`
10. `backend/api/test_production_config.py`
11. `backend/api/test_production_runtime.py`
12. `backend/api/test_request_throttle.py`
13. `backend/api/test_sidecar_admission.py`
14. `backend/api/test_verification_safety.py`
15. `backend/api/views.py`
16. `backend/cheat_sheet/production.py`
17. `backend/cheat_sheet/settings.py`
18. `backend/gunicorn.conf.py`
19. `backend/requirements-bootstrap.txt`
20. `backend/requirements.lock`
21. `backend/requirements.txt`
22. `backend/tests/test_request_throttle_postgres.py`
23. `docker-compose.production.yml`
24. `frontend/.dockerignore`
25. `frontend/Dockerfile`
26. `frontend/e2e/create.spec.js`
27. `frontend/nginx.conf`
28. `frontend/package-lock.json` — hash/structured comparison
29. `frontend/scripts/check-production-image.py`
30. `scripts/check-production-failures.py`
31. `scripts/check-production-stack.py`
32. `scripts/check-proxy-scheme.py`
33. `scripts/init-production-db.sh`
34. `scripts/verification_support.py`
35. `scripts/verify-production.sh`

## Execution evidence and limits

Parent-provided evidence: `baddd4e89` passed 474 backend tests with 96.88% coverage, seven separate PostgreSQL cases, 244 frontend tests, lint/build/migration checks, repaired runtime verifier and 39 browser tests; live budget returned to 60. `ba0cc1fa2` passed 15 focused tests and syntax/lint checks. I inspected the relevant tests but did not rerun these commands. Their reported success does not cover R3-B-1's earlier cancellation stage.

No implementation file in the manifest was left uninspected. Supporting modules were inspected only as needed, not as a whole-repository audit. Public TLS, WCAG/load/OS-vulnerability certification and the disclosed local HTTP boundary are outside scope. Fresh CI and the targeted repair/regression remain necessary before acceptance.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Completed the assigned read-only review of all 35 frozen implementation files without changing source, metadata or Git state; only wrote this requested external review artifact."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Verified every file hash, aggregate and patch equality; supplied a 20-item checklist, one actionable must-fix finding, explicit score and execution limitations."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff --cached --name-only (initial and final)",
      "result": "passed",
      "summary": "No staged files."
    },
    {
      "command": "git status --short; git branch --show-current; git rev-parse HEAD",
      "result": "passed",
      "summary": "Confirmed candidate worktree, fix/document-sections branch and 114b4ca baseline."
    },
    {
      "command": "Read-only Python hashlib/json manifest and aggregate comparison",
      "result": "passed",
      "summary": "35/35 hashes match; compact sorted-JSON aggregate matches 5067515e926227a7cc064eef34b8bd55bfba972fec15ffe52a3c07bae61f534e."
    },
    {
      "command": "Read-only patch comparison using git diff 114b4ca -- <path> and added-file reconstruction",
      "result": "passed",
      "summary": "All 35 patch blocks agree with current implementation."
    },
    {
      "command": "git show 114b4ca:frontend/package-lock.json plus read-only JSON comparison",
      "result": "passed",
      "summary": "41 version changes, one transitive addition, unchanged direct requirements, no major changes."
    },
    {
      "command": "Tests, containers, installs and network checks",
      "result": "not-run",
      "summary": "Prohibited for this independent read-only review; execution results are attributed to the parent."
    }
  ],
  "validationOutput": [
    "FAIL: 95%, 19/20 checklist items pass; item 17 fails.",
    "Finding counts: 1 must-fix, 0 should-fix, 0 consider.",
    "All 35 implementation files inspected; approved frontend lock inspected structurally."
  ],
  "residualRisks": [
    "Outer-PID cancellation during supervised preflight can leave supervisor/descendants running until the 600-second deadline.",
    "Fresh CI is pending; reviewer did not execute tests.",
    "Python constraints are not a complete artifact-hash lock; excluded certifications remain unclaimed."
  ],
  "noStagedFiles": true,
  "diffSummary": "No implementation changes made by this reviewer.",
  "reviewFindings": [
    "must-fix: scripts/verify-production.sh:39-43 - preflight supervisors start before cancellation/child-cleanup traps at lines 65-67; install non-mutating early cleanup and add a bounded fake-Docker cancellation regression."
  ],
  "manualNotes": "Review-task completion is not candidate acceptance. Candidate FAIL despite 95% because one must-fix remains. Report stored outside the worktree at the requested path."
}
```
