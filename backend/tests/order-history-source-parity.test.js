'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

test('customer order history and admin order list use the same PostgreSQL matching source', () => {
  const customerStart = api.indexOf("if (path === 'orders' && method === 'GET')");
  const customerEnd = api.indexOf('// ---------- GET /api/chat/unread', customerStart);
  const adminStart = api.indexOf("if (sub === 'orders' && method === 'GET')");
  const adminEnd = api.indexOf('// POST /api/admin/support/reply', adminStart);

  assert.ok(customerStart >= 0 && customerEnd > customerStart, 'customer order route must exist');
  assert.ok(adminStart >= 0 && adminEnd > adminStart, 'admin order route must exist');

  const customer = api.slice(customerStart, customerEnd);
  const admin = api.slice(adminStart, adminEnd);
  const customerEngineStart = customer.indexOf('if (matchingEngineRequested())');
  const customerLegacyStart = customer.indexOf('return json({ ok: true, orders: (Array.isArray(user.orders)');
  const adminEngineStart = admin.indexOf('if (matchingEngineRequested())');
  const adminLegacyStart = admin.indexOf('const list = [];');

  assert.ok(customerEngineStart >= 0 && customerLegacyStart > customerEngineStart);
  assert.ok(adminEngineStart >= 0 && adminLegacyStart > adminEngineStart);

  const customerEngine = customer.slice(customerEngineStart, customerLegacyStart);
  const adminEngine = admin.slice(adminEngineStart, adminLegacyStart);

  for (const [name, route] of [['customer', customerEngine], ['admin', adminEngine]]) {
    assert.ok(route.includes('matchingEngineEnabled()'), name + ' route must enforce matching cutover');
    assert.ok(route.includes('MATCHING_ENGINE_UNAVAILABLE'), name + ' route must fail closed when cutover is unavailable');
    assert.ok(route.includes('financial_matching_orders'), name + ' route must read the canonical PostgreSQL order table');
    assert.ok(route.includes('ORDER_READ_UNAVAILABLE'), name + ' route must report database read failures');
    assert.ok(!route.includes('user.orders'), name + ' route must not fall back to legacy user orders');
    assert.ok(!route.includes('db.users'), name + ' route must not fall back to legacy state orders');
  }

  assert.ok(admin.includes("source: 'postgres_financial_matching'"));
  assert.ok(admin.includes("source: 'legacy_state'"));
  assert.ok(customer.includes('Array.isArray(user.orders)'), 'legacy fallback remains explicit only when matching engine is not requested');
});
