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
  assert.match(migration, /seconds_contract_policy_audit_immutable[\\s\\S]*?BEFORE UPDATE OR DELETE/i);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE[\s\S]*?service_role/i);
});

test('new order RPC resolves the active backend policy and snapshots it atomically with reserve', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1');
  const end = migration.indexOf('-- Settlement uses the immutable payout snapshot', start);
  assert.ok(start >= 0 && end > start);
  const fn = migration.slice(start, end);
  assert.match(fn, /seconds_contract_policy_active[\s\S]*?FOR SHARE OF a,p/i);
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
