'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ADMIN_PERMISSION_KEYS, normalizeAdminPermissionSet, hasAdminPermission, canManageAdministrators } = require('../admin-rbac');
const apiSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api-core.js'), 'utf8');
test('permission catalogue is closed, unique, and excludes administrator-management grants', () => {
  assert.equal(new Set(ADMIN_PERMISSION_KEYS).size, ADMIN_PERMISSION_KEYS.length);
  assert.ok(ADMIN_PERMISSION_KEYS.includes('users.read'));
  assert.ok(ADMIN_PERMISSION_KEYS.includes('withdrawals.review'));
  assert.ok(!ADMIN_PERMISSION_KEYS.includes('admins.create'));
  assert.ok(!ADMIN_PERMISSION_KEYS.includes('admins.manage'));
  assert.ok(!ADMIN_PERMISSION_KEYS.includes('*'));
});
test('permission normalization rejects malformed, unknown, wildcard, and duplicate grants', () => {
  assert.deepEqual(normalizeAdminPermissionSet(['users.read', 'kyc.review']), { ok: true, permissions: ['kyc.review', 'users.read'] });
  assert.equal(normalizeAdminPermissionSet('users.read').code, 'INVALID_PERMISSION_SET');
  assert.equal(normalizeAdminPermissionSet(['*']).code, 'UNKNOWN_ADMIN_PERMISSION');
  assert.equal(normalizeAdminPermissionSet(['admins.manage']).code, 'UNKNOWN_ADMIN_PERMISSION');
  assert.equal(normalizeAdminPermissionSet(['users.read', 'users.read']).code, 'DUPLICATE_ADMIN_PERMISSION');
  assert.equal(normalizeAdminPermissionSet(['users.read', null]).code, 'UNKNOWN_ADMIN_PERMISSION');
});
test('active Super Admin receives all catalogue permissions and exclusively manages administrators', () => {
  const superAdmin = { status: 'active', is_super_admin: true, permissions: [] };
  for (const permission of ADMIN_PERMISSION_KEYS) assert.equal(hasAdminPermission(superAdmin, permission), true, permission);
  assert.equal(canManageAdministrators(superAdmin), true);
});
test('ordinary Admin receives only explicit grants and cannot manage administrators', () => {
  const admin = { status: 'active', is_super_admin: false, permissions: ['users.read', 'kyc.review'] };
  assert.equal(hasAdminPermission(admin, 'users.read'), true);
  assert.equal(hasAdminPermission(admin, 'kyc.review'), true);
  assert.equal(hasAdminPermission(admin, 'users.freeze'), false);
  assert.equal(hasAdminPermission(admin, 'admins.manage'), false);
  assert.equal(canManageAdministrators(admin), false);
});
test('inactive membership and malformed permission records fail closed', () => {
  assert.equal(hasAdminPermission({ status: 'suspended', is_super_admin: true }, 'users.read'), false);
  assert.equal(canManageAdministrators({ status: 'revoked', is_super_admin: true }), false);
  assert.equal(hasAdminPermission({ status: 'active', permissions: ['*'] }, 'users.read'), false);
  assert.equal(hasAdminPermission(null, 'users.read'), false);
  assert.equal(hasAdminPermission({ status: 'active', permissions: ['users.read'] }, 'unknown.action'), false);
});
test('ordinary membership cannot self-assert Super Admin through extra permission fields', () => {
  const forged = { status: 'active', is_super_admin: false, permissions: ['users.read'], role: 'super_admin', isSuperAdmin: true };
  assert.equal(canManageAdministrators(forged), false);
  assert.equal(hasAdminPermission(forged, 'system_config.write'), false);
});


test('admin read routes and balance adjustments require their own explicit permissions', () => {
  const apiSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api-core.js'), 'utf8');
  assert.match(apiSource, /route === 'withdrawals' && verb === 'GET'.*return 'withdrawals\.read'/);
  assert.match(apiSource, /route === 'orders' && verb === 'GET'.*return 'orders\.read'/);
  assert.match(apiSource, /route === 'support\/messages' && verb === 'GET'.*return 'support\.read'/);
  assert.match(apiSource, /route === 'user\/balance' && verb === 'POST'.*return 'financial_adjustment\.request'/);
  assert.ok(ADMIN_PERMISSION_KEYS.includes('withdrawals.read'));
  assert.ok(ADMIN_PERMISSION_KEYS.includes('orders.read'));
  assert.ok(ADMIN_PERMISSION_KEYS.includes('support.read'));
  assert.ok(ADMIN_PERMISSION_KEYS.includes('financial_adjustment.request'));
});


test('delegated administrator routes are restricted to the verified Super Admin and use server-derived actor identity', () => {
  assert.ok(apiSource.includes("if (sub === 'admins' && method === 'GET')"));
  assert.ok(apiSource.includes("if (sub === 'admins/manage' && method === 'POST')"));
  assert.ok(apiSource.includes('adminMembership.is_super_admin !== true'));
  assert.ok(apiSource.includes('p_actor_user_id: adminUserId'));
  assert.ok(apiSource.includes('p_request_hash: requestHash'));
  assert.ok(apiSource.includes("crypto.createHash('sha256')"));
  const manageRoute = apiSource.slice(apiSource.indexOf("if (sub === 'admins/manage'"), apiSource.indexOf('const requiredPermission'));
  assert.ok(!manageRoute.includes('body.actor_user_id'));
});


test('manual credit intent is account-scoped, reload-safe, and never stores credentials', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const admin = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('btcbox.admin.manual-credit.v1.'));
  assert.ok(admin.includes('window.localStorage.setItem(storageKey, JSON.stringify(intent))'));
  assert.ok(admin.includes('window.localStorage.getItem(key)'));
  assert.ok(admin.includes('idempotency_key: stableRequestId'));
  assert.ok(admin.includes('creditPendingInvalid'));
  assert.ok(admin.includes('if (!creditAccepted && reason instanceof ApiError'));
  assert.ok(!admin.includes('fund_password') && !admin.includes('twofa_code'));
  assert.ok(admin.includes('if (!/^(?:0|[1-9]\\d*)(?:\\.\\d{1,18})?$/.test(amount) || /^0(?:\\.0*)?$/.test(amount))'));
});


test('every React administrator read route is protected by its dedicated server-side permission', () => {
  const adminBlock = apiSource.slice(apiSource.indexOf("if (path.startsWith('admin/'))"));
  assert.ok(adminBlock.indexOf('const adminAuthResult = await adminAuth()') < adminBlock.indexOf("if (sub === 'session' && method === 'GET')"));
  assert.ok(adminBlock.includes('if (!adminAuthResult || !adminAuthResult.ok)'));
  const readRoutes = [
    ['stats', 'dashboard.read'], ['users', 'users.read'], ['user', 'users.read'],
    ['kyc', 'kyc.read'], ['withdrawals', 'withdrawals.read'], ['orders', 'orders.read'],
    ['support/messages', 'support.read'], ['audit-logs', 'financial_audit.read'],
    ['config', 'system_config.read'], ['spot-markets', 'system_config.read'],
    ['seconds-policy', 'seconds_policy.read'], ['seconds-positions', 'seconds_policy.read'],
  ];
  for (const [route, permission] of readRoutes) {
    assert.ok(adminBlock.includes("if (route === '" + route + "' && verb === 'GET') return '" + permission + "';"), route + ' must require ' + permission);
  }
  assert.ok(adminBlock.includes('if (!hasAdminPermission(adminMembership, requiredPermission))'));
  assert.ok(adminBlock.includes("if (sub === 'admins' && method === 'GET')"));
  assert.ok(adminBlock.includes('adminMembership.is_super_admin !== true'));
});
