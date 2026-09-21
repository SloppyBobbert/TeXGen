# Release handoff — REVIEWED DRAFT

The reviewed editor and production candidate is delivered through draft PR [#8](https://github.com/SloppyBobbert/TeXGen/pull/8). Local verification and independent review passed. Require successful backend, frontend and browser-e2e CI on the exact published PR head; previous CI does not cover new changes. Do not merge, enable auto-merge, or deploy without fresh owner approval.

## Scope and source

- Branch: `fix/document-sections`.
- Previous verified implementation: `c238dd2de041525214cb383d67080d080aab5524`; handoff-only base: `e3c0fcd4fee80cc4a4d574243efd021761573974`.
- The owner then requested both verifier follow-ups. The round-5 manifest identifies the new accepted implementation.
- Worktree: `.slim/worktrees/document-sections` under the main checkout.
- Editor acceptance: `e01s02-acceptance.md`; both independent reviewers passed at 100%.
- Production code acceptance: round 5, both independent reviewers 100%, zero findings. See `e01s03-followup-acceptance.md` and both round-5 reports.
- Accepted manifest: `e01s03-review-round5-manifest.json`; 36 files; source SHA-256 `b2830fb5e12a722808022db000da2b5a9ff51af901d4754485218db3fdd0d7a8`.
- [CI 35576550902](https://github.com/SloppyBobbert/TeXGen/actions/runs/35576550902): backend, frontend and browser-e2e succeeded for `c238dd2`.

## Local verification

Use only the owned disposable project recorded in `.pi/production-test.project`, with its local synthetic settings in `.pi/production-test.env`. Keep both files, credentials and browser traces out of commits.

**Warning:** The verifier briefly stops the test database and compiler. It must not target production data. It does not remove application volumes. Temporary probe containers and their private socket volume use a unique run label for cleanup. Its exit handler restores stopped dependencies and the anonymous request budget.

Before verification, prepare the approved images, frontend dependencies and browser executable. The exact CI setup is in `.github/workflows/ci.yml`; its acquisition/build steps are separate from verification. Do not run those acquisition steps as part of a claimed no-download check.

Required settings in the local fixture file:

- Separate `DJANGO_SECRET_KEY` and `JWT_SIGNING_KEY`, each at least 50 characters.
- Separate `POSTGRES_PASSWORD` for bootstrap and `POSTGRES_APP_PASSWORD` for the application.
- `DATABASE_URL=postgres://texgen:<encoded-password>@db:5432/texgen`, with no query or fragment. External destinations and connection-option overrides are rejected before migration.
- Put Compose settings in the fixture file, not exported shell variables. The verifier rejects ambient overrides and uses private resolved snapshots for startup and restoration.
- `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1` and `TEXGEN_LOCAL_HTTP=1`.
- `TEXGEN_HTTP_PORT=5173`; existing browser assertions require `http://localhost:5173`.
- `TEXGEN_BACKEND_IMAGE`, `TEXGEN_FRONTEND_IMAGE` and `TEXGEN_COMPILER_IMAGE` naming prepared local images.

Run from the implementation worktree:

```sh
bash -n scripts/verify-production.sh
bash scripts/verify-production.sh
```

The script requires the existing browser cache in `.pi/playwright-browsers`, or an explicit `PLAYWRIGHT_BROWSERS_PATH`. Missing dependencies must cause failure, not automatic installation.

The script checks startup, completed migrations/static collection, live restrictions, application database privileges, proxy headers, socket permissions, compiler limits, dependency outages and recovery. It then runs all browser tests with one worker and no retries. No dependency installation, image build or image pull occurs inside the verifier.

The browser phase temporarily uses anonymous budget **600**. The default is **60**, restored and checked against live Django settings on exit. This is a functional regression pass, not a default-budget full-suite pass. An exhausted test identity may remain throttled until its current fixed-minute window ends.

## Runtime contract

- Gunicorn 26.2.0 uses two synchronous workers and a private Unix socket. No TCP application port is published.
- Nginx alone publishes a loopback port. It replaces client forwarding headers and removes unsupported forwarding headers.
- App/proxy use UID/GID 10001, read-only filesystems, no capabilities and no-new-privileges.
- The compiler has no network, a read-only root, bounded temporary storage, process/CPU/memory/swap limits and bounded restart policy. Its image and approved assets are unchanged.
- Shared request admission uses PostgreSQL row locks. Accepted-compile quota remains separate.
- `/api/health/` is **liveness**, not dependency readiness. The aggregate stack verifier checks the database and compiler separately.
- Production persistent database connections use health checks before reuse. Live multi-worker restart checks passed in `ba549dcc1`, without request retries.
- Fresh database initialization creates a non-administrative application role. It does not retrofit existing database volumes.

## Dependency policy

- `backend/requirements-bootstrap.txt` hash-pins pip 26.2.
- `backend/requirements.lock` constrains exact package versions. It is **not** an artifact-hash lock.
- Only the approved frontend candidate changed: 41 version updates and one new transitive package. No major upgrade or new direct dependency was added.
- Frontend installation uses `npm ci --ignore-scripts`.
- Approved Python host/image and frontend audits reported no findings at their recorded checks. This does not certify operating-system packages or prove that all vulnerabilities are absent.

## Evidence and open gates

See `e01s03-runtime.md`, `e01s03-dependencies.md`, `e01s03-frontend-update-proposal.md` and `e01s03-browser-throttle.json` for task IDs, failures and later repairs.

Local checks and the independent review gate passed; see `e01s03-round5-checks.md` and `e01s03-followup-acceptance.md`. The follow-up run passed 482 backend tests (96.93% coverage), all seven PostgreSQL cases separately, 244 frontend tests, and all 39 browser tests, plus lint/build/migration/runtime/recovery checks. All 23 focused verifier tests passed.

All 15 tasks in the approved three-story execution plan were verified at the previous handoff. The owner-requested follow-ups are also locally verified and independently accepted. Use the [PR checks](https://github.com/SloppyBobbert/TeXGen/pull/8/checks) for exact-head hosted CI evidence. Historical checkpoint files retain their older results; this handoff and the round-5 acceptance record supersede the previous follow-up list.

Remaining decision: owner approval before merge, auto-merge or deployment. The separate development stack and unrelated worktree files are preserved; local test resources have not been removed.

## Completed verifier follow-ups

- Both loopback probes now use explicit proxy-disabled openers.
- Outage cleanup uses the exact verification-run account name and requires an unusable password. Outer recovery cleans the fixture after dependency restoration if probe cleanup was interrupted. Tests verify quota cascade deletion and preservation of unrelated accounts.

The original non-blocking findings remain recorded in `e01s03-acceptance.md`. Their repairs passed full verification and both round-5 reviews.

Local HTTP checks do not prove public TLS, secure-cookie admin login over HTTPS, full WCAG compliance, load capacity or production certification. Public TLS, backups/restore, operational monitoring and deployment approval remain separate release concerns.
