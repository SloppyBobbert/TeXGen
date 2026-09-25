# Compiler support

The compiler cache is generated and verified against a curated, sparse TeX corpus. It covers all catalog formulas, selected generated article/extarticle layouts, matrices/cases/tabular content, calculus, statistics, unit-circle content, practice problems, raw complete documents, and raw-fragment wrapping. The full layout Cartesian matrix is structural corpus metadata; the compiler cache uses a smaller covering set, not every combination.

The exact common raw package set is: `article`, `extarticle`, `geometry`, `amsmath`, `amssymb`, `enumitem`, `multicol`, `adjustbox`, `inputenc`, `mathtools`, `array`, `booktabs`, `xcolor`, and `hyperref`.

External files and images, bibliography processing, index processing, shell escape, network-dependent content, and unlisted packages are explicitly unsupported. Cache compatibility is corpus-based sparse cache support, not a guarantee that arbitrary LaTeX will compile.

## Build prerequisite

The compiler image requires a verified asset tree at `backend/.compiler-assets` before the Docker build. A clean checkout does not contain these ignored files. Do not bypass verification or use an empty directory to make the build pass.

The current curated Tectonic binary is Linux ARM64. Use a matching ARM64 build and runtime. Do not use this binary on an x86-64 runner. The browser E2E job uses `ubuntu-24.04-arm` and stages the following release archive before starting Compose:

- [Compiler asset prerelease](https://github.com/SloppyBobbert/TeXGen/releases/tag/compiler-assets-0.15.0-238864f4e9df)
- File: `texgen-compiler-assets-0.15.0-corpus-238864f4e9df.tar.gz`
- SHA-256: `add28e26a3af62f800b8171070501bf1ecb4f5b0f79244c5f14b11023fe9bce3`
- Archive size: 25,255,835 bytes. Extracted file size: 82,783,135 bytes, including the deployment manifest.

Verify this checksum before extraction. Then run `python3 -S backend/compiler_sidecar/container/verify_assets.py backend/.compiler-assets`. CI performs both checks before the Docker build; the Dockerfile verifies the tree again. A missing archive, changed checksum, or invalid tree must fail the build. The archive and extracted assets remain outside Git.

The backend build uses `backend/Dockerfile.dockerignore` to exclude compiler assets, local environments, archives under `build/`, and test outputs. The compiler build uses the root `backend/.dockerignore`, so it can still receive the verified assets. These rules control image builds only: the development Compose bind mount of `backend/` can still expose locally staged files to the running backend.

## Compiler modes

Production compilation defaults to `disabled`. The supported Compose path explicitly selects `sidecar`. Do not enable `local` in production.

`local` is a development-only mode and requires `DEBUG=True`. It does not install Tectonic or locate assets automatically. The normal backend image intentionally contains neither the compiler binary nor its assets. To use local mode in a separate development environment, provide the matching Linux ARM64 executable at `/opt/compiler-assets/tectonic/tectonic`, the verified cache and formats, and all required POSIX resource limits. Set `XDG_CACHE_HOME=/opt/compiler-assets/formats` and `TECTONIC_CACHE_DIR=/opt/compiler-assets/cache`; provide a writable temporary directory. Without these prerequisites, compilation fails rather than falling back to another adapter. Local mode does not provide the container isolation of the sidecar.

## Guest requests and account quotas

Guests get **three successful PDF compilations per browser identity, with no periodic reset**. The fourth is rejected before compiler execution with HTTP 403 and `reason: guest_login_required`; sign in to continue. Validation, normalization, and status queries do not spend credits. Confirmed syntax, resource, and runner-timeout failures refund the reservation. Internal errors and unknown execution results can consume a credit without returning a PDF. Saved sheet IDs require sign-in and ownership. Account storage and sync still require sign-in.

The server issues an opaque, signed HttpOnly `texgen_guest` cookie and stores a permanent `GuestCompileBalance` row separate from expiring request windows. `GET /api/compile/` restores the authoritative remaining count; responses expose `X-Guest-Compiles-Remaining`. The cookie requests a ten-year lifetime, refreshed on use, but browsers may cap or discard it. Clearing cookies/browser identity, private browsing, another browser, cookie blocking, or signing-key replacement can reset the anonymous allowance. This is not person-level enforcement or fingerprinting; IP addresses only apply to request throttling. Server balance rows have no scheduled expiry or reset and must not be included in throttle cleanup.

Admission uses a bounded atomic conditional increment (maximum three). The server releases the reservation only for a confirmed execution failure other than an internal error. A process crash, uncertain outcome, or failed release can conservatively leave a reservation spent; it never resets automatically. Storage errors fail closed with 503. No database transaction spans compiler execution.

Guest hydration, reload, and layout changes never auto-compile. Only explicit Generate/Compile actions spend credits. Download reuses the current in-memory PDF without a request; changed source/layout or a reload requires explicit compilation before download. Same-page requests are serialized, with Web Locks providing cross-tab serialization where available; the database enforces the identity's limit regardless.

All compile requests use `CompileUserThrottle`. It applies `COMPILER_USER_RATE` per account or, for guests, per IP address. Invalid source and normalization requests also count.

This rate uses Django's bounded, process-local cache. Eviction, restarts, and concurrent workers can weaken it. It is not a durable accepted-compile quota.

Production also enables `SharedRequestThrottle`, which stores per-minute request counts in PostgreSQL. Guests use `REQUEST_THROTTLE_ANON_LIMIT` per IP. Accounts use `REQUEST_THROTTLE_USER_LIMIT` per user across API requests.

Shared throttle storage failures return 503 before compilation. Rate denials return 429 with `Retry-After`. Guests do not create account quota rows. There is no durable per-IP accepted-compile quota.

Development defaults to `DJANGO_NUM_PROXIES=0` and uses the connection address, ignoring forwarded headers. Production trusts one nginx hop. Nginx overwrites `X-Forwarded-For`, and the backend must remain unreachable directly.

Shared IP addresses share request throttles, not browser compilation balances. Do not increase trusted proxy counts without checking the full proxy chain. All guests retain the same sandbox, source/output limits, time/CPU limits, and global compiler capacity limits.

If a session expires, sign in again or sign out to compile as a guest. Failed authenticated POST requests are not automatically replayed anonymously.

## Quota admission and socket acceptance

Authenticated accepted-compile quotas require PostgreSQL in production. SQLite is development-only: its `select_for_update()` is a no-op, so it does not provide the row locking required for concurrent fixed-window admission. SQLite tests do not prove production concurrency correctness.

Protocol v2 validates the job and acknowledges READY on the same connection before authenticated quota admission. Guest jobs use the same protocol with their durable three-credit reservation instead of an account quota check. The worker waits for START before running the compiler; denial or database failure closes the connection without starting work. Missing/refused sockets and pre-READY transport or protocol failures return 503 without consuming quota. READY/START frames retain bounded framing deadlines; a caller that stalls during admission releases the worker after the framing timeout. No database transaction is held during compilation.

For authenticated jobs, attempts remain charged after READY and quota admission, including syntax, timeout, resource, and successful outcomes. Lost connections or replies after admission are not refunded: work may already have executed. Deploy the v2 backend and sidecar together; incompatible protocol versions fail closed rather than executing before admission. The Compose memory and memory-plus-swap limits are both 256 MiB (no additional swap), while the per-process address-space ceiling remains 512 MiB.

## Manifest formats

Two inventories have different purposes:

- `cache_manifest.py` records a cache-only proof. Its `files` list includes relative paths, hashes, and sizes. The record also includes corpus, bundle, archive, and root-digest provenance. `verify_cache_manifest` verifies this format. It is not the image build manifest.
- `container/manifest.schema.json` defines the deployment manifest at `.compiler-assets/provenance/manifest.json`. It contains only a `files` object mapping each deployment-relative file path to its SHA-256 and size. It inventories the complete binary/cache/formats/provenance tree, except the manifest itself. `container/verify_assets.py` verifies this format and rejects missing, extra, or unsafe files.

To assemble a new deployment tree, first verify its cache-only proof. Copy the approved binary, cache, formats, and provenance into the final tree. Then calculate a deployment inventory from that complete tree using the deployment schema. Do not pass the cache-only manifest directly to the image verifier or convert only its `files` field: it omits deployment assets outside the cache. Verify the final tree before archiving it. Consumers of a verified release archive must preserve the included deployment manifest and verify the unpacked tree again.

## Health checks

Compose uses `restart: "on-failure:3"` for the compiler. Docker can restart it after a nonzero process exit, with up to three retries for a failure sequence. Repeated failures can exhaust the retry budget and require operator intervention. A manual stop is not a crash-recovery request, and an unhealthy probe alone does not restart the container. Repeated failures still require operator investigation; inspect restart counts and OOM events rather than treating a restart as proof of recovery.

The health check compiles a minimal document through the same socket as normal jobs. Its 40-second I/O budget covers one running 15-second job, its own job, and cleanup/framing time. Compose allows 45 seconds for the probe process. These probe budgets do not raise the 15-second limit on individual compiler jobs. Heavy load can still fill the bounded queue and cause a probe to fail; this check tests compilation readiness, not independent process liveness.
