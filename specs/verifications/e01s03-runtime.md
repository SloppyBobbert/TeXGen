# Production runtime — in progress

## Current gate

- The approved pip and frontend updates passed their installed-package audits. `b5cc8b906` passed 36 restricted backend-image tests and the live scheme/socket/role checks after the pip update. `b18c0d012` passed 244 frontend tests, strict lint and build. `bbdbd1815` passed the updated frontend image checks and 39 browser tests; test-only anonymous budget 600 was restored to the live default 60.
- `b4d3990c2` passed compiler outage/503/no-quota-charge/recovered-PDF checks and database outage/fail-closed/liveness checks. The following strict stack check failed on an API read after database recovery. The original recovery loop could observe one healthy worker while another retained a closed connection.
- Added Django's documented `CONN_HEALTH_CHECKS=True` for production persistent connections. The new configuration assertion first failed with `[600, False]`. It now passes. The outage check now proves both workers have open database connections before stopping PostgreSQL, then requires six concurrent recovery reads to return 200 without request retries.
- `b4becfcc6` passed 20 focused checks but its build failed before integration. The parent used `--network=none` during image preparation; this changed the build cache key and prevented the package setup layer from resolving Debian hosts. This was a setup-command error, not a failed application recovery test.
- The latest local configuration/runtime check passed 23 tests and Ruff. This includes an injected browser-failure check proving the consolidated script returns failure, restores budget 60, and does not print its overall success message.
- `b02ef31d5` rebuilt backend image `sha256:25d452850e96e9a26c89a7b93047988f1b12aed9ec619dfc783bb264b020526b`. All runtime, migration, restriction, scheme/socket, compiler-outage and strict multi-worker database-recovery checks passed. Its browser phase failed: 37 passed, two failed. The Save locator matched two messages; the last real compilation returned service unavailable. The exit handler restored and checked the live anonymous budget of 60. This is not a complete verification pass.
- The Save test now asserts the exact success toast and the separate Saved status, without swallowing assertions. `ba27e1056` passed that test and the unchanged real compilation journey (two tests, 7.2 seconds). Local traces are not committed. This isolated pass does not resolve intermittent compiler availability.
- `be8778097` had 459 backend passes, seven skips and one CI-contract failure. Adding a real development-Compose configuration check after asset verification preserved the original assertion; all eight deployment-contract tests then passed. `b216e7da1` passed 460 backend tests, seven PostgreSQL-only skips, 96.87% coverage, Ruff and migration checks, plus 244 frontend tests, strict lint and build. `b094f2698` separately passed all seven required PostgreSQL tests without skips.
- Recent compiler health probes took 1.656–1.938 seconds, while `SidecarCompilerClient.prepare()` uses a one-second timeout while waiting for READY. The server handles connections serially. `b0f8022fa` tests this overlap directly; no timeouts, resource limits or compiler-image code have been changed.

The complete browser/runtime gate, CI execution, independent production review and handoff remain open. Image preparation remains separate from the no-download verifier. No merge or public deployment is authorized. Earlier image IDs below are historical, not the current release candidate.

## Private Gunicorn configuration

- `bbc9c1cd5` failed because `gunicorn.conf.py` was absent.
- Added a Unix-socket-only listener at `/run/texgen-web/app.sock`, two synchronous workers, 30-second worker/shutdown limits, restrictive socket umask, no reload/preload, and no access logging.
- `be2a4eed1` exposed an input-type error: Gunicorn requires strings for forwarding settings, not Python lists. Empty strings now parse to empty lists, verified with Gunicorn's actual parser. The intended trust policy was not relaxed.
- `b7c217411` passed all 16 production/runtime tests and Ruff. Gunicorn's `--check-config` loaded production settings without starting a server. This was a local configuration check, not Linux runtime proof.
- Gunicorn 26.2.0 is pinned in `backend/requirements.txt`, matching the approved runtime proposal.

Unix socket peers are trusted by Gunicorn regardless of `forwarded_allow_ips`. The runtime must restrict socket access to the app and proxy. Nginx must overwrite incoming forwarding headers. Proxy and container verification are still required.

## Application image

Added `backend/Dockerfile.dockerignore` for the application image only. It excludes local environment files, databases, compiler assets, virtual environments, and test output. The compiler Dockerfile retains its separate asset context.

`b6efaa31c` failed because the production target was absent. Added separate production/development stages; development remains the last/default stage. `b3698e657` built the production backend successfully.

Inspected backend image: `sha256:3bac33484bcf1a6df84db13823dfe6f40960b04f7f73ffdbf60d05b30f828ee4`, Linux ARM64, user `10001:10001`, Gunicorn command, no exposed-port metadata. `bcda8788d` passed excluded-file assertions and all 31 focused tests inside that image under no-network/read-only/capability/resource restrictions (5.68 seconds). These were isolated tests, not proof of a listening application or production database connection.

The frontend now has a pinned Nginx production stage serving built assets. Development remains its default stage. `b97c2c3bb` built the first image, but its Nginx configuration is superseded.

`bc6d11e46` found that Nginx tried to create its default FastCGI temporary directory on the read-only filesystem. All module temporary paths now point to `/tmp`. `b830a03af` then passed the same non-root/no-network/read-only configuration check without relaxing restrictions.

`bba97bf99` rebuilt the corrected frontend and passed the embedded configuration check. The first HTTP smoke run, `bcee4e49c`, then found `.mjs` served as `application/octet-stream`. Added an explicit JavaScript MIME mapping without removing `nosniff` or weakening the assertion.

`b9e8de2f4` rebuilt image `sha256:47aa55bc12dd7a73091a8eb026ae2fc53a34f9a1f0b40b1e32995af7c0206f98` and passed `frontend/scripts/check-production-image.py`: HTML, SPA fallback, blocked dotfiles, missing-asset 404, PDF worker MIME, and cache/security headers. The check used a temporary loopback-only container and removed it on exit. This verifies static HTTP behavior, not the backend proxy or full application stack.

`b80da4ba8` recorded five new policy failures and 14 existing passes. After adding the production defaults and guards, `ba7ec0e39` passed all 65 focused production/runtime/throttle/compiler/sidecar tests and Ruff. Production enables secure cookies and HTTPS redirection, limits the explicit HTTP test mode to loopback hosts, uses one trusted proxy for client identification, and rejects local compilation. Secure cookies stay enabled in HTTP test mode; that mode does not verify an HTTPS admin login.

## Isolated Compose startup

Added `docker-compose.production.yml`, with no runtime image builds or pulls. The verification environment uses public synthetic fixtures, not deployment credentials. Only the frontend publishes a port, bound to `127.0.0.1`. The compiler retains its no-network, read-only, capability, PID, memory, CPU, temporary-storage, and bounded-restart controls.

`bda2bf5c5` rebuilt the backend and started project `texgen-e01s03-b5e0c3c2ca`. Migrations and static collection exited zero before backend startup. Database, compiler, backend, and frontend reached healthy state. The loopback URL is `http://127.0.0.1:55002`.

Inspected running images:
- Backend/migration: `sha256:9d70dd2537f1b7b26da1468fe0360870aa04a238de0bf76e93ca00aa9d705feb`.
- Frontend: `sha256:47aa55bc12dd7a73091a8eb026ae2fc53a34f9a1f0b40b1e32995af7c0206f98`.
- Compiler: `sha256:194889db4ab16c7f868e2eaf0c7fe7a23e239c99ab5aa36cfdf39e1a39eb15a4`.
- PostgreSQL: `sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425`.

Runtime inspection confirmed non-root/read-only/capability restrictions on app, migration, and proxy containers; compiler network/resource restrictions; and no other published ports. PostgreSQL uses its normal writable data volume and image defaults. Database-role privilege checks remain open.

`be7a50567` failed before browser launch because the parent omitted `PLAYWRIGHT_BROWSERS_PATH`. The approved executable was already present in the worktree cache; no installation was needed. `beff6a9fe` then passed all three unchanged real-stack browser journeys in 16.9 seconds, with one worker and no retries.

## Database role and proxy checks

`b638efd4f` passed startup, static collection, API proxy, invalid Host rejection, and stable request identity under forged forwarding headers. It failed the database privilege assertion: the application used the initial PostgreSQL administrative account.

Added `scripts/init-production-db.sh` and separate setup/application credentials in Compose. On a fresh volume, the setup account creates an application role without superuser, database-create, role-create, or replication privileges. The application owns its database so migrations can run. Initialization does not retrofit existing databases.

`b7f390320` removed only the disposable `texgen-e01s03-b5e0c3c2ca` stack and its test volumes, then started fresh project `texgen-e01s03-06457b505f`. Migrations and static collection completed, all services became healthy, and the unchanged `scripts/check-production-stack.py` passed, including the database privilege assertion. Images were reused without builds or pulls. The earlier development stack was not changed.

`bbfe780ca` selected 39 browser tests, not 31. It passed 37; two older tests required `http://localhost:5173`. All 31 editor/real-stack checks passed in that run. After confirming the port was free, the proxy moved to loopback port 5173 without changing those assertions.

`b8941e0ac` then passed 38 of 39 tests. `b9821dc56` reproduced the final signup/login failure with a local trace: registration returned 201, then login returned 429 with `Retry-After: 36`. The shared anonymous budget of 60 was exhausted by the rapid single-IP suite. Sanitized evidence is in `e01s03-browser-throttle.json`; the trace stays in ignored local storage.

`bdc516557` passed all 39 unchanged browser tests in 29.6 seconds using an explicit test-only anonymous budget of 600, one worker, and no retries. Its EXIT trap restored 60 and healthy services. A separate live Django settings assertion confirmed 60. This functional pass does not claim that all 39 rapid tests pass under the default budget.

`bca7c95ff` passed all 244 frontend unit tests, strict lint with zero warnings, and the production build.

`b4f6d8d71` and `b71b892d6` each recorded 457 passes, seven PostgreSQL-only skips, and one original Docker exclusion-contract failure. The first repair restored inherited exclusions but missed the next assertion. After reading the full contract, added the remaining build-output exclusions without changing the test or compiler context.

`b5ed82c1b` passed the targeted contract first, then all 458 backend tests with seven PostgreSQL-only skips and 96.85% coverage. Ruff and migration-drift checks passed. All seven PostgreSQL contention/quota tests then passed separately with no skips. `bafac9378` rebuilt the backend, then stopped before tests because the command selected DEBUG with the production settings module. The production guard correctly rejected that test setup. `b1b87e0df` selected the test settings explicitly and passed all 36 focused tests in the no-network/read-only/resource-limited image. It then restarted the live production-settings stack and passed its startup, static, proxy/Host/identity, and database-role checks.

## Scheme and Unix-socket trust

`b3bbfd88d` passed Ruff and `scripts/check-proxy-scheme.py`. Temporary containers used the real Gunicorn and Nginx configuration with a test-only WSGI probe. Client scheme/address headers were replaced; forwarded host/port and `Forwarded` were removed. A trusted Unix peer could set HTTPS. The socket belonged to UID/GID 10001 with mode 0770, and UID 10002 could not connect. Probe containers and their volume were removed. No diagnostic route was added to the application.

Verified images for this gate: backend `sha256:91a85424a473e2f98a8b030133848f685dee3263fe81ce8b0ce9712c453ff449`; frontend `sha256:47aa55bc12dd7a73091a8eb026ae2fc53a34f9a1f0b40b1e32995af7c0206f98`. This proves the local header/socket boundary, not a public TLS deployment. Failure-readiness, dependency/CI work, the consolidated no-download script, final regression, and independent review remain open. No public deployment has occurred.
