'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const apiCore = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');
const start = apiCore.indexOf("// ---------- GET /api/kline (Binance Vision primary, fresh-provider fallback) ----------");
const end = apiCore.indexOf("// ---------- GET /api/depth", start);
assert.ok(start >= 0 && end > start, 'production K-line route must exist');
const route = apiCore.slice(start, end);

test('production K-line route uses Binance Vision for every advertised interval', () => {
  assert.ok(route.includes('https://data-api.binance.vision/api/v3/klines'));
  for (const interval of ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d']) {
    assert.ok(route.includes("'" + interval + "'"), 'interval ' + interval + ' must be supported');
  }
  assert.ok(route.includes("'4h':'240'"), '4h fallback mapping must use Bybit 4-hour candles');
  assert.ok(route.includes("'1d':'D'"), 'daily fallback mapping must use Bybit daily candles');
  assert.ok(route.includes("'&interval=' + encodeURIComponent(interval)"), 'Binance Vision must receive the selected chart interval directly');
});

test('production K-line route rejects stale provider responses instead of returning HTTP 200 with old candles', () => {
  assert.ok(route.includes('const candleSetIsFresh = rows =>'));
  assert.ok(route.includes('ageSeconds <= Math.max(intervalSeconds * 3, 180)'));
  assert.ok(route.includes("if (candleSetIsFresh(normalized)) return candleResponse(normalized, 'binance-vision')"));
  assert.ok(route.includes("if (candleSetIsFresh(normalized)) return candleResponse(normalized, 'coinbase')"));
  assert.ok(route.includes("if (candleSetIsFresh(normalized)) return candleResponse(normalized, 'bybit')"));
  assert.ok(route.includes("code: 'KLINE_DATA_UNAVAILABLE'"));
  assert.ok(route.includes('Fresh K-line data is temporarily unavailable.'));
});

test('production K-line normalization rejects invalid OHLC rows and sorts candles chronologically', () => {
  assert.ok(route.includes('k.high >= Math.max(k.open, k.close, k.low)'));
  assert.ok(route.includes('k.low <= Math.min(k.open, k.close, k.high)'));
  assert.ok(route.includes('.sort((a, b) => a.time - b.time)'));
});
