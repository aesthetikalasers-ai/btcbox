# Perpetual v1 — Required Live-Postgres Scenarios (Phase 7)

These scenarios MUST be run against a disposable isolated PostgreSQL/Supabase instance with all
migrations 0001–0041 applied, before any financial cutover. Source-level contract tests
(`perpetual-api-contract.test.js`, `perpetual-sql-contract.test.js`) do NOT substitute for these.
Preserve SQL logs, setup, assertions, and reconciliation output for each.

For every scenario, assert after each step:
1. `sum(available_delta + frozen_delta) = 0` per asset across all `financial_ledger` rows touched.
2. `financial_accounts.available >= 0` and `frozen >= 0` for every user and `__perp_insurance__`.
3. `financial_accounts` balances reconcile with ledger sums per (user, asset).
4. No orphan `financial_operations` rows without at least one `financial_ledger` row.
5. No `perpetual_orders.reserved_margin` leaks (frozen matches sum of reserved_margin + isolated_margin).

## Scenarios

1. **Duplicate order (idempotency)** — submit same `client_order_id` twice; second returns `duplicate=true`, no double margin reserve, single order row, single reserve ledger leg. Then submit same key with different price/qty → must raise `client order id payload mismatch` (HTTP 409), no state change.

2. **Insufficient balance / margin** — submit order with notional/leverage requiring more than available USDT; must raise `insufficient margin`, no ledger row, no order row, balance unchanged. Boundary: exactly available → succeeds; available - 1 tick → fails.

3. **Service restart mid-match** — begin `perp_submit_order`, kill session mid-transaction (e.g. `pg_terminate_backend` after reserve insert, before fill commit). Assert rollback: no partial order, reserve released, ledger consistent. Restart and resubmit same `client_order_id` → must not double-reserve.

4. **Price anomaly / circuit breaker** — record mark price with sources deviating > `circuit_breaker_deviation_pct` (status degraded). Assert opening order rejected (`price deviation circuit breaker active`); reduce-only/close still accepted. Record fresh in-range mark → opening accepted again.

5. **Source outage / stale mark** — stop mark-price worker until `now() - last_mark > mark_price_stale_sec`. Assert `perp_submit_order` raises `mark price unavailable or stale`; assert `perp_liquidate_position` raises `mark price stale — liquidation paused (positions protected)` (positions protected, not liquidated).

6. **Liquidation-critical order** — open position, move mark to just above/below estimated liquidation price. Assert `perp_liquidate_position` returns `liquidatable=false` when safe; cross the threshold → `liquidated=true`, isolated margin consumed, open orders cancelled + reserved margin released, `perpetual_liquidation_events` row written, position deleted, no frozen leak. Force loss > isolated margin → insurance fund debited (insurance_cover > 0); drain insurance → bad_debt > 0 logged (no negative balances).

7. **Partial-fill then cancel** — submit large limit order that partially fills (resting book), then cancel with `client_cancel_id`. Assert only filled portion's margin released at fill; cancel releases remaining reserved_margin exactly; order status=cancelled, reserved_margin=0, frozen reconciles. Cancel again (same client_cancel_id) → duplicate, no double release.

8. **Double funding settlement (idempotency)** — run `perp_settle_funding_one` twice for same (symbol, funding_at, user). Second returns `duplicate=true`; exactly one `perp_funding` operation, exactly one ledger leg, exactly one `perpetual_funding_history` row. Funding payment sign: long pays short when rate>0 (long available decreases, short increases) and vice versa.

9. **Simultaneous close + liquidation race** — concurrently (two sessions) issue a user close market order and trigger `perp_liquidate_position` for the same position. Assert exactly one succeeds (the other returns `no_position` or duplicate); no double release of isolated margin, no negative balance, position history written exactly once, total frozen delta = isolated_margin + open-order reserved_margin.

10. **Transaction failure / RPC timeout** — call `perp_submit_order` and cut the connection before response. Retry with same `client_order_id` → returns the original order (duplicate=true) or, if transaction rolled back, resubmits cleanly. Never double-reserves. Same for cancel and funding. Assert ledger idempotency holds.

## Additional required (non-scenario) gates

- Apply 0041 to empty DB and verify all 7 functions created with exact signatures, RLS enabled, EXECUTE only to `service_role`, `__perp_insurance__` row present.
- Verify `perp_latest_mark_price` returns `max_deviation_pct` and `source_count` columns (regression guard).
- Verify market IOC with zero fills (reduce-only): no `financial_ledger` row with NULL operation_id, no reserve (v_reserve=0), order status=cancelled.
- Verify flip (close + open opposite in one fill) accounting: old margin fully released, new margin locked, position_history row for old side, new position row, ledger reconciles.
- Verify admin market upsert with `max_leverage=101` or `mmr=0.6` rejected at API layer.
- Verify `FINANCIAL_PERPETUAL_ENGINE_ENABLED=0` (default) → all writes return 503 `PERPETUAL_ENGINE_UNAVAILABLE`, `/perpetual/markets` returns empty list with `perpetual_enabled:false`.
