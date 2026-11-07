# BTCBOXCDT — Open Issues & Owner Handoff (2026-11-04, updated 2026-11-07)

> This file was referenced in the collaboration instructions but did not exist in
> the repository at handoff time. It is created here to record the current state
> and exact continuation point.

## Current branch & git state
- Branch: `work/btcbox-unified-20261104` (tracks `origin/work/btcbox-unified-20261104`).
- Handoff commits verified in history: `e0b192f5749f30934257bb69966dc114bf7b9cc7` (admin finance projection code), `d8539d2ed66370f7ce0fffadcc48d6fa98dbd5b9` (doc commit, was HEAD at start).
- Code commits added in this session (oldest → newest):
  1. `4e5e5685832a158a81cd8a34e181335355fd65e9` — fix(kyc): unify in-review status aliases
  2. `e423b4afbe6827ef7bb05c0555b57614070471ee` — fix(orders): align customer/admin order projections
  3. `88e39bf559be428394c26161d27fa27b8799453a` — test(admin): fund-operation audit/idempotency invariants
  4. `e6c7d933358992b1874be425fbe7ec5c500c894a` — fix(admin): broadcast push idempotency by request_id
  5. `dd98b5470f66952976e512bbb3e894e79fe87836` — test(admin): API contract invariants
  - Plus this documentation commit (see git log).
- Working tree: clean (no uncommitted changes) after the doc commit.
- PRs: #51, #52, #53 were found closed and could not be reopened; fresh draft PRs
  were opened to trigger CI. Backend CI was also triggered via `workflow_dispatch`
  on the work branch as a reliable fallback.

## Tests passed / not passed
- Backend `node --test tests/*.test.js`: 393 tests, 392 pass. The single failure is
  `build-site.js publishes the React root...` — a pre-existing environment issue
  requiring a frontend build artifact (`frontend/dist`), unrelated to these changes.
- Frontend: `tsc --noEmit` (lint script) passes locally. Frontend CI was
  path-filter-skipped on GitHub because no `frontend/**` file changed.
- PostgreSQL schema CI: path-filter-skipped because no `backend/supabase/sql/**`
  file changed. Parent baseline green.
- CI-skip clarification (verified 2026-11-07): `frontend-ci.yml` and
  `btcbox-postgres-schema-ci.yml` have no `workflow_dispatch` trigger, and their
  `push` branch whitelists do not include `work/btcbox-unified-20261104`. On a
  pull_request they are additionally gated by `paths` (`frontend/**` and
  `backend/supabase/sql/**` respectively). Since this batch changes zero frontend
  and zero SQL files, both suites are correctly skipped — no source change was
  fabricated to force them. If a future batch touches either path, both will
  trigger automatically on the PR.
- Collaboration PR: Draft **#54** (open) `work/btcbox-unified-20261104` →
  `fix/post-merge-db-bootstrap-seconds-20261106`. PRs #51/#52/#53 were found
  closed and unreopenable. Do not merge or deploy.
- Verified backend CI runs (exact SHA): 42297056648 (4e5e568), 42297955945 (e423b4a),
  42298110345 (88e39bf). Later commits (e6c7d93, dd98b54) were triggered via
  workflow_dispatch; check `actions/workflows/backend-ci.yml` runs for the final SHA.

## Unresolved / owner-policy items (do not invent)
- KYC document retention/deletion after approval/rejection: no retention period,
  no automatic deletion. Blocked on owner's explicit privacy/legal policy.
- Withdrawal approve carries a hardcoded reason (no admin-supplied reason field);
  intentionally left to avoid API contract change — owner may decide to add one.
- Direct administrator balance adjustment (`POST /api/admin/user/balance`) remains
  disabled pending a maker-checker / dual-approval queue.
- PR #51/#52/#53 are closed/unreopenable; a future operator should open a fresh
  draft PR against `fix/post-merge-db-bootstrap-seconds-20261106` (or `main`) if
  CI-on-PR is desired, or rely on `workflow_dispatch`.

## Exact continuation point for the next AI
- Start from `work/btcbox-unified-20261104` HEAD (doc commit after `dd98b54`).
- Files last modified: `backend/api-core.js`, `backend/tests/kyc-flow.test.js`,
  `backend/tests/account-credentials.test.js`, `backend/tests/order-history-source-parity.test.js`,
  `backend/tests/admin-fund-ops-audit.test.js` (new), `backend/tests/admin-support-idempotency.test.js` (new),
  `backend/tests/admin-api-contract.test.js` (new), `docs/AI_COORDINATION.md`, this file.
- Suggested next work: (a) if frontend/SQL changes are made, run frontend-ci and
  PostgreSQL CI on the exact SHA; (b) consider adding admin-supplied reason to
  withdrawal approve if the owner wants it; (c) continue hosted Supabase Auth/Storage
  workflow testing only in isolated staging with test credentials.
- No uncommitted modifications expected. If `git status` shows `backend/dist/`,
  remove it (build artifact, not tracked).

## Authentication contract correction — 2026-11-07

Owner-confirmed required methods: BTCBOX username/password login, Google OAuth, and wallet login (Ethereum/Solana Web3). Email registration, email/password login, and email OTP/recovery are not required.

Implementation batch on this branch:
- frontend/src/features/auth/AuthPages.tsx: login UI now includes username/password, Google, Ethereum wallet and Solana wallet. Registration uses Google or wallet identity; first-time identities are routed to Account Setup to create BTCBOX username/password.
- frontend/src/lib/auth.tsx: removed React email/password sign-in, email registration, and email reset/recovery methods. Retained username credentials and Google/Web3 auth flows.
- backend/api-core.js: Supabase identity allowlist now accepts only single-provider Google or Web3 identities; email provider identities are rejected.
- frontend/e2e/auth-routes.spec.ts: browser assertions now cover the requested entry points and absence of email forms.
- backend/tests/account-credentials.test.js: verifies Google/Web3 allowed and email/multi-provider identities rejected.
- backend/tests/google-only-auth.test.js: replaced stale Google-only React UI assertion with the owner-approved three-method contract.

Backend username authentication already uses PBKDF2-HMAC-SHA256 (600,000 iterations), strict username/password validation, IP/username rate limits, frozen-account checks and optional 2FA. Web3 identity verification is handled by Supabase Auth and checked server-side against the verified identity; Ethereum/Solana wallet addresses are validated and duplicate wallet ownership is rejected.

Important: source-level implementation is not proof of live Supabase provider configuration or successful real wallet signatures. Isolated E2E/runtime auth verification remains outstanding. No production auth settings, database, merge or deployment was changed.
## Authentication batch verification update — 2026-11-07

- Frontend CI run 42314537379 passed on source SHA 80731237b1f58d5097563521a9524e1f0d060c8c: npm install, lint, build, Chromium install, and desktop/mobile Playwright route smoke tests all completed successfully.
- Backend CI run 42314790953 passed on source SHA 62250b00bae0d7eac20bede9adf98e69c4137e85: backend build and all 402 tests passed; deployment preflight completed successfully.
- An earlier backend run failed because stale Google-only assertions remained in google-only-auth.test.js, google-only-identity.test.js, and spot-trading-live-refresh.test.js. Those assertions were corrected to the owner-approved username/Google/Web3 contract; the latest backend run above is green.
- The latest code commit at the time of this note is 62250b00bae0d7eac20bede9adf98e69c4137e85. Documentation updates may advance the branch head without changing the tested application source.
- SOURCE OBSERVED + TEST PASSED: username login UI and endpoint contracts, Google UI flow, Ethereum/Solana wallet entry points, email-provider rejection, frontend build/lint/browser route smoke tests, and backend 402-test suite.
- NOT VERIFIED: live Supabase Google provider configuration, real wallet signature challenge on mobile/desktop wallets, fresh account creation against isolated Supabase, and full account setup with a newly provisioned wallet identity.
- Production deployment remains paused. No production database/auth settings were changed.

## Admin KYC evidence-gating batch — 2026-11-07

- SOURCE OBSERVED: the admin KYC queue returns `document_uploaded` and a short-lived private `document_url`; the backend normal approval path rejects missing stored evidence with `KYC_DOCUMENT_REQUIRED`.
- SOURCE OBSERVED: the KYC queue previously enabled Approve even when the document was absent or its signed preview URL could not be generated. This exposed an action that was guaranteed to fail, and could encourage reviewers to approve without seeing the evidence.
- FIXED: Approve is now disabled unless the upload exists and a secure preview URL is available. The row explains whether the document is missing or the preview needs refreshing. Reject remains available to authorized reviewers.
- SECURITY / BUSINESS RULE: no admin exception override was added to the UI. The existing backend `admin_override` bypasses the ordinary evidence gate and requires a reason; enabling it is a material review-policy decision and is not silently exposed as a normal approval path.
- TEST ADDED: `backend/tests/kyc-flow.test.js` asserts the evidence and preview gate while preserving the authorized reject path.
- NOT VERIFIED: live Admin session, signed-document preview against Supabase Storage, and browser-level manual KYC review. No production records, database, deployment, or financial operation was touched.
- Commits: `7fe5a5ea214b3633107a9276cd604554e6df4ae7` (UI); `8b452412ed5e6a3f560bfd01426ec117da4a773a` (regression test).


## Withdrawal rejection audit-reason hardening — 2026-11-07

- SOURCE OBSERVED: the Admin UI already requires a non-empty rejection reason, but the backend API previously substituted a generic default reason when a caller omitted it. This allowed a direct API caller with `withdrawals.review` permission to reject/refund without recording the operator's actual rationale.
- FIXED: `POST /api/admin/withdraw/reject` now rejects blank reasons with `WITHDRAWAL_REJECTION_REASON_REQUIRED`; reasons over 200 characters or containing control characters are rejected with `WITHDRAWAL_REJECTION_REASON_INVALID`. Valid reason text is passed unchanged to the atomic database review RPC.
- TEST ADDED: `backend/tests/admin-api-contract.test.js` verifies the server-side validation and confirms the UI still requires a reason.
- Preserved: atomic `review_withdrawal_atomic` transaction, row lock, ledger refund, and append-only audit event. No SQL migration or production database change was needed.
- NOT VERIFIED: backend test suite on this exact commit; GitHub Actions push should run backend CI, but no passing run result has been observed yet. Vercel's prior build-rate-limit check is separate from backend tests.
- Commits: `d2e13fe776efd54af3d9d828e03689b854ad8916` (initial API validation); `ee7e1e6a35c6158cf5c37bc46602fe5746520fca` (regression test); `cd2ab8079cb91b889792d4736f171bafbf2c2468` (correct control-character matcher).
- No merge, deployment, production database change, or live financial operation was performed.


## Bybit fallback freshness gate — 2026-11-07

- SOURCE OBSERVED: the market endpoint already had a 5-second provider fetch timeout and Coinbase-primary / Bybit-fallback behavior. Coinbase `ticker.time` is last-trade time; Bybit `payload.time` is provider response time.
- FINDING: Bybit fallback rows were accepted even when the response timestamp was absent, more than 60 seconds old, or implausibly more than 15 seconds in the future. That could surface an old cached response as a current BTCBOX snapshot.
- FIXED: Bybit fallback now requires a valid provider response timestamp within the range `now - 60s` through `now + 15s`; stale/invalid rows are skipped rather than presented as fresh.
- IMPORTANT: this age gate is deliberately not applied to Coinbase last-trade timestamps; quiet trading pairs can legitimately have an older last trade while the provider request itself is healthy.
- TEST ADDED: `backend/tests/spot-market-catalog.test.js` locks the Bybit response-time gate and protects Coinbase's distinct last-trade semantics.
- NOT VERIFIED: live upstream behavior, production market freshness, and the exact-commit backend CI result. No production market/provider settings were changed.
- Commits: `b19331f3015126cc6fa3043d778cbe3d04abd2ff` (freshness gate); `a09834e834d9fd811c01cf2a97b3eda6c049eb1c` (regression test).
- No merge or deployment was performed.

## Manual withdrawal payout audit cross-check — 2026-11-07

- Source-observed: `mark_withdrawal_paid_atomic` requires an approved withdrawal and a non-empty, bounded payout reference; it changes payout status and records the reference, actor, timestamp and an audit event. The function does not broadcast a chain transaction or apply a second ledger debit.
- Source-observed: an exact retry with the same reference returns the completed result before the audit insert; a retry with a different reference is rejected. This prevents duplicate completion audit rows and prevents silently replacing the payout reference.
- Follow-up regression coverage added in `backend/tests/withdrawal-manual-payout.test.js` at commit `8e41700b213bc30aba86b3e31bd441db9676ea7a`: checks actor/subject/action/reference fields, paid_by/paid_at, and the no-duplicate-audit retry path.
- Verification status: source/test assertions added; test suite has NOT been run on this commit in this environment. Do not label TEST PASSED.
- No SQL migration, production database, real payout, merge or deployment was performed.
- Next continuation: inspect market response/cache freshness and spot trade public preview/depth/K-line route parity; then auth entry-point smoke tests. Keep the work moving with concise source-level checks and targeted regression tests.

## Public market snapshot freshness — 2026-11-07

- Source-observed before change: browser requests already use `cache: "no-store"` and the spot-trade screen polls ticker/depth every 15 seconds; backend fetches current Coinbase/Bybit data per request (the declared `LIVE_PRICE_CACHE_MS` is not used by the market route). The public response nevertheless allowed a 5-second shared-cache lifetime plus 3 seconds stale-while-revalidate.
- Changed `backend/api-core.js` market response cache policy to `public, max-age=0, s-maxage=2, stale-while-revalidate=1`. This reduces shared edge reuse while retaining a small cache to avoid excessive provider calls; no stale provider data is substituted on upstream failure.
- Added regression assertion in `backend/tests/spot-market-catalog.test.js` for the cache policy, browser no-store behavior and 15-second trade-screen refresh interval.
- Commits: `e2898dddb7b3a556a3e59ad531b9b72f8c700dda` (API), `1ff6d48da611f6a1679179d931a4832a3ab936b6` (test).
- Verification status: source and test assertion updated; no test run on these commits in this environment. Live upstream freshness and deployed browser behavior remain NOT VERIFIED.
- No production deployment was performed.

## Spot ticker / depth / chart consistency — 2026-11-07

- Found a visibility gap: the trade screen showed only one provider label (order book preferred), hiding when ticker, depth and candles came from different upstream providers. It now displays separate Ticker / Order book / Chart source labels.
- Depth API now normalizes both Coinbase and Bybit levels, drops malformed/non-positive price or size rows, sorts bids descending and asks ascending, caps each side at 20 levels, and rejects an empty/malformed side rather than returning a misleading partial book. Response includes server snapshot time and provider timestamp when Bybit supplies one.
- Frontend depth parser independently validates/sorts levels and rejects an empty/malformed book.
- K-line client now retains provider provenance, validates OHLC range consistency, and exposes a visible warning when refresh fails instead of silently keeping old candles.
- Added source-contract regression assertions in `backend/tests/spot-market-catalog.test.js`.
- Commits: `ae544a241fc0d8fcd93f94b55bafe998788cb045` (depth API), `f9c20505a739864dc85881b0fc64232ade8d2bd4` (depth client), `9d280a5774560ffcd4579ff4da3e32794fc6423d` (provider labels), `36d71cc080ff72582a92ac7d0fac668001a21c29` (depth regression), `17114ab149f1b9c897b8d657d2f8d51c769d39a5` (candle source/OHLC validation), `3081a36532d481cb83ddae409c1366047d6f2ca3` (chart warning/source UI), `08fabb8c8566f4527160d184c014443acc2a477c` (chart regression), `38a4f8f3b1f52f72d026c6b976917aa5dd01a89a` (K-line response typing).
- Verification status: static source cross-check and regression assertions committed; test/build/browser execution on these commits remains NOT VERIFIED. No production deploy or real order activity.
- Next continuation: run/check CI on the current head; then address route-level auth behavior and responsive trade UI issues without changing execution/settlement logic.

## Mobile spot preview regression coverage — 2026-11-07

- Added a 320px Playwright spot-preview case with isolated market/catalogue/K-line/depth/trading-status fixtures.
- The test asserts distinct Coinbase ticker / Bybit order-book / Coinbase chart provenance, no chart-refresh warning on successful fixture data, and no horizontal document overflow at 320px.
- Commit: `27782f4bd589ee84d133c3862e32bf63568c874d`.
- Follow-up corrected source-contract test strings for the three provider labels: `a4404e287e9fcdaa4b88a9522a817d36a9cfb95d`.
- Browser test has not run in this environment. Current visible commit status still reports only Vercel's deployment rate limit; no corresponding GitHub Actions result has been observed yet.

## CI verification update — 2026-11-07

- Backend CI run `42318730474` on `1b472aff19232f02295079a86f76096881ceeb46`: SUCCESS. Unified site build, all backend tests, fail-closed deployment configuration validation, and preserved-entrypoint verification all passed. This run includes the depth normalization and chart source/OHLC changes and the corrected cache-window regression test.
- Frontend CI run `42318554054` on `27782f4bd589ee84d133c3862e32bf63568c874d`: SUCCESS. Lint, build, Chromium install, and desktop/mobile route smoke tests passed, including the newly added 320px spot preview test.
- An earlier backend failure was a test-boundary assertion mistake (the K-line route is earlier in the file than the ticker route), not a product-code failure; corrected in `1b472aff19232f02295079a86f76096881ceeb46`, after which backend CI passed.
- Frontend failures before `38a4f8f3b1f52f72d026c6b976917aa5dd01a89a` were due to the KlineResponse type missing the new `source` field; type corrected and frontend CI passed.
- Vercel status remains a separate deployment rate limit (retry in 24 hours); deployment remains paused by project instruction. No production deployment.

## Authentication audit and browser regression — 2026-11-07

### SOURCE OBSERVED
- BTCBOX username/password are internal credentials on the existing BTCBOX account, not a separate email-auth account. Passwords are salted PBKDF2-SHA256 hashes with 600,000 iterations and timing-safe comparison; username login has persistent IP + username rate limiting.
- First credential setup requires a fresh authenticated session (maximum five minutes), validates username uniqueness, and writes the credentials to the same account. The route does not create a second user.
- Google OAuth uses Supabase PKCE. The callback exchanges the authorization code for a session and the backend verifies the Supabase identity before issuing the BTCBOX session.
- EVM and Solana sign-in use Supabase Web3 sign-in; the frontend requires an access-token session before exchanging it with BTCBOX. EVM discovery uses EIP-6963; Solana detection supports injected Phantom/Brave/standard providers.
- Credential recovery is gated by a fresh linked Google/wallet identity and short-lived server-side proof; TOTP is required when enabled. Password recovery revokes other BTCBOX sessions and pending 2FA login tokens.

### CHANGES
- Added Playwright test for username/password login request contract and visible invalid-credential rejection.
- Added Playwright test for first-time username/password setup, confirming the request stays attached to the authenticated BTCBOX account.
- Test commit: 2598d7ef901e7bea36036d6381e3d2126838c525.
- Coordination evidence commit: 0b854bd7dd71815402d18dc63523523fcd711f37.

### NOT VERIFIED / NEXT
- Live Google provider enablement and redirect URI allowlist in Supabase.
- Wallet sign-in on actual injected EVM and Solana wallets/devices; local E2E currently tests UI and API contracts, not real wallet signatures.
- End-to-end login against hosted backend and the newly added Playwright tests' CI result.
- Next batch: inspect backend Supabase identity exchange for Google/Web3 provider parity; add isolated wallet-provider cancellation/unavailable tests and callback failure/retry tests. Do not change the email-auth exclusion, real financial paths, production DB or deployment state.

### Test follow-up — 2026-11-07
- Frontend CI run 42319186017: username-login E2E passed; first-credential setup E2E failed on desktop and mobile because the new mocked `/api/account` fixture omitted required `unpriced_assets`, causing account bootstrap validation to fail before the setup screen rendered. This was a test-fixture defect, not evidence of a production auth regression.
- Added `unpriced_assets: []` to the fixture in commit 1d066f5f6050e4c47d061528dd1d6fe4bd3afbe2. Awaiting the rerun; do not mark the test green until CI confirms.

### Authentication regression batch — verification completed 2026-11-07

- Username login browser contract test passed (request payload + safe rejection UI).
- First-time username/password setup passed on desktop and mobile; fixture now models the account snapshot before and after credentials are saved so the setup gate is exercised accurately.
- Google OAuth cancellation callback test passed; user receives a visible error and return-to-login path, with no BTCBOX session creation.
- Backend wallet claim tests cover EVM address normalization, Solana base58 address acceptance, malformed EVM/Solana addresses and unsupported chain rejection.
- Frontend CI run 42321032193 at 00581b5ab1bc10697ce01f447b91d21d17f0372e: SUCCESS (lint/build + desktop/mobile Playwright).
- Backend CI run 42321114844 at 863576598db9414669798ff917f389ccb8eb8892: SUCCESS (411 tests + unified build/preflight).
- Test-only failures and fixes: 2598d7e failed because the account fixture omitted required unpriced_assets; 1d066f5 corrected it; 00581b5 made the account response reflect persisted credentials; bfd5056 added OAuth cancellation coverage; d77126f initially used an unsuitable cross-realm strict assertion; 8635765 corrected the assertion and passed CI.
- Live Google provider enablement/redirect allowlist and real EVM/Solana wallet signature flows remain NOT VERIFIED. Do not claim production authentication is live solely from isolated CI. No deployment or production data change.

## Mobile spot workstation — implementation and verification 2026-11-07

- Reordered mobile spot experience: ticker/price summary first, limit-order entry immediately after; long chart and order-book content no longer pushes order entry down the page.
- Chart and order book are mobile bottom drawers with 72dvh max height, safe-area padding and explicit Close controls. Desktop remains side-by-side.
- Chart initialization is deferred while hidden/zero-width and runs when the chart drawer opens; resize observer tracks its actual visible width.
- Added 320px E2E assertions for the above-the-fold priority, drawer default state, chart canvas render, chart/depth open-close, source labels and horizontal overflow.
- CI run 42321826347 at bb6183557b9048734382c3f4cac75d8fbc8b5a7c: SUCCESS; 32 desktop/mobile route tests passed; lint and build passed.
- Files changed: frontend/src/features/pages/Pages.tsx and frontend/e2e/auth-routes.spec.ts. Main code commits: 1b77262b (reorder + toggles), 73ecc2c8 (price summary moved above the grid), 16496e2a (bottom drawer styling), 4103b146 (close controls), 046fc466 (visible-width chart initialization); final regression sequence: bb618355.
- No financial logic or production environment touched.

### Wallet provider failure regression — 2026-11-07

- Added E2E coverage for unavailable injected Ethereum and Solana providers. Each must show a visible error and must not call the BTCBOX Supabase-session exchange endpoint without a verified wallet session.
- Frontend CI run 42322062375 at 24017400371e46cb200fbe37867c5190ee5f1080: SUCCESS; lint/build passed and all 34 desktop/mobile route tests passed.
- This is an isolated provider-unavailable test, not a real wallet signature test. Live EVM/Solana signing, Supabase Web3 provider configuration and real device compatibility remain NOT VERIFIED.

## Admin semi-manual review queue — 2026-11-07

- Existing workflow retained: staff verify a deposit receipt/transaction reference and manually credit the selected user's asset row; withdrawal requests are approved/rejected first, actual transfer is staff-operated, and Mark paid requires TxID/reference; KYC approval remains blocked unless uploaded document and secure preview URL are present; rejection requires a reason.
- Added explicit refresh buttons to Withdrawal and KYC queues for staff to load newly submitted requests while staying in the review tab.
- Refresh indicator is independent from action busy state. Manual refresh failures no longer display language that implies an action was confirmed; post-action queue refresh failures retain the confirmation context.
- AdminPage changes are frontend-only; no financial route, ledger, approval decision, transfer or settlement semantics changed.
- CI run 42322366989 at 3e15087f7952f05d3022f61be3f62ee14af1f8bc: SUCCESS. Follow-up correction commit c7366273d51526bca32135766908ba1160d8fcf7; CI run 42322432342: SUCCESS.

## Vercel production build and live-market verification — 2026-11-07

- Unified branch HEAD at this checkpoint: `386a325214d670756801cd5d9ad26712bfa78b89`. Latest application-source verification remains frontend CI run `42322432342` on `c7366273d51526bca32135766908ba1160d8fcf7` (SUCCESS); latest backend source verification is CI run `42321114844` on `863576598db9414669798ff917f389ccb8eb8892` (SUCCESS, 411 tests). The commits after those source SHAs are documentation-only or frontend-only as shown in branch history.
- Vercel project `btcboxcdt` latest production-target deployment is `dpl_2cAQrbFQbTouccNyccnYZfY7P89e`, built from `main` SHA `361be5c395fef85d11b52b67884122dab0d8e7c6`, not the unified branch. It is ERROR: `npm run build && npm test` exited 1; summary was 350 passed / 6 failed.
- Build logs explicitly show `ADMIN_PASS_TOO_WEAK` from the module-level `adminPassStartupCheck` in `backend/api-core.js`. The failing test-file imports include `backend/tests/backend_security.test.js` and `backend/tests/seconds-reference-timestamp.test.js`; importing the API module triggers the startup guard. This is an environment configuration/security-policy blocker, not evidence that the current unified-branch CI failed. Do not weaken or remove the guard to make the build green.
- The Vercel `ADMIN_PASS` value was not retrieved or exposed. Owner/operator action required: replace the Vercel `ADMIN_PASS` value in the relevant deployment environments with a unique password meeting the existing policy (at least 12 characters, uppercase + lowercase + digit + symbol, and not in the weak-password denylist), then re-run a preview build. Do not put the value in Git, chat, or logs. No environment variable was changed and no deployment was triggered here.
- The current production alias still serves the legacy static customer shell (`/assets/js/app-core.js`, `views-home.js`, `views-trade.js`, etc.), not the unified branch's React/Vite `/frontend-assets/` app. The latest production-target deployment is failed, so the unified branch is not live.
- Read-only live API checks at `https://btcboxcdt.vercel.app`: `/api/market?symbol=BTCUSDT` returned HTTP 200 with Coinbase source and server snapshot timestamps advancing from `1794016975` to `1794017005` across two observations; `/api/depth?symbol=BTCUSDT` returned HTTP 200 with Coinbase source and `Cache-Control: no-store`; `/api/kline?symbol=BTCUSDT&interval=1h&limit=5` returned HTTP 200 with 350 candles, latest candle at `1794013200000` (the most recently completed 1-hour candle at observation time). These are point-in-time endpoint checks, not a sustained uptime or websocket test.
- `/api/market/pairs` returned HTTP 404 on the current production alias. The unified branch implements the public `market/pairs` route; production remains on the older main deployment, so this mismatch must be retested only after a preview of the unified branch is available.
- No production DB, auth configuration, funds, orders, merge, or deployment was changed. Next: after the owner updates the Vercel secret, run a preview build against the unified branch; then verify the React shell, public market catalogue, ticker/depth/K-line freshness, and auth redirects together. Production rollout remains paused.

## PR #59 backend CI assertion correction — 2026-11-07

- Initial PR CI at head `ff6d3676cc55763cf32724265e836617027969e6`: unified build succeeded; backend tests reported 409/411 passed, 2 failed. Frontend PR CI completed SUCCESS.
- Both backend failures were stale source-text assertions, not runtime behavior regressions: `backend/tests/admin-api-contract.test.js:62` and `backend/tests/withdrawal-manual-payout.test.js:75` expected the retired literal `The database action is confirmed; the queue could not refresh`. The current Admin UI intentionally uses a shared `refreshWithdrawalQueue(confirmedAction)` helper and composes the specific confirmed-action text with `The queue could not refresh`.
- Corrected only those assertions to verify the shared helper and the explicit withdrawal approval/rejection/manual-payout confirmation messages. No application or financial logic changed. Commits: `5e9bcd25642a7e7a9edfd4e1932449398e588896` and `226e11a9d9c7d28c4ed4a422dc7eecfabb1b457c`.
- Backend PR CI run `42327514949` completed SUCCESS on code SHA `226e11a9d9c7d28c4ed4a422dc7eecfabb1b457c`: unified build passed, all 411/411 backend tests passed, fail-closed deployment preflight passed, and unified output/entrypoint checks passed. The subsequent handoff commit `f67eeceddc7780c3cb535b016ae0f8e38f9acbf3` is documentation-only. Frontend PR CI run `42327514959` completed SUCCESS: lint, build, Chromium install and all 34 desktop/mobile Playwright route smoke tests passed (17 desktop + 17 mobile), including the 320px spot preview, username/password auth, Google OAuth cancellation and wallet-provider failure cases.

## 2026-11-07 continuation — Admin browser QA coverage

- Added isolated Playwright coverage for the semi-manual Admin review system.
- Withdrawal queue case: synthetic administrator session, approved-but-not-paid request, manual refresh fails with 503; expected UI reports only queue refresh failure, Mark paid remains disabled without a TxID/reference, and no POST/PUT/PATCH/DELETE Admin request is sent.
- KYC case: synthetic pending application has no uploaded document or secure preview URL; Approve remains disabled, refresh is read-only, and no Admin mutation request is sent.
- All test API calls are intercepted; no production identity, financial write, Supabase database, merge or deployment is used.
- Commit: `d42c2fdbc5de26be937ead020e147abdd0930432`. Push CI run `42328415525` completed SUCCESS: lint, build and all 38 desktop/mobile Playwright tests passed (19 desktop + 19 mobile), including both new Admin cases. Backend PR run `42328419228` completed SUCCESS with 411/411 tests, build, preflight and output checks; frontend PR run `42328419231` completed SUCCESS with lint, build and browser tests.

## 2026-11-07 continuation — trading mode chooser and Admin QA

- Trade Hub now presents four mode categories first: Spot, Seconds, Earn, and Futures. Futures is marked unavailable because the current backend does not register a supported futures service.
- Backend-enabled spot pairs are displayed in a separate section below the category cards, with explicit loading/error/empty states; no synthetic markets are used.
- Added Earn to the chooser and translated the new copy in all seven supported frontend locales. Earn account positions remain protected; subscribe/redeem continue to obey backend financial controls.
- Added Playwright coverage for mode cards, a backend-provided BTC/USDT pair, Futures unavailable state, and Earn login gate.
- Admin E2E covers withdrawal queue refresh failure without false financial confirmation or any mutation request, and blocks KYC approval when document upload/secure preview is absent.
- Exact code/test head: `8967f936520470cd0a624efc718012dc615e26e2`. Push CI `42329063335`: SUCCESS — lint/build and 40 Playwright tests (20 desktop + 20 mobile). Backend PR CI `42329067130`: SUCCESS — 411/411 tests, unified build, fail-closed preflight and output checks. Frontend PR CI `42329067115`: SUCCESS — lint/build and 40 desktop/mobile tests.
- No production database, funds, real orders, merge or deployment touched.


## 2026-11-07 continuation — restore original mature UI palette and integrate BTCBOX brand

### User decision
- User rejected forcing the earlier proposed near-monochrome BTCBOX palette, stating that it made the interface too plain.
- Follow the original mature UI foundation palette and its visual language; adapt the BTCBOX brand rather than redesigning the source system into a flat black/white look.
- LOGO should be integrated into the interface rather than appearing as a pasted image.

### Changes committed to `work/btcbox-unified-20261104`
- `frontend/src/index.css`: restored the mature UI foundation's deep navy / blue accent palette (surface hierarchy, cool-neutral text, blue focus/interaction state, green profit and red-pink loss semantics); preserved the existing font imports, typography utilities and responsive base rules.
- `frontend/src/components/BrandLogo.tsx`: added a reusable inline SVG/vector BTCBOX mark with a typographic wordmark and optional EXCHANGE label.
- `frontend/src/components/layout/Sidebar.tsx`: replaced the CSS-only diamond placeholder with the shared vector brand component.
- `frontend/src/components/layout/Topbar.tsx`: added a compact wordmark in the mobile header so the brand remains visible when the desktop sidebar is hidden.
- Commits: `dc48ca58409ccc19c68c7601663e59a5cc915fce` (brand component), `b8466acaa2a6a28e7ed7a67abeb58de0d6c58f4b` (palette), `764fb3330b437aaa6872850b9f8ad6e84bb094cf` (sidebar), `98da5054da084298c323be91da981a4963d81908` (mobile topbar).

### Scope and verification
- No trading/order execution, account, authentication, backend, database, financial, or deployment behavior was changed.
- Source edits are committed to the unified collaboration branch. Build, lint, Playwright, and visual browser QA for the latest head are PENDING until CI results are checked.
- Remaining visual QA: compare mobile and desktop surfaces against the original mature UI foundation; inspect brand mark proportions, header/sidebar alignment, focus states, chart colors, profit/loss contrast, and Admin visual consistency. Do not claim full-site visual completion until these checks pass.


### Visual palette / brand CI verification — 2026-11-07
- Frontend CI run `42330608347` on source commit `98da5054da084298c323be91da981a4963d81908`: SUCCESS. npm install, lint, build, Chromium install, and desktop/mobile route smoke tests all passed.
- Backend CI run `42330608528` on the same source commit: SUCCESS. Unified site build, all backend tests, fail-closed deployment configuration validation, and unified output/preserved-entrypoint checks all passed.
- PR #59 remains OPEN / DRAFT / NOT MERGED. Current PR head after the documentation updates: `1edf89c82d4e1cb01de51507454b38d56da97567`.
- CI success verifies build and automated route smoke tests for the source commit; it is not a substitute for human visual review on actual devices or a deployed preview. Full-site desktop/mobile visual acceptance remains pending.
- No merge, production deployment, database write, financial action, or auth configuration change was performed.


## 2026-11-07 — registration page and public preview priority batch

### User priority
Registration and the signed-out preview/home page are now the first pages to complete before broad visual polish on the rest of the application.

### Implemented on `work/btcbox-unified-20261104`
- `frontend/src/features/auth/AuthPages.tsx`
  - Reworked login/register presentation into a responsive split layout with integrated vector BTCBOX brand mark, clear registration method explanation, and a desktop brand/value panel.
  - Registration continues to offer Google and Ethereum/Solana wallet identity creation only; the user sets BTCBOX username/password after identity verification.
  - Kept existing auth handlers, two-factor flow, disabled-provider messaging, account redirect behavior, and login username/password path intact.
  - Added public-market navigation and made it explicit that public market information does not require signing in.
- `frontend/src/features/dashboard/Dashboard.tsx`
  - Turned the signed-out `/home` route into a public market preview landing page with a branded hero, register/trading CTAs, public market access explanation, account-protection explanation, provider-backed market table and chart sections, and a bottom sign-in/register CTA.
  - Did not introduce mock prices, sample balances, or fake market statistics. Existing market API reads remain the source for market content.
- `frontend/src/lib/i18n.tsx`
  - Added the new public preview copy in all seven supported locales (English, Japanese, Simplified Chinese, Spanish, Vietnamese, Italian and Portuguese).
- `frontend/e2e/auth-routes.spec.ts`
  - Added 320px mobile registration coverage and a signed-out public preview test asserting market content, registration entry point, no horizontal overflow and no financial mutation requests.

### Commits
- `ff13534415cc1bf538cac9d9b4275ae21c8a8ed2` — registration/login presentation
- `7d28541435b4e72fe4e926e826777afca986d2fb` — public preview landing page
- `a377d87d165986b2100f284411c72fdd6f14d6e8` — mobile and public preview E2E coverage
- `9f59a718aac0a7ef55780682b9762cb788092fa0` — seven-locale preview copy
- `05a4f09577b78c18aead06fa3a156a7c68c3a58f` — precise public market pair assertion

### Pending verification
- Frontend CI (lint, build, Chromium desktop/mobile route tests) is required on the latest source SHA.
- Manual visual QA still required at 320/360/390/430px and desktop widths, including Google disabled/enabled states, installed wallet list and no-wallet-provider fallback.
- Confirm public market data error/empty states remain clear and no signed-out route emits financial mutations.
- Backend auth configuration, live Google provider configuration, real wallet signature flow, and production deployment are outside this UI-only batch and remain unverified.
- No merge, deployment, production DB/auth setting, or financial action was performed.


### Verification result — 2026-11-07

- The first CI pass exposed stale assertions rather than product logic defects:
  - Backend test `google-only-auth.test.js` asserted an obsolete registration sentence. Updated it to assert the new copy's unchanged meaning: username/password are created after Google or wallet identity verification.
  - Frontend E2E tests used a partial "Welcome back" heading locator, which became ambiguous after the new split-screen hero was added. Updated those checks to exact heading matching.
  - Registration E2E copy assertion updated to the new visible sentence.
- Verified latest tested source SHA: `2e5c0401812d39be1bec055718d66b63f96c2734`.
- Frontend CI `42331547336`: SUCCESS; install, lint, build and **44/44 desktop/mobile Playwright tests** passed.
- Backend CI `42331547350`: SUCCESS; **411/411 backend tests** passed, unified build and fail-closed preflight succeeded.
- New preview landing E2E and 320px registration E2E both passed on desktop and mobile projects.
- The test suite confirms no horizontal overflow at 320px for these flows and no signed-out financial mutation requests in the public preview route.
- Manual visual review at common phone widths and desktop sizes remains pending; no production deployment or merge has been performed.


## 2026-11-07 continuation — registration / public-preview source QA

- Re-read the unified-branch registration page, signed-out dashboard, BrandLogo, sidebar, mobile topbar, design tokens, E2E spec and package scripts at PR #59 head `92b1b714c0b36b0ffecd6a27ae0d6ddbc40351e1`.
- SOURCE OBSERVED: the user-approved auth entry points are present in the registration UI (Google, Ethereum wallet and Solana wallet); username/password remains on the login route; registration does not offer email. Account credentials are created after identity verification.
- SOURCE OBSERVED: the public dashboard reads markets and BTC/USDT candles through existing API functions, refreshes market rows, and renders explicit feed / no-chart-data states. No synthetic market prices or balances were introduced in this UI.
- SOURCE OBSERVED: the BTCBOX mark is rendered as inline SVG plus a typographic wordmark through the shared `BrandLogo` component and is reused in the sidebar, mobile topbar, auth page and preview hero.
- FIXED: a source-level review found the authenticator-code input used an over-escaped regular expression (`/\\D/g`), which would not strip non-digits as intended. Corrected it to `/\D/g` in `frontend/src/features/auth/AuthPages.tsx` (commit `227eb0c7d18148011c57922e1070a8666a7b185c`).
- NOT VERIFIED: actual rendered visual QA on a browser/device. BrowserAct could not be installed in this runtime because the required Python download failed at network/DNS resolution. The existing CI Playwright route suite is the automated browser evidence; it does not substitute for screenshot-based visual acceptance.
- NEXT: verify CI for the exact latest source SHA, then continue with screenshot-based desktop/mobile review when a browser runtime is available. No merge, deploy, production DB/auth, or financial operation was performed.


## 2026-11-07 continuation — standalone auth layout and preview hierarchy

- Reviewed `frontend/src/App.tsx`, `AuthPages.tsx`, `AccountSetupPage.tsx`, `Dashboard.tsx`, `Topbar.tsx`, `BottomNav.tsx`, `Sidebar.tsx`, `BrandLogo.tsx`, design tokens and the route E2E suite.
- FINDING: login, registration, account setup and OAuth callback were mounted inside the full customer `AppLayout`. This placed the global trading header and mobile bottom navigation around dedicated auth screens that already render their own BTCBOX identity and public-market links.
- FIX: `frontend/src/App.tsx` now renders `/login`, `/register`, `/account-setup` and `/auth/react-callback` outside `AppLayout`. Public market and trading routes retain the normal application shell.
- FIX: `AuthPages.tsx` and `AccountSetupPage.tsx` use the full standalone viewport height rather than subtracting the global header height.
- FIX: `Dashboard.tsx` hides the hero's duplicate brand mark at mobile widths where the topbar already displays the BTCBOX logo; tablet/desktop still show the hero brand mark.
- TEST: `frontend/e2e/auth-routes.spec.ts` now asserts login/register have no global header or primary nav, and the mobile public preview retains its topbar and navigation without duplicate hero branding.
- Commits: `b1fcb2c` (auth route shell), `0dade52` (auth viewport), `b7e2fd5` (account setup viewport), `23379eb` (auth shell E2E), `c09c69c` (mobile preview logo hierarchy), `3abf1ec` (preview shell E2E).
- CI was triggered for latest code/test SHA `3abf1ec5cbccdf6c1795de4f74306c2643e3ad54`; record final status after completion. Previous run on SHA `378039745bfc9f22557cdbdd60590a62faeeb9a5` passed frontend lint/build + 44/44 Playwright tests and backend 411/411 tests.
- NOT VERIFIED: screenshot-based manual visual review on a physical browser/device remains pending; automated E2E does not substitute for visual acceptance. No merge, deployment, production DB/auth configuration or financial operation was performed.


## 2026-11-07 auth-shell / preview verification result

- Final tested source/test SHA: `4e0695afae911c670214703a819de2618036aaeb`.
- Frontend CI run `42333471864`: SUCCESS — npm install, lint, build and `44/44` desktop/mobile Playwright tests passed.
- Backend CI run `42333471866`: SUCCESS — unified build, `411/411` backend tests, fail-closed deployment preflight and preserved output checks passed.
- The first test run caught an assertion that incorrectly required a responsive topbar logo link to be visible in both project viewport configurations. The app code was not at fault; removed that breakpoint-sensitive assertion while retaining checks for the header, mobile navigation and hidden duplicate hero mark. The rerun passed all 44 tests.
- The auth-route assertions passed in desktop and mobile projects: no global banner or primary navigation is rendered on login/registration. Public preview assertions passed with the normal app header/navigation and no horizontal overflow or signed-out financial mutations.
- Latest PR #59 remains OPEN / DRAFT / NOT MERGED. No production deployment, DB/auth configuration change, or financial action was performed.
- Manual screenshot-based visual acceptance is still pending; CI browser tests are not claimed as physical-device visual approval.


## 2026-11-07 continuation — public market snapshot timestamp

- Source cross-check confirmed `getMarkets()` maps the backend `data[symbol].ts` value into `MarketTicker.snapshotTs`; this is the server snapshot time and is intentionally distinct from `providerTs`.
- The public `LiveMarketsTable` now displays the latest server snapshot time for the returned rows, or an explicit unavailable label when no server timestamp is supplied. Existing refresh-error behavior remains: last confirmed rows may remain visible only with the warning that live refresh is unavailable.
- Added a public-preview browser assertion that the server snapshot indicator is present when the market API returns its timestamp.
- Commits: `23b5fb8b10ce176c449e5803dc914fc3d65b8751` (UI); `a421c57382435d0f49f278a53b9d5a32a2b0a5b2` (E2E).
- Verification pending: frontend CI for the exact latest source/test SHA, plus screenshot-based visual QA. Real upstream freshness and deployed behavior remain NOT VERIFIED. No merge, deployment, production DB/auth change or financial operation.


## 2026-11-07 continuation — Admin queue stale-state safety

- Cross-reviewed frontend/src/features/admin/AdminPage.tsx and existing Admin E2E coverage. Manual refresh failure behavior intentionally retains last confirmed rows with an explicit error; no change to that workflow.
- Found a different failure mode on tab navigation: withdrawal/KYC rows from the previous load remained in component state when the next tab-level queue GET failed. After the loading state ended, stale rows and review actions could reappear.
- Fixed tab-level loading to clear the corresponding queue before requesting a new snapshot. A failed initial/re-entry load now leaves no stale actionable rows visible; manual refresh still preserves its last confirmed snapshot and displays the refresh error.
- Added E2E regression: load a pending withdrawal, navigate to KYC, return with a simulated 503, and assert stale withdrawal ID and Approve action are absent while the error is visible.
- Commits: d23218081fbbd9d993ef3280f4933ab1cc349d65 (Admin UI); 8a834cc1b5734b5a0259b54457e3d92ce7649815 (browser test).
- Exact-commit CI pending. No backend finance API, DB, payout semantics, production setting, merge or deployment changed.


## Admin audit reload regression — 2026-11-07

- Finding: audit-tab re-entry previously retained old rows and canonical-source/completeness labels while the next GET was pending; on failure, stale evidence remained visible.
- Fix: clear the audit snapshot and reset provenance/completeness to unknown before every tab-level GET; successful empty snapshots now render an explicit empty state.
- E2E: canonical fixture -> navigate to KYC -> force second audit GET to return 503; assert prior audit ID disappears and source confidence resets.
- Frontend-only state/display change; no financial API, ledger, database, or auth contract changes.
- Manual-credit path inspected: browser-persisted request ID is reused on ambiguous network/server responses. Preserve that behavior; no real credit or production write tests were performed.
- Commits: `90da39877976130d306ec0b0488ce40e5349bcaf` (UI), `647923bc0aee7f7d3a76dd220259aa37b69fd8a4` (E2E).


## Admin payout TxID recovery — 2026-11-07

- Backend contract checked via `backend/tests/withdrawal-manual-payout.test.js`: exact same-reference retries are idempotent; conflicting references after completion fail; manual payout completion is audit/status-only and does not apply another ledger debit.
- Frontend issue: after an ambiguous payout POST (e.g. network/5xx), reloading Admin lost the typed TxID/reference, although the withdrawal could still be approved in the queue. This risked staff entering a different reference on retry.
- Fix: persist non-secret payout reference in localStorage scoped by admin actor and withdrawal ID before sending; restore on session load; clear only after API confirmation. Fail closed if local persistence fails. Ambiguous result keeps same reference and displays verify-before-retry guidance.
- Duplicate success notice now survives queue refresh.
- E2E covers first POST 503 -> browser reload -> exact reference restoration -> same-reference duplicate success -> completed queue state.
- No backend/financial contract, ledger, DB, production configuration, merge or deployment changes.
- Commits: `c1fc1fb103064d10b04347ce5960bce4396d02d5` initial UI, `ed4bcf7211eb959e2bf8d6c9e4dd8f8599046a81` notice, `fe00e0d2b0518c9703e7a7e0ba78af499de3d316` validation, `6a5078bf98a7bfba541332b59268ad375cc8f20e` E2E initial, `3b7f05f1103034ba43aeaba8d234feb657fd72b8` E2E assertion.


- Operator isolation follow-up: payout drafts are replaced (not merged) when the authenticated admin identity changes, so an unsent reference from a previous operator cannot leak into the next operator's UI. Commit: `8d75ce111e06ca8a7f7fca64bb4e755c1e1724b6`.


- CI integration finding: existing Core contract tests assert the Admin UI's refresh-after-confirmed-payout call pattern. Kept that call shape and re-applied the exact duplicate-reference notice after queue refresh, so both the established contract and improved operator feedback are preserved. No Core source/test changes.
- Follow-up: `be2b47513b18f961e96a5d97c2b99b6aec10b3c9`.


## Admin user-detail selection isolation — 2026-11-07

- 2号 AI cross-reviewed the Admin Users / manual-credit panel against the per-user deposit history and ledger-source labels.
- FOUND: selecting a second user left the previously selected user's detail panel mounted while the next `admin/user` GET was pending. If that read failed, the old user's balances, deposit history and manual-credit form remained visible even though the operator had attempted to open another user.
- FIXED: clear the selected user before issuing the next detail request. A failed read now leaves the explicit “Select a user…” state and no prior user's balance/deposit evidence or manual-credit controls.
- REGRESSION: Playwright loads one user's ledger-backed balance and deposit history, then simulates a 503 for the next user's detail request; it asserts the previous deposit ID and balance row disappear and the read error is visible.
- Scope: frontend selection state and E2E only. No deposit API, ledger, database, idempotency key, credit behavior, or production configuration changed.
- Verification: exact-head CI pending; no merge, deployment, production DB write, or real financial operation performed.


## Admin audit identity clarity — 2026-11-07

- Cross-check found the audit table used generic “Actor” and “User” headers while the values are administrator identity and affected BTCBOX UID. This can obscure which UUID is the operator versus the customer affected by the event.
- Updated the UI headers to “Operator ID” and “Affected user UID”; the stored `by` and `uid` values and API contract remain unchanged.
- Extended the audit E2E to assert both identity column labels and the synthetic operator/affected-user cells.
- CI previously exposed two E2E fixture/locator assumptions in the audit reload and user-detail isolation tests; those tests were made deterministic before adding the identity assertions. Latest exact-head CI is pending.
- No backend, audit schema, permissions, financial operations, production database, merge or deployment action performed by 2号 AI.


## Admin queue race and evidence-refresh isolation — 2026-11-07 (2号 AI)

- Repository check: PR #59 was merged by the repository owner on 2026-11-07 into `fix/post-merge-db-bootstrap-seconds-20261106`; the collaboration branch continues at its own HEAD. No deployment or production database action was performed by this batch.
- FOUND: Admin user-detail reads could complete out of order. A slow response for an earlier user selection could overwrite a newer user's detail panel, even after the old panel was cleared before each request.
- FIXED: sequence the user-detail requests with a component ref; only the latest selection may update user data, surface its error, or release the busy state.
- REGRESSION: Playwright delays the first user-detail response, loads the second user first, then releases the first response and verifies the second user's balance remains selected.
- FOUND: manual KYC queue refresh retained the previously loaded review rows when the new read failed, leaving stale evidence rows and approval controls available after a refresh error.
- FIXED: clear the KYC queue before manual refresh. If the request fails, no stale KYC evidence or approval action remains visible; the read error is shown.
- REGRESSION: KYC E2E now loads an incomplete evidence row, simulates a 503 on manual refresh, and verifies the stale user row and Approve button disappear. No financial/admin mutation is sent.
- Scope: frontend state isolation and Playwright only. No KYC decision rules, financial APIs, ledger, database schema, authentication, or production settings changed.
- Commits: `c806372` (latest-user response guard), `bda8639` (out-of-order response test), `6b5810f` (KYC fail-closed refresh), `ef50db2` (KYC refresh regression).
- Verification: exact-head CI queued/running at handoff; do not mark the batch fully verified until both frontend and backend workflows finish.


## Admin rapid-selection test assertion correction — 2026-11-07 (2号 AI)

- CI run `42347244241`: lint/build passed; 52 Playwright cases passed; desktop and mobile variants of the rapid-selection test failed on the same invalid assertion.
- The old test incorrectly expected the first user's email to disappear from the whole page. That email correctly remains in the Users directory after selection changes; the meaningful stale-state assertion is that the first user's balance (`111.00`) does not replace the latest user's balance (`222.00`).
- Corrected the test to keep the directory row visible and assert the stale balance is absent. Commit: `dab5f6dee6ea6f1196f0afe172f5d95cc4d3170c`.
- Awaiting exact-head CI. No production or backend financial operation.


## Admin KYC preview and deposit-history traceability — 2026-11-07 (2号 AI)

- KYC edge case: if `document_preview_error` was non-empty alongside `document_uploaded=true` and a `document_url`, the Admin UI still rendered the link and enabled Approve. Updated it to suppress the link and disable approval on any preview error; regression covers both missing upload and failed secure preview.
- Deposit reconciliation: per-user deposit history now shows the optional source record ID separately from the TxID/reference, improving traceability without changing backend semantics. E2E asserts the record ID is visible.
- Commits: `11a13c5`, `feaf362`, `0a9cfb1`, `0ef84b5`.
- Scope: frontend rendering/tests only; no backend financial contract, ledger, DB, or production setting changed. Exact-head CI pending.


## Admin audit pagination and deposit-history scope — 2026-11-07 (2号 AI)

- Added canonical PostgreSQL audit cursor pagination (“Load older records”), deduplication, and source/completeness consistency guard. API already supported `before`/`next_before`; UI now consumes it.
- Legacy state audit IDs use `AL...`, but backend currently validates all `before` cursors as positive PostgreSQL bigints before the legacy branch. The UI therefore intentionally hides pagination for legacy state and labels that source as retention-limited; backend fix belongs to Core owner if legacy pagination is required.
- Confirmed from `0011_financial_read_api_earn_v1.sql` that account snapshot returns only the latest 20 deposits. Admin now labels the section “Deposit history · latest 20” and points staff to audit log for broader financial event trail.
- Added E2E coverage for canonical pagination, unsupported legacy cursor suppression, and latest-20 disclosure.
- Commits: `0bf6425`, `662d676`, `fbc04a0`, `3986341`, `f51f17a`. Frontend-only changes; no production/financial operations. Exact-head CI pending.


- Audit pagination follow-up: guarded cursor-page requests against tab changes/re-entry. A delayed older page is ignored after a fresh audit snapshot is loaded. Regression test covers the out-of-order page response.
- Commits: `28c3df8`, `4fa93a5`. Exact-head CI pending.


- Added the audit event ID to the Admin audit table for direct reconciliation with the canonical audit record. Clarified that Operator ID is the recorded actor identifier, not a display name. E2E covers the visible ID. Commits: `cb8a45d`, `95de3cc`.

## 2号 AI — public market provenance batch — 2026-11-07

- Branch: `work/ai2-integration-batch-20261107`, based on the current `work/btcbox-unified-20261104` collaboration branch. No merge or deployment.
- SOURCE OBSERVED: the public dashboard polls `GET /api/market` every 15 seconds and the market API maps both server snapshot time (`ts`) and provider timestamp (`providerTs`) into `MarketTicker`. The existing public table showed only server snapshot time, which could be mistaken for the upstream market-event/response time.
- FIXED: public market table now displays the newest available provider timestamp separately from the server snapshot timestamp, including sanitized provider source and elapsed seconds. If provider timestamp is absent, it explicitly says unavailable; it does not substitute server time.
- REGRESSION: appended Playwright coverage with distinct server/provider timestamps and asserts both labels are present. Age assertion is clock-boundary tolerant.
- Commits: `6ed1954458e8cc0e8d5478c10cd03897a97efcba` (UI); `86b24d2dec1490e6a98bafe9bfd380a66d200908` (E2E); `c00ecb75f114e96a105e36b53f6113a164210ba5` (stable age assertion).
- TEST STATUS: exact-head CI not yet triggered/verified. No local build result is claimed. Browser screenshot/physical-device visual QA remains pending.
- LIMITATION: displaying upstream timestamp improves provenance visibility but does not prove that production provider data is fresh or changing. Live provider freshness and deployment behavior still require isolated Preview verification when release testing is authorized.
- SAFETY: no auth, API contract, backend, database, funds, orders, production configuration, merge, or deployment changes.

## 2号 AI — Admin tab response race batch — 2026-11-07

- SOURCE OBSERVED: Admin `loadTab` requests for users, withdrawals, KYC, audit, orders, support, markets, deposits, seconds policy and administrator lists could resolve after a newer tab/search request. Existing audit pagination and user-detail selection had local guards, but the shared tab loader did not guard every read response.
- FIXED: introduced a monotonically increasing tab-load request ID. Only the latest tab/search load may update its corresponding snapshot, surface its load error, or clear the shared loading state. Applied guards after awaited responses across the tab loader; retained the separate audit pagination guard and the existing manual refresh behavior.
- REGRESSION: Playwright delays the first withdrawals GET, switches to KYC, re-enters withdrawals and receives a newer queue, then releases the older response; asserts the stale withdrawal ID cannot replace the latest queue.
- Commits: `fc09aa75e86c59db717041b107adb9bfd44c9c3f` (Admin UI); `6e206e429a8508386c3e908cac8a3b8814ff6e5d` (E2E).
- TEST STATUS: exact-head CI pending. No local build or screenshot QA claimed.
- Scope: Admin frontend request lifecycle and synthetic Playwright fixtures only. No backend finance API, permissions, ledger, database, authentication or production setting changed; no real financial operations.

## 2号 AI — deployment test isolation follow-up — 2026-11-07

- Vercel source-observed latest production deployment: `dpl_2cAQrbFQbTouccNyccnYZfY7P89e`, commit `361be5c395fef85d11b52b67884122dab0d8e7c6`, state ERROR. Frontend Vite build completed successfully; backend `npm test` exited 1 (350/356 passed, 6 failed).
- Retrieved the failing log segment: `backend/tests/api-routing.test.js` loads `api-adapter.js` / `api-core.js` while the inherited Vercel `ADMIN_PASS` fails the startup-strength check, raising `ADMIN_PASS_TOO_WEAK`. This is a test-process environment isolation issue; it is not evidence that the public frontend build failed.
- FIXED in this branch: set a strong, explicitly test-only `ADMIN_PASS` inside `backend/tests/api-routing.test.js` before requiring the adapter. This is confined to that test worker and does not alter Vercel settings, runtime credentials, or the production password-strength policy.
- Also fixed the first frontend CI run's Playwright regex over-escaping for the provider-age assertion. The initial lint/build passed; route E2E failed only on that assertion matcher. Commit: `92f7f48c78e16a5fdecb387fcd98f0839dfddb7b`.
- Admin tab-load cleanup now invalidates outstanding requests as soon as the effect is cleaned up. Commit: `e5351418e694592702a0c612b6467148dd0066e2`.
- Test isolation commit: `4091008d2b4212a69f61db9c03a7376f1ad762fd`.
- TEST STATUS: fresh frontend/backend CI for the final branch head is pending. Do not infer that the other five Vercel test failures have the same root cause until the backend CI result identifies them.
- Release pause remains in force. No Vercel environment setting, deployment, production database, authentication provider, real order or financial record was changed.

- CI wiring finding: `.github/workflows/backend-ci.yml` had a push trigger for the unified collaboration branch but omitted that branch from its `pull_request.branches` allowlist. A backend test change in a draft PR targeting the unified branch therefore would not receive the required backend CI. Added the unified branch to the PR trigger list (commit `e66111e480327c70f69ee9b2be7b51909dc6653a`). Confirm the backend workflow starts on the updated PR head before treating test isolation as verified.

- Backend CI after test-secret isolation: unified build passed; backend tests reached 410/411. The remaining failure was a stale source-contract regex in `backend/tests/kyc-flow.test.js`: it expected the old KYC approval-disabled expression and omitted the newly added `!!item.document_preview_error` guard. The Admin implementation correctly disables approval when secure preview reports an error. Updated the assertion to include that guard (commit `ddd6f921bf97249ea23c177b8fd5b469cbbaca73`). Exact-head backend CI rerun pending.

- Backend CI rerun `42356561473`: SUCCESS — unified build, 411/411 backend tests, fail-closed preflight, and output/entrypoint verification all passed.
- Frontend CI run `42356454539`: SUCCESS with 62 passed and 2 flaky (both passed on retry). The new Admin tab race test's exact request-count assertion was too strict under repeated initial loads; relaxed to assert at least two reads. An existing Admin stale-queue test also assumed exactly one initial GET; updated its fixture to tolerate the repeated initial read and fail the later re-entry refresh as intended. Commit: `94ba7a94aa0539ac643648fae52e4a1a4ec6d430`. Fresh exact-head frontend CI pending.

- IMPORTANT RUNTIME HANDOFF TO 1号/Core owner: the production Vercel environment currently has a weak `ADMIN_PASS` (observed in the deployment test log; do not read or expose its value). `backend/api-core.js` throws at module startup when this value is weak, and the catch-all adapter imports that module. The test-only override above isolates the test process only; it does not repair the Vercel runtime. Before any release, the authorized environment owner must set a strong production admin password meeting the deployment preflight policy, or Core owner must redesign the guard so invalid admin credentials fail closed for admin authentication without crashing the shared API module. Do not weaken the password policy or change the production secret from this 2号 batch.

- Frontend CI run `42356699699`: SUCCESS — lint/build and all desktop/mobile tests passed, but two existing Admin queue tests were flaky on first attempt and passed on retry. Logs showed count-based fixtures racing repeated initial GETs. Converted both to action-driven one-shot failure flags and retained the delayed-response race test; commits `a0fab6b` and `7662bba`. Fresh exact-head CI pending; require zero flaky cases before marking the batch fully accepted.

- Final backend CI rerun `42356891197`: SUCCESS — unified site build, 411/411 backend tests, fail-closed deployment preflight and preserved output/entrypoint checks passed.
- Final frontend CI rerun `42356891195`: install, lint, build and Chromium installation passed; desktop/mobile Playwright route suite was still running at the latest status check. Do not mark frontend suite complete until the job concludes. The prior run `42356699699` succeeded with 62 passed but reported two flaky tests; action-driven fixture corrections are included in the latest rerun.
- PR #61 remains draft/open and mergeable against the unified collaboration branch; no merge or deployment.

- FINAL VERIFICATION — frontend CI run `42356891195`: SUCCESS. npm install, lint, build, Chromium install and **64/64 desktop/mobile Playwright tests passed**, with no flaky retries reported. This run includes the upstream-provider timestamp assertion, the Admin tab response-race regression, and the action-driven queue failure fixtures.
- FINAL VERIFICATION — backend CI run `42356891197`: SUCCESS. Unified build passed, **411/411 backend tests passed**, fail-closed deployment preflight passed, and preserved output/entrypoint checks passed.
- The source/test batch is CI-green on branch `work/ai2-integration-batch-20261107`. PR #61 remains OPEN / DRAFT / NOT MERGED. No production deployment, production environment edit, database write, financial operation, or real order was performed.
- STILL BLOCKED FOR RELEASE: production Vercel `ADMIN_PASS` remains weak as observed in the latest failed production build logs. Test isolation does not fix runtime. Manual desktop/mobile visual review and live upstream freshness on an authorized Preview remain pending.


## 2号 AI — registration and public preview responsive regression batch — 2026-11-07

- Source review confirmed `/register` starts with Google/Ethereum/Solana identity verification; `/account-setup` is where the user creates BTCBOX username/password. No email registration or email OTP was introduced. `/login` continues to expose username/password plus Google and wallet sign-in.
- Public `/home`, `/markets`, and `/trade/:symbol` routes remain available without an account; private account/financial routes remain guarded.
- Added Playwright breakpoint regression coverage for registration at 320/390/768/1440 px and public preview at 320/375/768/1024/1440 px. Assertions cover core identity choices, desktop registration hero, public market content and document-level horizontal overflow.
- Commit: `4362d2589ae1c81c4ba4a5be585aa4b526a97c37`.
- Fresh frontend CI for this commit is pending. Previous exact-head Actions runs passed 411/411 backend tests and 64/64 frontend tests.
- GitHub commit status shows the Vercel check failing because the free plan reached its daily deployment limit (`api-deployments-free-per-day`). This is not a Playwright failure. No deployment retry or alternate deployment was attempted.
- Manual desktop/mobile screenshot review and live upstream freshness remain unverified; automated viewport assertions are not visual acceptance.
- Frontend E2E/docs only. No auth/backend/financial API, ledger, database, production environment, real account, real order, merge or deployment change.


- CI follow-up: first responsive-suite run `42357749939` passed install, lint, build, Chromium setup and the registration breakpoint test. The preview breakpoint test failed on a locator selecting the hidden duplicate mobile/desktop market row in the DOM; no app overflow or missing market content was reported. Replaced it with a visible-paragraph locator (`p:visible` + `BTC/USDT`). Fix commit: `ad7073ed1639be40f79bfd777d28fac9b1ee170f`. Fresh exact-head frontend CI required; do not mark the responsive batch accepted until it passes.


- FINAL RESPONSIVE CI — frontend run `42357960746` completed SUCCESS on the responsive-test fix: npm install, TypeScript lint, production build, Chromium setup, and **68/68 desktop/mobile Playwright tests passed**. The new registration and public-preview breakpoint tests passed on both projects. The earlier 66-pass/2-fail run was the test-selector defect described above; corrected and verified with no retries reported in the final log.
- FINAL BACKEND CI — run `42357960745` completed SUCCESS: unified build, backend test suite, fail-closed preflight, and output/entrypoint checks all passed.
- The Vercel status remains separate and blocked by the free-plan daily deployment cap. No deploy was attempted. Manual screenshot review and live provider freshness remain pending; do not claim production visual/live-feed acceptance.
