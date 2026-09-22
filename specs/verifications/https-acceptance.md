# Optional HTTPS configuration — source acceptance

The owner authorized provider-independent HTTPS configuration and local tests. This does not authorize public deployment, DNS changes, purchases or a merge.

## Accepted source

- Branch: `feat/public-deployment`.
- Base: `0fa9f8d0423ad1b7c5423bfbcc3229f3f5fe6e3c`.
- Manifest: `https-review-manifest.json`, nine implementation and evidence files.
- Source fingerprint: `e0ce2a22b8c8c26b1be961fcb07eb3c0a85321633edfa367b88c19ecd65d80ec`.
- Fingerprint method: SHA256 of the sorted, compact JSON path-to-hash mapping.

Both reviewers and the parent confirmed all nine hashes. No accepted file changed after review. Archived reports only normalize trailing whitespace.

## Independent review: PASS

Both fresh reviewers passed all 20 checklist items: **100%, zero findings**.

- Workflow: `740fd2dd-fb54-40e6-a28f-309392f7275d`.
- Implementation: `68af173c-07f5-48e0-b4b0-64f905d9a25a`.
- Review A: `be8041f6-1597-46c3-ac74-caea4e3f1694`, report `https-review-a.md`.
- Review B: `ffe201f6-e3cd-4e24-8c79-fad651ce364b`, report `https-review-b.md`.

Reviewers inspected source independently. They did not run tests or read each other's reports.

## Verification and remaining gates

See `https-checks.md` for commands and limitations. The full backend run passed 502 tests at 96.97% coverage. Seven PostgreSQL-only tests were skipped on SQLite. They require the separate PostgreSQL CI job, not a claim that skips passed.

The focused module adds 20 passing tests. Trusted local TLS, sanitized forwarding headers, fixed-host redirects, ordinary and absolute-form Host rejection, static/health behavior and owned cancellation cleanup passed. Actual Compose rendering confirms replacement ports and inherited restrictions. Ruff and shell syntax passed.

The workflow also required host-run backend/lint and live TLS verification before reviewers started. Fresh CI on the published candidate remains a release gate. The draft PR checks must identify the exact new commit, not reuse baseline CI.

The TLS probe uses a WSGI fixture. It does not prove real Django/admin login, CSRF, secure-cookie issuance or complete HTTPS editor journeys. Public DNS/trust, certificate renewal/reload, backups, reboot recovery and capacity remain separate staging and operational work.

The original local configuration and application code are unchanged. Existing editor diagnostics are not a clean baseline claim. In particular, no actionable gitleaks finding was confirmed: the analyzer inventory is not a finding. No credential finding was suppressed.

## Handoff

Publish as a draft PR and verify its CI. Preserve other worktrees and local services. Obtain fresh owner approval before any merge or deployment.
