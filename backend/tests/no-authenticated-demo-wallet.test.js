'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = path.resolve(__dirname, '../../frontend/src');

test('authenticated app startup never initializes a customer demo wallet', () => {
  const main = fs.readFileSync(path.join(frontend, 'main.tsx'), 'utf8');
  assert.ok(main.includes('TradingProvider'), 'the context provider remains mounted for shared hooks');
  assert.ok(!main.includes('TradingInitializer'), 'no automatic demo wallet initializer may run');
  const trading = fs.readFileSync(path.join(frontend, 'lib/trading.tsx'), 'utf8');
  assert.ok(trading.includes('PAPER_TRADING_ENABLED ? loadLedger() : emptyLedger()'));
  assert.ok(trading.includes('if (!PAPER_TRADING_ENABLED) return;'));
  assert.ok(trading.includes('const PAPER_TRADING_ENABLED = import.meta.env.DEV && DEMO_PREVIEW_ACTIVE'));
});

test('new backend accounts start with zero balances for every supported asset', () => {
  const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');
  const start = api.indexOf('function emptyBalances()');
  const end = api.indexOf('function safeDepositAddresses', start);
  assert.ok(start >= 0 && end > start);
  const emptyBalances = api.slice(start, end);
  for (const asset of ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC']) {
    assert.match(emptyBalances, new RegExp(asset + ': \\{ free: 0, frozen: 0 \\}'));
  }
  assert.ok(api.includes('balances: emptyBalances()'), 'new account creation must use the zero-balance factory');
});

test('real asset page reads only the authenticated account snapshot', () => {
  const assets = fs.readFileSync(path.join(frontend, 'features/assets/AssetsPage.tsx'), 'utf8');
  assert.ok(assets.includes('getAccount(controller.signal)'));
  assert.ok(assets.includes('Object.entries(account?.balances ?? {})'));
  assert.ok(!assets.includes('useTrading'));
  assert.ok(!assets.includes('paperBalances'));
  assert.ok(!assets.includes('DEMO_INITIAL_USDT'));
});

test('real order history does not merge browser paper orders', () => {
  const orders = fs.readFileSync(path.join(frontend, 'features/orders/OrdersPage.tsx'), 'utf8');
  assert.ok(orders.includes('getOrders(controller.signal)'));
  assert.ok(orders.includes('const visibleOrders = openOnly ? orders.filter'));
  assert.ok(!orders.includes('useTrading'));
  assert.ok(!orders.includes('paperOrders'));
  assert.ok(!orders.includes('mergedOrders'));
});

test('live Seconds page uses only server balances, policy, positions and settlement', () => {
  const seconds = fs.readFileSync(path.join(frontend, 'features/pages/SecondsPage.tsx'), 'utf8');
  assert.ok(seconds.includes('getAccount(controller.signal)'));
  assert.ok(seconds.includes('accountResult.value.balances["USDT"]?.free'));
  assert.ok(seconds.includes('setAvailableUSDT(null)'));
  assert.ok(seconds.includes('getSecondsPositions(controller.signal)'));
  assert.ok(seconds.includes('getSecondsPolicy(controller.signal)'));
  assert.ok(seconds.includes('submitSecondsOrder(intent)'));
  assert.ok(!seconds.includes('setAvailableUSDT("0.00")'));
  assert.ok(!seconds.includes('useTrading'));
  assert.ok(!seconds.includes('settleSecondsTrade'));
  assert.ok(seconds.includes('if (status !== "authenticated")'));
});
