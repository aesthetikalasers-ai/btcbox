'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('public spot-market catalogue is sourced from operator configuration before the auth-only routes', () => {
  const route = backend.indexOf("if (path === 'market/pairs' && method === 'GET')");
  const authBoundary = backend.indexOf('// ---------- 以下接口需要登录 ----------');
  assert.ok(route >= 0 && authBoundary > route, 'public market catalogue must be registered before authenticated routes');
  assert.match(backend, /readSpotMarketCatalog\(\)/);
  assert.match(backend, /markets\.filter\(market => market\.enabled\)/);
  assert.match(backend, /market\.quote_asset !== 'USDT'/);
  assert.match(backend, /quoteAsset !== 'USDT'/);
});

test('market ticker, candles and depth cannot expose unconfigured or disabled spot pairs', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  const klineStart = backend.indexOf("if (path === 'kline' && method === 'GET')");
  const depthStart = backend.indexOf("if (path === 'depth' && method === 'GET')");
  assert.ok(marketStart >= 0 && klineStart > marketStart && depthStart > klineStart);
  assert.match(backend.slice(marketStart, klineStart), /readSpotMarketCatalog\(\)/);
  assert.match(backend.slice(marketStart, klineStart), /configured_empty/);
  assert.match(backend.slice(klineStart, depthStart), /SPOT_MARKET_DISABLED/);
  assert.match(backend.slice(depthStart, depthStart + 1800), /SPOT_MARKET_DISABLED/);
});

test('user Trade Hub links only to configured pairs and Spot order submission checks the active pair', () => {
  assert.match(api, /export async function getSpotMarketPairs/);
  assert.match(api, /\$\{API_BASE_URL\}\/market\/pairs/);
  assert.match(pages, /getSpotMarketPairs\(controller\.signal\)/);
  assert.match(pages, /pair\.base_asset\+pair\.quote_asset/);
  assert.match(pages, /pair\.base_asset===base&&pair\.quote_asset==="USDT"/);
  assert.match(pages, /if\(!spotPairEnabled\)/);
  assert.match(pages, /setSpotPairEnabled\(false\);setTradingStatus\(null\)/);
  assert.match(pages, /!spotPairEnabled\|\|!tradingStatus\?\.spot_order_entry_enabled/);
});
