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
