# BTCBOX Frontend / Backend Integration Matrix

Audit date: 2026-11-06 (UTC+8)
Repository: `avali9308-code/btcboxcdt`
Coordination branch HEAD observed before this update: `8aa774fdea120b362eed5e6384347f3c62c62377`
Application branch inspected: `feat/btcbox-web3-auth-20261105` at `741c709d818cb10145620e2e0ba84891736d64de`
Scope: source-only integration audit. No runtime, production, Supabase, Vercel setting, or financial write performed.

## Executive conclusion

The current React/Vite application is already the customer-facing frontend source selected by the unified build script. The backend build script explicitly overlays the Vite build as the root customer app while retaining legacy admin/OAuth assets. The frontend manifest identifies the app as BTCBOX based on Strata Pro.

This is meaningful integration progress, but the route source still explicitly labels several core exchange features as pending or unavailable. In particular, the current route called `/seconds` is not evidence of a perpetual futures engine, and the trade hub explicitly marks Futures unavailable because no supported futures service is registered in the current backend.

## Source-of-truth observations

| Area | Source observation | Classification |
|---|---|---|
| Customer app entry | `backend/scripts/build-site.js` overlays `frontend/dist/index.html` and `frontend/dist/frontend-assets` onto the public output root | SOURCE OBSERVED |
| Unified build | `backend/package.json` builds `../frontend` before creating backend `dist` | SOURCE OBSERVED |
| Vercel config in repo | `backend/vercel.json` specifies `npm run build && npm test`, output `dist` | SOURCE OBSERVED |
| Frontend identity | `frontend/package.json` describes the app as BTCBOX React frontend based on Strata Pro Crypto UI (MIT) | SOURCE OBSERVED |
| Shadcn Fintech | Pinned on the separate migration branch as a submodule source; no evidence yet that its full source is installed into this application branch | SOURCE OBSERVED / NOT VERIFIED |
| Vercel project root | Project metadata previously reported CRA framework; actual Root Directory and effective build settings remain unresolved | NOT VERIFIED |

## Route-to-business integration matrix

| BTCBOX capability | Current route/source | Current state in inspected source | Required integration |
|---|---|---|---|
| Market overview | `/home`, `/markets` → Dashboard | Dashboard exists; market/candle API work exists, but static example token dataset remains in the source | Verify every displayed price/candle is live, freshness-aware and never silently replaced with demo data |
| Spot trading | `/trade/:symbol` | Placeholder says order-entry interface will connect after request/response contract verification | Connect market selection, order book, limit/market order forms, validation, preview, submit, order state and fills to existing spot APIs; preserve locked trading layout |
| Seconds trading | `/seconds` | Placeholder says seconds-order and position APIs are pending | Verify exact business semantics and settlement API; do not label this as futures/perpetual trading without proof |
| Futures / perpetuals | Trade hub Futures card | Explicitly unavailable; source says no supported futures service is registered in current backend | Requires a real futures business/API implementation or verified existing service: contracts, leverage, margin, positions, PnL, liquidation, funding and risk controls |
| Assets / wallet | `/assets` | Placeholder says no account data loaded | Connect authenticated balances, available/frozen amounts, asset ledger and transaction history; no fabricated balances |
| Orders | `/orders` | Placeholder says authenticated account API will supply history | Connect read-only order history first; separately verify cancellation and order mutation contracts |
| Deposit | `/deposit` | Placeholder; address selection and pending-deposit flow not connected | Connect supported asset/network address retrieval, deposit status and confirmations; no simulated deposit |
| Withdraw | `/withdraw` | Placeholder; no transaction can be submitted from preview | Connect policy/limits, address validation, risk review, 2FA confirmation and server-side withdrawal state only after safe staging QA |
| Account / profile | `/me` | Placeholder; account details not loaded | Connect authenticated profile and user preferences |
| Login / registration | `/login`, `/register`, `/account-setup`, callback | New auth flow is implemented on inspected branch; backend tests/CI were previously reported passing | Preserve current Google/Web3/username-password/session behavior; verify browser E2E against isolated test accounts |
| Security | `/settings` | Password/security page exists; full 2FA enrollment/confirm/disable UI is not yet complete | Implement complete management UI after canonical frontend root is confirmed |
| KYC | `/kyc` | Placeholder | Connect KYC submission/status and evidence requirements to backend |
| Support | `/support` | Placeholder | Connect authenticated support conversation APIs |

## Important distinction: current scope vs finished scope

- Strata Pro has already influenced the BTCBOX Vite frontend foundation and visual structure; this does not prove every upstream Strata source file was copied into `frontend/vendor/strata-pro`.
- Shadcn Fintech remains a separately pinned upstream source. It must be adapted selectively; its Next.js routing, Clerk auth, seeded demo data and simulated transfers are not authoritative BTCBOX services.
- A route existing in React Router is not proof that the business feature is implemented.
- A backend API endpoint existing is not proof that the browser UI is wired to it or that the complete transaction lifecycle works.

## Safe execution order

1. Resolve effective Vercel Root Directory/build settings and prove which artifact is served; do not change deployment settings during this audit.
2. Inventory exact API contracts and tests for spot orders, seconds orders, futures, assets, deposits, withdrawals and admin functions.
3. Connect read-only market/account/order data before enabling any financial mutation controls.
4. Build missing customer pages and admin UI against the confirmed canonical runtime; keep financial controls disabled in QA.
5. Run build, unit/integration tests, route coverage and responsive/browser QA at the exact candidate SHA.
6. Request user approval before merge to `main` or production deployment.

## Safety / release boundaries

No merge to `main`, no Vercel deployment/configuration change, no Supabase production migration or write, no real order/deposit/withdrawal, and no change to the locked trading page layout was performed in this batch.


## Follow-up API contract audit — 2026-11-06 (UTC+8)

Application branch re-inspected: `feat/btcbox-web3-auth-20261105` at `741c709d818cb10145620e2e0ba84891736d64de`.
This addendum supersedes any broader wording above that implies the seconds APIs do not exist.

### Confirmed backend capabilities and hard gates

| Capability | Backend evidence | Current readiness |
|---|---|---|
| Market ticker / candles / depth | `GET /api/market`, `GET /api/kline`, `GET /api/depth` fetch Coinbase primary / Bybit fallback data | SOURCE OBSERVED; React Dashboard calls ticker and kline APIs |
| Spot limit orders | `POST /api/order` validates supported pair, side, quantity, limit price and idempotency; calls `submit_limit_order_matching_v1` | SOURCE OBSERVED; hard-disabled unless `matchingEngineEnabled()` passes |
| Spot cancel | `POST /api/order/cancel` calls `cancel_limit_order_matching_v1` | SOURCE OBSERVED; hard-disabled by same matching-engine gate |
| Spot market orders | API explicitly rejects every type other than `limit` | NOT SUPPORTED |
| Spot matching migration | `0009_financial_matching_engine_v1.sql` exists | SOURCE OBSERVED; migration application, RPC readiness and matching cutover are NOT VERIFIED |
| Legacy spot ledger RPC | `0008_financial_spot_trade_v3.sql` creates `execute_spot_trade_atomic`, but its own header says it is not a matching engine and records a caller-validated simulated/market fill | DO NOT treat as the active matching engine; current `POST /api/order` calls the separate matching RPC |
| Seconds contracts | `POST /api/seconds/order`, `POST /api/seconds/settle`, `GET /api/seconds/positions`; trusted server-side reference prices; SQL ledger RPCs and idempotency protections | SOURCE OBSERVED; hard-disabled unless `financialWritesEnabled()` passes |
| Seconds scope | BTC/ETH/SOL/BNB; 30/60/300/900 seconds; up/down directions | SOURCE OBSERVED; this is seconds trading, not perpetual futures |
| Perpetual futures | No corresponding futures order/position/funding/liquidation API or migration found in inspected tree | NOT FOUND IN INSPECTED SOURCE; separate implementation required |
| Account / balances | `GET /api/account` and `getAccount()`; normalized ledger snapshot only when financial-read cutover is enabled, otherwise legacy account state | SOURCE OBSERVED; React AssetsPage does not call it yet |
| Order history | `GET /api/orders` and `getOrders()`; matching-table read path is conditional on matching-engine gate | SOURCE OBSERVED; React Orders route is still placeholder |
| Deposit | `POST /api/deposit` with zero/omitted amount only queries a configured deposit address; positive amount is explicitly rejected pending on-chain confirmation | SOURCE OBSERVED; React Deposit route is placeholder |
| Withdrawal | `POST /api/withdraw` includes address allowlist/cooldown, fund-password/2FA and admin-review logic; final posting requires financial cutover | SOURCE OBSERVED; React Withdraw route is placeholder and financial write gate is closed by default |
| KYC / support | `POST /api/kyc`, `POST /api/support/chat` exist | SOURCE OBSERVED; React routes remain placeholders |

### React frontend connection gap

The current Vite client `frontend/src/lib/api.ts` exposes market, kline, authenticated account, read-only orders and auth methods. It does not expose spot order submit/cancel or seconds order/settle/positions methods. `frontend/src/App.tsx` maps `/trade/:symbol` and `/seconds` to generic placeholder `SectionPage`; `/orders`, `/deposit`, `/withdraw`, `/kyc` and `/support` are also placeholders. `AssetsPage` does not invoke the existing `getAccount()` client method.

The repository also contains a legacy vanilla-JS customer application under `backend/assets/js` with spot/seconds interaction code and tests. That code is not automatically wired into the current Vite React routes. Reuse must be deliberate and contract-tested; do not mistake legacy UI presence for React integration.

### Corrected integration sequence

1. Preserve the already implemented backend API contracts; do not rebuild them.
2. Add typed Vite client methods for the existing read-only endpoints first: account, orders and seconds positions (while preserving the explicit cutover-incomplete state instead of interpreting it as a genuine empty portfolio).
3. Connect the React Assets and Orders pages to those read-only methods with loading/error/empty states and auth guards.
4. Add typed spot submit/cancel and seconds order/settle client methods only after request/response contract tests cover idempotency, uncertain network outcomes and the backend's fail-closed codes. Keep controls unavailable while financial/matching gates are closed.
5. Treat deposits as address display + chain-confirmation status; never allow client-side credit. Treat withdrawals as a staged request with review status, never as an immediate transfer.
6. Perpetual futures remain a distinct backend product gap; do not relabel seconds contracts as futures.

### Evidence classification

- SOURCE OBSERVED: backend route implementations and SQL migrations exist for spot matching, seconds lifecycle, account reads, withdrawal and deposit address query.
- SOURCE OBSERVED: spot matching and seconds financial mutations are protected by server-side cutover flags.
- SOURCE OBSERVED: current Vite client and routes are not yet connected to most of these business APIs.
- NOT VERIFIED: migrations are applied in the target Supabase project; RPCs are deployed; financial read/write flags are configured; any end-to-end financial lifecycle is operational.
- NOT VERIFIED: any perpetual futures engine exists outside the inspected application branch.
- No production DB writes, financial operations, Vercel changes, merge, or deployment were performed.


## Derivatives template source audit — 2026-11-06

### SOURCE OBSERVED

- The pinned Strata Pro source at `bymilon/strata-pro-crypto-ui` commit `a3f79d0237c68faddc877f8c1b00afece2fbbae8` contains 42 tree entries. Its tracked source is a dashboard starter: app shell, sidebar/topbar, token icon, dashboard cards/charts/table and static dashboard data. No futures, perpetual, derivatives, leverage, margin, position, or contract-specific source paths were found.
- Strata Pro README explicitly describes the project as frontend-only, using mock market data, and excluding live trading, auth, and backend integration.
- The pinned Shadcn Fintech source at `abderrahimghazali/shadcn-fintech` commit `a905058c75a840896d27a16991f2e7cc1ca06f3f` contains Crypto, Investments, Accounts, Transactions and Transfers pages, but no futures/perpetual/derivatives/margin/position source paths.
- Shadcn Fintech `src/components/crypto/trade-form.tsx` is a spot-style conversion/buy/sell form. Its `handleTrade()` uses local timers to display a successful trade without calling a backend. `crypto-page-client.tsx` seeds prices from static data and simulates price drift every three seconds. These are demo interactions, not an exchange order flow.

### INTEGRATION DECISION

- Do not treat either downloaded template as an existing perpetual-contract implementation.
- Reuse Strata Pro's market-terminal visual components and Shadcn Fintech's account/portfolio UI selectively; replace all demo prices, seeded balances and simulated trade success with BTCBOX APIs.
- Perpetual contracts remain a separate backend/frontend product gap: require explicit contract specs, isolated/cross margin policy, leverage limits, position accounting, funding, risk checks, liquidation and settlement before implementation. Do not relabel the existing seconds-contract product as perpetual.
- This audit is source-only. It does not prove runtime behavior or any external database deployment.
