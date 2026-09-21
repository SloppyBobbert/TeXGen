# Frontend security update — approved and verified

## Evidence

- `bc33431c7`: the existing lockfile has 14 affected package entries (nine high, four moderate, one low). These refer to 40 distinct advisory URLs, including inherited findings.
- `bccbf5c73`: the dry run left those findings unresolved and changed no project files.
- `b6c8e0ee9`: resolved a candidate lockfile in a disposable copy using `npm audit fix --package-lock-only --ignore-scripts`. No packages were installed. The project manifests remained byte-identical. The candidate audit reported zero known vulnerabilities.

## Exact candidate

- Candidate: ignored local `.pi/e01s03-proposed-package-lock.json`
- SHA-256: `7830e3556da78601a15fa094c6f76b56bc8dec05630b76dee8e9879e4486c3f9`
- Full version-change list: `.pi/e01s03-frontend-candidate-summary.json`
- Changes: 41 version updates and one new transitive package. No major-version upgrades or new direct dependencies. `package.json` is unchanged.
- Download and expanded disk costs have not been measured. Candidate resolution fetched registry metadata, not installed packages.

Direct dependency changes:

| Package | Existing | Candidate |
| --- | --- | --- |
| react-router-dom | 7.14.1 | 7.18.4 |
| vite | 6.4.2 | 6.4.3 |
| vitest | 4.1.5 | 4.1.11 |

Matching React Router/Vitest internals and affected Babel, HumanFS, browser-data, YAML, ID-generation, CSS, and HTTP-client dependencies also change. The new transitive package is `@humanfs/types 0.15.0`.

## Proposed execution

After approval, verify the candidate hash, apply only the candidate lockfile, and install that exact set with lifecycle scripts disabled. Recheck the installed dependency audit, all 244 frontend tests, strict lint, build, production image, and all 39 browser tests. Report any compatibility or install-script requirement before widening the change. Preserve existing test assertions and timeouts. The default anonymous request budget remains 60; the rapid browser regression uses the separately documented test-only budget.

The owner explicitly approved the candidate through the confirmation question. Before applying it, the parent verified its SHA-256, unchanged `package.json`, all 42 changed package entries' registry URLs and SHA-512 integrity values, and absence of major-version updates. The original lockfile is backed up in ignored local `.pi/e01s03-frontend-package-lock-before.json`.

Only the approved candidate lockfile was applied. `b18c0d012` installed it with lifecycle scripts disabled. The audit reported zero known vulnerabilities; all 244 unit tests, strict lint, and the build passed. Raw audit: ignored local `.pi/e01s03-frontend-audit-after.json`.

The Docker build now also uses `npm ci --ignore-scripts`. `bbdbd1815` built frontend image `sha256:8061d71594c9e17e9b9b26ff8d19c021c4d146f4054c01569f53557d849b9b5c` and passed static HTTP, live stack, database-role, and scheme/socket checks. All 39 unchanged browser tests passed in 30.1 seconds, with one worker and no retries. The documented test-only request budget was 600; the EXIT trap restored 60 and healthy services, and a separate live settings assertion confirmed 60.

Backend image used: `sha256:27c85461246b2e7863b8e3e2633b92f1ffc4d0c5520dd70509b76d3134423428`. No extra install scripts or unrelated upgrades were needed. This update's verification does not replace the remaining readiness, CI, final-revision, and independent-review gates.

This approval does not permit public deployment, merging, unrelated upgrades, or a claim that every advisory applies to this application's execution mode.
