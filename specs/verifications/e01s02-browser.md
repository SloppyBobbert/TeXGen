# e01s02 browser checks — accepted

Current result: all 31 browser checks passed in `b81f38975`; both independent reviewers passed at 100%. See `e01s02-acceptance.md`. The entries below are the chronological investigation record, not the current gate status.

`ba1871b9a` ran the existing three real-stack journeys against the owned Compose services. All three failed. Desktop/mobile journeys failed because Back did not restore the latest confirmed removal. The registration journey timed out waiting for a successful compile response. Test assertions and timeouts remain unchanged.

Owned backend logs show the generation and compile endpoints returned HTTP 200 at 07:43:48 and 07:43:51 UTC. This does not prove the browser received or displayed the PDF. A bounded rerun of the registration journey with Playwright tracing (`b82de926e`) passed in 6.7 seconds, without changing code, assertions, or timeouts. The original timeout remains unexplained; the complete browser suite must pass again after the undo repair. Traces remain local because they can contain test credentials.

The parent added an immediate in-memory undo/redo case to the real-App recovery test matrix. Existing immediate Save and compile/reload cases are retained unchanged. `b30596d1c` failed the new case (33 unrelated cases filtered out). It confirms that App save publication replaces newer reducer history with an older snapshot. The parent changed local and remote save publication to preserve the reducer's current recovery history/cursor using a functional update. `b4da8e3cb` passed: 230 tests in 17 files, zero-warning lint, production build, and all three real-stack journeys in 18.2 seconds. No tests were skipped. The browser assertions and timeouts were not weakened.

`bbde9126c` failed all six new accessibility checks at 1440px, 390px, and 320px: the skip link was absent, and class collapse was not a separately named keyboard control. Later viewport assertions were not reached, so no overflow result is inferred.

The parent added a visible-on-focus skip link and a focusable main target, changed the nested editor main to a named section, separated class drag/collapse/remove buttons, and named native formula drag buttons. Handle sizing preserves focus visibility, and touch-action is restricted to handles so ordinary list scrolling remains possible. The existing real-stack expansion step now selects the named class button; its data-retention assertions are unchanged.

`be95db70a` passed unit tests, strict lint, build, and six of nine browser tests, including all three recovery journeys. The remaining three cases passed skip-link/landmark checks but attempted to open the editor before content existed. The parent corrected this test precondition by selecting UNIT CIRCLE and generating a document; no application behavior or timeout was changed. `bce23a57f` passed all nine browser tests in 22.3 seconds.

`bd9eb8f46` passed: 422 backend tests, five PostgreSQL-only skips, 96.71% coverage, Ruff, system checks, and migration drift checks. The skips are not counted as passes. Targeted accessibility checks pass; independent review remains pending.

The preferred `agent-browser` CLI timed out during open and snapshot. Its diagnostic check found installed Chrome and the owned session daemon. The parent closed only session `texgen-e01s02-audit`; closure succeeded. No other browser sessions or Docker services were stopped. Playwright remains available for the existing test suite.

Accessibility review reference fetched: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md . No accessibility pass is claimed yet.
