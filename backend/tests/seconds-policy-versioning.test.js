'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0025_seconds_policy_versioning_v1.sql'), 'utf8');
const legacy = fs.readFileSync(path.join(root, 'supabase/sql/0024_seconds_settlement_idempotency_v1.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

test('policy versions are immutable, append-only and initialized to the observed baseline', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.seconds_contract_policies/i);
  assert.match(migration, /seconds_contract_policies_immutable[\s\S]*?BEFORE UPDATE OR DELETE/i);
  assert.match(migration, /payout_bps[\s\S]*?8500/i);
  assert.match(migration, /1000000000000/);
  assert.match(migration, /ARRAY\['BTC','ETH','SOL','BNB'\]/);
  assert.match(migration, /ARRAY\[30,60,300,900\]/);
  assert.match(migration, /seconds_contract_policy_audit/i);
  assert.match(migration, /seconds_contract_policy_audit_immutable[\s\S]*?BEFORE UPDATE OR DELETE/i);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE[\s\S]*?service_role/i);
});

test('new order RPC resolves the active backend policy and snapshots it atomically with reserve', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1');
  const end = migration.indexOf('-- Settlement uses the immutable payout snapshot', start);
  assert.ok(start >= 0 && end > start);
  const fn = migration.slice(start, end);
  assert.match(fn, /seconds_contract_policy_active/);
  assert.doesNotMatch(fn, /FOR SHARE|FOR UPDATE/i);
  assert.match(fn, /POLICY_LIMIT_EXCEEDED/);
  assert.match(fn, /OPEN_EXPOSURE_LIMIT_EXCEEDED/);
  assert.match(fn, /payout_bps_snapshot/);
  assert.match(fn, /policy_snapshot/);
  assert.match(fn, /financial_ledger/);
  assert.match(fn, /policy_version/);
});

test('settlement uses position payout snapshot and preserves legacy 85 percent fallback', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.settle_seconds_position_v1');
  const end = migration.indexOf('REVOKE ALL ON FUNCTION public.submit_seconds_order_v1', start);
  assert.ok(start >= 0 && end > start);
  const fn = migration.slice(start, end);
  assert.match(fn, /coalesce\(v_pos\.payout_bps_snapshot,8500\)/i);
  assert.match(fn, /v_pos\.amount\*v_payout_bps\/10000/);
  assert.match(fn, /policy_version/);
  assert.match(fn, /POSITION_ALREADY_SETTLED/);
  assert.match(fn, /SETTLEMENT_PRICE_BEFORE_MATURITY/);
  assert.match(legacy, /round\(v_pos\.amount\*0\.85,18\)/);
});

test('policy snapshot cannot be rewritten and the client cannot control payout or policy', () => {
  assert.match(migration, /prevent_seconds_position_policy_rewrite_v1/);
  const start = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const end = api.indexOf('// ---------- POST /api/seconds/settle ----------', start);
  assert.ok(start >= 0 && end > start);
  const orderHandler = api.slice(start, end);
  assert.doesNotMatch(orderHandler, /body\.(?:payout|payout_rate|win_rate|profit_rate|policy_id|policy_version)/i);
  assert.doesNotMatch(orderHandler, /p_(?:payout|payout_rate|win_rate|profit_rate|policy_id|policy_version)\s*:/i);
});

test('migration is additive and does not open financial cutover or modify legacy positions', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS policy_id/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_bps_snapshot/i);
  assert.doesNotMatch(migration, /UPDATE public\.seconds_contract_positions[\s\S]*?SET[\s\S]*?policy_id/i);
  assert.doesNotMatch(migration, /financialWritesEnabled|FINANCIAL_CUTOVER_ENABLED/i);
});


test('order idempotent replay is resolved before requiring a currently active policy', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1');
  const end = migration.indexOf('-- Settlement uses the immutable payout snapshot', start);
  const fn = migration.slice(start, end);
  const replay = fn.indexOf('WHERE open_request_id=p_request_id FOR UPDATE');
  const policy = fn.indexOf('FROM public.seconds_contract_policy_active');
  assert.ok(replay >= 0 && policy > replay);
  assert.match(fn.slice(replay, policy), /IDEMPOTENCY_CONFLICT/);
  assert.match(fn.slice(replay, policy), /duplicate/);
});

test('policy-aware settlement preserves the historical owner, maturity, idempotency and ledger contract', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.settle_seconds_position_v1');
  const end = migration.indexOf('REVOKE ALL ON FUNCTION public.submit_seconds_order_v1', start);
  const fn = migration.slice(start, end);
  for (const invariant of [
    /WHERE position_id=p_position_id AND user_id=p_user_id FOR UPDATE/i,
    /settle_request_hash IS DISTINCT FROM p_request_hash/i,
    /POSITION_ALREADY_SETTLED/,
    /v_now<v_pos\.settle_at/,
    /p_settle_price_ts<v_pos\.settle_at/,
    /FROZEN_BALANCE_INVARIANT/,
    /INSERT INTO public\.financial_operations/i,
    /UPDATE public\.financial_accounts/i,
    /INSERT INTO public\.financial_ledger/i,
    /settle_operation_id=v_op_id/
  ]) assert.match(fn, invariant);
  assert.match(fn, /coalesce\(v_pos\.payout_bps_snapshot,8500\)/i);
  assert.match(fn, /'policy_version',v_pos\.policy_version/);
});

test('policy RPC execution remains service-role-only and policy tables are not client-writable', () => {
  assert.match(migration, /REVOKE ALL ON public\.seconds_contract_policies, public\.seconds_contract_policy_active,[\s\S]*?FROM public, anon, authenticated/i);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.seconds_contract_policies,[\s\S]*?FROM service_role/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.submit_seconds_order_v1\([\s\S]*?FROM public, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.submit_seconds_order_v1\([\s\S]*?TO service_role/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.settle_seconds_position_v1\([\s\S]*?FROM public, anon, authenticated/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.settle_seconds_position_v1\([\s\S]*?TO service_role/i);
});


test('seed minimum is the numeric precision floor, not an invented commercial minimum', () => {
  assert.match(migration, /min_stake numeric\(38,18\) NOT NULL CHECK \(min_stake > 0\)/i);
  assert.match(migration, /0\.000000000000000001,[\s\S]*?1000000000000,[\s\S]*?8500/);
  const start = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const end = api.indexOf('// ---------- POST /api/seconds/settle ----------', start);
  assert.ok(start >= 0 && end > start);
  const handler = api.slice(start, end);
  assert.match(handler, /amount === null \|\| compareMoney\(amount, '0'\) <= 0/);
  assert.match(handler, /compareMoney\(amount, '1000000000000'\) > 0/);
  assert.doesNotMatch(handler, /compareMoney\(amount,\s*'(?!0(?:'|\.))/);
  assert.match(api, /raw\.length > 64 \|\| !\/\^\(\?:0\|\[1-9\]\\d\*\)\(\?:\\\.\\d\{1,18\}\)\?\$\//);
});
