'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../api-core');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
const normalize = api._test.normalizeReferenceTimestamp;

test('Coinbase ISO ticker time is retained as the settlement event timestamp', () => {
  const now = Date.parse('2026-11-06T12:00:10.000Z');
  assert.equal(normalize('2026-11-06T12:00:08.500Z', now), 1793966408);
});

test('Bybit epoch-millisecond event time is normalized to Unix seconds', () => {
  const now = 1793966410000;
  assert.equal(normalize('1793966408500', now), 1793966408);
});

test('missing, malformed, stale and materially future provider timestamps fail closed', () => {
  const now = 1793966410000;
  assert.equal(normalize(null, now), null);
  assert.equal(normalize('not-a-time', now), null);
  assert.equal(normalize(now - 120001, now), null);
  assert.equal(normalize(now + 5001, now), null);
  assert.equal(normalize(now - 120000, now), 1793966290);
  assert.equal(normalize(now + 5000, now), 1793966415);
});

test('Seconds settlement persists the provider event timestamp, never a fabricated request-time timestamp', () => {
  const start = source.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const end = source.indexOf("// ---------- GET /api/seconds/positions ----------", start);
  assert.ok(start >= 0 && end > start);
  const handler = source.slice(start, end);
  assert.match(handler, /p_settle_price_ts: new Date\(settleRef\.ts \* 1000\)\.toISOString\(\)/);
  assert.doesNotMatch(handler, /p_settle_price_ts: new Date\(\)\.toISOString\(\)/);
  assert.match(source, /normalizeReferenceTimestamp\(ticker && ticker\.time\)/);
  assert.match(source, /normalizeReferenceTimestamp\(payload && payload\.time\)/);
});
