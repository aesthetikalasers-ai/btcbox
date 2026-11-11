# Frontend public-market preview batch — 2026-11-07

## Scope
Repository: `avali9308-code/btcboxcdt`
Working branch: `work/btcbox-unified-20261104`
Safety: no merge, deployment, production database access, financial writes, or real order placement.

## Changes committed
- `frontend/src/App.tsx`: removed the account-auth route guard from `/trade/:symbol`. Public visitors can open the spot trading screen to inspect market price, candles, and order book.
- `frontend/src/features/pages/Pages.tsx`: an unauthenticated `GET /api/account` response with `AUTH_REQUIRED` no longer sets the page-wide error state, so it does not suppress public market preview. Backend order/account APIs remain responsible for authentication.
- `frontend/src/features/dashboard/Dashboard.tsx`: market overview ticker refresh reduced from 30 seconds to 15 seconds; an in-flight guard prevents overlapping requests; failed refreshes preserve the last successful ticker snapshot.
- `frontend/src/features/dashboard/components/LiveMarketsTable.tsx`: when a prior valid snapshot exists, provider refresh errors now show a stale-feed warning while keeping confirmed rows visible. When no snapshot exists, the unavailable state remains.
- `backend/tests/spot-trading-live-refresh.test.js`: added source-contract regression assertions for public spot preview, anonymous account response handling, 15-second polling, overlap protection, and stale snapshot retention.

## Commit sequence
- `06586c56e5286cec63ebab8f64b2a5a9224692e3` — public spot preview route.
- `19b143136b28bbb7e565ab134a1732d0ae80043c` — anonymous account response no longer blocks preview.
- `0ef183b58f7e83984ce08baad8dea63603f22271` — 15-second market polling and overlap guard.
- `7d4bd7d92a172364254ae75feb6a78e8f67c3b91` — retain last confirmed market rows on feed interruption.
- `4be2b4b7462f89ce0f210ba6730e34b073f5683b` — regression assertions.

## Evidence and verification
- SOURCE OBSERVED: the spot route previously wrapped `SpotTradingPage` in `ProtectedAccountRoute`, contradicting the public market-preview requirement.
- SOURCE OBSERVED: the spot page fetched public market data and private account/order data together; an anonymous account 401 was being promoted to the page-wide error state.
- SOURCE OBSERVED: dashboard market ticker polling was 30 seconds; the spot page ticker/order-book polling was 15 seconds.
- SOURCE OBSERVED: the backend `/api/market` response includes a provider source and per-symbol timestamp in its `data` object; provider requests use Coinbase primary and Bybit fallback, with no synthesized price fallback. The frontend `MarketTicker` type currently consumes the `markets` array, which does not itself carry the timestamp.
- TEST NOT YET RUN on these five new commits. The latest observed successful backend and frontend workflow runs were on earlier source commit `abe8bedc922e2d5cf2d1e6e2755ebb25c15d7117` (2026-11-06), not this batch. Do not treat those older green runs as validation of this batch.
- NOT VERIFIED: anonymous browser route end-to-end, frontend build/typecheck, browser responsive behavior, provider freshness on the deployed hostname, and production behavior.
- Deployment automation remains paused. No preview or production deployment was created.

## Outstanding findings
- The current branch's `frontend/src/features/auth/AuthPages.tsx` still contains email/password, BTCBOX username/password, and wallet sign-in entry points. This conflicts with the user's stated Google-only sign-in adjustment. The file was not modified because the user stated this issue had already been adjusted; the actual adjustment has not yet appeared in the inspected working branch. Locate and reconcile the user's change before touching auth UI.
- `frontend/src/lib/api.ts` currently discards the backend per-symbol `data.ts` timestamp when returning `markets[]`. The spot page's “Last update” is based on browser receipt time, not provider event time. This should be addressed in a follow-up so the UI does not imply provider freshness it cannot prove.
- The market endpoint obtains Coinbase product metadata and then requests each enabled product's stats in parallel. Rate limiting/provider latency should be investigated with controlled provider tests; do not merely shorten the polling interval further.

## Resume point
1. Run frontend/backend CI on this exact branch head once a safe trigger is available; record the exact SHA and workflow URLs.
2. Add a focused test for anonymous direct navigation to `/trade/BTCUSDT` and confirm private order placement remains login-gated.
3. Propagate provider timestamps from `/api/market` through `getMarkets` to the UI; label receipt time separately from provider time.
4. Reconcile Google-only auth UI changes from the user's actual source/commit without overwriting them.
5. Continue Admin Panel review workflow integration after market-preview verification.

## Additional Admin Panel audit — 2026-11-07

- SOURCE OBSERVED: `frontend/src/features/admin/AdminPage.tsx` is an implemented Admin Panel, not the old loading placeholder. It has separate overview, users/manual-credit, deposit-address/config, withdrawals, KYC, audit, orders, support, admin-membership, Seconds policy, and spot-market tabs.
- SOURCE OBSERVED: manual credit is wired from the user detail screen to `POST /api/admin/deposit/confirm`; the UI requires a transaction hash/receipt reference, stores a stable idempotency request locally, refreshes the selected user after confirmation, and displays deposit history with source metadata.
- SOURCE OBSERVED: manual-credit action buttons are gated by both `deposits.read` and `deposits.review`; backend endpoint requires the audited atomic `admin_manual_deposit_atomic` RPC and fails closed while `financialWritesEnabled()` is false. This preserves the current no-financial-write QA boundary.
- SOURCE OBSERVED: existing tests `manual-credit-assets.test.js` and `manual-deposit-reference.test.js` cover supported assets, mandatory reference, SQL reference length, canonical ledger history and audit wiring.
- NOT VERIFIED: the admin manual-credit path has not been run against an isolated database fixture or live admin session in this batch. Do not test it against production funds.
- Vercel project domain lookup confirms `btcboxcdt.vercel.app` is assigned to project `prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK`; however, the project still reports `live:false` and its latest deployment remains `ERROR` at `dpl_ELZ73yuhyU15pytc9UmRV4B5VcpZ`. No deployment was created.

- Cross-branch auth trace: branch `feat/btcbox-react-google-auth-20261105` has a reduced auth page (no BTCBOX username/password or wallet buttons), but still exposes Supabase email/password login, email registration and password-reset flow. It therefore does not satisfy the user's Google-only/no-email-auth requirement and was NOT ported. The unified branch auth UI remains unchanged pending the correct user-approved version.

## Google + wallet login/register UI batch — 2026-11-07

### Implemented
- Rebuilt `frontend/src/features/auth/AuthPages.tsx` as a single compact sign-in/sign-up experience. Both routes now expose Google OAuth and one clearly labeled `Connect wallet` entry instead of mixing in email/password and BTCBOX username/password forms.
- Wallet chooser presents Ethereum / EVM and Solana. EIP-6963 discovered Ethereum wallets are listed by wallet name; the provider's existing Solana injection lookup remains the Solana sign-in path.
- Added mobile deep links for Phantom and Coinbase Wallet and explicit copy that wallet sign-in requests an ownership signature only, not a transfer or token approval.
- Preserved the server-required second-factor challenge UI. This is not a new mandatory MFA enrollment flow; it is only shown when the existing account/backend explicitly returns `require_2fa`.
- Preserved the OAuth callback and password-recovery callback component because account recovery / existing routes still depend on it; removed email/password recovery controls from the public login/register page.
- Updated `backend/tests/google-only-auth.test.js` to assert Google + wallet UI and guard against email/username/password controls appearing on the public auth page.
- Added the unified branch to backend and frontend CI push filters; included `AuthPages.tsx` in backend workflow path filters. Both workflows contain build/test/preflight steps only, no deployment step.

### Commits
- `d630f65fdc4ae09c8b9c41617240c7a969938804` — Google + wallet auth UI.
- `b7b67693460ac583e4fd960c4d8d62859e96b721` — auth UI contract test.
- `26f5341fcd02cb4f8e7f3dcd64142e1b59ce2ce3` — forbid legacy email/username controls.
- `b983de42176bb3a02780c3e4802da074fb31357a` — backend CI branch/path coverage.
- `aa42ea2a7e4e798687fb9b208b5a36bdde2da389` — frontend CI branch coverage.

### Auth support evidence / limits
- SOURCE OBSERVED: frontend calls Supabase `auth.signInWithOAuth({ provider: "google" })` for Google and `auth.signInWithWeb3({ chain: "ethereum" | "solana" })` for wallets, then exchanges the Supabase access token with BTCBOX's backend.
- SOURCE OBSERVED: backend validates the Supabase-verified Web3 identity, accepts only Ethereum addresses matching `0x` + 40 hex characters or Solana base58 addresses of 32–44 characters, and stores chain/address as wallet identity. The backend rejects unsupported or malformed wallet claims.
- NOT VERIFIED: Supabase Auth provider configuration for Web3 (Ethereum and Solana) is not exposed by the current public auth-client-config endpoint; no live wallet sign-in was attempted. The buttons and code paths are present, but provider enablement in the Supabase project must still be confirmed in an isolated preview / provider settings check.
- NOT VERIFIED: real Google OAuth callback, Phantom/MetaMask/Coinbase Wallet handoff, mobile deep links, and full browser login/register E2E.
- TEST RUNS: workflow runs `42309363409` (frontend) and `42309363348` (backend) were observed running on exact source head `aa42ea2a7e4e798687fb9b208b5a36bdde2da389`. Their final conclusions must be recorded after completion; prior green runs do not validate this head.

### Resume point
1. Read final backend/frontend CI conclusions for `aa42ea2a7e4e798687fb9b208b5a36bdde2da389`; fix any failures before more auth work.
2. Confirm Supabase Web3 providers are enabled for Ethereum and Solana; do not infer enablement from the frontend buttons.
3. Run preview-only login/register smoke tests for Google, Ethereum wallet and Solana wallet; do not use production accounts or real funds.
4. Review `AccountSetupPage.tsx`: new Google/wallet identities may be routed there when the backend reports missing BTCBOX credentials. Decide whether this onboarding is still needed; do not remove account credential/recovery APIs without a separate migration plan.

### CI follow-up
- Backend CI run `42309363348` on `aa42ea2a7e4e798687fb9b208b5a36bdde2da389` initially failed because an older `backend/tests/spot-trading-api.test.js` still asserted that the spot preview route must be protected. This was a stale test contract contradicting the approved public-preview behavior; it was updated to assert the public route instead.
- Backend CI rerun `42309521968` on `1a1e93a78bfd2f5ef5d931796fabf5f11fc8428d` completed SUCCESS, including unified build, backend test suite, fail-closed preflight, and output checks.
- Frontend CI run `42309363409` on `aa42ea2a7e4e798687fb9b208b5a36bdde2da389`: install, lint, build and Chromium installation passed; desktop/mobile Playwright route smoke tests were still running at last check.

- Frontend CI follow-up: run `42309855968` on `19d2075aac3c9812b08e85441b5151381e6042ba` passed install, lint, build, Chromium setup and all desktop/mobile route smoke tests. A further runtime assertion was added to verify that the Google button appears when `google_enabled=true`; latest run `42310007202` on `4f4b64917b1c1d0cea5575a71222fdbe7dd87313` also completed SUCCESS across install, lint, build and desktop/mobile Playwright smoke tests.
- One earlier E2E run failed because the existing browser tests still expected email/username login and treated `/trade/BTCUSDT` as protected. Those assertions were updated to match the Google + wallet public auth UI and public market-preview requirement. The corrected run passed.

## Follow-up implementation — 2026-11-07

- Backend `/api/market` now sets per-symbol `data[symbol].ts` after provider responses complete. It is explicitly a server snapshot timestamp, NOT an exchange event timestamp; Coinbase 24h stats do not provide a per-ticker event timestamp.
- Frontend `getMarkets()` now carries this value as `MarketTicker.snapshotTs` and preserves the provider source from the per-symbol payload.
- Spot trading UI now displays “Snapshot checked” using the server timestamp; it no longer labels browser response-receipt time as the market update time. If a symbol is absent from a successful response, the last confirmed ticker is retained and a stale warning is shown.
- Auth page entry points now expose Google only. Removed wallet-connect controls and wallet-specific mobile deep links. The existing 2FA verification state remains available; no email login UI was added.
- Added source-contract tests for snapshot timestamp propagation and Google-only sign-in UI. The earlier 400-test backend run on commit `c966aa0` had 399 pass / 1 fail because an existing assertion still expected the old label “Last update”; the assertion has now been corrected to “Snapshot checked”.
- CI on subsequent commits is the required verification. Do not claim these latest changes passed until the exact current branch-head runs complete.

## Latest CI evidence — 2026-11-07

- Backend CI run `42310916938`, source commit `7d5ed8fd58faee3e502a5025ca97425704d294c2`: SUCCESS. Unified site build passed; all 401 backend tests passed (401 pass / 0 fail); fail-closed preflight and output/entrypoint checks passed.
- Frontend CI run `42310911601`, source commit `0394a88d5607f31ab04938e7db3fcd4183c6a586`: npm install, lint, and production build passed; desktop/mobile route smoke-test step was still running at the last inspection. Do not mark the full frontend CI successful until that step completes.
- The earlier backend failures were actionable stale assertions / an omitted normalize argument, both corrected in subsequent commits. Latest successful backend run includes the provider event timestamp changes and Google-only UI/test changes.
- CI results apply to the source commits above. Documentation-only commits after those runs do not alter application source.

## Deployment cross-check — 2026-11-07

- The latest Vercel production deployment observed is `dpl_2cAQrbFQbTouccNyccnYZfY7P89e`, source `main` commit `361be5c395fef85d11b52b67884122dab0d8e7c6`, state `ERROR`. It was not created by this work batch.
- The corrected Vercel install command is confirmed effective: Vercel ran `npm install` successfully from the configured backend root; the backend build then installed 134 frontend packages, ran `tsc -b && vite build`, and transformed 1,769 modules successfully.
- The remaining Vercel failure is later in `npm run build && npm test`: Vercel build log reports `# tests 356`, `# pass 350`, `# fail 6`, and `BUILD_UTILS_SPAWN_1`. This is a different blocker from the prior nested `frontend/package.json` ENOENT.
- GitHub Actions for the same main SHA `361be5c` show backend CI, frontend CI, and PostgreSQL schema CI all successful. This Vercel-vs-GitHub test discrepancy remains unexplained; full failing test names were not present in the 100-event Vercel log response.
- Do not deploy or merge the unified branch to try to resolve this. Next step is to reproduce the six Vercel-environment test failures using the exact main commit and its Vercel environment/config, then reconcile the difference.

- Frontend CI run `42310911601` completed with failure only in Playwright auth-route smoke tests: the old E2E cases still required the removed `Connect wallet` button (two desktop checks; same outdated expectation in registration/admin route checks). npm install, lint, and Vite production build all passed. Updated `frontend/e2e/auth-routes.spec.ts` to assert Google-only behavior and zero wallet entry points; rerun `42311253408` is in progress.

## Current branch reconciliation — 2026-11-07 07:23 +08

- The earlier statement that unified-branch `AuthPages.tsx` still exposed email/username/wallet controls is stale and superseded by later commits. Re-read of the current branch confirms `AuthPages.tsx` SHA `92c21aaa99768fb5bbacdc599c1595896fb1cb3c` contains Google OAuth only; no email, username/password, or wallet sign-in entry points. Existing 2FA challenge remains. No auth code was overwritten in this follow-up.
- Market timestamp propagation is now present end-to-end in source: backend per-symbol `data[symbol].ts` is server snapshot time; Bybit fallback also carries its normalized provider event time as `providerTs`; frontend maps both separately. Coinbase 24h stats do not expose a provider event timestamp, so Coinbase rows correctly show snapshot time without pretending it is exchange event time.
- Exact latest application-source commit: `84603e7150db06c6861e4667fb7a4c55f70f4f2d` (Google-only browser-test contract update). Latest branch HEAD is documentation-only commit `b49b021ba1f4a22fc6896a9124409137e864e6d9`.
- Frontend CI run `42311253408` on `84603e7`: npm install, lint and Vite build passed; Chromium installation was still in progress at inspection time; Playwright desktop/mobile route tests had not started. Do not yet call full frontend CI green.
- Backend CI run `42310916938` on `7d5ed8f` passed unified build, 401/401 tests, fail-closed preflight and output checks. Backend source has not changed after that tested source commit in the current branch sequence; latest changes after it are frontend and documentation.
- Current Admin manual-credit path was re-audited: required TxID/reference (max 160), validated decimal amount, stable idempotency UUID persisted before submission, disabled duplicate editing while pending, retries reuse the same request ID, success refreshes canonical user balance/history, backend requires `admin_manual_deposit_atomic`, and role checks require both deposit read and review. Tests cover required references, SQL 160-character preservation, canonical ledger projection and audited transaction. No production financial write was attempted.
- No open GitHub issues were returned by the repository issue list. No deployment, merge, or production database change was made in this follow-up.

## Current source reconciliation — 2026-11-07 (supersedes earlier Google-only status)

Re-read the current unified-branch source at the start of this batch. The current authentication UI and provider expose all three owner-approved methods: BTCBOX username/password, Google OAuth, and Ethereum/Solana Web3 wallet sign-in. Email sign-in, email registration, and email password-reset methods are not exposed by the React auth provider. The prior Google-only statements above are historical and superseded.

Market timestamp semantic clarification:
- `snapshotTs` is generated by the BTCBOX server after provider responses complete.
- `providerTs` is provider-supplied but is not one universal kind of exchange event timestamp: Coinbase `ticker.time` is the last-trade timestamp; Bybit top-level `payload.time` is the provider response timestamp.
- Frontend type comments and regression coverage now explicitly preserve this distinction. Do not label every `providerTs` value as an exchange trade/event timestamp.
- This source-level contract does not establish that live provider data is always fresh. Runtime freshness, upstream outages, and live production market display remain unverified.

Admin review re-audit:
- Withdrawal approval changes review state only; staff must separately transfer funds and then record the TxID/reference using the manual payout completion action.
- Withdrawal rejection requires a reason and uses the atomic database review RPC; the database transaction records the refund and audit together.
- Manual payout completion requires a bounded TxID/reference and is status/audit confirmation only; it does not broadcast or debit funds again.
- Frontend preserves confirmed action state if the subsequent queue refresh fails and handles already-processed retries without repeating the financial action.
- KYC rejection requires a reason; direct approval checks in-review state and requires a stored document unless the explicit exception path supplies a reason.
- These are source/test-contract observations. No live admin session or production financial operation was executed.
## Follow-up batch — 2026-11-07: market semantics and Admin KYC conflict handling

Market timestamp contract:
- `frontend/src/lib/api.ts` now documents `providerTs` accurately: Coinbase supplies a last-trade timestamp; Bybit supplies a provider response timestamp. `snapshotTs` remains the BTCBOX server snapshot timestamp.
- `backend/tests/spot-market-catalog.test.js` now asserts the provider-specific timestamp sources and the separate server snapshot timestamp.
- Backend CI run `42315401002` passed 403/403 tests on source commit `936d5baf435aa2ca25f1e95117f6cc2c62941f41`; frontend CI run `42315396247` passed install, lint, build, Chromium install, and desktop/mobile route smoke tests on source commit `8d86ceceb62a32e5feabdebc56523ec320e73b73`.

Admin KYC conflict handling:
- Found a false-positive classification: the Admin Panel treated every HTTP 409 and `KYC_EXCEPTION_REQUIRED` as evidence that a KYC action had already succeeded. That could mask actionable server responses such as missing identity documents or a requirement for exception approval.
- `frontend/src/features/admin/AdminPage.tsx` now classifies only the explicit `WITHDRAWAL_ALREADY_PROCESSED` code as a confirmed withdrawal retry. KYC 409 responses remain actionable errors and are shown to the operator; dead KYC duplicate-success handling was removed.
- `backend/tests/admin-api-contract.test.js` now guards against treating generic 409 or KYC exception-required responses as confirmed success.
- Backend CI run `42315626395` passed 403/403 tests and deployment preflight on source commit `51c302a96f069876e438321d3597501fcbc26b54`.
- Frontend CI run `42315614500` completed SUCCESS on source commit `06ddef81192a72b5717125f59b069ac1a478dca6`: npm install, lint, build, Chromium installation, and all 24 desktop/mobile Playwright route smoke tests passed (12 desktop + 12 mobile).

Current branch HEAD at note creation: `51c302a96f069876e438321d3597501fcbc26b54`. No merge, deployment, production database change, or live financial operation was performed.

## Superseding authentication contract — 2026-11-11

This section supersedes the earlier Google-only / email-not-required notes in this historical document. The approved BTCBOX authentication contract is:

- Supabase Email/password registration and sign-in, including email confirmation and password recovery.
- Google OAuth registration and sign-in.
- Ethereum and Solana wallet registration/sign-in.
- Existing BTCBOX username/password authentication remains a separate credential path; it must not be confused with Supabase Email credentials.
- Supabase-verified Email, Google, and wallet identities are exchanged for a BTCBOX session through the existing Supabase session endpoint. Email identities are accepted by the backend provider allowlist.
- Email registration must call Supabase Auth `signUp()`; it must not fall back to the legacy `/api/register` endpoint.

Do not remove Email registration/login UI or the Supabase Email Auth methods based on the superseded 2026-11-07 Google-only notes. Preserve Google, wallet, username, account-setup, and two-factor paths. Verify registration using a dedicated test account; do not create or modify production user records without explicit authorization.


## Email registration operational prerequisites — 2026-11-11

The React Email registration flow uses Supabase Auth PKCE and redirects confirmed users to `/auth/react-callback`. A successful frontend build alone does not prove that production email delivery and confirmation are configured. Before accepting public registrations, verify these settings in the Supabase Auth project:

1. **Allow new users to sign up** and the Email provider are enabled.
2. **Site URL** is the actual production origin. Add the exact callback URL `https://btcboxcdt-pi.vercel.app/auth/react-callback` to allowed Redirect URLs for the currently observed Vercel production domain; add local and preview URLs only when needed.
3. **Custom SMTP is configured and tested** for public users. Supabase's built-in SMTP is restricted to addresses belonging to the Supabase organization and is currently limited to 2 emails per hour; it is not a production delivery service.
4. Because this client uses **PKCE**, the confirmation link must be opened in the same browser and device that started registration, unless the confirmation flow is deliberately redesigned for cross-device verification.
5. Verify signup and password recovery using a dedicated test account. Do not disable email confirmation as a production workaround, and do not create test users in production without explicit authorization.

Current evidence boundary: Vercel has the public Supabase Auth URL and publishable-key environment variables configured for production/preview/development. The available Supabase project connector does not expose the project's custom SMTP or allowed Redirect URL settings, so those settings remain unverified. Recent Auth audit logs show Google signups and Email sign-in activity, but no Email signup success event in the queried window; this is not proof of a failed signup attempt.

Official references:
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase PKCE flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
