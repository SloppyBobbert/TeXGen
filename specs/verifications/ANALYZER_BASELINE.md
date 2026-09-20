# Django analyzer baseline decision

The parent independently compared `backend/api/models.py` with its exact `origin/main` version at `65a4938`.

Method: export the original module to a temporary Python file beside `models.py`, then actively probe both files through the same Pyright LSP and the same project configuration/interpreter. The temporary file was removed after the comparison. No application source was changed by this investigation.

Results:

- Current module: 20 Pyright errors.
- Original module: the same 20 errors, with only the expected line shifts from two added fields.
- Neither added `generated_sections` JSON field produced an error in this probe.
- Findings concern numeric field defaults inferred as `NOT_PROVIDED`, instance fields inferred as descriptors rather than Python values, and Django-generated reverse relations not recognized by the analyzer.

The active probe does not substantiate 41 distinct new errors. The child reports that the edit gate aggregates 41 findings.

## Disposition

Use the supported `lens_diagnostic_mark` false-positive disposition for each exact, verified Django inference error. Do not use `suppress`, add ignore comments, lower diagnostic severity, or blanket-dismiss other rules/files. Keep reasons and baseline evidence. A reported finding is not automatically false merely because it existed before the change; this decision applies only to the verified Django inference failures above.

Any additional gate entry must be matched to the same source location and inference failure or independently examined. New diagnostics still require investigation. Continue active probes and all runtime tests. If the supported disposition does not clear the gate, report the exact remaining entries instead of repeatedly changing application typing.

This is an analyzer-adjudication decision, not a claim that the new feature works. The task-2 regression is still RED and its implementation is incomplete.
