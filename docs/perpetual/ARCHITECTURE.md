# BTCBOX Perpetual Contract (Contract / Perpetual) — Architecture v1

## Scope (first version)
USDT-margined **linear** perpetual, **isolated margin only** (no cross, no portfolio margin, no multi-asset collateral, no copy trading). Net position per (user, symbol) — no hedge mode. Leverage capped per market (max 100, markets default lower). All money `numeric(38,18)` in Postgres; app layer passes strings.

## Components
1. **Schema** (`backend/supabase/sql/0041_perpetual_contract_v1.sql`, additive):
   - `perpetual_markets` (risk params, fees, funding interval/cap, circuit breaker, status)
   - `perpetual_orders` (single authoritative order book; price-time partial indexes)
   - `perpetual_positions` (net, isolated margin, entry, realized PnL, funding paid)
   - `perpetual_trades` (fills, fees, operation_id)
   - `perpetual_cancel_requests` (idempotent cancel)
   - `perpetual_funding_rates` + `perpetual_funding_history` (auditable, idempotent per user/interval)
   - `perpetual_mark_price_feed` (multi-source, deviation %, status ok/degraded/stale)
   - `perpetual_liquidation_events` + `perpetual_position_history` (append-only audit)
   - Reuses `financial_accounts` / `financial_operations` / `financial_ledger`; extends `operation_type` with `perp_*`. Insurance fund = financial account `__perp_insurance__` (USDT).
2. **Matching**: taker-driven PL/pgSQL RPC `perp_submit_order` with `pg_advisory_xact_lock(perp-market:<symbol>)` → **single writer per market**, crash-safe (transactional, state in tables), price-time priority, partial fills, market orders IOC. Duplicate `client_order_id` replays. `perp_cancel_order` idempotent.
3. **Positions**: `perp_apply_fill_to_position` handles open/increase/decrease/close/flip with weighted-average entry, pro-rata margin release, realized PnL settled to available immediately.
4. **Margin & risk**: opening orders reserve initial margin + worst-case fee (over-reserve, safe). Maintenance margin check + liquidation price computed in `perp_liquidate_position`. Loss waterfall: isolated margin → insurance fund → bad debt recorded (no socialized loss v1). Mark-price stale/deviated → opens rejected, liquidation paused (positions protected). User max position notional enforced.
5. **Funding**: worker records rate (unique per symbol/interval) then settles per user via `perp_settle_funding_one` (idempotent; positive rate = long pays short). Insufficient available debits isolated margin.
6. **Mark price**: worker aggregates ≥2 sources, writes via `perp_record_mark_price` (computes max deviation %, status). Sources + timestamps persisted. Circuit breaker: deviation > market threshold → reduce/close only.
7. **API** (`/api/perpetual/*`, gated by `perpetualEngineEnabled()` default OFF): markets, order (idempotency key), cancel, orders open/history, positions (unrealized PnL + liq price computed), trades, funding, close-position. Admin `/api/admin/perpetual/*` for market/risk config + liquidation events.
8. **Workers** (`backend/scripts/perp-*.js`): mark-price, funding, liquidation — all idempotent, restart-safe.

## What is explicitly NOT in v1 (documented, not faked)
Cross margin, portfolio margin, hedge mode, stop/trigger orders, trailing stops, auto-deleveraging (ADL) socialized loss (bad debt logged instead), spot fees (still zero), high-frequency market-making depth. UI shows honest empty states.

## Gating / safety
`perpetualEngineEnabled()` requires `financialWritesEnabled()` + Postgres cutover. Markets default `enabled=false, status='paused'`. Product stays closed in UI if API returns not-enabled — no fake availability.
