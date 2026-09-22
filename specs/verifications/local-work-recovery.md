---
type: verification
context: Selective recovery of local work against main 528ab03cbf71d1cdf7c38648e5a9293b851d7bc5
---

# Local work recovery

Status: local verification and both independent reviews passed; exact-head hosted CI remains required. No cleanup, merge or deployment is approved by this record.

## Scope

Three independent read-only comparisons covered the root tests, the CI worktree's separate staged/unstaged changes, and the phase1 worktree. Most application code is integrated or superseded. This change retains only missing test assertions, four catalog fixtures, generated-output lint exclusions and accessible button-help associations.

The recovered save-reset test exposed an unhandled rejected promise. `App` awaits the original create request, but also creates a shared promise to obtain the new sheet ID. That second promise can reject without a waiter after reset. It now handles its own rejection by returning null. The original request still owns error feedback, cancellation, revision checks and persistence. No compiler policy, migration, ownership rule, dependency or deployment setting changed.

## Local checks

| Check | Evidence | Result |
| --- | --- | --- |
| Baseline | `b964089a3` | 502 backend tests; seven PostgreSQL-only skips; 96.97% coverage; frontend tests, lint/build, backend lint and migration check passed |
| Recovered frontend red check | `b30bc4419` | Expected button-description failure and an unhandled save AbortError; 175 other tests passed |
| First frontend repair | `b3a60929e` | 256 tests passed; lint rejected unqualified DOMException in the new test |
| Final frontend | `bee71a824` | 256 tests; zero-warning lint; production build passed |
| Focused backend | `bdfe88068` | Ruff and 186 tests passed |
| Full backend | `bb972bdd7` | 514 tests; seven PostgreSQL-only skips; 97.06% coverage; lint, migration and whitespace checks passed |
| LSP probe | App and CreateCheatSheet | No diagnostics; server response inconclusive, not proof of clean |

## Browser setup failures and remaining gate

- `b94e07805`: setup error. The isolated development frontend had no API. Accessibility tests need the real catalog, so the run failed and reached its 300-second command limit. This is not passing evidence.
- `b4d502d64`: new frontend on port 5174, existing disposable API on port 5173. All tests ran with one worker and zero retries. 35 passed; four PDF-preview cases failed after compilation. No timeout or assertion was weakened.
- `b89f5b782`: built frontend on port 5174 against that same API. 38 passed, including the prior PDF-preview failures. The last signup failed. Read-only runtime inspection found an anonymous limit of 60 and a saturated window count of 60.
- `b824c6301`: full functional rerun using the existing verifier's validated 600-budget snapshot, with a restoration trap for the 60-budget snapshot. All 39 browser tests passed in 30.5 seconds with one worker and zero retries. The run exited 0 and verified the restored live anonymous budget of 60.

Both exact-root navigation assertions use Playwright's configured baseURL, so the separate test port retains exact origin/path checks. The first browser attempts did not restart Docker services. The final functional run temporarily recreates only the owned disposable backend with the verifier's 600 anonymous budget, then restores 60. It does not build/pull images or change database volumes, compiler restrictions or other stacks. Browser suites create synthetic accounts/documents in the existing disposable test API. No public service was used. A functional pass at 600 is not a default-budget load-capacity result.

## Parent self-review

- PASS: changes retain existing compiler isolation, authentication, ownership, revision and manual-source rules. Permission tests verify rejected mutations leave records unchanged.
- PASS: no new dependencies, credentials, disabled checks, retries or increased test timeouts. Generated-output ignores do not exclude source tests.
- PASS: recovered tests use current canonical IDs, draft identity and API boundaries rather than old subprocess/global-storage assumptions.
- PASS: the only application changes are accessible help associations and the handled auxiliary save promise. No additional request or rendering work is added.
- PASS: regression tests reproduced both application gaps before the fixes; final frontend/backend/browser checks pass.
- Limit: existing large modules were not split for this small recovery change. Broader refactoring would increase risk and is not required.
- Limit: LSP was inconclusive and PostgreSQL-only tests were skipped locally. Exact-head CI is still required.

## Preservation and publication

The private recovery archive was verified before edits. All 76 archived source files still match the old worktrees. The source edits are isolated on `test/local-work-recovery`; the original dirty source trees remain unchanged. No dependencies were installed, and the existing Python environment and browser cache were reused.

Review round 1 passed: two fresh independent reviews each scored 96/100, with zero must-fix and zero should-fix findings. Both independently verified tracked patch SHA256 `2aced6397093a4f4ddfe296047ed6020699fd83f777c5d7bbcd21afbcd8ce114`. Review run IDs: `f2308a90-0f70-44f1-a806-4b560df54d48` and `db3b31c6-a647-44e5-8d9e-32a6904d8800`. These were static reviews, not additional test executions.

Both suggested optional future coverage for an active initial-create rejection and concurrent ID waiters. They found no current defect and did not require expanding this recovery change. The report's review-status text was updated after review; application and test source remained unchanged.

The review gate permits a focused draft PR. Fresh exact-head hosted CI remains required; local SQLite skips are not PostgreSQL evidence. No merge or deployment is authorized. A separate numbered cleanup proposal requires owner approval before branch/file removal.
