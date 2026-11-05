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
