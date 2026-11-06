'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('every read/write admin API contract is mapped to an explicit least-privilege permission', () => {
  const start = api.indexOf('const requiredPermission = (function(route, verb)');
  const end = api.indexOf('if (!requiredPermission)', start);
  assert.ok(start >= 0 && end > start, 'admin permission resolver must exist');
  const resolver = api.slice(start, end);

  const mappings = [
    ["stats", "GET", "dashboard.read"],
    ["users", "GET", "users.read"],
    ["user", "GET", "users.read"],
    ["user/freeze", "POST", "users.freeze"],
    ["user/balance", "POST", "financial_adjustment.request"],
    ["user/reset-pwd", "POST", "users.manage"],
    ["user/reset-email", "POST", "users.manage"],
    ["kyc", "GET", "kyc.read"],
    ["kyc/approve", "POST", "kyc.review"],
    ["kyc/reject", "POST", "kyc.review"],
    ["deposit/confirm", "POST", "deposits.review"],
    ["addresses", "GET", "deposits.read"],
    ["address/manage", "POST", "system_config.write"],
    ["withdrawals", "GET", "withdrawals.read"],
    ["orders", "GET", "orders.read"],
    ["support/messages", "GET", "support.read"],
    ["support/reply", "POST", "support.reply"],
    ["push", "POST", "announcements.manage"],
    ["audit-logs", "GET", "financial_audit.read"],
    ["spot-markets", "GET", "system_config.read"],
    ["spot-markets", "POST", "system_config.write"],
    ["config", "GET", "system_config.read"],
    ["config", "POST", "system_config.write"],
    ["seconds-policy", "GET", "seconds_policy.read"],
    ["seconds-policy", "POST", "seconds_policy.manage"],
    ["seconds-positions", "GET", "seconds_policy.read"],
  ];

  for (const [route, method, permission] of mappings) {
    const expected = `if (route === '${route}' && verb === '${method}') return '${permission}';`;
    const groupedMapping =
      (route === "user/reset-pwd" || route === "user/reset-email") &&
        resolver.includes("if ((route === 'user/reset-pwd' || route === 'user/reset-email') && verb === 'POST') return 'users.manage';") ||
      (route === "kyc/approve" || route === "kyc/reject") &&
        resolver.includes("if ((route === 'kyc/approve' || route === 'kyc/reject') && verb === 'POST') return 'kyc.review';");
    assert.ok(resolver.includes(expected) || groupedMapping,
      `Missing permission mapping: ${method} admin/${route} -> ${permission}`);
  }
  assert.ok(resolver.includes("if (['withdraw/approve','withdraw/reject','withdraw/mark-paid'].includes(route) && verb === 'POST') return 'withdrawals.review';"));
});

test('unknown admin routes and insufficient permissions fail closed before route handlers', () => {
  const start = api.indexOf('const requiredPermission = (function(route, verb)');
  const unknown = api.indexOf("if (!requiredPermission) return json({ ok: false, code: 'ADMIN_ROUTE_NOT_FOUND'", start);
  const denied = api.indexOf('if (!hasAdminPermission(adminMembership, requiredPermission))', start);
  const audit = api.indexOf('const priorAuditFlush = await flushAdminAuditOutbox()', start);
  assert.ok(start >= 0 && unknown > start && denied > unknown && audit > denied);
});


test('direct admin balance adjustment is blocked until a dual-approval workflow exists', () => {
  const gate = api.indexOf("if (sub === 'user/balance' && method === 'POST') {", api.indexOf('const requiredPermission ='));
  const outbox = api.indexOf('const priorAuditFlush = await flushAdminAuditOutbox()', gate);
  const mutation = api.indexOf("// POST /api/admin/user/balance", outbox);
  assert.ok(gate >= 0 && outbox > gate && mutation > outbox);
  const guard = api.slice(gate, outbox);
  assert.ok(guard.includes("code: 'FINANCIAL_ADJUSTMENT_APPROVAL_REQUIRED'"));
  assert.ok(guard.includes('Direct administrator balance adjustments are disabled.'));
  assert.ok(guard.includes('dual-approval adjustment queue'));
  assert.ok(!guard.includes('admin_adjustment_atomic'));
});

test('admin role editor does not offer the unapproved immediate financial adjustment permission', () => {
  const admin = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(!admin.includes('["financial_adjustment.request","Request financial adjustment"]'));
  assert.ok(admin.includes('Manual deposit credit'));
});
