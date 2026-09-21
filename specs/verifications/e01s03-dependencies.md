# Dependency audit — in progress

`b31601c4a` audited the existing backend virtual environment without installing or upgrading packages. It inspected 46 distributions, skipped none, and returned failure for four advisory entries in `pip 26.1`. The entries represent two unique issues:

- `PYSEC-2026-196` / `CVE-2026-8643` / `GHSA-wf93-45jw-7689`: unsafe entry-point installation paths. Reported fix: 26.1.2.
- `PYSEC-2026-3721` / `CVE-2026-13346` / `GHSA-qwm4-qh6w-59xr`: doubly encoded package-index URLs can allow installation outside the intended location. Reported fixes: 26.2 and equivalent 26.2.0.

No other installed distribution had a reported finding. This is not proof that the application, operating system, or all container packages are vulnerability-free. At that initial checkpoint the backend image had pip 25.3. Its later update and separate image audit are recorded below; the initial host audit alone did not establish the image's affected-version range.

Raw host audit: ignored local `.pi/e01s03-python-audit.json`.

## Installer update — approved

Apply pip 26.2 only to the project backend virtual environment and backend image build. Pin and verify the wheel before installation. Do not change the compiler image, global Python installation, or runtime dependency versions as part of this update.

Official metadata: https://pypi.org/pypi/pip/26.2/json

- Wheel: `pip-26.2-py3-none-any.whl`
- Download size: 1,816,475 bytes
- SHA-256: `931c303696af6fa3417112103b1cad26890e5a07eccb5b99783700e33f2b8aad`
- Requires Python: >=3.10
- Yanked: false
- Expanded disk and rebuilt-image costs: not measured

The owner explicitly approved this scope through the confirmation question. `b59528dc1` installed the hash-pinned wheel successfully. Inventory comparison confirmed that only pip changed, from 26.1 to 26.2. The fresh audit inspected 46 distributions, skipped none, and reported no known vulnerabilities. Raw result: ignored local `.pi/e01s03-python-audit-after.json`. The installer advertised 26.2.1, but that unapproved version was not installed.

Added `backend/requirements-bootstrap.txt` for the hash-checked installer and `backend/requirements.lock` to constrain the other 45 distributions to the running container's tested versions. Docker installs the pinned bootstrap first, then applies those constraints. The version constraints are not an artifact-hash lock. `b1c7d2f52` built backend image `sha256:27c85461246b2e7863b8e3e2633b92f1ffc4d0c5520dd70509b76d3134423428`. Its inventory exactly matched all 46 constraints; only pip changed from the prior image. `pip check` found no broken requirements. The installed-package audit inspected 46 distributions with no known vulnerabilities and no skips. Raw result: ignored local `.pi/e01s03-image-audit.json`. Cache-write warnings reflected the read-only, non-root environment; no restrictions were relaxed. The compiler image and global Python are unchanged.

`b5cc8b906` passed 36 restricted-image tests and live startup/proxy/role/scheme/socket checks. `bc33431c7` found 14 affected frontend dependency entries. The owner then approved the exact candidate: 41 version updates and one new transitive package, with no major updates or new direct dependencies. See `e01s03-frontend-update-proposal.md` for the complete scope and candidate hash.

`b18c0d012` installed that lockfile with lifecycle scripts disabled. The frontend audit reported zero findings; all 244 tests, strict lint and build passed. `bbdbd1815` passed the updated frontend-image/runtime checks and 39 browser tests, with the explicit test budget restored afterward.

CI now prepares an isolated backend virtual environment with the hash-pinned bootstrap and version constraints, audits installed Python packages, installs frontend packages with scripts disabled, and audits the frontend lock. Both PostgreSQL test files are selected explicitly. The browser job prepares approved production images before invoking the separate no-download verification script and all supported browser tests. These CI edits have passed local YAML parsing but have not run on GitHub yet.

Final verification does not install or download dependencies. Image preparation and browser acquisition are separate setup steps. Final-revision checks, CI execution and independent review remain open. These package audits are not an operating-system or complete container vulnerability scan.
