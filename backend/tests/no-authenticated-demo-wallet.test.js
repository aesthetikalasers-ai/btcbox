'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = path.resolve(__dirname, '../../frontend/src');

test('authenticated app startup does not seed a local demo wallet', () => {
  const main = fs.readFileSync(path.join(frontend, 'main.tsx'), 'utf8');
  assert.ok(main.includes('import { TradingProvider } from "./lib/trading";'));
  assert.ok(!main.includes('TradingInitializer'));
  assert.ok(!main.includes('<TradingInitializer'));
});

test('real asset page reads only the authenticated account snapshot', () => {
  const assets = fs.readFileSync(path.join(frontend, 'features/assets/AssetsPage.tsx'), 'utf8');
  assert.ok(assets.includes('getAccount(controller.signal)'));
  assert.ok(assets.includes('Object.entries(account?.balances ?? {})'));
  assert.ok(!assets.includes('useTrading'));
  assert.ok(!assets.includes('paperBalances'));
  assert.ok(!assets.includes('DEMO_INITIAL_USDT'));
});

test('live Seconds page does not read or settle the browser paper ledger', () => {
  const seconds = fs.readFileSync(path.join(frontend, 'features/pages/SecondsPage.tsx'), 'utf8');
  assert.ok(seconds.includes('submitSecondsOrder(intent)'));
  assert.ok(seconds.includes('getSecondsPositions(controller.signal)'));
  assert.ok(!seconds.includes('useTrading'));
  assert.ok(!seconds.includes('placeSecondsOrder'));
  assert.ok(!seconds.includes('settleSecondsTrade'));
  assert.ok(!seconds.includes('openSecondsTrade'));
});
