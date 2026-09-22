# Public HTTPS configuration: implementation scope

Owner authorization: implement provider-independent HTTPS configuration and tests. No purchases, DNS changes, public deployment or merge.

## Baseline

Branch `feat/public-deployment`, worktree `.slim/worktrees/deployment-config`, base `0fa9f8d0423ad1b7c5423bfbcc3229f3f5fe6e3c`. Post-merge CI `35649116075` passed all three jobs. Dependency Graph `35649122776` passed. Preserve the primary checkout and previous worktree unchanged.

## Impact

Add an optional public Compose overlay, Nginx TLS configuration and minimal startup validation. Keep the reviewed local Compose/Nginx paths unchanged. Read-only certificates and one validated hostname are deployment inputs. Preserve same-origin API access and private Gunicorn/compiler sockets.

Consumers: optional public runtime, container health checks, new tests and CI runtime verification. Existing local verifier remains separate and must pass unchanged. No application models, API ownership, editor source, quotas or dependencies need changes.

Risk: high at the new TLS/header boundary, contained by opt-in configuration. Explicitly reject invalid host input. Never preserve arbitrary forwarded scheme or address headers. Do not expose the HTTP application listener through merged port lists.

## Acceptance

- TLS terminates at Nginx and reaches Gunicorn as HTTPS through the private socket.
- HTTP redirects to the configured HTTPS host, not an arbitrary Host header.
- Unknown hosts, invalid host configuration and missing certificates fail safely.
- No public application HTTP listener remains from Compose merge.
- Non-root identity, read-only mounts, capabilities, resources and compiler network isolation remain unchanged.
- Certificates stay outside Git/images and mount read-only. Health checks still work.
- Tests use synthetic certificates and disposable loopback-only resources, not a public service.
- Retain bounded subprocesses and uniquely owned cleanup, including failed startup and cancellation.
- Verify frontend static behavior, spoofed headers, direct HTTPS scheme, trusted certificate verification and existing local regression coverage.
- State evidence limits. A local TLS probe does not prove public DNS, certificate renewal, backup restoration or real-user capacity.

## Implementation checkpoint

Implemented the optional overlay, separate TLS template/startup script, 20 focused
checks, loopback TLS probe and CI step after existing production verification.
Existing local Compose, Nginx, verification scripts, application code and compiler
configuration are unchanged. See [exact verification evidence](verifications/https-checks.md).

The probe exercises the installed Gunicorn configuration with a WSGI fixture,
not real Django/admin CSRF or complete editor workflows. Certificate dates,
public trust, renewal, DNS, provisioning, recovery and capacity remain operational
gates. This checkpoint is not deployment authorization; independent review and
fresh CI are still required.

## Source documentation

Docker Compose merge documentation: <https://docs.docker.com/reference/compose-file/merge/>. Context7 `/docker/docs` confirms that `!override` replaces merged sequences and requires Compose 2.24.4 or later. Ordinary port-list merging appends entries. Local Compose is 5.1.3.

Use `docs/DEPLOYMENT_PLAN.md` as the proposed architecture. Update its status only for implemented and tested work. Keep hosting, domain, certificate provisioning, recovery targets and deployment approval unresolved.
