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
3. **Positive max-position-cap validation is present in the currently fetched PR #116 SQL.** The replacement function checks for a null or non-positive cap on opening orders before entering the opening/reservation branch (function lines 64–67), so the previously reported malformed/unreachable-guard concern is not reproduced in this fetched file revision. The later exposure calculation is conditional on non-null, but the earlier guard makes that condition true for this path. Keep a regression test for null/zero caps so future edits cannot remove the fail-closed check.
4. **The reduce-only minimum-notional exemption is correct and should be retained.** The new minimum-notional check is conditional on neither `p_reduce_only` nor `p_close_position`, so small partial closes and full closes are not blocked by an opening-order minimum.
5. **Maker-side reduce-only logic is new matching behavior.** The rewritten function adds a maker-position cap and cancellation path in addition to the taker cap. This requires targeted regression tests for maker/taker partial fills, opposite-side position availability, simultaneous orders, cancellation, and ledger/margin invariants.
6. **Full-function rewrite risk remains.** The migration replaces the complete order submission RPC, not just a small validation block. Every reservation, partial-fill, fee, insurance, cancel, idempotency and close-position path must be compared with the current authoritative function and exercised against a disposable staging database.

## Current authoritative SQL risks still deferred

The same liquidation-only status guard is also present in this branch's current authoritative migration `0041_perpetual_contract_v1.sql`: it rejects any status other than `trading` or `open_only` before checking the reduce-only / close-position flags. Therefore this is not only a PR #116 regression; the existing SQL contract also prevents emergency reduce/close orders while the market is `liquidation_only`.

The current migration `0041` also treats `max_position_notional` as nullable and only applies an exposure check when the value is present. The new admin form/API now require a positive cap for new or edited market configurations, but this does not retrofit or protect any pre-existing row with a null cap. The authoritative order RPC must be hardened and tested before any market activation.

These order-RPC changes remain deliberately deferred because they affect matching, positions, margin reservation and settlement. No status semantics or financial SQL was changed in this admin-only batch.

## Current implementation boundary

The current admin panel intentionally exposes only fields already present in migration 0041. The PR #116 minimum-notional and market-order lot fields are not displayed or sent until their schema migration and rewritten order RPC are separately reviewed and approved.

Evidence status:
- SOURCE OBSERVED: branch source and PR #116 migration inspected.
- STATIC SOURCE CHECKED: route, permission, paused-state, risk-field and UI wiring assertions are present.
- TEST PASSED: not claimed; the test suite and frontend build have not been executed in this environment.
- NOT VERIFIED: staging database behavior, live admin API behavior, visual rendering and production state.

## Follow-up source review — authoritative order RPC (2026-11-24)

This follow-up inspected the complete function bodies in current branch migration `0041_perpetual_contract_v1.sql` and compared the replacement function in PR #116 migration `0051_perpetual_market_min_notional_v1.sql`. This is source review only; no SQL was executed and no financial SQL was changed.

### Confirmed current-0041 findings

1. **`liquidation_only` cannot accept user reduce/close orders.** In `perp_submit_order`, the market status guard rejects every status outside `trading` and `open_only` before reaching the reduce-only branch (0041 lines 405–408). The market lookup also requires `enabled=true` (line 405). A safe correction must explicitly define which statuses permit reduce-only orders; it must not accidentally allow new exposure in `paused`.
2. **Resting maker reduce-only orders are not capped against the maker's live position.** The current matching loop caps the taker with `v_reducible_remaining` (0041 line 141 and lines 569–572), but it does not reload and cap a maker's reducible position before calculating the fill. A maker reduce-only order can therefore outlive the position it was meant to close; a later fill risks reducing through zero and opening the opposite side. PR #116 adds maker-side live-position lookup, fill capping and exhausted-order cancellation (its replacement function lines 168–183 and 264–270); that logic still needs regression coverage before adoption.
3. **Stale mark data blocks reduce-only orders too.** The current function raises on missing/stale mark data without a reduce-only exception (0041 lines 414–419). Emergency close behavior under stale pricing needs an explicit execution policy; simply bypassing all price safeguards is not an acceptable automatic fix.
4. **Market-IOC response can disagree with persisted order state.** On an unfilled market-order remainder, the function sets the stored order to `remaining_quantity=0,status='cancelled'` (0041 lines 580–600), but returns the local `v_remaining` variable without re-reading the row (lines 611–613). PR #116 re-reads the persisted `remaining_quantity` before constructing the response (replacement function lines 314–317). Add an API/RPC regression test for partial-fill and no-fill IOC cases.
5. **Existing null exposure caps remain fail-open for openings.** Current 0041 only checks `max_position_notional` when it is non-null (lines 442–451). Admin API/form validation protects new or edited configurations, but does not protect legacy rows. The order RPC must reject opening orders when the cap is null, zero or invalid, independently of UI state.

### PR #116 follow-up concerns

1. **Reduce-only status handling is too broad as written.** PR #116 bypasses the `trading/open_only` status guard whenever `p_reduce_only` is true (replacement function lines 59–62). This appears to permit reduce-only orders in `paused` as well as `liquidation_only`. Define an explicit state matrix: `paused` should not silently inherit emergency-close behavior; `liquidation_only` should allow only validated risk-reducing actions; `trading/open_only` should retain their intended opening rules.
2. **Max-cap guard re-check: no malformed nesting found in the fetched PR SQL.** The early null/non-positive cap guard is before the opening branch (function lines 64–67); the later exposure calculation is inside the opening branch and is reached only after that guard. The earlier review note about nesting behind the leverage exception is superseded by this direct re-check. Keep null/zero-cap regression tests.
3. **Maker-side reduce-only protection is a useful targeted change, not grounds to import the whole RPC.** The replacement changes order matching, position updates, fees, margin movement and IOC cancellation. Do not transplant the complete function merely to obtain the maker cap or minimum-notional guard.

### Required regression matrix before any financial SQL change

- Market states: `trading`, `open_only`, `liquidation_only`, `paused`, with enabled true/false; test open, reduce-only partial close, full close and liquidation-engine close separately.
- Reduce-only maker and taker: live position smaller than resting order, position fully closed before later fill, partial fill across multiple counterparties, and no reverse-side position creation.
- Mark feed: fresh, stale, missing and circuit-breaker-deviated; verify the explicitly approved close policy for each case.
- Market IOC: no fill, partial fill, full fill; response remaining quantity must equal the persisted order row and all reserve balances must reconcile.
- Exposure cap: positive, null, zero, legacy null row, concurrent orders and partial fills.
- Financial invariants: available/frozen balances, isolated margin, maker/taker fees, insurance credits, operation idempotency, ledger uniqueness and cancel/release behavior.
- Funding and liquidation: duplicate interval settlement, insufficient available balance with margin fallback, stale mark protection, open-order reserve release, insurance coverage and bad-debt recording.

Evidence status for this follow-up:
- SOURCE OBSERVED: complete current 0041 function bodies and PR #116 replacement function.
- STATIC REVIEW: findings above are based on source control flow and schema constraints; no runtime behavior is claimed.
- TEST PASSED: none claimed for this follow-up.
- NOT VERIFIED: PostgreSQL execution, concurrency behavior, staging ledger invariants, live API behavior and production state.
