'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const migration = read('supabase/sql/0025_seconds_policy_versioning_v1.sql');
const durationAlignment = read('supabase/sql/0031_seconds_policy_duration_alignment_v1.sql');
const rbacSql = read('supabase/sql/0026_admin_rbac_private_store_v1.sql');
const policyRpc = read('supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql');
const bootstrap = read('scripts/bootstrap-empty-database.sh');

test('active policy durations are not contradicted by the base position constraint', () => {
  assert.match(durationAlignment, /DROP CONSTRAINT IF EXISTS seconds_contract_positions_duration_sec_check/i);
  assert.match(durationAlignment, /CHECK \(duration_sec > 0\)/i);
  assert.match(bootstrap, /0031_seconds_policy_duration_alignment_v1\.sql/);
});

test('policy migration creates immutable versions and snapshots payout terms on positions', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.seconds_contract_policies/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_bps_snapshot integer/i);
  assert.match(migration, /v_policy\.payout_bps/);
  assert.match(migration, /coalesce\(v_pos\.payout_bps_snapshot,8500\)/i);
  assert.match(migration, /prevent_seconds_policy_mutation/i);
});

test('policy and admin RPCs enforce private storage, live permission, atomic audit and idempotency', () => {
  assert.match(migration, /REVOKE ALL ON public\.seconds_contract_policies, public\.seconds_contract_policy_active,[\s\S]*?FROM public, anon, authenticated/i);
  assert.match(migration, /GRANT SELECT ON public\.seconds_contract_policies, public\.seconds_contract_policy_active TO service_role/i);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.seconds_contract_policies,[\s\S]*?FROM service_role/i);
  assert.match(rbacSql, /CREATE TABLE private\.admin_memberships/i);
  assert.match(rbacSql, /CREATE OR REPLACE FUNCTION private\.admin_get_membership_v1/i);
  assert.match(policyRpc, /FUNCTION private\.admin_set_seconds_policy_v1/i);
  assert.match(policyRpc, /seconds_policy\.manage/);
  assert.match(policyRpc, /seconds_policy_request_idempotency/);
  assert.match(policyRpc, /INSERT INTO public\.seconds_contract_policy_audit/);
  assert.match(policyRpc, /GRANT EXECUTE ON FUNCTION public\.admin_set_seconds_policy_v1[\s\S]*?TO service_role/i);
});

test('Super Admin policy changes use one atomic RPC without a multi-person approval workflow', () => {
  assert.match(policyRpc, /admin_set_seconds_policy_v1/);
  assert.match(policyRpc, /seconds_policy\.manage/);
  assert.match(policyRpc, /INSERT INTO public\.seconds_contract_policy_audit/);
  assert.match(policyRpc, /INSERT INTO private\.seconds_policy_request_idempotency/);
  assert.match(policyRpc, /UPDATE public\.seconds_contract_policy_active/);
});

test('PostgreSQL lifecycle coverage proves old and new positions use their own payout snapshots', () => {
  const lifecycle = read('tests/postgres-financial-lifecycle.integration.sql');
  assert.match(migration, /v_payout_bps:=coalesce\(v_pos\.payout_bps_snapshot,8500\)/i);
  assert.match(migration, /round\(v_pos\.amount\*v_payout_bps\/10000,18\)/i);
  assert.match(lifecycle, /Raise the payout rate for new positions/i);
  assert.match(lifecycle, /v_payout_bps<>8500/);
  assert.match(lifecycle, /v_payout_bps<>9200/);
  assert.match(lifecycle, /v_result->>'pnl'\)::numeric<>9\.2/);
  assert.match(lifecycle, /v_balance<>117\.7/);
});
