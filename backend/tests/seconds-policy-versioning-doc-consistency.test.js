'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0025_seconds_policy_versioning_v1.sql'), 'utf8');
const spec = fs.readFileSync(path.resolve(root, '../../docs/SECONDS_POLICY_VERSIONING.md'), 'utf8');
const rbac = fs.readFileSync(path.resolve(root, '../../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');

test('policy versioning spec accurately distinguishes migration source from live database state', () => {
  assert.match(spec, /source artifact only; its presence in Git does not prove it has been applied/i);
  assert.match(spec, /Current source implementation boundary \(migration 0025\)/);
  assert.match(spec, /Not implemented by migration 0025/i);
});

test('policy migration source creates immutable policy and position payout snapshots', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.seconds_contract_policies/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_bps_snapshot integer/);
  assert.match(migration, /v_policy\.payout_bps/);
  assert.match(migration, /coalesce\(v_pos\.payout_bps_snapshot,8500\)/);
  assert.match(spec, /stores the policy\/payout snapshot in the same transaction/i);
  assert.match(spec, /stored payout snapshot/i);
});

test('policy source privileges are read-only for service_role and deny browser roles', () => {
  assert.match(migration, /REVOKE ALL ON public\.seconds_contract_policies, public\.seconds_contract_policy_active,[\s\S]*?FROM public, anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.seconds_contract_policies, public\.seconds_contract_policy_active TO service_role/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.seconds_contract_policies,[\s\S]*?FROM service_role/);
  assert.match(spec, /grants service_role SELECT[\s\S]*?revokes service_role INSERT\/UPDATE\/DELETE/i);
});

test('administrator identity and transition governance remain a separate unimplemented layer', () => {
  assert.match(spec, /individually authenticated admin actors, role\/membership tables/i);
  assert.match(rbac, /three distinct/i);
  assert.match(rbac, /validated Auth user UUID/i);
  assert.match(spec, /No policy write path exists/i);
});
