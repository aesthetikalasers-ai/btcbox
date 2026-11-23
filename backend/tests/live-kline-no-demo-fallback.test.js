'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/lib/api.ts'),
  'utf8',
);
const start = source.indexOf('export async function getKlines(');
const end = source.indexOf('export interface TradingStatus', start);
assert.notEqual(start, -1, 'getKlines must exist');
assert.notEqual(end, -1, 'getKlines must end before TradingStatus');
const getKlinesSource = source.slice(start, end);

test('live K-line requests never fall back to synthetic demo candles', () => {
  assert.match(getKlinesSource, /if \(DEMO_PREVIEW_ACTIVE\) return getDemoKlines\(symbol, interval\)/);
  assert.equal(
    (getKlinesSource.match(/getDemoKlines\(symbol, interval\)/g) || []).length,
    1,
    'synthetic candles may only be returned by the explicit demo-preview branch',
  );
  assert.match(getKlinesSource, /payload\\?\\.code \\|\\| "KLINE_DATA_UNAVAILABLE"/);\n  assert.match(getKlinesSource, /normalized\\.length === 0/);\n  assert.match(getKlinesSource, /No verified candle data is available/);\n  assert.match(getKlinesSource, /KLINE_NETWORK_ERROR/);
  assert.doesNotMatch(getKlinesSource, /fall back to demo candles|fall back to demo data/i);
});
