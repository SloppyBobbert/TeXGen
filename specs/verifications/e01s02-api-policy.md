# e01s02 API request policy — accepted

Current result: verified within 244 frontend tests and both independent reviews at 100%. See `e01s02-acceptance.md`. Pending statements below describe earlier checkpoints only.

The new client permits only same-origin `/api/` paths. It shares one refresh promise across concurrent reads and retries GET/HEAD at most once after a 401. It does not refresh or replay POST/PATCH/PUT/DELETE requests. Caller cancellation, network failures, and login-session changes prevent replay. Application integration and AuthProvider lifecycle tests remain pending; this is not task 2 completion.

## Checks

- `bc05271cb`: expected missing-module failure before implementation; zero tests ran. This proves only the missing implementation boundary, not behavior.
- `be85d1bdb`: ten policy tests passed. Strict lint failed on two unqualified browser globals (`DOMException` and `AbortController`).
- Parent changed both uses to `globalThis` properties without changing policy. `b70c25995` passed: ten tests and zero-warning lint.
- `bf6694e8e` failed all four provider regressions. Three failures demonstrate existing lifetime bugs: late login restored credentials after logout, an older login replaced a newer account, and unmount did not abort authentication transport. The fourth failure was the missing provider API entry point.
- Parent connected the provider to the client, kept tokens in memory, added version checks before publishing responses, aborted authentication transport on session changes/unmount, and bounded authentication requests to ten seconds. Timer/read refresh uses the same client. `b559ac4d7` passed all 14 provider/client tests and strict lint.
- Parent migrated App saves, LaTeX requests, catalog loading, Dashboard actions, and video-resource requests to the shared client through `useApiRequest`. The existing compile operation epochs and caller signals remain. `bddc26a67` passed 213 tests, strict lint, and build, but the lower-than-expected test count exposed an accidental replacement of the existing authentication test file. That result is not accepted as complete regression evidence.
- Parent restored `AuthContext.test.jsx` byte-for-byte from HEAD (confirmed with `git diff --exit-code HEAD -- frontend/src/context/AuthContext.test.jsx`). New lifetime tests are in `AuthContext.lifetime.test.jsx`. The registration success path still does not require a response body. Added successful refresh, in-memory credential, and ten-second refresh-timeout tests. `b0ae7d788` passed all 220 tests in 17 files, strict zero-warning lint, and the production build. No tests were skipped.
- Provider success and timeout tests now pass. Removed the remaining repeated compile authorization headers; the shared client is the sole credential-header owner. Request-lifetime review continues with three new Dashboard regressions (`b73c1e96c`): an old response body after an account switch, retained account listings after logout, and a PDF body completing after unmount. These remain unverified. The failed Luna checks produced no verification report and do not alter these local test results.
- React effect cleanup guidance was checked against the official React documentation via Context7 (`/reactjs/react.dev`, `reference/react/useEffect.md` and `learn/synchronizing-with-effects.md`). Stale responses must be ignored even when transport cancellation is not honored.

Commands run from `frontend/`: `npm test -- --run src/api/client.test.js && npm run lint -- --max-warnings=0`. Logs are under the root checkout's `.pi/tasks/session-68908-68908/`.
