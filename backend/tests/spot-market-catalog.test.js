'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const api = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

function createSpotCatalogHarness(readSpotMarketCatalog, clock) {
  const sandbox = {
    readSpotMarketCatalog,
    Date: { now: clock },
    DEFAULT_SYMBOLS: ['BTC', 'ETH'],
    PUBLIC_SPOT_CATALOG_CACHE_MAX_AGE_MS: 15 * 60 * 1000,
  };
  vm.createContext(sandbox);
  const start = backend.indexOf('async function readPublicSpotMarketCatalog()');
  const end = backend.indexOf('// Keep this list aligned with spot pair support', start);
  assert.ok(start >= 0 && end > start, 'production catalogue helper must be extractable');
  const productionHelper = backend.slice(start, end);
  vm.runInContext(
    'let lastKnownSpotMarketCatalog = null; let spotMarketCatalogReadGeneration = 0; let lastSuccessfulSpotMarketCatalogReadGeneration = 0; ' +
      productionHelper + '; globalThis.readPublicSpotMarketCatalog = readPublicSpotMarketCatalog;',
    sandbox
  );
  return {
    read: () => sandbox.readPublicSpotMarketCatalog(),
    setReader: reader => { sandbox.readSpotMarketCatalog = reader; },
  };
}

function catalogMarket(baseAsset) {
  return {
    base_asset: baseAsset, quote_asset: 'USDT', enabled: true,
    price_tick: '0.01', quantity_step: '0.001', min_quantity: '0.001',
    min_notional: '1', min_limit_price: null, max_limit_price: null,
  };
}

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
  assert.ok(routeBlock.includes('readPublicSpotMarketCatalog()'));
  assert.ok(!routeBlock.includes('if (!user)'), 'public catalogue must not require a user session');
  assert.ok(routeBlock.includes('catalog_source'));
  assert.ok(backend.includes('async function readPublicSpotMarketCatalog()'));
  assert.ok(backend.includes("const source = useCached ? 'stale-cache' : 'static-fallback'"));
  assert.ok(backend.includes('PUBLIC_SPOT_CATALOG_CACHE_MAX_AGE_MS'));
  assert.ok(backend.includes('DEFAULT_SYMBOLS.map'));
  assert.ok(backend.includes('trading_enabled: false'), 'degraded catalogue pairs must be display-only');
  assert.ok(routeBlock.includes('markets: catalog.markets'));
  const catalogHelper = backend.slice(backend.indexOf('async function readPublicSpotMarketCatalog()'), backend.indexOf('// Keep this list aligned with spot pair support'));
  assert.ok(catalogHelper.includes("const source = useCached ? 'stale-cache' : 'static-fallback'"));
  assert.ok(catalogHelper.includes('tradingEnabled: false'), 'all degraded catalogue responses must disable trading');
  assert.ok(catalogHelper.includes('trading_enabled: false'), 'degraded pairs must be explicitly read-only');
  assert.ok(catalogHelper.includes('cached.markets'), 'a recent validated catalogue may be reused for display');
  assert.ok(catalogHelper.includes('DEFAULT_SYMBOLS.map'), 'cold starts must have a bounded provider-independent display fallback');
  assert.ok(catalogHelper.includes('Date.now() - cached.fetchedAt <= PUBLIC_SPOT_CATALOG_CACHE_MAX_AGE_MS'), 'stale cache must expire instead of becoming durable configuration');
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
  assert.ok(backend.slice(marketStart, marketStart + 9000).includes('readPublicSpotMarketCatalog()'));
  assert.ok(backend.slice(marketStart, marketStart + 9000).includes('configured_empty'));
  assert.ok(backend.slice(klineStart, klineStart + 5000).includes('readPublicSpotMarketCatalog()'));
  assert.ok(backend.slice(klineStart, klineStart + 5000).includes('SPOT_MARKET_DISABLED'));
  assert.ok(backend.slice(depthStart, depthStart + 3000).includes('readPublicSpotMarketCatalog()'));
  assert.ok(backend.slice(depthStart, depthStart + 3000).includes('SPOT_MARKET_DISABLED'));
});

test('user Trade Hub links only to configured pairs and Spot order submission checks the active pair', () => {
  assert.ok(api.includes('export async function getSpotMarketPairs'));
  assert.ok(api.includes('${API_BASE_URL}/market/pairs'));
  assert.ok(pages.includes('getSpotMarketPairs(controller.signal)'));
  assert.ok(pages.includes('pair.base_asset+pair.quote_asset'));
  assert.ok(pages.includes('pair.base_asset===base&&pair.quote_asset==="USDT"'));
  assert.ok(api.includes('trading_enabled?: boolean'));
  assert.ok(pages.includes('pair.trading_enabled!==false'));
  assert.ok(pages.includes('spotCatalogDegraded'));
  assert.ok(pages.includes('if(spotCatalogDegraded&&!pendingIntent)'));
  assert.ok(pages.includes('if(!spotPairEnabled&&!pendingIntent)'));
  assert.ok(pages.includes('(!spotPairEnabled&&!pendingIntent)'));
  assert.ok(pages.includes('setSpotPairEnabled(false);setSpotCatalogDegraded(false);setSpotPairRules(null);setTradingStatus(null)'));
  assert.ok(pages.includes('(!spotPairEnabled&&!pendingIntent)||(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent)'));
});


test('Bybit fallback rejects missing, stale, and implausibly future response timestamps', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  const klineStart = backend.indexOf("if (path === 'kline' && method === 'GET')", marketStart);
  const route = backend.slice(marketStart, klineStart);
  const bybitStart = route.indexOf("const missingBases = bases.filter");
  const bybitEnd = route.indexOf("const snapshotTs =", bybitStart);
  const fallback = route.slice(bybitStart, bybitEnd);
  assert.ok(fallback.includes("providerTs === null || providerTs > now + 15 || now - providerTs > 60"));
  assert.ok(fallback.indexOf('providerTs === null') < fallback.indexOf('normalize(base'));
  // Coinbase's timestamp is last-trade time, not response time; do not apply
  // the Bybit response-age gate to it because quiet markets can have old trades.
  const coinbase = route.slice(0, bybitStart);
  assert.ok(coinbase.includes("Date.parse(ticker.time) / 1000"));
  assert.ok(!coinbase.includes('now - providerTs > 60'));
});

test('market timestamps distinguish server snapshot time from provider-specific timestamps', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  const klineStart = backend.indexOf("if (path === 'kline' && method === 'GET')", marketStart);
  const route = backend.slice(marketStart, klineStart);
  assert.ok(route.includes("Date.parse(ticker.time) / 1000"), 'Coinbase timestamp is the last-trade timestamp');
  assert.ok(route.includes("const providerTimeMs = Number(payload.time)"), 'Bybit timestamp is the provider response timestamp');
  assert.ok(route.includes('providerTs'));
  assert.ok(route.includes('const snapshotTs = Math.floor(Date.now() / 1000)'), 'server snapshot time is generated after provider responses');
  assert.ok(route.includes('ts: snapshotTs, providerTs: marketsByBase[row.sym].providerTs'));
  assert.ok(api.includes('Server snapshot time (Unix seconds), not an exchange event timestamp.'));
  assert.ok(api.includes('never synthesized by the browser.'));
});

test('public ticker snapshots use a short shared-cache window and clients bypass browser cache', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  assert.ok(marketStart >= 0);
  const routeEnd = backend.indexOf('// Public capability snapshot', marketStart);
  const route = backend.slice(marketStart, routeEnd);
  assert.ok(route.includes("'Cache-Control': 'public, max-age=0, s-maxage=2, stale-while-revalidate=1'"));
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

test('public catalogue recovers to database authority and degrades safely after a later outage', async () => {
  let now = 1_000;
  const harness = createSpotCatalogHarness(async () => { throw new Error('database unavailable'); }, () => now);

  const coldFallback = await harness.read();
  assert.equal(coldFallback.source, 'static-fallback');
  assert.equal(coldFallback.tradingEnabled, false);

  harness.setReader(async () => [catalogMarket('BTC')]);
  const recovered = await harness.read();
  assert.equal(recovered.source, 'database');
  assert.equal(recovered.tradingEnabled, true);
  assert.deepEqual(recovered.markets.map(market => market.base_asset), ['BTC']);
  assert.equal(recovered.markets[0].trading_enabled, true);

  harness.setReader(async () => { throw new Error('database unavailable again'); });
  const outage = await harness.read();
  assert.equal(outage.source, 'stale-cache');
  assert.equal(outage.tradingEnabled, false);
  assert.deepEqual(outage.markets.map(market => market.base_asset), ['BTC']);
  assert.equal(outage.markets[0].trading_enabled, false);

  now += 15 * 60 * 1000 + 1;
  const expired = await harness.read();
  assert.equal(expired.source, 'static-fallback');
  assert.equal(expired.tradingEnabled, false);
  assert.deepEqual(expired.markets.map(market => market.base_asset), ['BTC', 'ETH']);
});

test('an older concurrent database response cannot overwrite a newer successful catalogue', async () => {
  let resolveOlder;
  let resolveNewer;
  let requestCount = 0;
  const harness = createSpotCatalogHarness(() => new Promise(resolve => {
    requestCount += 1;
    if (requestCount === 1) resolveOlder = resolve;
    else resolveNewer = resolve;
  }), () => 5_000);

  const olderRequest = harness.read();
  const newerRequest = harness.read();
  assert.equal(requestCount, 2);

  resolveNewer([catalogMarket('ETH')]);
  const newerResult = await newerRequest;
  assert.deepEqual(newerResult.markets.map(market => market.base_asset), ['ETH']);

  resolveOlder([catalogMarket('BTC')]);
  const olderResult = await olderRequest;
  assert.deepEqual(olderResult.markets.map(market => market.base_asset), ['ETH']);

  harness.setReader(async () => { throw new Error('database unavailable'); });
  const afterOutage = await harness.read();
  assert.equal(afterOutage.source, 'stale-cache');
  assert.deepEqual(afterOutage.markets.map(market => market.base_asset), ['ETH']);
});
