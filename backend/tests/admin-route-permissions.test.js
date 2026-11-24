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
    ["addresses", "GET", "payout_addresses.read_sensitive"],
    ["address/manage", "POST", "payout_addresses.manage"],
    ["withdrawals", "GET", "withdrawals.read"],
    ["orders", "GET", "orders.read"],
    ["support/messages", "GET", "support.read"],
    ["support/reply", "POST", "support.reply"],
    ["push", "POST", "announcements.manage"],
    ["audit-logs", "GET", "financial_audit.read"],
    ["assets", "GET", "system_config.read"],
    ["assets", "POST", "system_config.write"],
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
  assert.ok(!resolver.includes("if (route === 'addresses' && verb === 'GET') return 'deposits.read';"));
  assert.ok(!resolver.includes("if (route === 'address/manage' && verb === 'POST') return 'system_config.write';"));
});

test('unknown admin routes and insufficient permissions fail closed before route handlers', () => {
  const start = api.indexOf('const requiredPermission = (function(route, verb)');
  const unknown = api.indexOf("if (!requiredPermission) return json({ ok: false, code: 'ADMIN_ROUTE_NOT_FOUND'", start);
  const denied = api.indexOf('if (!hasAdminPermission(adminMembership, requiredPermission))', start);
  const audit = api.indexOf('const priorAuditFlush = await flushAdminAuditOutbox()', start);
  assert.ok(start >= 0 && unknown > start && denied > unknown && audit > denied);
});


test('direct admin balance adjustment remains explicitly permission-gated', () => {
  const route = api.slice(api.indexOf("// POST /api/admin/user/balance"), api.indexOf("// POST /api/admin/user/freeze"));
  assert.ok(route.includes('admin_adjustment_atomic'));
  assert.ok(route.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(route.includes('ADMIN_ACTOR_NOT_CONFIGURED'));
  assert.ok(route.includes('FINANCIAL_CUTOVER_INCOMPLETE'));
});

test('admin role editor exposes the explicit manual balance-adjustment permission', () => {
  const admin = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('["financial_adjustment.request","Manual balance adjustment"]'));
  assert.ok(admin.includes('Manual deposit credit'));
});


test('manual deposit credit requires both review authority and deposit-history read access', () => {
  const permissionStart = api.indexOf('const requiredPermission = (function(route, verb)');
  const extraGate = api.indexOf("if (sub === 'deposit/confirm' && method === 'POST' &&", permissionStart);
  const outbox = api.indexOf('const priorAuditFlush = await flushAdminAuditOutbox()', extraGate);
  assert.ok(extraGate > permissionStart && outbox > extraGate);
  const gate = api.slice(extraGate, outbox);
  assert.ok(gate.includes("hasAdminPermission(adminMembership, 'deposits.read')"));
  assert.ok(gate.includes("permission: 'deposits.read'"));
  const admin = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(admin.includes('!hasPermission("deposits.review") || !hasPermission("deposits.read")'));
});


test('withdrawal actions, support read receipts, and every FAQ method retain explicit route permissions', () => {
  const start = api.indexOf('const requiredPermission = (function(route, verb)');
  const end = api.indexOf('if (!requiredPermission)', start);
  assert.ok(start >= 0 && end > start, 'admin permission resolver must exist');
  const resolver = api.slice(start, end);

  const requiredMappings = [
    ["withdraw/approve", "withdrawals.review"],
    ["withdraw/reject", "withdrawals.review"],
    ["withdraw/mark-paid", "withdrawals.review"],
    ["support/read", "support.read"],
    ["support/faq", "support.read", "GET"],
    ["support/faq", "support.manage", "POST"],
    ["support/faq/delete", "support.manage", "POST"],
  ];

  for (const [route, permission, explicitMethod] of requiredMappings) {
    if (explicitMethod) {
      const expectedLine = (route === 'support/faq' || route === 'support/faq/delete') && explicitMethod === 'POST'
        ? "if ((route === 'support/faq' || route === 'support/faq/delete') && verb === 'POST') return 'support.manage';"
        : `if (route === '${route}' && verb === '${explicitMethod}') return '${permission}';`;
      assert.ok(
        resolver.includes(expectedLine),
        `Missing permission mapping: ${explicitMethod} admin/${route} -> ${permission}`
      );
      continue;
    }
    assert.ok(
      resolver.includes(`if (['withdraw/approve','withdraw/reject','withdraw/mark-paid'].includes(route) && verb === 'POST') return 'withdrawals.review';`),
      `Missing withdrawal permission mapping: POST admin/${route}`
    );
  }
});


test('perpetual admin endpoints remain fail-closed until their route permissions are explicitly approved', () => {
  const start = api.indexOf('const requiredPermission = (function(route, verb)');
  const end = api.indexOf('if (!requiredPermission)', start);
  assert.ok(start >= 0 && end > start, 'admin permission resolver must exist');
  const resolver = api.slice(start, end);

  // These handlers exist below the dispatcher, but exposing them changes the
  // reachability of market configuration and financial audit data. Keep them
  // inaccessible until the owner approves an explicit least-privilege mapping.
  for (const [route, method] of [
    ['perpetual/market', 'POST'],
    ['perpetual/liquidations', 'GET'],
    ['perpetual/insurance', 'GET'],
  ]) {
    assert.ok(
      !resolver.includes(`route === '${route}' && verb === '${method}'`),
      `Unexpectedly exposed admin/${route} via ${method}; review authorization and audit requirements first.`
    );
  }

  const handlerStart = api.indexOf("if (sub.startsWith('perpetual/'))");
  assert.ok(handlerStart > end, 'perpetual admin handler must remain present for future approved integration');
  const handler = api.slice(handlerStart);
  assert.ok(handler.includes("hasAdminPermission(adminMembership, 'system_config.write')"));
  assert.ok(handler.includes("hasAdminPermission(adminMembership, 'financial_audit.read')"));
});
