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
