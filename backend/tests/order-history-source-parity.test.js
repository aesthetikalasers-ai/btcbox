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
  }

  assert.ok(admin.includes("source: 'postgres_financial_matching'"));
  assert.ok(admin.includes("source: 'legacy_state'"));
  assert.ok(customer.includes('Array.isArray(user.orders)'), 'legacy fallback remains explicit only when matching engine is not requested');
});


test('administrator order viewer exposes the source used by customer and admin order reads', () => {
  const adminPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  assert.ok(adminPage.includes('setOrdersSource(snapshot.source || "unknown")'));
  assert.ok(adminPage.includes('"Source: PostgreSQL matching"'));
  assert.ok(adminPage.includes('"Source: legacy state"'));
  assert.ok(adminPage.includes('Customer order history and this administrator view use the canonical PostgreSQL matching orders.'));
  assert.ok(adminPage.includes('Legacy state fallback is active because matching-engine mode was not requested.'));
});

test('customer and admin PostgreSQL order projections use consistent status values, key fields and symbol format', () => {
  const customerStart = api.indexOf("if (path === 'orders' && method === 'GET')");
  const customerEnd = api.indexOf('// ---------- GET /api/chat/unread', customerStart);
  const adminStart = api.indexOf("if (sub === 'orders' && method === 'GET')");
  const adminEnd = api.indexOf('// POST /api/admin/support/reply', adminStart);
  const customer = api.slice(customerStart, customerEnd);
  const admin = api.slice(adminStart, adminEnd);
  const customerEngine = customer.slice(customer.indexOf('if (matchingEngineRequested())'), customer.indexOf('return json({ ok: true, orders: (Array.isArray(user.orders)'));
  const adminEngine = admin.slice(admin.indexOf('if (matchingEngineRequested())'), admin.indexOf('const list = [];'));
  // Both must select client_order_id from the canonical table.
  assert.ok(customerEngine.includes('client_order_id'));
  assert.ok(adminEngine.includes('client_order_id'));
  // The admin view must not silently rewrite the canonical DB status. The
  // matching engine check constraint uses 'cancelled'; both views must return
  // the same raw value so a customer and an admin never see different statuses
  // for the same order.
  assert.ok(!adminEngine.includes("o.status === 'cancelled' ? 'canceled'"));
  assert.ok(!adminEngine.includes("status: o.status === 'cancelled'"));
  // Symbol format must match the customer view (base+quote, no slash).
  assert.ok(adminEngine.includes('symbol: o.base_asset + o.quote_asset'));
  assert.ok(!adminEngine.includes("o.base_asset + '/' + o.quote_asset"));
  // Both projections expose the same core quantity/price/time fields under the
  // customer-canonical names (order_id, quantity, created_at) while retaining
  // legacy admin aliases (id, amount, time).
  for (const field of ['order_id: o.id', 'quantity: o.quantity', 'created_at: o.created_at', 'client_order_id: o.client_order_id', "type: 'limit'"]) {
    assert.ok(adminEngine.includes(field), 'admin projection must include ' + field);
  }
  for (const field of ['order_id: row.id', 'quantity: row.quantity', 'client_order_id: row.client_order_id', "type: 'limit'"]) {
    assert.ok(customerEngine.includes(field), 'customer projection must include ' + field);
  }
  // Admin order read remains permission-gated and never falls back to legacy
  // orders when the matching engine is requested.
  assert.ok(adminEngine.includes('financial_matching_orders'));
  assert.ok(!adminEngine.includes('u.orders'));
});
