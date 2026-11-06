'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const design = fs.readFileSync(path.resolve(root, '../../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');

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
