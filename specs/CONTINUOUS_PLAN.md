# TeXGen continuous execution plan

Date: 2026-09-19
Status: Authorized for execution. Ask the owner before any merge.

## Current authorization — 2026-09-19

The owner authorized all work needed for this plan, including dependency installation, downloads, local test resources, commits, pushes, and PR creation. This replaces the approval requirements in the original plan, scope, story files, and historical refactoring plan. Record exact versions, sources, and disk impact for new dependencies. Preserve unrelated user work. Never expose credentials. Do not merge or enable automatic merging without fresh approval.

Use this authority for the planned release candidate. Do not create unrelated paid services or deploy incomplete work. Report missing credentials, unsupported infrastructure, and unresolved security decisions rather than guessing.

## Goal

Finish the remaining refactoring work for a small public launch. Protect saved work, preserve manual LaTeX, and keep compiler isolation intact. Prepare and publish a verified release-candidate PR. Ask the owner before merging.

## Start here

Read this file, `state.yaml`, and the active story in `epics/e01-launch-readiness/`. The task YAML files are the execution checklist. `failing` means not yet verified; it does not claim that an existing test fails.

This plan is stored in `/Users/brandontran/TeXGen/.slim/worktrees/refactor-backend/specs/`. Do not work from the root checkout's old `docs/REFACTORING_PLAN.md`.

Verified baseline:

- Remote `main`: `65a4938f11bd3b3817e3ba98b2b5e8fe1afa9783`.
- Source tree: `e3496d5096dd677617ced954b31fedeeb0a653a2`.
- Local `fix/backend-review-followup`: `0f25c509246173d3bce7a58fbc152325ca9fed03`, with the same source tree.
- PR #7 was merged on September 14. Main CI passed: https://github.com/SloppyBobbert/TeXGen/actions/runs/34813358009.
- These are historical checks, not validation of future edits.

## Execution order

| Story | Deliverable | Depends on |
| --- | --- | --- |
| e01s01 | Safe topic removal with stable IDs, protected manual edits, and save/reload | Verified baseline |
| e01s02 | One editor state owner, consistent requests, and usable mobile/keyboard workflows | e01s01 |
| e01s03 | Production build controls, complete CI evidence, and a release handoff | e01s02 |

Each story contains smaller tasks. Finish and verify one task before starting the next. Use the existing tests and dependencies. Do not rewrite working features just to match an unchecked item in the old plan.

## First execution task

1. Check remote main, all worktrees, and pending changes again. The old root checkout contains unrelated edits. The recovered worktree contains untracked `.pi/` data and a `frontend/node_modules` link; preserve them.
2. Create a new implementation worktree from current main, named `fix/document-sections`. Obtain the exact main commit if it is not available locally. Copy only these reviewed plan files into that worktree. Do not move or delete the old worktrees.
3. Compare any new main changes with this plan. Update small path or command differences locally. Stop for a changed product or security contract.
4. Locate installed Python, Node, frontend dependencies, PostgreSQL, Docker, Chromium, and compiler assets. Check versions and asset provenance without installing anything.
5. Run the baseline checks in e01s01 task 1. Record the exact commands, source revision, runtime versions, pass/fail counts, and skipped tests.

A missing dependency blocks only the checks that need it. Continue independent read-only work, but do not mark a dependent task complete.

## Product rules

- Use the checked-in formula IDs. Do not derive identity from display text.
- In structured mode, remove untouched generated content for a removed topic.
- If affected content contains manual edits, keep both source and selection unchanged until the user confirms removal. Cancel leaves both unchanged.
- Confirmation must apply to the document revision shown in the dialog. New edits invalidate it. Confirmed removal must be reversible through history.
- This confirmation belongs in the application. The coding agent need not ask the owner each time it writes or tests this behavior.
- Raw mode keeps source authoritative. Selection changes must not rewrite arbitrary LaTeX. Explain that the user must edit raw source or explicitly regenerate.
- Do not infer editable sections from old name-based comments. Preserve old or damaged documents and offer explicit regeneration with a recovery snapshot.
- A missing, duplicate, unknown, or damaged section marker must stop automatic rewriting, not cause a best-effort deletion.
- Preserve custom text, layout, order, and manual source through drafts, save, reload, and history.
- Failed compilation retains the last valid PDF and its matching source snapshot. Do not present it as a preview of newer source.
- Keep sign-in, ownership, staff-only template writes, quota admission, and fail-closed compiler selection.

## Continuous work rules

After each task:

1. Run its focused checks. Fix failures before continuing.
2. Review the diff for data loss, security changes, and unrelated edits.
3. Record evidence under `specs/verifications/<story>-<task>.md`. Include uncommitted diff identity if the changes have no commit yet.
4. Set the task to `passing` only after its checks pass. Update `state.yaml` with the next task and any blocker.
5. Continue to the next task without requesting routine approval.

After each story, run full backend tests with the 95% coverage floor, frontend tests, lint, and build. Run the affected real-stack tests when the approved environment is available. Obtain an independent review before declaring the story complete. Use a configured review tool only after its availability checks. If review infrastructure fails, record the failure; do not silently change execution methods.

Keep one writer per worktree. Reviewers must use fresh, read-only contexts. Do not modify their review scope until the result is retrieved. Use native background completion notifications for long-running checks; do not poll to wait.

No automated loop or scheduled process is installed by this plan. Continuous work means advancing through this checklist during active sessions and saving enough state to resume after interruption.

## Stop conditions

Stop the affected task and ask when:

- A merge is ready. Provide the PR, final revision, checks, and remaining risks, then ask for approval. Do not enable auto-merge.
- Work would destroy unrelated user data, requires unavailable credentials, or needs an unresolved deployment/account choice. Routine installs, test resources, commits, pushes, and PR publication are authorized.
- A conflict involves unrelated local changes or a concurrently active worktree.
- A new product decision could discard manual content or weaken security.
- The selected deployment platform cannot support the isolated sidecar, Unix socket, approved architecture, or resource limits.
- An external tool or review service fails. Record the exact failure and partial diff before retrying the same method or asking for another method.

Do not weaken assertions, coverage, sandbox limits, quotas, or fail-closed behavior to pass a check. Do not treat a skipped PostgreSQL or real-compiler test as a pass.

## Verification environment

Commands in task YAML run from the implementation worktree root. Activate the approved Python environment first so `python3` resolves to it. Use Node 24 and Python 3.14 as required by the current project. Use local npm scripts, not `npx` commands that can install missing packages.

Focused backend checks use `--no-cov`; full checks use `--cov-fail-under=95`. PostgreSQL evidence requires `DATABASE_URL` and `TEXGEN_REQUIRE_POSTGRES_CONCURRENCY=1`. Never write credential values into reports.

Browser checks require the matching Playwright browser and a started real stack. Local builds must not pull or install unapproved dependencies. If the prerequisites are absent, record the gate as blocked.

## Completion gate

All task checks pass on the final source revision. The full template → edit → remove → compile → save → reload journey passes against a real backend. Raw, legacy, damaged-marker, undo, race, ownership, quota, mobile, and keyboard cases pass. Production images pass the approved offline compiler corpus with enforced limits. The independent review has no unresolved blocking findings.

Update `docs/REFACTORING_PLAN.md` with evidence, not assumptions. Produce a release handoff, commit and push reviewed changes, and open a PR. Monitor checks for the final PR revision. Ask before merging; never enable auto-merge.
