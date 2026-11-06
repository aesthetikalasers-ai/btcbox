'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0025_seconds_policy_versioning_v1.sql'), 'utf8');
const rbacSql = fs.readFileSync(path.join(root, 'supabase/sql/0026_admin_rbac_private_store_v1.sql'), 'utf8');
const policyRpc = fs.readFileSync(path.join(root, 'supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql'), 'utf8');
const spec = fs.readFileSync(path.resolve(root, '../docs/SECONDS_POLICY_VERSIONING.md'), 'utf8');
const rbac = fs.readFileSync(path.resolve(root, '../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');

test('policy documentation accurately separates source implementation from hosted database state', () => {
  assert.match(spec, /source implementation exists on the integration branch/i);
  assert.match(spec, /hosted database application and runtime PostgreSQL verification are NOT VERIFIED/i);
  assert.match(spec, /0028_admin_rbac_service_rpc_wrappers_v1\.sql/);
  assert.match(spec, /Separate draft\/review\/scheduled activation\/retirement endpoints are not implemented/i);
});

test('policy migration creates immutable versions and snapshots payout terms on positions', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.seconds_contract_policies/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_bps_snapshot integer/);
  assert.match(migration, /v_policy\.payout_bps/);
  assert.match(migration, /coalesce\(v_pos\.payout_bps_snapshot,8500\)/);
  assert.match(spec, /snapshot policy ID\/version\/payout terms on the position/i);
});

test('policy and admin RPCs enforce private storage, live permission, atomic audit and idempotency', () => {
  assert.match(migration, /REVOKE ALL ON public\.seconds_contract_policies, public\.seconds_contract_policy_active,[\s\S]*?FROM public, anon, authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.seconds_contract_policies, public\.seconds_contract_policy_active TO service_role/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.seconds_contract_policies,[\s\S]*?FROM service_role/);
  assert.match(rbacSql, /CREATE TABLE private\.admin_memberships/);
  assert.match(rbacSql, /CREATE OR REPLACE FUNCTION private\.admin_get_membership_v1/);
  assert.match(policyRpc, /FUNCTION private\.admin_set_seconds_policy_v1/);
  assert.match(policyRpc, /seconds_policy\.manage/);
  assert.match(policyRpc, /seconds_policy_request_idempotency/);
  assert.match(policyRpc, /INSERT INTO public\.seconds_contract_policy_audit/);
  assert.match(policyRpc, /GRANT EXECUTE ON FUNCTION public\.admin_set_seconds_policy_v1[\s\S]*?TO service_role/);
  assert.match(spec, /same transaction/i);
});

test('Super Admin can complete policy changes alone; no three-person workflow is claimed', () => {
  assert.match(rbac, /Super Admin.*without a three-person workflow/i);
  assert.match(rbac, /no three-person or distinct-author\/reviewer\/activator requirement applies/i);
  assert.match(rbac, /seconds_policy\.manage/);
  assert.match(rbac, /verified Supabase Auth identity/i);
  assert.match(rbac, /Initial Super Admin bootstrap is a one-time owner-controlled database operation/i);
});
