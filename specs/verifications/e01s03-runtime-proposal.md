# e01s03 runtime proposal

Status: approved by the owner through the Runtime approval question: "Approve proposal (Recommended)". Approval covers the exact runtime inputs and local-only topology below. Installation and verification results must still be recorded; approval is not proof of readiness.

## Installation receipt

Task `b0615cab8` exited 0. Gunicorn 26.2.0 installed into the existing backend virtual environment with `--no-deps --only-binary=:all: --require-hashes`. Docker pulled the exact approved Nginx manifest and reported its matching digest. No service was started and no public deployment occurred. Expanded image storage is not yet measured.

## Proposed topology

Use an isolated Linux Compose test stack. Serve built frontend assets and proxy API requests with Nginx. Run Django WSGI with Gunicorn on a private connection. Reuse PostgreSQL for shared request throttling; do not add Redis. Keep the compiler sidecar isolated with its existing resource, network, filesystem, admission, and quota controls.

Expose only a loopback HTTP test endpoint. This does not select a public hosting provider, create credentials, configure DNS, or deploy publicly. Public TLS and any additional upstream proxy require a later host-specific decision. The edge must replace, not trust, incoming forwarding headers. Backend access and proxy trust require explicit tests.

## Exact new runtime inputs

### Gunicorn

- Version: `gunicorn==26.2.0`, without optional extras.
- Source: <https://pypi.org/pypi/gunicorn/26.2.0/json>.
- Wheel: `gunicorn-26.2.0-py3-none-any.whl`.
- SHA-256: `bd249d0b3f7972f7432f0a6b6ff3b3ee2d129f70cd1ff6c09a9dd9e29a2b88e3`.
- Download: 228,389 bytes. Sum of unpacked wheel entries: 829,524 bytes. Python bytecode and filesystem allocation add overhead; allow about 2 MiB for this package.
- Metadata requires Python >=3.10. All listed extra dependencies are optional; none are proposed.
- Deployment guidance checked through Context7 `/benoitc/gunicorn`, including trusted proxy restrictions and the 26.2.0 header-policy security fix: <https://github.com/benoitc/gunicorn/blob/master/docs/content/deploy.md>.

### Nginx

- Official Docker image, pinned rather than a moving tag:
  `nginx:stable-alpine@sha256:ef8676b33d681f272ba429b27658bdd7e640963279714c96bddf1dc76307f7b6`.
- Registry metadata: <https://hub.docker.com/v2/repositories/library/nginx/tags/stable-alpine>.
- ARM64 manifest: `sha256:cca05ef58fc0d12e458475b3ac5747c5ae5018f26b4a8ff87da56a772b687114`; compressed image size 25,966,388 bytes.
- AMD64 manifest: `sha256:89956b8306b7db851b00cc78b32292cc32a848dcc0c48e65ebe20526c9a36019`; compressed image size 26,073,528 bytes.
- Expanded Docker storage is not yet measured. Allow 150 MiB for the new proxy image as a planning estimate, not a hard bound. Application rebuild caches, existing images, database volumes, and compiler assets are additional.

## Approval boundary

Approval must cover the exact package, pinned proxy image, local Compose topology, and PostgreSQL-backed shared throttling. Implementation still needs tests for worker sharing, spoofed headers, startup, migrations, static files, readiness, and unchanged compiler isolation. The final verification script must not download or install anything.
