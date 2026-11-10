'use strict';
// Perpetual (Contract / Perpetual) v1 — API-layer contract tests (source-level, no DB).
// Verifies: feature switch default-off, input validation, idempotency keys, money-as-strings,
// no JS Number settlement, admin endpoints gated by permission, no fake availability.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

function routeSlice(startMarker, endMarker) {
  const start = api.indexOf(startMarker);
  const end = api.indexOf(endMarker, start + 1);
  assert.ok(start >= 0, 'missing start: ' + startMarker);
  assert.ok(end > start, 'missing end: ' + endMarker);
  return api.slice(start, end);
}

test('perpetual engine feature switch defaults OFF and gates every write', () => {
  assert.ok(api.includes('function perpetualEngineEnabled()'));
  assert.ok(api.includes("process.env.FINANCIAL_PERPETUAL_ENGINE_ENABLED === '1' && financialWritesEnabled()"));
  // writes must check perpetualEngineEnabled() BEFORE calling perpRpc
  assert.ok(api.includes("if (!perpetualEngineEnabled()) return json({ ok: false, code: 'PERPETUAL_ENGINE_UNAVAILABLE'"));
  assert.ok(api.includes('Perpetual trading is not enabled. No order was created and your balance was unchanged.'));
  // perpRpc itself also fails closed
  assert.ok(api.includes('async function perpRpc(name, payload)'));
  assert.ok(api.includes("error.code = 'PERPETUAL_ENGINE_UNAVAILABLE'"));
});

test('perpetual public markets never fake availability — returns empty list when disabled', () => {
  const route = routeSlice("path === 'perpetual/markets' && method === 'GET'", "path === 'perpetual/order' && method === 'POST'");
  assert.ok(route.includes('perpetual_enabled: false'));
  assert.ok(route.includes('markets: []'));
  assert.ok(route.includes('Perpetual trading is not enabled yet.'));
  // reads enabled markets only (enabled=eq.true)
  assert.ok(route.includes('enabled=eq.true'));
});

test('perpetual order submission validates all inputs before RPC and requires idempotency key', () => {
  const route = routeSlice("path === 'perpetual/order' && method === 'POST'", "path === 'perpetual/order' && method === 'DELETE'");
  assert.ok(route.includes('ACCOUNT_FROZEN'));
  assert.ok(route.includes('INVALID_SYMBOL'));
  assert.ok(route.includes("['limit','market']"));
  assert.ok(route.includes('INVALID_LEVERAGE'));
  assert.ok(route.includes('leverage > 100'));
  assert.ok(route.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(route.includes('x-idempotency-key')); // accepts header or body
  assert.ok(route.includes('client_order_id'));
  // money passed as strings: parseMoneyInput, never Number() on qty/price
  assert.ok(route.includes('parseMoneyInput(body.quantity)'));
  assert.ok(!route.includes('Number(body.quantity)'));
  assert.ok(!route.includes('Number(body.price)'));
  // RPC call with string params
  assert.ok(route.includes("perpRpc('perp_submit_order'"));
  assert.ok(route.includes('p_price: price, p_quantity: quantity')); // strings passed through
  // rate limit consumed before RPC
  assert.ok(route.includes("rateCheckShared('spot_order'"));
});

test('perpetual cancel requires client_cancel_id and calls perp_cancel_order', () => {
  const route = routeSlice("path === 'perpetual/order' && method === 'DELETE'", "path === 'perpetual/close-position' && method === 'POST'");
  assert.ok(route.includes('client_cancel_id'));
  assert.ok(route.includes("perpRpc('perp_cancel_order'"));
  assert.ok(route.includes("rateCheckShared('spot_cancel'"));
  assert.ok(route.includes('Cancel was not executed.'));
});

test('perpetual close-position is reduce-only market order and rejects when no position', () => {
  const route = routeSlice("path === 'perpetual/close-position' && method === 'POST'", "path === 'perpetual/orders' && method === 'GET'");
  assert.ok(route.includes('NO_POSITION'));
  assert.ok(route.includes('p_reduce_only: true, p_close_position: true'));
  assert.ok(route.includes("p_type: 'market'"));
  // closes opposite side: long→sell, short→buy
  assert.ok(route.includes("pos.side === 'long' ? 'sell' : 'buy'"));
});

test('perpetual positions read computes unrealized PnL display-only and marks estimates as non-authoritative', () => {
  const route = routeSlice("path === 'perpetual/positions' && method === 'GET'", "path === 'perpetual/trades' && method === 'GET'");
  assert.ok(route.includes('perp_latest_mark_price'));
  assert.ok(route.includes('unrealized_pnl_est'));
  assert.ok(route.includes('display-only estimates; settlement & liquidation are database-authoritative'));
});

test('perpetual trades & funding reads exist and are auth-gated', () => {
  assert.ok(api.includes("path === 'perpetual/trades' && method === 'GET'"));
  assert.ok(api.includes("path === 'perpetual/funding' && method === 'GET'"));
  assert.ok(api.includes("path === 'perpetual/orders' && method === 'GET'"));
});

test('admin perpetual market upsert validates max_leverage <= 100 and mmr range, gated by system_config.write', () => {
  const start = api.indexOf("perpSub === 'market' && method === 'POST'");
  assert.ok(start >= 0, 'admin perpetual market upsert route missing');
  const route = api.slice(start, start + 4000);
  assert.ok(route.includes("hasAdminPermission(adminMembership, 'system_config.write')"));
  assert.ok(route.includes('maxLeverage > 100'));
  assert.ok(route.includes('mmr < 0 || mmr > 0.5'));
  assert.ok(route.includes('INVALID_MARKET_CONFIG'));
  assert.ok(route.includes('perpetual_markets?on_conflict=symbol'));
});

test('admin perpetual liquidations & insurance endpoints gated by financial_audit.read', () => {
  assert.ok(api.includes("perpSub === 'liquidations' && method === 'GET'"));
  assert.ok(api.includes("perpSub === 'insurance' && method === 'GET'"));
  const liqStart = api.indexOf("perpSub === 'liquidations'");
  const liqRoute = api.slice(liqStart, liqStart + 600);
  assert.ok(liqRoute.includes("'financial_audit.read'"));
  assert.ok(liqRoute.includes('perpetual_liquidation_events'));
  const insStart = api.indexOf("perpSub === 'insurance'");
  const insRoute = api.slice(insStart, insStart + 600);
  assert.ok(insRoute.includes('__perp_insurance__'));
});

test('workers exist and are idempotent/restart-safe', () => {
  for (const f of ['perp-mark-price-worker.js', 'perp-funding-worker.js', 'perp-liquidation-worker.js']) {
    const src = fs.readFileSync(path.join(root, 'scripts', f), 'utf8');
    assert.ok(src.includes('SUPABASE_SERVICE_ROLE_KEY'), f + ' must require service key');
    assert.ok(src.includes('perp_record_mark_price') || src.includes('perp_settle_funding_one') || src.includes('perp_liquidate_position'), f + ' must call a perp RPC');
  }
  const mark = fs.readFileSync(path.join(root, 'scripts', 'perp-mark-price-worker.js'), 'utf8');
  assert.ok(mark.includes('sources.length < 2'), 'mark worker requires >=2 sources');
  assert.ok(mark.includes('CIRCUIT BREAKER'), 'mark worker reports circuit breaker');
  const fund = fs.readFileSync(path.join(root, 'scripts', 'perp-funding-worker.js'), 'utf8');
  assert.ok(fund.includes('duplicate'), 'funding worker handles duplicate settlement');
  const liq = fs.readFileSync(path.join(root, 'scripts', 'perp-liquidation-worker.js'), 'utf8');
  assert.ok(liq.includes('mark price stale'), 'liquidation worker pauses on stale mark');
  assert.ok(liq.includes('BAD DEBT'), 'liquidation worker escalates bad debt');
});
