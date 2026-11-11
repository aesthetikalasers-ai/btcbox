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
