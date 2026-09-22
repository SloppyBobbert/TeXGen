# TeXGen deployment plan

Status: provider-independent HTTPS configuration implemented locally; hosting and deployment remain proposed. The owner authorized configuration and tests only. Do not provision resources, change DNS, purchase services, or deploy.

Purpose: identify the smallest public deployment and its release gates. The optional HTTPS configuration below exists; operational gates remain unresolved.

## Verified starting point

- Merged commit: `0fa9f8d0423ad1b7c5423bfbcc3229f3f5fe6e3c`, from [PR #8](https://github.com/SloppyBobbert/TeXGen/pull/8).
- The inspected worktree matches its Git tree: `58df37d1ccc4614a34b08702cd7139cb268dd7b0`.
- [Post-merge CI](https://github.com/SloppyBobbert/TeXGen/actions/runs/35649116075) passed backend, frontend and browser-e2e.
- Two independent production/security reviewers scored the preceding candidate at 100%, with zero findings.
- Public HTTPS, backup restoration, host recovery and capacity remain unverified.

Sources: [runtime contract](../specs/verifications/RELEASE_HANDOFF.md), [Compose](../docker-compose.production.yml), [production settings](../backend/cheat_sheet/production.py), [Nginx](../frontend/nginx.conf), and [CI](../.github/workflows/ci.yml).

## Optional HTTPS configuration (not a deployment)

Use Compose >=2.24.4 and both `docker-compose.production.yml` and
`docker-compose.public.yml`. The `!override` port list removes the inherited 8080
publication. Existing local verification remains unchanged.

Required additional inputs:

- `TEXGEN_PUBLIC_HOST`: one lowercase ASCII DNS hostname with at least two labels,
  no trailing dot, wildcard, scheme, port or path; final label must be letters.
  Convert international names to their ASCII form first.
- `TEXGEN_TLS_DIRECTORY`: existing absolute certificate directory outside Git,
  containing `fullchain.pem` and matching unencrypted `privkey.pem`. Keep both
  readable by container UID/GID 10001 and restrict the private key to that identity
  and the certificate operator. The directory is mounted read-only. Nginx checks
  certificate/key syntax and matching before listening; certificate dates, DNS
  ownership and a publicly trusted chain remain operator responsibilities.
- Existing production image and secret inputs remain required. Use a private
  environment file outside Git; do not reuse verification credentials.

A configuration-only review command (no listeners or containers):

```sh
docker compose --env-file /absolute/private/public.env \
  -f docker-compose.production.yml -f docker-compose.public.yml config --quiet
```

The default bind is `127.0.0.1` with ephemeral host ports. TLS uses container port
8443; port 8081 only redirects to `https://<configured-host><request-uri>` on the
standard HTTPS port. Local verification connects directly to the assigned TLS
port rather than following that redirect. Internal 127.0.0.1:8080 serves only
health and is never published. Backend and migration force `TEXGEN_LOCAL_HTTP=0`
even when the ambient value is 1; allowed hosts are the public host plus localhost
for the existing backend healthcheck. Backend/database have no published ports.

Public exposure is a separate, future, approved operation: deliberately choose
`TEXGEN_PUBLIC_BIND`, `TEXGEN_PUBLIC_HTTP_PORT=80`, and
`TEXGEN_PUBLIC_HTTPS_PORT=443`, then review firewall, certificates and all release
gates before starting anything. No command here starts a public service.

The mounted startup script rejects malformed hostnames and missing TLS inputs,
substitutes only the public hostname, validates Nginx, then runs it as UID 10001.
Unknown HTTP/HTTPS Host values are rejected. Forwarding headers are replaced or
removed exactly as in the local proxy. File bind mounts fail if their sources do
not exist. Nginx variables are not expanded by the template renderer.

Local evidence: [HTTPS checks](../specs/verifications/https-checks.md).
`python3 scripts/check-public-https.py` uses existing prepared images, temporary
synthetic certificates with verified trust, loopback-only ports and owned cleanup.
It does not test real Django/admin CSRF or user workflows; those need staging.
Provisioning, renewal/reload, backup restore, reboot recovery, DNS and capacity
remain future work. Production Django still enables one year of HSTS; verify
certificate operations before exposing it to real browsers.

## Recommended first deployment

Use one Linux ARM64 host with Docker Compose, persistent storage and a public domain. Keep the application and database on this host initially.

Proposed staging size: 2–4 vCPUs and 4 GiB RAM. This is a starting estimate, not tested capacity. Measure compilation latency and memory before selecting the production size.

```text
Browser -- HTTPS --> Nginx -- private Unix socket --> Gunicorn/Django
                                                      |-- PostgreSQL
                                                      `-- private Unix socket --> compiler
                                                                                   no network
```

Terminate TLS in the existing Nginx container. Mount certificates read-only. Keep the frontend and API on one origin.

| Option | Assessment |
| --- | --- |
| Single ARM64 Linux host | Recommended starting point. Retains shared Unix sockets and the existing compiler boundary. Host failure interrupts the whole service. |
| Host plus managed PostgreSQL | Possible later. Requires private connectivity, database TLS, role setup and new recovery tests. The local verifier cannot target that database. |
| Separate managed application services | Not a direct conversion. First prove shared sockets, UID permissions, read-only mounts and a networkless compiler. |
| AMD64 host | Requires matching compiler assets and native verification. Current browser CI checks ARM64 assets. Do not assume the existing archive is portable. |

No provider, price, quota or regional availability was checked. No hosting account was accessed.

## Deployment blockers and required work

### 1. Public HTTPS and proxy trust

The existing Nginx configuration listens on HTTP port 8080. It replaces `X-Forwarded-Proto` with its own `$scheme`.

An external TLS proxy forwarding HTTP to this unchanged Nginx configuration loses the original HTTPS scheme. Django can repeatedly redirect HTTPS clients.

For the proposed direct-TLS design:

1. Add a separate public deployment configuration. Preserve the tested local configuration.
2. Configure Nginx TLS on an unprivileged container port. Map host port 443 to that port.
3. Provide HTTP-to-HTTPS redirection and a certificate renewal method.
4. Mount certificate files read-only with access limited to the Nginx process and the certificate operator.
5. Keep Gunicorn and PostgreSQL private. Preserve the compiler's disabled network.
6. Set `TEXGEN_LOCAL_HTTP=0` and explicit public allowed hosts.
7. Test HTTPS scheme detection, forged forwarding headers, secure cookies, admin CSRF and redirects.
8. Test certificate renewal and Nginx reload before public use.

If a CDN or load balancer is selected, define its trusted addresses explicitly. Re-test client identity and anonymous throttling. Do not trust arbitrary forwarded headers.

Production settings enable one year of HSTS. Confirm the domain's HTTPS operation and renewal before exposing this policy to real browsers.

### 2. Production configuration and image delivery

The existing Compose file explicitly targets local production verification. It publishes only a loopback HTTP port and requires prepared images.

Create a separate deployment definition from the reviewed restrictions. Do not repurpose `.pi/production-test.env` or its synthetic credentials.

- Build backend and frontend images with the explicit `production` target. Their default targets remain development targets.
- Acquire and verify the compiler assets before building its image. Keep acquisition separate from runtime checks.
- Build for the selected host architecture. Test that architecture natively.
- Record the source commit, image digests and configuration version. Promote the same image digests from staging.
- Select an image registry or an authenticated offline transfer method. Verify digests after transfer.
- Generate separate Django, JWT, bootstrap database and application database secrets. Store them outside Git and logs.
- Define secret rotation and recovery ownership. Existing minimum-length checks do not generate or rotate secrets.
- Keep the default anonymous/user request budgets at 60/600. The browser test override is not a production default.
- Set the optional YouTube key only if that feature is required.

The init script creates the restricted database role only for an empty database volume. Existing databases need a separate, reviewed role and credential procedure.

### 3. Persistent data and rollback

Keep the PostgreSQL volume persistent. Do not remove it during replacement or rollback.

Proposed initial recovery targets: at most 24 hours of lost data and restoration within four hours. The owner must approve these targets.

1. Create encrypted off-host database backups before admitting user data.
2. Set backup retention and restrict access to database dumps and encryption keys.
3. Restore a backup into an isolated database. Verify ownership, saved documents and application access.
4. Measure restoration time against the approved target.
5. Keep the previous application images and configuration available.
6. Before each migration, check compatibility with the previous application version.

Image rollback does not reverse a database migration. If compatibility fails, use an approved recovery procedure. Database restoration can lose newer writes.

### 4. Host recovery, monitoring and capacity

- Restrict public inbound traffic to the selected HTTP/HTTPS ports. Restrict administrative access separately.
- Keep database ports, application sockets and the Docker socket private.
- Configure security updates and bounded logs. Do not log secrets, tokens or document source.
- Configure explicit service startup after host reboot. Current `on-failure:3` settings alone do not establish reboot recovery.
- Test host reboot, disk pressure and exhausted restart attempts on staging.
- Alert on certificate expiry, backup failure, disk pressure, memory exhaustion, repeated restarts and sustained 5xx responses.
- Monitor compilation failures, latency and 429 rates without changing quota semantics.
- Keep liveness separate from dependency readiness. `/api/health/` does not prove database or compiler readiness.
- Test expected concurrent use before choosing capacity. The compiler is bounded and shared, not a demonstrated high-throughput service.

## Ordered implementation and release gates

| Step | Work | Evidence required to proceed |
| --- | --- | --- |
| 1 | Owner authorizes provider-independent configuration (done); chooses host, domain, recovery targets and budget later | Configuration scope approved; operational decisions still required |
| 2 | Add public configuration and focused regression tests on a new branch (implemented locally) | HTTPS checks and fresh review; no weaker permissions, header trust, compiler limits or quota rules |
| 3 | Build and prepare separate staging resources | Matching architecture and recorded image digests |
| 4 | Verify staging HTTPS and full application journeys | Valid certificate, no redirect loop, correct cookies, save/reload and offline PDF success |
| 5 | Verify backup restoration, reboot and rollback | Measured recovery with preserved data and ownership |
| 6 | Obtain fresh review and CI for deployment changes | Both code and operational gates pass |
| 7 | Obtain explicit deployment and DNS approval | Named destination, maintenance window and rollback owner |
| 8 | Deploy the approved images and run non-destructive smoke checks | Healthy public origin and successful controlled account/document/PDF checks |

Use `scripts/verify-production.sh` only with its owned disposable local test project. It stops the database and compiler. It seeds test data and changes the anonymous budget temporarily.

Never run that verifier against the public service or production data. Use a separate HTTPS staging test for public configuration. Use non-destructive smoke checks after deployment.

## Decisions still needed

1. Hosting provider, region and monthly budget.
2. Public domain and DNS operator.
3. Expected concurrent users and compilation frequency.
4. Acceptable downtime and approved recovery targets.
5. Backup destination, retention and operational owner.
6. Whether external integrations such as YouTube are required.

No infrastructure change is part of this implementation. The next steps are independent review, fresh CI and owner decisions on the operational gates.

## Plan verification

These read-only commands check the source files used by this plan. They do not verify a public deployment.

```sh
test -f docker-compose.production.yml
test -f backend/cheat_sheet/production.py
test -f frontend/nginx.conf
test -f scripts/init-production-db.sh
git diff --check
```
