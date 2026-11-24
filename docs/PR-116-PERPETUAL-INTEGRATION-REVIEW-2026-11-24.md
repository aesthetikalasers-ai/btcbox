# PR #116 — Perpetual market administration integration review

Date: 2026-11-24

## Scope and branch safety

- Repository: `avali9308-code/btcboxcdt`
- Integration work branch: `work/admin-backend-restructure-20261124`
- Reference PR: #116, `feat/perpetual-market-admin-and-min-notional`
- PR #116 was inspected as a source only. Its branch was not modified or merged.
- No production deployment, production database operation, or SQL migration was performed.

## Changes integrated on this branch

1. Added permission-map entries for `GET admin/perpetual/markets` and `POST admin/perpetual/market`, plus the existing liquidation and insurance read routes. Previously these routes could be rejected as unknown before their route handlers ran.
2. Added the admin market-list endpoint using columns already present in migration `0041_perpetual_contract_v1.sql`.
3. Hardened the market upsert endpoint:
   - base assets must belong to the fixed BTCBOX 26-asset catalogue (USDT and USDC are not accepted as perpetual base assets);
   - symbol must match `BASEUSDT`;
   - precision, leverage, fee, funding and risk parameters are validated server-side;
   - a positive `max_position_notional` cap is mandatory for new/edited market configurations; blank or zero exposure caps are rejected by the API and admin form;
   - `mark_price_stale_sec` and `circuit_breaker_deviation_pct` are persisted;
   - client-supplied activation state is ignored; every configuration write stores `enabled=false` and `status='paused'`;
   - before/after configuration data and the operator reason are sent to the admin audit log after the database upsert succeeds.
4. Added the perpetual market panel to the existing Markets admin tab. Its asset selector reads the current admin asset catalogue rather than maintaining a second hardcoded list. It shows the actual stored market state and clearly states that new/edited settings are saved paused and disabled.
5. Added contract tests for route permissions, fail-closed save state, risk-field persistence, audit ordering and the live asset-catalogue UI integration.

## PR #116 migration blockers — do not apply yet

The migration `0051_perpetual_market_min_notional_v1.sql` is not included in this branch. It adds `min_notional`, `market_quantity_step`, `market_min_quantity` and `market_max_quantity`, then replaces the complete `public.perp_submit_order` function. The following issues need resolution before that migration can be accepted:

1. **Existing market state is not actually forced paused.** The migration comment says existing markets remain paused/disabled, but its updates backfill new columns only. There is no migration statement that sets existing rows to `enabled=false, status='paused'`. Defaults do not change existing rows.
2. **Liquidation-only close semantics are inconsistent.** The function accepts only `trading` and `open_only` before it checks whether an order is reduce-only. Thus `liquidation_only` rejects reduce-only and close-position orders too. The intended emergency-close behavior must be defined and tested before adoption.
3. **The max-position-cap guard is malformed/unreachable.** In the rewritten function, the `if p_leverage > v_market.max_leverage` block is not closed before the following max-position-cap condition. The second condition is therefore nested after an unconditional exception and cannot run. Markets with a null `max_position_notional` can still reach the opening path without the intended fail-closed cap.
4. **The reduce-only minimum-notional exemption is correct and should be retained.** The new minimum-notional check is conditional on neither `p_reduce_only` nor `p_close_position`, so small partial closes and full closes are not blocked by an opening-order minimum.
5. **Maker-side reduce-only logic is new matching behavior.** The rewritten function adds a maker-position cap and cancellation path in addition to the taker cap. This requires targeted regression tests for maker/taker partial fills, opposite-side position availability, simultaneous orders, cancellation, and ledger/margin invariants.
6. **Full-function rewrite risk remains.** The migration replaces the complete order submission RPC, not just a small validation block. Every reservation, partial-fill, fee, insurance, cancel, idempotency and close-position path must be compared with the current authoritative function and exercised against a disposable staging database.

## Current implementation boundary

The current admin panel intentionally exposes only fields already present in migration 0041. The PR #116 minimum-notional and market-order lot fields are not displayed or sent until their schema migration and rewritten order RPC are separately reviewed and approved.

Evidence status:
- SOURCE OBSERVED: branch source and PR #116 migration inspected.
- STATIC SOURCE CHECKED: route, permission, paused-state, risk-field and UI wiring assertions are present.
- TEST PASSED: not claimed; the test suite and frontend build have not been executed in this environment.
- NOT VERIFIED: staging database behavior, live admin API behavior, visual rendering and production state.
