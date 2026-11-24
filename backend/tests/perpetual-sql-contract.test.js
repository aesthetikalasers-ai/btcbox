'use strict';
// Perpetual v1 — SQL-layer contract tests (source-level, no live Postgres).
// Verifies: ledger enforcement, idempotency, insufficient-margin path, reduce-only rejection,
// leverage cap, market-disabled path, stale-mark rejection, funding idempotency, insurance account,
// numeric(38,18) everywhere, no check-constraint weakening, grant/revoke signatures match.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0041_perpetual_contract_v1.sql'), 'utf8');
const fundingSql = fs.readFileSync(path.join(root, 'supabase/sql/0046_perpetual_funding_atomic_clearing_v1.sql'), 'utf8');
const fundingWorker = fs.readFileSync(path.join(root, 'scripts/perp-funding-worker.js'), 'utf8');
const markWorker = fs.readFileSync(path.join(root, 'scripts/perp-mark-price-worker.js'), 'utf8');
const liquidationAccountingSql = fs.readFileSync(path.join(root, 'supabase/sql/0047_perpetual_liquidation_accounting_closure_v1.sql'), 'utf8');

test('0041 extends operation_type with perp_* and reuses financial_accounts/operations/ledger', () => {
  assert.ok(sql.includes("'perp_order_reserve'"));
  assert.ok(sql.includes("'perp_trade'"));
  assert.ok(sql.includes("'perp_order_cancel'"));
  assert.ok(sql.includes("'perp_funding'"));
  assert.ok(sql.includes("'perp_liquidation'"));
  assert.ok(sql.includes("'perp_insurance_cover'"));
  assert.ok(sql.includes("'perp_bad_debt'"));
  assert.ok(sql.includes('insert into public.financial_accounts'));
  assert.ok(sql.includes('insert into public.financial_operations'));
  assert.ok(sql.includes('insert into public.financial_ledger'));
});

test('insurance fund account exists as a normal financial_account and receives fees', () => {
  assert.ok(sql.includes("'__perp_insurance__'"));
  assert.ok(sql.includes("insert into public.financial_accounts(user_id, asset) values ('__perp_insurance__', 'USDT')"));
  assert.ok(sql.includes('insurance_user_id'));
  // fee leg credits insurance available
  assert.ok(sql.includes("available=available + (v_taker_fee + v_maker_fee)"));
});

test('all money columns are numeric(38,18); no float/double/real', () => {
  assert.ok(!/\bfloat\b/.test(sql.replace(/--.*$/gm, '')));
  assert.ok(!/double precision/.test(sql));
  assert.ok(!/\breal\b/.test(sql.replace(/--.*$/gm, '')));
  // spot/fee rates are numeric(12,10) (rates, not money) — allowed
  assert.ok(sql.includes('numeric(38,18)'));
});

test('submit order: market disabled / stale mark / insufficient margin / leverage cap all raise', () => {
  assert.ok(sql.includes("raise exception 'perpetual market disabled or unconfigured'"));
  assert.ok(sql.includes("raise exception 'mark price unavailable or stale'"));
  assert.ok(sql.includes("raise exception 'insufficient margin'"));
  assert.ok(sql.includes("raise exception 'leverage exceeds market maximum'"));
  assert.ok(sql.includes("raise exception 'no position to reduce'"));
  assert.ok(sql.includes("raise exception 'reduce-only order cannot increase position'"));
  // circuit breaker allows reduce/close only
  assert.ok(sql.includes('price deviation circuit breaker active'));
});

test('0051 adds a positive per-market minimum notional and enforces it inside the atomic order RPC', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/sql/0051_perpetual_market_min_notional_v1.sql'), 'utf8');
  assert.ok(migration.includes('add column if not exists min_notional numeric(38,18)'));
  assert.ok(migration.includes('perpetual_markets_min_notional_positive'));
  assert.ok(migration.includes("raise exception 'order notional below market minimum'"));
  assert.ok(migration.includes('coalesce(p_price, v_mark.mark_price) * p_quantity < v_market.min_notional'));
  assert.ok(migration.includes('if not p_reduce_only and not p_close_position'));
  assert.ok(migration.includes('min_notional numeric(38,18)'));
  assert.ok(migration.includes('market_quantity_step numeric(38,18)'));
  assert.ok(migration.includes('market_min_quantity numeric(38,18)'));
  assert.ok(migration.includes('market_max_quantity numeric(38,18)'));
  assert.ok(migration.includes("p_type='market' and not coalesce(p_reduce_only,false)"));
  assert.ok(migration.includes('market quantity precision invalid'));
  assert.ok(migration.includes('market quantity below minimum'));
  assert.ok(migration.includes('Reduce-only partial market orders use the regular lot step'));
  assert.ok(migration.includes('if p_close_position then'));
  assert.ok(migration.includes('Full-position closes use the exact locked position quantity'));
  assert.ok(migration.includes("v_market.max_position_notional is null or v_market.max_position_notional <= 0"));
  assert.ok(migration.includes('market risk exposure cap unavailable'));
  assert.ok(migration.includes('never be blocked by opening-order lot/minimum filters'));
});

test('submit order idempotency: unique (user, client_order_id) + duplicate replay + payload mismatch raise', () => {
  assert.ok(sql.includes('unique (user_id, client_order_id)'));
  assert.ok(sql.includes("raise exception 'client order id payload mismatch'"));
  assert.ok(sql.includes("'duplicate',true"));
  // advisory locks: per (user, client_order_id) then per symbol (single writer per market)
  assert.ok(sql.includes("pg_advisory_xact_lock(hashtextextended('perp-order:'"));
  assert.ok(sql.includes("pg_advisory_xact_lock(hashtextextended('perp-market:'"));
});

test('matching loop reserves initial margin via ledger and writes 4-party fill legs + fees to insurance', () => {
  assert.ok(sql.includes("'perp_order_reserve'"));
  assert.ok(sql.includes("available=available-v_reserve, frozen=frozen+v_reserve"));
  assert.ok(sql.includes("'perp_trade'"));
  // taker & maker margin release legs
  assert.ok(sql.includes('taker margin invariant failed'));
  assert.ok(sql.includes('maker margin invariant failed'));
  // fill persisted
  assert.ok(sql.includes('insert into public.perpetual_trades'));
});

test('market IOC unfilled remainder uses a DEDICATED perp_order_cancel operation (never reuses reserve op id)', () => {
  // regression: old code used coalesce(v_operation_id, v_fill_op_id) which violates unique(operation_id,user_id,asset)
  assert.ok(sql.includes('perp-ioc-cancel-'));
  assert.ok(sql.includes("'perp_order_cancel'"));
  assert.ok(!sql.includes('coalesce(v_operation_id, v_fill_op_id)'));
});

test('taker reserved_margin is kept in sync during fills (cancel would otherwise over-release)', () => {
  assert.ok(sql.includes('set reserved_margin=v_reserve'));
  assert.ok(sql.includes("status=case when v_filled_qty>0 then 'partially_filled' else 'open' end"));
  assert.ok(sql.includes("status='filled', reserved_margin=0"));
});

test('pro-rata margin release uses CURRENT remaining quantity as denominator (not original)', () => {
  // regression: old code used p_quantity / v_maker.quantity (original) → under-release.
  assert.ok(sql.includes('v_reserve * (v_fill / v_remaining)'));
  assert.ok(sql.includes('v_maker.reserved_margin * (v_fill / v_maker.remaining_quantity)'));
  assert.ok(!sql.includes('v_reserve * (v_fill / p_quantity)'));
  assert.ok(!sql.includes('v_maker.reserved_margin * (v_fill / v_maker.quantity)'));
});

test('cancel order is idempotent with payload-mismatch check and releases reserved margin via ledger', () => {
  assert.ok(sql.includes('create table if not exists public.perpetual_cancel_requests'));
  assert.ok(sql.includes("raise exception 'cancel idempotency key payload mismatch'"));
  assert.ok(sql.includes("'perp_order_cancel'"));
  assert.ok(sql.includes('cancel margin release invariant failed'));
});

test('perp_latest_mark_price returns deviation/source columns (callers access .max_deviation_pct)', () => {
  // regression: old function returned only (mark, index, status, age) but submit/liquidate accessed max_deviation_pct
  assert.ok(sql.includes('source_count integer, max_deviation_pct numeric(12,6)'));
  assert.ok(sql.includes('f.source_count, f.max_deviation_pct'));
});

test('funding settlement is idempotent and records history; pays from available then isolated margin', () => {
  assert.ok(sql.includes('perp_settle_funding_one'));
  assert.ok(sql.includes("'perp-funding-'"));
  assert.ok(sql.includes("return jsonb_build_object('ok',true,'duplicate',true)"));
  assert.ok(sql.includes('insert into public.perpetual_funding_history'));
  assert.ok(sql.includes('funding debit invariant failed'));
});

test('liquidation: deterministic idem key (position id), stale-mark pause, loss waterfall margin->insurance->bad_debt, releases open-order reserved margin', () => {
  assert.ok(sql.includes("v_idem := 'perp-liq-'||v_pos.id::text"));
  assert.ok(!sql.includes("floor(extract(epoch from now()))::text;")); // no longer uses now() in idem key
  assert.ok(sql.includes("raise exception 'mark price stale — liquidation paused (positions protected)'"));
  assert.ok(sql.includes('insurance_cover'));
  assert.ok(sql.includes('bad_debt'));
  assert.ok(sql.includes('v_orders_reserved')); // releases reserved margin of cancelled open orders
  assert.ok(sql.includes('reserved_margin=0'));
  assert.ok(sql.includes('insert into public.perpetual_liquidation_events'));
  assert.ok(sql.includes('insert into public.perpetual_position_history'));
  assert.ok(sql.includes("'liquidation'"));
});

test('perpetual schema grants only the identity sequence it creates', () => {
  assert.ok(sql.includes('grant usage, select on sequence public.perpetual_mark_price_feed_id_seq to service_role'));
  assert.ok(!sql.includes('grant usage, select on all sequences in schema public to service_role'));
});

test('all perpetual tables are RLS-enabled, revoked from public/anon/authenticated, granted to service_role', () => {
  assert.ok(sql.includes('enable row level security'));
  assert.ok(sql.includes("revoke all on public.%I from public, anon, authenticated"));
  assert.ok(sql.includes("grant select, insert, update on public.%I to service_role"));
});

test('grant/revoke signatures match the 7 function arg lists exactly', () => {
  const fns = [
    'perp_submit_order(text,text,text,text,text,numeric,numeric,integer,boolean,boolean,text)',
    'perp_cancel_order(text,text,text)',
    'perp_record_mark_price(text,numeric,numeric,jsonb,integer)',
    'perp_settle_funding_one(text,timestamptz,numeric,text)',
    'perp_liquidate_position(text,text)',
    'perp_latest_mark_price(text,integer)',
    'perp_apply_fill_to_position(text,text,text,numeric,numeric,integer,numeric)',
  ];
  for (const fn of fns) {
    assert.ok(sql.includes('revoke all on function public.' + fn + ' from public, anon, authenticated'), 'missing revoke: ' + fn);
    assert.ok(sql.includes('grant execute on function public.' + fn + ' to service_role'), 'missing grant: ' + fn);
  }
});

test('no check constraint weakened: max_leverage bounded 1-100, mmr bounded, fees >=0, status enum closed', () => {
  assert.ok(sql.includes('max_leverage between 1 and 100'));
  assert.ok(sql.includes('maintenance_margin_rate between 0 and 0.5'));
  assert.ok(sql.includes("status in ('trading','paused','open_only','liquidation_only')"));
  assert.ok(sql.includes("side in ('buy','sell')"));
  assert.ok(sql.includes("side in ('long','short')"));
  assert.ok(sql.includes('maker_fee_rate >= 0'));
  assert.ok(sql.includes('taker_fee_rate >= 0'));
});

test('financial operation type expansion is additive, atomic, and preserves legacy operation types', () => {
  assert.ok(sql.includes('financial_operations_operation_type_check_v2'));
  assert.ok(sql.includes('not valid'));
  assert.ok(sql.includes('validate constraint financial_operations_operation_type_check'));
  assert.ok(sql.includes("'withdraw_paid'"));
  assert.ok(sql.includes("'migration_opening_balance'"));
  assert.ok(!sql.includes('drop constraint if exists financial_operations_operation_type_check;\nalter table public.financial_operations add constraint'));
});

test('position fill helper validates direct service-role inputs before changing positions', () => {
  assert.ok(sql.includes("raise exception 'invalid perpetual position fill'"));
  assert.ok(sql.includes("p_fill_direction is null or p_fill_direction not in ('buy','sell')"));
  assert.ok(sql.includes('p_symbol is null or p_symbol !~'));
  assert.ok(sql.includes('p_fill_qty is null or p_fill_qty <= 0'));
  assert.ok(sql.includes('p_fill_price is null or p_fill_price <= 0'));
  assert.ok(sql.includes('p_leverage > 100'));
});

test('liquidation fails closed when market configuration is missing', () => {
  assert.ok(sql.includes("raise exception 'invalid perpetual liquidation identity'"));
  assert.ok(sql.includes("raise exception 'perpetual market configuration missing'"));
});

test('bad debt is platform-owned and is not represented as a fake zero-delta customer ledger row', () => {
  assert.ok(liquidationAccountingSql.includes("values ('perp-bad-debt-'||v_pos.id::text,'__perp_platform__','USDT','perp_bad_debt'"));
  assert.ok(!liquidationAccountingSql.includes('bad-debt ledger audit marker'));
  assert.ok(!liquidationAccountingSql.includes('select v_bad_debt_op,p_user_id'));
  assert.ok(liquidationAccountingSql.includes('platform_risk_absorption'));
  assert.ok(liquidationAccountingSql.includes("'affected_user_id',p_user_id"));
  assert.ok(liquidationAccountingSql.includes('perpetual_liquidation_journal'));
});

test('liquidation writes separate user, insurance and platform operations with a balanced risk journal', () => {
  assert.ok(liquidationAccountingSql.includes("'perp-insurance-cover-'||v_pos.id::text"));
  assert.ok(liquidationAccountingSql.includes("'perp_insurance_cover'"));
  assert.ok(liquidationAccountingSql.includes('select v_insurance_op,v_market.insurance_user_id'));
  assert.ok(liquidationAccountingSql.includes('insurance_operation_id'));
  assert.ok(liquidationAccountingSql.includes('unique (event_id,line_no)'));
  assert.ok(liquidationAccountingSql.includes('v_journal_debits <> v_journal_credits'));
  assert.ok(liquidationAccountingSql.includes('v_journal_debits <> v_loss'));
  assert.ok(liquidationAccountingSql.includes('least(v_loss,v_pos.isolated_margin)'));
  assert.ok(liquidationAccountingSql.includes('v_bad_debt := v_excess - v_insurance_cover'));
});

test('general financial operation RPC remains scoped to generic single-account movements', () => {
  const compatibility = fs.readFileSync(path.join(root, 'supabase/sql/0044_withdrawal_operation_type_compatibility_v1.sql'), 'utf8');
  const fnStart = compatibility.indexOf('CREATE OR REPLACE FUNCTION public.apply_financial_operation(');
  const fnEnd = compatibility.indexOf('$$;', fnStart);
  const fn = compatibility.slice(fnStart, fnEnd);
  assert.ok(fn.includes('p_operation_type NOT IN'));
  assert.ok(!fn.includes("'perp_trade'"));
  assert.ok(!fn.includes("'perp_bad_debt'"));
  assert.ok(liquidationAccountingSql.includes('create or replace function public.perp_liquidate_position'));
});

test('order idempotency binds reduce-only and close-position flags', () => {
  assert.ok(sql.includes('v_existing.reduce_only is distinct from coalesce(p_reduce_only,false)'));
  assert.ok(sql.includes('v_existing.close_position is distinct from coalesce(p_close_position,false)'));
});

test('reduce-only and market IOC responses return the persisted final remainder after cancellation', () => {
  const finalized = sql.indexOf('select remaining_quantity into v_remaining');
  const response = sql.indexOf("'remaining_quantity',v_remaining", finalized);
  assert.ok(finalized >= 0, 'final persisted remaining quantity must be re-read');
  assert.ok(response > finalized, 'response must use the re-read persisted quantity');
});

test('perpetual markets reference the canonical asset registry and match the base/USDT symbol', () => {
  assert.ok(sql.includes('base_asset text not null references public.btcbox_assets(asset_code)'));
  assert.ok(sql.includes("quote_asset text not null default 'USDT' references public.btcbox_assets(asset_code)"));
  assert.ok(sql.includes('check (symbol = base_asset || quote_asset)'));
});


test('funding settlement is market-atomic and shares the order-entry advisory lock', () => {
  assert.ok(fundingSql.includes("pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0))"));
  assert.ok(fundingSql.includes('for update'));
  assert.ok(fundingSql.includes('for v_pos in'));
  assert.ok(fundingSql.includes('public.perp_settle_funding_one(p_symbol,p_funding_at,v_rate.rate,v_pos.user_id)'));
  assert.ok(fundingSql.includes('update public.perpetual_markets'));
  assert.ok(fundingSql.includes('next_funding_at=p_funding_at + (v_market.funding_interval_sec * interval'));
  assert.ok(fundingSql.includes("revoke all on function public.perp_settle_funding_market(text,timestamptz) from public, anon, authenticated"));
  assert.ok(fundingSql.includes("grant execute on function public.perp_settle_funding_market(text,timestamptz) to service_role"));
});

test('funding boundary fails closed without a persisted validated non-zero-or-zero rate snapshot', () => {
  assert.ok(fundingSql.includes('validated funding rate snapshot missing'));
  assert.ok(fundingSql.includes('funding snapshot is incomplete'));
  assert.ok(fundingSql.includes('funding snapshot has insufficient source samples'));
  assert.ok(!fundingSql.includes('values (p_symbol,p_funding_at,0,0,false)'));
  assert.ok(!fundingSql.includes('intentionally records zero funding'));
  assert.ok(fundingSql.includes('v_rate.premium_index is null'));
  assert.ok(fundingSql.includes('v_rate.settled'));
  assert.ok(fundingSql.includes('funding source samples are invalid or stale'));
  assert.ok(fundingSql.includes('funding snapshot samples are invalid or stale'));
  assert.ok(fundingSql.includes('v_market.mark_price_stale_sec*1000'));
});

test('liquidation settles due funding before reloading position and calculating maintenance margin', () => {
  const settleAt = liquidationAccountingSql.indexOf('public.perp_settle_funding_market(p_symbol, v_market.next_funding_at)');
  const reloadAt = liquidationAccountingSql.indexOf('select * into v_pos from public.perpetual_positions', settleAt);
  const riskAt = liquidationAccountingSql.indexOf('v_mm := v_notional * v_market.maintenance_margin_rate');
  assert.ok(settleAt >= 0, 'liquidation must settle the due funding boundary');
  assert.ok(reloadAt > settleAt, 'position must be reloaded after funding changes margin');
  assert.ok(riskAt > reloadAt, 'maintenance margin check must use post-funding position state');
  assert.ok(liquidationAccountingSql.includes('due funding boundary could not be settled before liquidation'));
});

test('funding clearing ledger writes an equal-and-opposite counter-entry and backfills prior history', () => {
  assert.ok(fundingSql.includes('create table if not exists public.perpetual_funding_clearing_ledger'));
  assert.ok(fundingSql.includes('check (clearing_delta = -payment_delta)'));
  assert.ok(fundingSql.includes('values (v_op,p_symbol,p_funding_at,p_user_id,v_payment,-v_payment)'));
  assert.ok(fundingSql.includes('from public.perpetual_funding_history'));
  assert.ok(fundingSql.includes('on conflict do nothing'));
  assert.ok(fundingSql.includes('alter table public.perpetual_funding_clearing_ledger enable row level security'));
});

test('funding worker calls one atomic market RPC and never advances the boundary with REST PATCH', () => {
  assert.ok(fundingWorker.includes("rpc('perp_settle_funding_market'"));
  assert.ok(!fundingWorker.includes("rpc('perp_settle_funding_one'"));
  assert.ok(!fundingWorker.includes("method: 'PATCH'"));
  assert.ok(!fundingWorker.includes('perpetual_positions?select=user_id,symbol'));
  assert.ok(fundingWorker.includes('next_funding_at=not.is.null'));
  assert.ok(!fundingWorker.includes('&enabled=eq.true'));
  assert.ok(fundingSql.includes('where symbol=p_symbol for update'));
});

test('mark worker sends the fresh source array and uses an independent perpetual order-book midpoint', () => {
  assert.ok(markWorker.includes('p_sources: freshSources'));
  assert.ok(!markWorker.includes('p_sources: sources'));
  assert.ok(markWorker.includes('perpetualBookMidPrice'));
  assert.ok(markWorker.includes('side=eq.buy'));
  assert.ok(markWorker.includes('side=eq.sell'));
  assert.ok(markWorker.includes('calculateBookDepthMidPrice'));
  assert.ok(markWorker.includes('remaining_quantity=gt.0'));
  assert.ok(markWorker.includes('limit=50'));
  assert.ok(!markWorker.includes('updated_at=gte.'));
  assert.ok(markWorker.includes('insufficient two-level'));
});

test('mark feed keeps external spot index independent from the perpetual-book mark premium', () => {
  const markFn = sql.slice(sql.indexOf('create or replace function public.perp_record_mark_price'));
  assert.ok(markFn.includes('index price must match the validated external spot source mean'));
  assert.ok(markFn.includes('BTCBOX perpetual-book midpoint'));
  assert.ok(markFn.includes('v_mark_deviation := abs(p_mark_price-p_index_price)/p_index_price*100'));
  assert.ok(!markFn.includes('abs(p_mark_price-v_mean)/v_mean > 0.0001'));
});

test('mark-price source validation requires unique trusted provider identities', () => {
  assert.ok(sql.includes("v_source_name not in ('binance','okx','coingecko')"));
  assert.ok(sql.includes('v_source_name = any(v_sources_seen)'));
  assert.ok(sql.includes('mark price sources must be unique trusted providers'));
});

test('perpetual migration reuses and preserves the canonical BTCBOX asset registry', () => {
  assert.ok(sql.includes('create table if not exists public.btcbox_assets'));
  assert.ok(sql.includes('on conflict (asset_code) do nothing'));
  assert.ok(sql.includes("to_regclass('auth.users')"));
  assert.ok(sql.includes('populated project asset registry is incomplete'));
  assert.ok(sql.includes("('ADA','Cardano','crypto',6,true)"));
  assert.ok(sql.includes('public.btcbox_assets(asset_code)'));
  assert.ok(sql.includes('Deliberately do not create the legacy btcbox_asset_seed_wallet_accounts_v1'));
});


const fundingRateSql = fs.readFileSync(path.join(root, 'supabase/sql/0048_perpetual_funding_rate_producer_v1.sql'), 'utf8');
const fundingRateWorker = fs.readFileSync(path.join(root, 'scripts/perp-funding-rate-worker.js'), 'utf8');

test('fixed funding formula is versioned, database-calculated, bounded and auditable', () => {
  assert.ok(fundingRateSql.includes("'btcbox-funding-v1'"));
  assert.ok(fundingRateSql.includes('v_interest constant numeric(12,10) := 0.0001'));
  assert.ok(fundingRateSql.includes('v_adjustment constant numeric(12,10) := 0.0005'));
  assert.ok(fundingRateSql.includes('v_absolute_cap constant numeric(12,10) := 0.0075'));
  assert.ok(fundingRateSql.includes('v_premium := ((v_mid / v_feed.index_price) - 1)'));
  assert.ok(fundingRateSql.includes('v_interest - v_premium'));
  assert.ok(fundingRateSql.includes('impact_bid_price'));
  assert.ok(fundingRateSql.includes('impact_ask_price'));
  assert.ok(fundingRateSql.includes('calculated_at'));
  assert.ok(fundingRateSql.includes("v_feed.status <> 'ok'"));
  assert.ok(fundingRateSql.includes('v_feed.created_at < now()'));
  assert.ok(fundingRateSql.includes('on conflict (symbol,funding_at) do update'));
});

test('funding financial operations reject unversioned or stale snapshots', () => {
  assert.ok(fundingRateSql.includes("v_rate.formula_version is distinct from 'btcbox-funding-v1'"));
  assert.ok(fundingRateSql.includes("v_rate.interest_rate is distinct from 0.0001::numeric"));
  assert.ok(fundingRateSql.includes("v_rate.calculated_at < now() - interval '2 minutes'"));
  assert.ok(fundingRateSql.includes('before insert on public.financial_operations'));
  assert.ok(fundingRateSql.includes("new.operation_type <> 'perp_funding'"));
});

test('funding snapshot settlement validates version and freshness even when there are no positions', () => {
  assert.ok(fundingRateSql.includes('create or replace function public.perp_guard_funding_snapshot_settlement_v1()'));
  assert.ok(fundingRateSql.includes("new.formula_version is distinct from 'btcbox-funding-v1'"));
  assert.ok(fundingRateSql.includes("new.calculated_at < now() - interval '2 minutes'"));
  assert.ok(fundingRateSql.includes('new.premium_index is distinct from v_expected_premium'));
  assert.ok(fundingRateSql.includes('new.rate is distinct from v_expected_rate'));
  assert.ok(fundingRateSql.includes('before update of settled on public.perpetual_funding_rates'));
  assert.ok(fundingRateSql.includes('new.settled = true'));
});

test('funding-rate producer is separate from the settlement worker and never changes balances', () => {
  assert.ok(fundingRateWorker.includes("rpc/perp_record_funding_rate_snapshot"));
  assert.ok(fundingRateWorker.includes('calculateImpactPrices'));
  assert.ok(fundingRateWorker.includes('perpetual_orders?select=price,remaining_quantity'));
  assert.ok(!fundingRateWorker.includes('perp_settle_funding_market'));
  assert.ok(!fundingRateWorker.includes('financial_accounts'));
  assert.ok(!fundingRateWorker.includes("method:'PATCH'"));
});
