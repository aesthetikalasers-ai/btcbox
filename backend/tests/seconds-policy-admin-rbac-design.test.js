'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const design = fs.readFileSync(path.resolve(root, '../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');

test('seconds policy write routes remain unavailable until dedicated policy lifecycle RPCs are wired', () => {
  const authStart = api.indexOf('async function adminAuth()');
  const authEnd = api.indexOf('async function flushAdminAuditOutbox()', authStart);
  assert.ok(authStart >= 0 && authEnd > authStart);
  const auth = api.slice(authStart, authEnd);
  assert.match(auth, /authorizeSupabaseAdmin/);
  assert.doesNotMatch(auth, /Basic |ADMIN_USER|ADMIN_PASS/);
  assert.match(api, /if \(path\.startsWith\('admin\/'\)\)/);
  assert.match(api, /route === 'seconds-policy' && verb === 'GET'/);
  assert.match(api, /route === 'seconds-policy' && verb === 'POST'/);
  assert.doesNotMatch(api, /if \(sub === 'seconds-policy' && method === 'POST'\)/);
});

test('seconds policy RBAC design requires a validated Supabase subject and server-side permission lookup', () => {
  assert.match(design, /validate the token with the trusted Supabase Auth server/i);
  assert.match(design, /canonical actor is the validated Auth user UUID/i);
  assert.match(design, /private, non-Data-API-exposed schema\/table/i);
  assert.match(design, /read the current membership\/permission state server-side for every sensitive action/i);
  assert.match(design, /Do not use mutable `user_metadata`/i);
});

test('seconds policy versions remain immutable while Super Admin can complete the lifecycle alone', () => {
  assert.match(design, /Super Admin may author, review and activate a policy without a three-person separation requirement/i);
  assert.match(design, /Every edit creates a new draft\/version/i);
  assert.match(design, /active pointer transition, effective-window conflict check, audit append, request-idempotency record, and optimistic revision check must commit atomically/i);
});

test('every policy mutation contract requires reason, idempotency, optimistic revision, and atomic audit', () => {
  assert.match(design, /Require a bounded non-empty reason, a high-entropy request ID\/idempotency key, and an expected revision/i);
  assert.match(design, /Bind idempotency to actor, action, object, expected revision, and canonical request hash/i);
  assert.match(design, /Append an audit event in the same database transaction/i);
  assert.match(design, /Fail closed if Auth, permission lookup, audit persistence, or database transaction is unavailable/i);
});

test('policy editor is explicitly gated on backend authorization and cannot write policy tables directly', () => {
  assert.match(design, /expose policy controls only after read\/write APIs and server-side authorization are complete/i);
  assert.match(design, /No frontend control may write directly to policy tables/i);
  assert.match(design, /does not create admin users, grant roles, create database tables\/functions, expose API routes\/UI/i);
});

test('administrator enrollment is explicit, attributable, and cannot be self-service', () => {
  assert.match(design, /No self-service administrator registration/i);
  assert.match(design, /exact Auth UUID obtained from a trusted Auth user lookup/i);
  assert.match(design, /initial Super Admin is provisioned once by the project owner/i);
  assert.match(design, /No default email, password, UUID, or public bootstrap endpoint/i);
  assert.match(design, /After the first administrator set is provisioned, permanently disable\/remove the bootstrap path/i);
  assert.match(design, /Supabase account existence alone grants no BTCBOX administrator access/i);
});

test('permission grants and revocations are revisioned, audited, and immediately effective', () => {
  assert.match(design, /grantor Auth UUID, reason, change\/ticket reference/i);
  assert.match(design, /A grantor cannot grant permissions to themselves/i);
  assert.match(design, /perform a live server-side membership\/permission lookup on every policy transition/i);
  assert.match(design, /Unknown permission keys, wildcard grants/i);
  assert.match(design, /Preserve historical actor UUIDs and audit records/i);
});

test('break-glass recovery is temporary and cannot bypass policy governance', () => {
  assert.match(design, /Break-glass is not a normal API role/i);
  assert.match(design, /project owner through a separately authenticated, out-of-band database operation/i);
  assert.match(design, /bounded temporary grant/i);
  assert.match(design, /must not activate a seconds policy or enable financial cutover/i);
  assert.match(design, /If audit persistence is unavailable, emergency policy mutations remain blocked/i);
});

test('administrator permission data remains outside browser-accessible Data API paths', () => {
  assert.match(design, /dedicated non-exposed schema/i);
  assert.match(design, /Explicitly verify the project's exposed-schema configuration/i);
  assert.match(design, /revoke table\/schema privileges from/i);
  assert.match(design, /frontend receives only permission-filtered presentation data/i);
});


test('RBAC database contract defines immutable identity, permission, review, transition and audit records', () => {
  for (const phrase of [
    'administrator memberships',
    'permission grant events',
    'policy review decisions',
    'transition idempotency',
    'administrator security audit',
    'canonical content SHA-256',
    'expected membership and policy revisions',
    'Super Admin may author, review and activate a policy without a three-person separation requirement'
  ]) assert.ok(design.toLowerCase().includes(phrase.toLowerCase()), 'missing contract phrase: ' + phrase);
});

test('private RBAC schema remains unexposed and PostgREST wrapper cannot become a public security-definer endpoint', () => {
  assert.match(design, /private schema remains absent from Supabase Data API exposed schemas/i);
  assert.match(design, /SECURITY INVOKER wrapper/i);
  assert.match(design, /EXECUTE privilege is revoked from PUBLIC, anon, and authenticated/i);
  assert.match(design, /Do not create a public SECURITY DEFINER wrapper/i);
  assert.match(design, /do not grant direct table DML/i);
});


test('Super Admin has full authority and exclusively manages delegated administrator permissions', () => {
  assert.match(design, /Super Admin has every BTCBOX admin permission/i);
  assert.match(design, /Super Admin can create or provision ordinary Admin accounts/i);
  assert.match(design, /assigns each Admin an explicit set of allowlisted permissions/i);
  assert.match(design, /Ordinary Admins cannot create or promote administrators/i);
  assert.match(design, /Administrator management is reserved to the Super Admin/i);
  assert.match(design, /The Super Admin may perform the complete seconds-policy lifecycle alone/i);
  assert.match(design, /Every sensitive request validates the Supabase Auth token/i);
  assert.match(design, /Revocation takes effect on the next sensitive request/i);
  assert.match(design, /No three-person approval requirement is imposed/i);
});

test('Super Admin authority cannot be changed through ordinary administrator APIs', () => {
  assert.match(design, /No ordinary Admin can create, replace, suspend, revoke, or modify the Super Admin/i);
  assert.match(design, /Changing the Super Admin requires a separate owner-controlled out-of-band recovery\/change procedure/i);
});


test('ordinary Admin permissions are a closed module-level allowlist and never include admin provisioning', () => {
  for (const key of [
    'dashboard.read', 'users.read', 'users.manage', 'users.freeze',
    'kyc.read', 'kyc.review', 'deposits.read', 'deposits.review',
    'withdrawals.read', 'withdrawals.review', 'orders.read',
    'support.read', 'support.reply', 'support.manage',
    'announcements.read', 'announcements.manage',
    'system_config.read', 'system_config.write',
    'seconds_policy.read', 'seconds_policy.manage',
    'financial_audit.read', 'financial_adjustment.request'
  ]) assert.ok(design.includes(key), 'missing permission key: ' + key);
  assert.match(design, /Administrator provisioning and permission assignment are deliberately absent from the ordinary grant catalogue/i);
  assert.match(design, /Only the Super Admin can list, create, modify, suspend, revoke, or grant permissions to Admin accounts/i);
  assert.match(design, /An Admin permission never bypasses those controls/i);
});
