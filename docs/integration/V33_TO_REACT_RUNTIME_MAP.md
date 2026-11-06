# BTCBOX runtime integration map — 2026-11-06

Status: source audit / integration boundary. This document is not a claim that V33 business features are already integrated.

## Canonical target and exact source heads

- Target repository: `avali9308-code/btcboxcdt`.
- Target integration branch: `integration/btcbox-runtime-integration-20261106`.
- Target branch currently has the same 16-commit delta as `recovery/btcbox-all-sources-20261106`, based on `main` at `14a8e361fd928626d4e350a03698135f0c49ceea`.
- V33 business source: `avali9308-code/btcbox-v33`, branch `fix/manual-withdrawal-rpc-compat-20261106`; inspected API core blob `8141b52382888bc7a37a61b948c47d60fc08bff8`, account view blob `a6f9681cc907f8ae776ace7cde388139ae273c5e`, trading view blob `ad63fafcecf5748cc5525d5586405fce7bd56d9c`.
- Template source pins are recorded in `docs/recovery/RESTORATION_AUDIT.md`. They are source references, not runtime imports.

## Runtime shape observed on the target

- Customer runtime is React 19 + Vite under `frontend/`.
- `backend/package.json` orchestrates Vite build then `backend/scripts/build-site.js` assembles the public output and retains legacy admin/OAuth resources.
- `frontend/src/App.tsx` currently routes Seconds, spot order-entry, Orders, Deposit, Withdraw, Login, Register, KYC, Support and Settings to generic placeholder sections.
- `frontend/src/lib/api.ts` exposes market, kline, account, orders and logout functions; it does not yet expose the seconds-policy/positions/order/settlement client methods.
- `backend/api-core.js` already contains seconds order, settle and positions handlers, but the current target snapshot does not contain the V33 `admin/seconds-policy` handler or the V33 manual withdrawal `withdraw/mark-paid` completion handler.
- The legacy target admin shell is not the intended finished React admin console. Do not treat the legacy Basic Auth shell as the final individual-admin-identity and role-based admin system.

## Business source mapping

| Capability | V33 source evidence | Target status | Integration rule |
|---|---|---|---|
| Seconds policy | `GET/POST /api/admin/seconds-policy`, PostgreSQL-backed policy read/write, minimum payout rate validation of 0.85, per-position policy snapshot | Existing target has seconds order/settle/positions handlers, but no matching policy admin handler found in inspected API core; React route is placeholder | Port policy contract and UI only after the target's fresh schema/RPC contract is defined. Keep payout floor configurable by admin and never hardcode 85% as the only rate. |
| Seconds positions | `GET /api/seconds/positions`; returns open/history and server time | Handler already exists in target API core; no React page/client integration | Reuse target endpoint after response contract tests; do not copy V33 monolithic SPA. |
| Seconds order | `POST /api/seconds/order`; server fetches reference price, validates request ID, and uses atomic RPC behind financial cutover gate | Handler already exists in target API core; no React order-entry integration | Reuse/compare implementation; client never supplies trusted price; retain idempotency and unresolved-order safeguards. |
| Seconds settlement | `POST /api/seconds/settle`; server price source and atomic settlement RPC | Handler already exists in target API core; no React integration | Preserve server-side pricing, maturity/ownership checks and atomic/idempotent settlement. |
| Deposit address config | V33 `GET/POST /api/admin/config`; eight network keys and validation | Target config handler exists; target admin UI is not the V33 console | Build the new React admin surface against the target API; preserve eight known networks and explicit address clearing semantics. |
| Manual deposit credit | V33 `POST /api/admin/deposit/confirm`; six supported assets; account/asset-derived identity; atomic RPC and idempotency | Target route and exact DB RPC contract require comparison before porting | Preserve user selection + asset-row binding; do not ask staff to type UID/coin; no user-created pending deposit order or chain watcher. |
| Manual withdrawal payout | V33 `POST /api/admin/withdraw/mark-paid`; rejects blank TxID/reference and uses atomic RPC | Matching handler not found in inspected target API core | Port only after target canonical withdrawal table/RPC contract is fixed; manual transfer only, no blockchain broadcast. |
| Admin UI | V33 `VIEWS.admin` contains tabs for users, deposit addresses, withdrawals, KYC and seconds | Target React admin console is not yet present as an integrated runtime route | Rebuild with BTCBOX React design system and verified target auth/role model; do not copy Basic Auth as final admin identity. |

## Important compatibility findings

1. V33 is a vanilla-JS SPA/API; target runtime is React/Vite plus a backend build orchestrator. A wholesale copy would create a second competing runtime.
2. The V33 admin view is coupled to `apiAdapter`, global state, HTML-string rendering and HTTP Basic Auth. It is a behavior/reference source, not a drop-in React page.
3. The target backend already has seconds order/settlement/positions endpoints. Replacing them wholesale would risk losing target-specific security and current SQL/RPC alignment.
4. The target and V33 both fail closed when financial cutover flags are not enabled. Keep every financial write/matching gate disabled during integration and QA.
5. V33's migration-history/runner work is not part of this port. Do not replay its numbered migrations or repair hosted history as an integration shortcut.
6. No real deposit, withdrawal, order, settlement, balance credit or production database write may be used for testing.

## Ordered implementation batches

### Batch 1 — React customer routes
- Implement Seconds page using target API contracts after adding response-shape tests for policy, open positions, history, order intent and settlement.
- Replace the placeholder Orders page with authenticated read-only orders using existing `getOrders`.
- Connect account/asset views to existing `getAccount`; keep unpriced assets explicit and never show seeded balances.
- Keep spot trading, deposit and withdrawal actions disabled until their exact API contracts and safe interaction states are verified.

### Batch 2 — financial workflows
- Add the simple manual deposit user instructions/address view, driven by admin-configured network address; do not create pending deposit orders.
- Add withdrawal request/status view only after target API/table contract review; staff records manual payout reference after transfer.
- Port the V33 manual-credit and payout-completion behavior to the target's canonical schema/RPCs, not its legacy JSON state.

### Batch 3 — React admin
- Build a dedicated authenticated admin route and role-aware shell.
- Add user lookup, balances (read-only until approved), deposit address configuration, manual credit, withdrawal review/manual payout reference, KYC, seconds policy, support, and audit-log screens.
- Use selected user + selected asset row to bind UID/coin automatically. Require explicit confirmation and display unknown-result/reconciliation states.
- Keep financial mutation controls visibly disabled while cutover flags remain off.

### Batch 4 — proof and release readiness
- Run canonical frontend typecheck/build, backend Node tests, SQL bootstrap in an isolated PostgreSQL instance, and API contract tests with isolated fixtures.
- Verify responsive layouts and keyboard/accessibility behavior.
- Record exact branch SHA and reproducible test output. No merge, production deployment, or V33 deletion until all required capabilities are integrated and verified and the user approves release.

## Current evidence classification

- SOURCE OBSERVED: target branch is 16 commits ahead of main and 0 behind; this is the restored source checkpoint, not proof of runtime integration.
- SOURCE OBSERVED: target React routes listed above are placeholders; current API client has five request functions.
- SOURCE OBSERVED: target API core already contains seconds order/settle/positions handlers; V33 adds the admin seconds-policy contract and manual withdrawal payout completion handler.
- SOURCE OBSERVED: V33 contains manual deposit credit route for USDT/BTC/ETH/SOL/BNB/USDC, eight deposit network keys, and manual payout reference validation.
- NOT VERIFIED: full recursive submodule checkout, React build/typecheck, backend tests, isolated PostgreSQL bootstrap/RPC execution, browser QA, and end-to-end Supabase connectivity.
- NOT DONE: no business code from V33 has yet been declared integrated by this document.
