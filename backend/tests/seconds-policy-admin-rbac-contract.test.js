'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('Seconds policy routes use verified Supabase identity and explicit read/write permissions', () => {
  const authStart = api.indexOf('async function adminAuth()');
  const authEnd = api.indexOf('async function flushAdminAuditOutbox()', authStart);
  assert.ok(authStart >= 0 && authEnd > authStart);
  const auth = api.slice(authStart, authEnd);
  assert.ok(auth.includes('authorizeSupabaseAdmin'));
  assert.ok(!auth.includes('ADMIN_USER') && !auth.includes('ADMIN_PASS'));
  assert.ok(api.includes("route === 'seconds-policy' && verb === 'GET'"));
  assert.ok(api.includes("route === 'seconds-policy' && verb === 'POST'"));
  assert.ok(api.includes("if (sub === 'seconds-policy' && method === 'GET')"));
  assert.ok(api.includes("if (sub === 'seconds-policy' && method === 'POST')"));
  assert.ok(api.includes('p_actor_user_id: adminUserId'));
  assert.ok(api.includes('p_request_hash: requestHash'));
});

test('Seconds policy RPC validates symbols, positive durations and the configured payout floor', () => {
  assert.ok(sql.includes('FUNCTION private.admin_set_seconds_policy_v1'));
  assert.ok(sql.includes('FUNCTION public.admin_set_seconds_policy_v1'));
  assert.ok(sql.includes("'seconds_policy.manage'"));
  assert.ok(sql.includes('p_payout_bps < 8500'));
  assert.ok(sql.includes("OR NOT (p_symbols <@ ARRAY['BTC','ETH','SOL','BNB']::text[])"));
  assert.ok(!sql.includes("OR p_symbols <@ ARRAY['BTC','ETH','SOL','BNB']::text[]"));
  assert.ok(sql.includes('NOT (0 < ALL(p_durations_sec))'));
  assert.ok(!sql.includes('p_payout_bps > 10000'));
});

test('policy RPC rechecks live membership and atomically activates, audits and records idempotency', () => {
  assert.ok(sql.includes('private.admin_get_membership_v1(p_actor_user_id)'));
  assert.ok(sql.includes('seconds_policy_request_idempotency'));
  assert.ok(sql.includes('stale seconds policy version'));
  assert.ok(sql.includes('UPDATE public.seconds_contract_policy_active'));
  assert.ok(sql.includes('INSERT INTO public.seconds_contract_policy_audit'));
  assert.ok(sql.includes('INSERT INTO private.seconds_policy_request_idempotency'));
  assert.ok(sql.includes('SECURITY DEFINER'));
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.admin_set_seconds_policy_v1'));
});

test('Super Admin policy changes are one atomic create-and-activate operation', () => {
  assert.ok(sql.includes('admin_set_seconds_policy_v1'));
  assert.ok(sql.includes('seconds_policy.manage'));
  assert.ok(sql.includes('UPDATE public.seconds_contract_policy_active'));
  assert.ok(sql.includes('INSERT INTO public.seconds_contract_policy_audit'));
  assert.ok(sql.includes('INSERT INTO private.seconds_policy_request_idempotency'));
});

test('React policy editor uses the authenticated API and does not write policy tables directly', () => {
  assert.ok(admin.includes('saveAdminSecondsPolicy(token'));
  assert.ok(admin.includes('hasPermission("seconds_policy.manage")'));
  assert.ok(admin.includes('expected_policy_version: secondsPolicy.policy_version'));
  assert.ok(admin.includes('window.crypto.randomUUID()'));
  assert.ok(!admin.includes('from("seconds_contract_policies")'));
});
