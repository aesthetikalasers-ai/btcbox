'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontend = path.resolve(__dirname, '../../frontend/src');
const marketData = fs.readFileSync(path.join(frontend, 'lib/marketData.ts'), 'utf8');
const trading = fs.readFileSync(path.join(frontend, 'lib/trading.tsx'), 'utf8');
const demoPreview = fs.readFileSync(path.join(frontend, 'lib/demoPreview.ts'), 'utf8');

test('live market engine starts empty and never exposes hard-coded seed quotes', () => {
  assert.doesNotMatch(marketData, /INITIAL_SEEDS|MockSeed|初始种子价格/);
  assert.match(marketData, /private prices: Map<string, MarketPrice> = new Map\(\)/);
  assert.match(marketData, /Nothing is fabricated here/);
  assert.match(marketData, /getStatus\(\): MarketStatus/);
});

test('paper balances and demo market data are restricted to local development', () => {
  assert.match(trading, /const PAPER_TRADING_ENABLED = import\.meta\.env\.DEV/);
  assert.match(trading, /PAPER_TRADING_ENABLED \? loadLedger\(\) : emptyLedger\(\)/);
  assert.match(demoPreview, /const forceDemo = import\.meta\.env\.DEV &&/);
  assert.match(demoPreview, /if \(import\.meta\.env\.DEV\)/);
});
