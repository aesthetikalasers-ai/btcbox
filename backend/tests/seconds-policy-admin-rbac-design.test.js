'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const design = fs.readFileSync(path.resolve(root, '../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql'), 'utf8');

test('Seconds policy routes use verified Supabase identity and explicit read/write permissions', () => {
  const authStart = api.indexOf('async function adminAuth()');
  const authEnd = api.indexOf('async function flushAdminAuditOutbox()', authStart);
  assert.ok(authStart >= 0 && authEnd > authStart);
  const auth = api.slice(authStart, authEnd);
  assert.ok(auth.includes('authorizeSupabaseAdmin'));
  assert.ok(!auth.includes('ADMIN_USER') && !auth.includes('ADMIN_PASS'));
  assert.ok(api.includes("if (path.startsWith('admin/'))"));
  assert.ok(api.includes("route === 'seconds-policy' && verb === 'GET'"));
  assert.ok(api.includes("route === 'seconds-policy' && verb === 'POST'"));
  assert.ok(api.includes("if (sub === 'seconds-policy' && method === 'GET')"));
  assert.ok(api.includes("if (sub === 'seconds-policy' && method === 'POST')"));
  assert.ok(api.includes('p_actor_user_id: adminUserId'));
  assert.ok(api.includes('p_request_hash: requestHash'));
});

test('Seconds policy RPC creates an immutable version, atomically activates it, and audits the actor', () => {
  assert.ok(sql.includes('FUNCTION private.admin_set_seconds_policy_v1'));
  assert.ok(sql.includes('FUNCTION public.admin_set_seconds_policy_v1'));
  assert.ok(sql.includes('seconds_policy.manage'));
  assert.ok(sql.includes('p_payout_bps < 8500'));
  assert.ok(sql.includes("OR NOT (p_symbols <@ ARRAY['BTC','ETH','SOL','BNB']::text[])") , 'valid symbol subsets must pass the allowlist check');
  assert.ok(!sql.includes("OR p_symbols <@ ARRAY['BTC','ETH','SOL','BNB']::text[]"), 'do not reject valid symbol subsets');
  assert.ok(!sql.includes('p_payout_bps > 10000'));
  assert.ok(sql.includes('UPDATE public.seconds_contract_policy_active'));
  assert.ok(sql.includes('INSERT INTO public.seconds_contract_policy_audit'));
  assert.ok(sql.includes('seconds_policy_request_idempotency'));
  assert.ok(sql.includes('stale seconds policy version'));
  assert.ok(sql.includes('max_open_positions_per_user'));
  assert.ok(sql.includes('SECURITY INVOKER'));
  assert.ok(sql.includes('SECURITY DEFINER'));
});

test('seconds policy RBAC design requires a validated Supabase subject and server-side permission lookup', () => {
  assert.ok(design.includes('validate the token with the trusted Supabase Auth server'));
  assert.ok(design.includes('canonical actor is the validated Auth user UUID'));
  assert.ok(design.includes('private, non-Data-API-exposed schema/table'));
  assert.ok(design.includes('Read the current membership/permission state server-side for every sensitive action'));
  assert.ok(design.includes('Do not use mutable `user_metadata`'));
});

test('seconds policy versions remain immutable while Super Admin can complete the lifecycle alone', () => {
  assert.ok(design.includes('Super Admin may author, review and activate a policy without a three-person separation requirement'));
  assert.ok(design.includes('Every edit creates a new draft/version'));
  assert.ok(design.includes('active pointer transition, effective-window conflict check, audit append, request-idempotency record, and optimistic revision check must commit atomically'));
});

test('every policy mutation contract requires reason, idempotency, optimistic revision, and atomic audit', () => {
  assert.ok(design.includes('Require a bounded non-empty reason, a high-entropy request ID/idempotency key, and an expected revision'));
  assert.ok(design.includes('Bind idempotency to actor, action, object, expected revision, and canonical request hash'));
  assert.ok(design.includes('Append an audit event in the same database transaction'));
  assert.ok(design.includes('Fail closed if Auth, permission lookup, audit persistence, or database transaction is unavailable'));
});

test('policy editor is explicitly gated on backend authorization and cannot write policy tables directly', () => {
  assert.ok(design.includes('seconds_policy.manage'));
  assert.ok(design.includes('No frontend control may write directly to policy tables'));
});
