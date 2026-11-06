'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const app = fs.readFileSync(path.resolve(root, '../frontend/src/App.tsx'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('spot trading status reports server-side capability and fails closed by default', () => {
  assert.ok(api.includes("if (path === 'trading/status' && method === 'GET')"));
  assert.ok(api.includes('const enabled = matchingEngineEnabled();'));
  assert.ok(api.includes('spot_order_entry_enabled: enabled, spot_cancel_enabled: enabled'));
});

test('spot order submission validates the limit-order contract before the matching RPC', () => {
  const start = api.indexOf("if (path === 'order' && method === 'POST')");
  const end = api.indexOf("if (path === 'order/cancel' && method === 'POST')", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("type !== 'limit'"));
  assert.ok(route.includes('clientOrderId'));
  assert.ok(route.includes('if (!matchingEngineEnabled())'));
  assert.ok(route.indexOf('if (!matchingEngineEnabled())') < route.indexOf("matchingRpc('submit_limit_order_matching_v1'"));
  assert.ok(route.includes('No order was created and your balance was unchanged.'));
});

test('spot cancellation uses a separate idempotency key and remains server-gated', () => {
  const start = api.indexOf("if (path === 'order/cancel' && method === 'POST')");
  const end = api.indexOf('// ---------- GET /api/earn/products ----------', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('client_cancel_id'));
  assert.ok(route.includes('matchingEngineEnabled()'));
  assert.ok(route.includes("matchingRpc('cancel_limit_order_matching_v1'"));
});

test('React spot terminal uses real market, candle, order book, order and capability APIs', () => {
  for (const contract of [
    'getTradingStatus', 'getMarkets', 'getKlines', 'getOrderBook',
    'submitSpotOrder', 'cancelSpotOrder', 'getOrders'
  ]) assert.ok(client.includes(contract), 'missing client contract ' + contract);
  assert.ok(pages.includes('export function SpotTradingPage()'));
  assert.ok(pages.includes('createChart('));
  assert.ok(pages.includes('getKlines(symbol,"1h"'));
  assert.ok(pages.includes('getOrderBook(symbol'));
  assert.ok(pages.includes('submitSpotOrder('));
  assert.ok(pages.includes('cancelSpotOrder('));
  assert.ok(app.includes('<Route path="/trade/:symbol" element={<ProtectedAccountRoute><SpotTradingPage /></ProtectedAccountRoute>} />'));
});


test('Spot limit form accepts decimal digits and rejects malformed decimal strings', () => {
  assert.ok(pages.includes('!/^(?:0|[1-9]\\d*)(?:\\.\\d{1,18})?$/.test(quantity)'));
  assert.ok(pages.includes('!/^(?:0|[1-9]\\d*)(?:\\.\\d{1,18})?$/.test(price)'));
});
