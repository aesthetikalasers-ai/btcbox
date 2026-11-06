'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const page = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const types = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');

test('administrator user search returns the canonical Supabase Auth UUID only to Super Admin', () => {
  const start = api.indexOf("if (sub === 'users' && method === 'GET')");
  const end = api.indexOf("// GET /api/admin/kyc", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.match(route, /admin_auth_user_id:\s*adminMembership\.is_super_admin === true\s*\?\s*String\(u\.supabase_user_id\s*\|\|/);
  assert.ok(route.includes('u.supabase_user_ids[0]'));
  assert.ok(!route.includes('supabase_user_ids:'));
});

test('delegated administrator provisioning sends the Auth UUID, not the internal BTCBOX UID', () => {
  assert.match(page, /value=\{user\.admin_auth_user_id\}/);
  assert.match(page, /item\.user_id===user\.admin_auth_user_id/);
  assert.match(page, /user\.admin_auth_user_id\|\|""/);
  assert.ok(page.includes('BTCBOX UID {user.uid}'));
  assert.ok(types.includes('admin_auth_user_id?: string;'));
});

test('membership mutation continues to submit the selected Auth UUID as target_user_id', () => {
  assert.ok(page.includes('target_user_id: targetUserId'));
  assert.ok(api.includes('p_target_user_id: targetUserId'));
  assert.ok(api.includes('validUuid.test(targetUserId)'));
});
