# BTCBOX restoration audit

Audit date: 2026-11-06
Recovery branch: `recovery/btcbox-all-sources-20261106`
Recovery base: `feat/btcbox-strata-theme-batch-20261105` at `0b93b1a5c77aaff5420ab1bbdf2f5c9eec5f88de`
Before this audit note: `a52d7c3973221c7f72de8b8d3e659efaa0b09b3f`

## 1. Recovery result

SOURCE OBSERVED:
- Recovery branch is 15 commits ahead of `main`, 0 behind at the time of audit.
- It contains the 14-commit Strata theme/live-market batch plus one recovery commit.
- It restores four complete repositories as pinned Git submodules:
  - Strata Pro: `a3f79d0237c68faddc877f8c1b00afece2fbbae8`
  - Shadcn Fintech: `a905058c75a840896d27a16991f2e7cc1ca06f3f`
  - BTCBOX v33 feature branch: `d2702086ce217fa365f8a77fe4e55b5766ebbe62`
  - Original source/archive repository BTC: `c6c8e79862046d75430c897a369fafae31dc5601`
- All four pinned commits were confirmed to exist through GitHub commit lookup.
- The original source archive repository contains `admin-panel-main.zip`, `core-main.zip`, `web-app-main.zip`, `opendax-2-6-stable.zip`, and `frontend-reference/`.
- The branch is isolated. No merge to `main`, production deployment, database write, or destructive operation was performed.

To fetch the complete upstream contents, use a recursive clone or `git submodule update --init --recursive`. The parent repository stores pinned submodule references, not duplicated copies of all upstream files.

## 2. Existing main-branch work already preserved

SOURCE OBSERVED:
- `main` is `14a8e361fd928626d4e350a03698135f0c49ceea`.
- PR #21 (four-language UI/mobile work) is merged into main at this SHA.
- PR #20 (authenticated read-only account/orders API client) is merged.
- PRs #5–#10 include the React/Vite frontend foundation, Strata unified build, admin/backend integration notes, and visual refresh.
- The 14-commit Strata theme batch was not in main and is now retained on the recovery branch. It removes generated/random chart fallback data, applies the Strata neutral theme to shared UI/charts, and refreshes market candles periodically.
- PRs #15 and #19 were closed without merging. Do not treat those PRs as merged; relevant chart/theme commits are preserved through the Strata theme branch instead.

## 3. React/Vite frontend — current implementation gaps

SOURCE OBSERVED:
- `frontend/` is a Vite + React 19 + TypeScript app.
- `frontend/src/lib/api.ts` currently exports only five request functions: `getMarkets`, `getKlines`, `getAccount`, `getOrders`, and `logout`.
- The dashboard calls `/api/market` and `/api/kline`; ticker refresh is every 30 seconds and candle refresh is every 60 seconds. Runtime freshness and backend connectivity are NOT VERIFIED.
- The recovery branch removes the generated random candle/volume series from `dashboard.data.ts`. A hard-coded `topTokens` sample array remains in that module and should be confirmed unused or removed before production use.
- `frontend/src/App.tsx` still routes Spot trading, Seconds, Orders, Deposit, Withdraw, Earn, Login, Register, KYC, Support, and Settings to generic placeholder pages. Assets and My Account also display no-account-data / sign-in placeholders.
- Strata Pro and Shadcn Fintech are source references only at this point; neither full upstream application is wired into the BTCBOX runtime.
- The current app does not yet expose a completed order-entry/settlement flow through its React routes.

NOT VERIFIED:
- Full recursive submodule checkout in a clean workspace.
- Vite install/build/lint/unit tests on the recovery branch.
- Live API connectivity, auth/session hydration, market data freshness, and mobile browser QA.

## 4. Existing backend/admin state

SOURCE OBSERVED from the current `btcboxcdt/main` source:
- The legacy backend contains a large API handler and a broad API adapter surface.
- The admin route in `backend/assets/js/app-core.js` still resolves to `Admin view loading…`; an actual admin console UI is not present in that snapshot, even though admin API methods/routes exist.
- The backend uses HTTP Basic Auth for admin API access in this snapshot. Individual Supabase-authenticated admin identities and server-side role checks are not established by this source audit.
- Presence of SQL files in Git does not prove they have been applied to Supabase.

## 5. Recovered v33 business work — preserve, do not blindly copy

SOURCE OBSERVED:
- `avali9308-code/btcbox-v33` branch `fix/manual-withdrawal-rpc-compat-20261106` is 77 commits ahead of its `main`, 0 behind.
- The branch contains work for manual deposit-address configuration and account-scoped manual credit, manual withdrawal payout completion with required TxID, independent simultaneous seconds positions, settlement idempotency, and configurable seconds policy snapshots.
- The seconds policy SQL enforces payout rate >= 0.85, supports admin-controlled durations/min/max amounts and payout rate, and snapshots the selected policy onto each new position.
- The v33 source is a separate vanilla-JS SPA/API implementation, materially different from the React/Vite app in `btcboxcdt`. Treat it as recovered business reference/source, not as a drop-in replacement for the React frontend or current backend.
- The v33 branch contains migration-focused SQL and tests. The project owner later rejected spending time on migration-history reconciliation. Do not port its migration runner/history work.
- The current v33 `loadDB()` implementation fails closed if the `btcbox_state` JSON row is absent. It is therefore not a clean-empty-database bootstrap as-is.
- The v33 source still has shared HTTP Basic Auth admin handling; it does not satisfy the intended individual admin identity/role model as-is.

INTEGRATION RULE:
- Selectively port the useful business contracts and implementation logic only after mapping them to the canonical React/Vite frontend and a simple fresh schema.
- Do not copy the v33 app wholesale over `btcboxcdt`.
- Do not copy its migrations or assume its DB schema is applied.
- Do not enable financial writes or use real deposits, withdrawals, or orders for QA.

## 6. Build/check evidence

SOURCE OBSERVED:
- The recovery commit is `a52d7c3973221c7f72de8b8d3e659efaa0b09b3f`.
- GitHub Actions workflow lookup returned no PR-triggered workflow runs for that exact commit.
- The Vercel status for that commit is `failure` and its target URL indicates a Vercel build-rate-limit/plan limit (`upgradeToPro=build-rate-limit`). This is not a compiler/test failure report.
- Therefore no successful build, lint, or test result is claimed for the recovery branch.

## 7. Next implementation order

1. Keep this recovery branch as the consolidated source checkpoint; do not merge it to main yet.
2. Build a page/component map from the pinned Strata Pro and Shadcn Fintech sources to BTCBOX routes. Preserve licenses/notices and adapt Next.js-only parts rather than importing its app router or Clerk.
3. Map the recovered v33 business flows to React UI and backend contracts: Seconds policy/order/settlement; manual deposit config/credit; manual withdrawal review/payout TxID.
4. Design one clean fresh Supabase schema and server-side operations for the required product. Do not spend time reconciling the rejected migration history.
5. Implement the missing React routes and admin UI, then run reproducible build/tests and independent QA before requesting approval to merge or deploy.
