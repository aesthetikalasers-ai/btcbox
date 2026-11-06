'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const design = fs.readFileSync(path.resolve(root, '../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');

test('seconds policy write routes remain unavailable while admin identity is shared Basic Auth', () => {
  const authStart = api.indexOf('async function adminAuth()');
  const authEnd = api.indexOf('async function flushAdminAuditOutbox()', authStart);
  assert.ok(authStart >= 0 && authEnd > authStart);
  const auth = api.slice(authStart, authEnd);
  assert.match(auth, /startsWith\('Basic '\)/);
  assert.match(auth, /process\.env\.ADMIN_USER/);
  assert.match(auth, /process\.env\.ADMIN_PASS/);
  assert.doesNotMatch(api, /seconds-policy/);
  assert.match(api, /if \(path\.startsWith\('admin\/'\)\)/);
});

test('seconds policy RBAC design requires a validated Supabase subject and server-side permission lookup', () => {
  assert.match(design, /validate the token with the trusted Supabase Auth server/i);
  assert.match(design, /canonical actor is the validated Auth user UUID/i);
  assert.match(design, /private, non-Data-API-exposed schema\/table/i);
  assert.match(design, /read the current membership\/permission state server-side for every sensitive action/i);
  assert.match(design, /Do not use mutable `user_metadata`/i);
});

test('seconds policy activation requires three distinct actors and immutable reviewed versions', () => {
  assert.match(design, /author, reviewer, and activator must be three distinct/i);
  assert.match(design, /An author cannot review or activate/i);
  assert.match(design, /A reviewer cannot activate/i);
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
  assert.match(design, /Require two separately authenticated approvers/i);
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
