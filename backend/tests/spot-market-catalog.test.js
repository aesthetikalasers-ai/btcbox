'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('public USDT/USD FX route is exposed by the shared Vercel API handler', () => {
  const route = backend.indexOf("if (path === 'fx/usdt-usd' && method === 'GET')");
  const klineStart = backend.indexOf("if (path === 'kline' && method === 'GET')");
  assert.ok(route >= 0 && klineStart > route, 'FX route must be present before the kline route');
  const routeBlock = backend.slice(route, klineStart);
  assert.ok(routeBlock.includes("getUsdtUsd()"));
  assert.ok(routeBlock.includes("code: 'FX_DATA_UNAVAILABLE'"));
  assert.ok(!routeBlock.includes("rate: 0.99999"));
  assert.ok(api.includes('getUsdtUsdRate'));
  assert.ok(api.includes('${API_BASE_URL}/fx/usdt-usd'));
});

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
  assert.ok(!backend.includes("DEFAULT_SPOT_CATALOG"), "catalogue read failures must not activate a seeded market list");
  assert.match(backend, /catch \(error\) \{ throw new Error\('Spot market catalogue unavailable:/);
  assert.ok(api.includes("MARKET_CATALOG_UNAVAILABLE"));
  assert.ok(!api.includes("return getSampleMarketPairs()"), "the public client must not fabricate a pair list");
  assert.ok(api.includes("return { rate: null, source: \"unavailable\", stale: true }"));
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
  assert.ok(pages.includes('setSpotPairEnabled(false);setSpotPairRules(null);setTradingStatus(null)'));
  assert.ok(pages.includes('(!spotPairEnabled&&!pendingIntent)||(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent)'));
});


test('Bybit fallback is batched and rejects missing, stale, and future response timestamps', () => {
  const gateway = fs.readFileSync(path.join(root, 'market-gateway.js'), 'utf8');
  assert.ok(gateway.includes('async function bybitMarket(provider, bases, timeoutMs)'));
  assert.ok(gateway.includes('/v5/market/tickers?category=spot'));
  assert.ok(gateway.includes('providerTs === null || providerTs > now + 15 || now - providerTs > 60'));
  assert.ok(gateway.includes("['binance-vision', 'bybit', 'coinbase', 'binance-us']"));
  // Coinbase's timestamp is last-trade time, not response time; do not apply
  // Bybit's response-age gate to it because quiet markets can have old trades.
  const coinbaseStart = gateway.indexOf('async function coinbaseMarket');
  const bybitStart = gateway.indexOf('async function bybitMarket', coinbaseStart);
  const coinbase = gateway.slice(coinbaseStart, bybitStart);
  assert.ok(coinbase.includes('Date.parse(ticker.time)'));
  assert.ok(!coinbase.includes('now - providerTs > 60'));
});

test('market timestamps distinguish server snapshot time from provider-specific timestamps', () => {
  const gateway = fs.readFileSync(path.join(root, 'market-gateway.js'), 'utf8');
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  const klineStart = backend.indexOf("if (path === 'kline' && method === 'GET')", marketStart);
  const route = backend.slice(marketStart, klineStart);
  assert.ok(gateway.includes('Date.parse(ticker.time)'), 'Coinbase timestamp is the last-trade timestamp');
  assert.ok(gateway.includes('const providerTimeMs = num(payload.time)'), 'Bybit timestamp is the provider response timestamp');
  assert.ok(gateway.includes('ts: now, providerTs'), 'gateway preserves provider time separately');
  assert.ok(route.includes('const gatewaySnapshotTs = Number(gatewayRow.ts)'), 'API reads the gateway server snapshot time');
  assert.ok(route.includes('ts: Number.isFinite(gatewaySnapshotTs) && gatewaySnapshotTs > 0 ? gatewaySnapshotTs : null'), 'API preserves the gateway timestamp instead of refreshing stale data');
  assert.ok(route.includes('ts: Number.isFinite(gatewaySnapshotTs) && gatewaySnapshotTs > 0 ? gatewaySnapshotTs : null'), 'stale fallback age must remain unchanged');
  assert.ok(route.includes('providerTs: gatewayRow.providerTs !== null && gatewayRow.providerTs !== undefined && Number.isFinite(gatewayProviderTs) && gatewayProviderTs > 0 ? gatewayProviderTs : null'), 'API preserves provider timestamp separately');
  assert.ok(api.includes('Server snapshot time (Unix seconds), not an exchange event timestamp.'));
  assert.ok(api.includes('never synthesized by the browser.'));
});

test('public ticker snapshots use a short shared-cache window and clients bypass browser cache', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  assert.ok(marketStart >= 0);
  const route = backend.slice(marketStart, marketStart + 9000);
  assert.ok(route.includes("'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=1'"));
  assert.ok(api.includes('cache: "no-store"'));
  assert.ok(pages.includes('window.setInterval(refreshMarketData,5000)'));
});

test('order book snapshots normalize provider levels and preserve server-side freshness', () => {
  const depthStart = backend.indexOf("if (path === 'depth' && method === 'GET')");
  const authBoundary = backend.indexOf('// ---------- 以下接口需要登录 ----------', depthStart);
  const route = backend.slice(depthStart, authBoundary);
  assert.ok(route.includes('const normalizeLevels = rows => rows'));
  assert.ok(route.includes('Number(row[0]) > 0'));
  assert.ok(route.includes('Number(row[1]) > 0'));
  assert.ok(route.includes('sort((left, right) => Number(right[0]) - Number(left[0]))'));
  assert.ok(route.includes('sort((left, right) => Number(left[0]) - Number(right[0]))'));
  assert.ok(route.includes('snapshotTs: Math.floor(Date.now() / 1000), providerTs'));
  assert.ok(api.includes('const normalizeLevels = (rows: unknown[])'));
  assert.ok(api.includes('INVALID_ORDER_BOOK'));
  assert.ok(pages.includes('!serverSnapshotTimestampMs||!Number.isFinite(serverSnapshotTimestampMs)'));
  assert.ok(pages.includes('(!ticker||marketSnapshotStale)&&!pendingIntent'));
  assert.ok(!pages.includes('providerTimestampMs'), 'provider event time must not replace server snapshot freshness');
  assert.ok(!pages.includes('displayTicker?.source'), 'ticker source must not be rendered in customer UI');
  assert.ok(pages.includes('const orderBookSnapshotStale=!!book&&(!book.snapshotTs||marketClockNow-book.snapshotTs*1000>90_000)'));
  assert.ok(pages.includes('const streamDepthFresh=liveDepth.updatedAt!==null&&Date.now()-liveDepth.updatedAt<=90_000'));
  assert.ok(pages.includes('const displayBook=streamDepthFresh?liveDepth.data:(orderBookSnapshotStale?null:book)'));
  // A stale stream frame cannot shadow a newer polled provider snapshot.
  assert.ok(pages.includes('orderBookSnapshotStale?null:book'), 'stale polled book must not be rendered as live');
  // Source metadata stays in API snapshots but is not rendered in the customer UI.
  assert.ok(!pages.includes('displayBook?.source'), 'order book source must not be rendered in customer UI');
  assert.ok(!pages.includes('t("Source")'), 'internal feed labels must not be rendered');
});

test('spot chart preserves internal provider provenance and rejects impossible OHLC ranges', () => {
  const normalizer = fs.readFileSync(path.resolve(root, '../frontend/src/lib/klineData.ts'), 'utf8');
  assert.ok(normalizer.includes('high < Math.max(open, close, low)'));
  assert.ok(normalizer.includes('low > Math.min(open, close, high)'));
  assert.ok(normalizer.includes('source: typeof candle.source === "string" ? candle.source : fallbackSource'));
  assert.ok(api.includes('normalizeKlines(payload.klines, payload.source)'));
  assert.ok(!pages.includes('candles[candles.length-1]?.source'), 'chart provider source must stay internal');
  assert.ok(pages.includes('setCandles([]);setChartFeedWarning(t("Chart data is temporarily unavailable."))'));
  assert.ok(!pages.includes("showing the last confirmed candles"));
});

test('legacy market and depth polling suppress overlapping requests and never retain failed snapshots', () => {
  const appCore = fs.readFileSync(path.join(root, 'assets/js/app-core.js'), 'utf8');
  const tradeView = fs.readFileSync(path.join(root, 'assets/js/views-trade.js'), 'utf8');
  const marketStart = appCore.indexOf('async function refreshMarket()');
  const depthStart = appCore.indexOf('async function refreshDepth()', marketStart);
  const adapterStart = appCore.indexOf('/* ---------- apiAdapter', depthStart);
  assert.ok(marketStart >= 0 && depthStart > marketStart && adapterStart > depthStart);
  const market = appCore.slice(marketStart, depthStart);
  const depth = appCore.slice(depthStart, adapterStart);
  assert.ok(market.includes('if(state.marketRefreshInFlight) return;'));
  assert.ok(market.includes('state.marketRefreshInFlight=true;'));
  assert.ok(market.includes('state.marketRefreshInFlight=false;'));
  assert.ok(market.includes('clearMarketQuotes();updateLivePriceEls();'));
  assert.ok(market.includes('catch{'));
  assert.ok(depth.includes('if(!sym||state.depthRefreshInFlight) return;'));
  assert.ok(depth.includes('state.depthRefreshInFlight=false;'));
  assert.ok(depth.includes('if(state.currentPair!==sym)return;'));
  assert.ok(depth.includes('state.depthUnavailable=true;'));
  assert.ok(depth.includes('state.depthCache=null;'));
  assert.ok(tradeView.includes("state.depthUnavailable?'Order book unavailable"));
});
