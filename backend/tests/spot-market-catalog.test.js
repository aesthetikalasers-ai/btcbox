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
  assert.ok(api.includes('not a universal exchange-event timestamp.'));
});

test('public ticker snapshots use a short shared-cache window and clients bypass browser cache', () => {
  const marketStart = backend.indexOf("if (path === 'market' && method === 'GET')");
  assert.ok(marketStart >= 0);
  const route = backend.slice(marketStart, marketStart + 9000);
  assert.ok(route.includes("'Cache-Control': 'public, max-age=0, s-maxage=2, stale-while-revalidate=1'"));
  assert.ok(api.includes('cache: "no-store"'));
  assert.ok(pages.includes('window.setInterval(refreshMarketData,15000)'));
});

test('order book snapshots normalize provider levels and expose source-specific freshness', () => {
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
  assert.ok(pages.includes('t("Ticker")}: {displayTicker?.source||"—"}'));
  assert.ok(pages.includes('const marketSnapshotStale=!!ticker&&(!marketUpdatedAt||marketClockNow-marketUpdatedAt>90_000)'));
  assert.ok(pages.includes('(!ticker||marketSnapshotStale)&&!pendingIntent'));
  assert.ok(pages.includes('const orderBookSnapshotStale=!!book&&(!book.snapshotTs||marketClockNow-book.snapshotTs*1000>90_000)'));
  assert.ok(pages.includes('const displayBook=orderBookSnapshotStale?null:book'));
  assert.ok(pages.includes('t("Order book")}: {displayBook?.source||"—"}'));
});

test('spot chart preserves provider provenance and rejects impossible OHLC ranges', () => {
  assert.ok(api.includes('candle.high >= Math.max(candle.open, candle.close, candle.low)'));
  assert.ok(api.includes('candle.low <= Math.min(candle.open, candle.close, candle.high)'));
  assert.ok(api.includes('source: typeof payload.source === "string" ? payload.source : undefined'));
  assert.ok(pages.includes('t("Chart")}: {candles[0]?.source||"—"}'));
  assert.ok(pages.includes('setCandles([]);setChartFeedWarning("Chart data is temporarily unavailable.")'));
  assert.ok(!pages.includes("showing the last confirmed candles"));
});
