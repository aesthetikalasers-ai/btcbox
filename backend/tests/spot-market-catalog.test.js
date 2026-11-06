'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('public spot-market catalogue is sourced from operator configuration', () => {
  const route = backend.indexOf("if (path === 'market/pairs' && method === 'GET')");
  const marketRoute = backend.indexOf("if (path === 'market' && method === 'GET')");
  assert.ok(route >= 0 && marketRoute > route, 'catalogue route must precede ticker route');
  const routeBlock = backend.slice(route, marketRoute);
  assert.ok(routeBlock.includes('readSpotMarketCatalog()'));
  assert.ok(!routeBlock.includes('if (!user)'), 'public catalogue must not require a user session');
  assert.ok(routeBlock.includes('markets.filter(market => market.enabled)'));
  assert.ok(backend.includes("market.quote_asset !== 'USDT'"));
  assert.ok(backend.includes("quoteAsset !== 'USDT'"));
});

test('market ticker, candles and depth are gated by enabled spot pairs', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  const klineStart = backend.indexOf("if (path === 'kline' && method === 'GET')");
  const depthStart = backend.indexOf("if (path === 'depth' && method === 'GET')");
  assert.ok(marketStart >= 0 && klineStart >= 0 && depthStart >= 0);
  assert.ok(backend.slice(marketStart, marketStart + 9000).includes('readSpotMarketCatalog()'));
  assert.ok(backend.slice(marketStart, marketStart + 9000).includes('configured_empty'));
  assert.ok(backend.slice(klineStart, klineStart + 5000).includes('SPOT_MARKET_DISABLED'));
  assert.ok(backend.slice(depthStart, depthStart + 3000).includes('SPOT_MARKET_DISABLED'));
});

test('user Trade Hub links only to configured pairs and Spot order submission checks the active pair', () => {
  assert.ok(api.includes('export async function getSpotMarketPairs'));
  assert.ok(api.includes('${API_BASE_URL}/market/pairs'));
  assert.ok(pages.includes('getSpotMarketPairs(controller.signal)'));
  assert.ok(pages.includes('pair.base_asset+pair.quote_asset'));
  assert.ok(pages.includes('pair.base_asset===base&&pair.quote_asset==="USDT"'));
  assert.ok(pages.includes('if(!spotPairEnabled&&!pendingIntent)'));
  assert.ok(pages.includes('(!spotPairEnabled&&!pendingIntent)'));
  assert.ok(pages.includes('setSpotPairEnabled(false);setTradingStatus(null)'));
  assert.ok(pages.includes('!spotPairEnabled||!tradingStatus?.spot_order_entry_enabled'));
});
