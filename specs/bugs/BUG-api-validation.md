---
bug_id: BUG-api-validation
status: reviewed
type: bug-fix
context: fix/site-quality at ea0eae3
severity: high
scope: expanded-audit B1-B3
title: Reject malformed layout, conflicting template aliases, and contextual weak passwords
---

## Current acceptance

Both final independent reviews scored 95/100 with no must-fix findings. Fresh pre-PR verification passed 636 backend tests with seven PostgreSQL-only skips, 97.23% reported API coverage, and Ruff. Frontend and browser checks also passed. The owner authorized a PR only; hosted CI, merge and deployment are separate gates. Earlier execution restrictions below describe the implementation phase.

## Bounded plan / root causes
Work only in site-quality on fix/site-quality. Preserve frontend recovery changes and node_modules symlink. No publication, installations, database reuse, or compiler work.

1. B1: Real API regression tests for non-string layout fields in generation and compile normalization, malformed document layout/source modes and non-object bodies. Guard types before set/dict operations at shared boundaries. Preserve established fallback for unsupported string generation values and column coercion.
2. B2: Real TemplateSerializer create/update tests for conflicting default_ / bare / canonical aliases, plus accepted matching aliases. Normalize bare template aliases before validation, reject conflicts instead of overwriting validated values.
3. B3: Real registration API tests for username/password similarity, password error shape, no persisted invalid user, and valid hashed-password registration. Run contextual Django validation on validated attributes before save.
4. Run focused tests red then green per defect; full backend suite with coverage >=95 and Ruff over backend, scripts and frontend/scripts using approved existing venv and in-memory SQLite. Self-review; leave independent review/browser verification to parent.

## Caller sweep / prior art
validate_layout_params has two callers: generate_sheet and compile_latex. validate_layout handles canonical and legacy document writes in DocumentContractSerializer, shared by TemplateSerializer and CheatSheetSerializer. Both serializer preprocessing layers copy input before DRF shape validation. Source-mode dictionary/set lookups have the same unhashable-input hazard. UserSerializer is the RegisterView serializer; its field-only password validator lacks the username. Existing DRF ValidationError and Django validate_password suffice; no dependency or new abstraction needed.

## Evidence
- B1: `.pi/api-b1-red.log`: 83 failures/2 passes; `.pi/api-b1-bodies-red.log`: 17 failures/86 passes. Four additional Template update cases initially failed fixture setup (missing latex_content), corrected without weakening assertions. `.pi/api-b1-green-final.log`: 103 passed.
- B2: `.pi/api-b2-red.log`: 11 failures/33 passes/74 deselected; `.pi/api-b2-green.log`: 118 passed. All five template layout alias families covered on create/update; supported bare/default/matching/canonical aliases persisted and read back.
- B3: `.pi/api-b3-red.log`: 1 failure/3 passes/118 deselected (similarity accepted as 201); `.pi/api-b3-green.log`: 122 passed, including invalid-user non-persistence and valid hashed-password creation.
- Final full suite: `.pi/api-full-tests-final.log`: exit 0, 636 passed, seven existing PostgreSQL skips, API coverage 97.23% (95% threshold), 67.40s. Final focused document/regression run: `.pi/api-focused-final.log`: 136 passed. Final Ruff across backend, scripts, frontend/scripts: `.pi/api-ruff-final.log`: All checks passed. Full suite revalidated after self-review restored original data.copy() behavior to preserve QueryDict semantics.
- git diff --check passed; index empty; HEAD unchanged; frontend node_modules symlink unchanged. No commits or publication.
- Skill red-commit/stash recommendations not applied: preserve dirty frontend tree; no commits/staging or publication.

## Self-review / diagnostics
Correctness, security, scope, dependencies and test clarity reviewed. No dependencies, migrations, credentials, or external calls added. Only shared trust boundaries changed. Existing unsupported-string defaults and numeric column coercion retained for generation/compilation. Template aliases normalize before validation; conflicting representations cannot overwrite validated values. Django password policy receives the prospective username and preserves password-keyed list errors.

The editor LSP cannot resolve installed Django/DRF/pytest through the sibling virtual environment. Supervisor explicitly approved runtime pytest/Ruff validation without interpreter configuration changes; no clean LSP claim. Separate pi-lens findings in views.py (12 whitespace-only lines, 2 unchained Http404 raises, urlopen scheme warning) are unchanged from ea0eae3, confirmed via git show comparison. Synthetic password literals are intentional test inputs, not credentials. No suppressions or weakened assertions added. Independent review and parent browser verification passed; hosted CI remains pending.
