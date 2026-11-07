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
