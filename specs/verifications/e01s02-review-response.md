# e01s02 review response — round 1

type: verification
context: e01-launch-readiness / e01s02

Current result: PASS. Both fresh round-3 reviewers passed at 100%, with zero must-fix or should-fix findings. See `e01s02-acceptance.md`. Round 1 failed: Reviewer A scored 80%; Reviewer B scored 81.25%. Both reports were read before repairs began. The final frontend gate `baef40f7f` passed 244 tests, strict lint, production build, and 28 browser tests (28.1 seconds). This is not yet story acceptance.

## Accepted findings

1. **Must fix — generation snapshot consistency (A M1).** Add delayed-response tests for title edits and selection changes. Prevent an old operation from overwriting newer document state or combining mismatched source and selections. `bcf52cb36` reproduced title/addition/reordering failures. The repair invalidates operations on title/selection value changes. Verified by `bd674c124` and the final `baef40f7f` gate.
2. **Must fix — video publication after cancellation (B M1 / A S2).** `b3338fe3a` reproduced six failures across clearing and replacement with late successful, aborted, and failed bodies. Three unmount transport checks also run. Add a post-body cancellation check and ignore cancelled errors; do not swallow body failures as empty success. `b1dbf6dc4` passed all 13 video tests but failed lint on an unqualified DOMException in the new test. After qualifying it with window, `bf8e50a90` passed all 13 tests and strict lint.
3. **Should fix — LaTeX body transport lifetime (A/B S1).** Keep controllers registered through body consumption and assert signal cancellation after headers. Retain epoch publication guards. `bcf52cb36` reproduced four body-cancellation failures (edit, unmount, logout, account switch). The request helper now consumes JSON/blob/error bodies before removing its controller. Verified by `bd674c124` and `baef40f7f`.
4. **Should fix — accessibility coverage (A S3 / B S2).** Add 375px, 768px, short landscape, actual class/formula keyboard movement and cancellation, video-dialog focus lifecycle, and reduced-motion checks. The expanded suite found incorrect nested drag targets, an unnamed close button, and missing reduced-motion styles. Compatible drop targets, explicit activator refs, a close label, reduced-motion CSS, and immediate keyboard scrolling repair those paths. Keyboard tests wait for pickup and collision measurement before sending movement keys, verify intended targets before cancel/drop, and explicitly Save before canonical-draft reload. No timeouts or order assertions were weakened. `bce627da1` passed five repeated keyboard journeys; `baef40f7f` passed all 28 browser tests.

## Round 2 — runtime motion

Round 2 did not pass the AND gate (A 95%, B 93.75%). Both identified explicit PDF smooth scrolling; B also identified logo scaling. `b7455e5f0` reproduced both reduced-motion failures while the normal-motion control passed. The repair uses the existing MotionConfig user policy and checks the live motion preference for PDF scrolling. Runtime tests sample rendered logo transforms and exercise the real compiled PDF's scroll-to-top action. The existing App motion mock gained a MotionConfig export; no assertions were removed.

Final round-3 evidence: `b81f38975` passed 244 unit tests, strict lint, build, and all 31 browser checks in 32.9 seconds. See `e01s02-round3-manifest.json` for the exact source fingerprint. No large-document performance claim is made. Embedded-player and physical-device coverage limits remain explicit.

## Test integrity

The new video cases initially replaced an existing test filename. Before applying the repair, the original `youtubeResources.test.jsx` was restored byte-for-byte from HEAD and verified with `git diff --exit-code`. New cases now live in `youtubeResources.lifetime.test.jsx`. The verification command runs both files. No original assertions are removed.

## Review notes

Reconcile historical verification headings at closure. Broader rerender cost is an unmeasured consideration, not evidence for a speculative component rewrite. No story closure, commit, push, or production-readiness claim is made. Both independent reviewers rechecked the exact repaired fingerprint and passed. The acceptance document records the final gate.
