import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKlines } from "../src/lib/klineData.ts";

test("normalizes milliseconds, sorts candles, and keeps the last candle per chart second", () => {
  const rows = normalizeKlines([
    { time: 1_700_000_002_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 1_700_000_000_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 1_700_000_002_500, open: 10, high: 13, low: 9, close: 12, volume: 2, source: "per-candle" },
    { time: -1_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 1_700_000_003_000, open: 10, high: 9, low: 8, close: 11, volume: 1 },
  ], "provider");

  assert.deepEqual(rows.map(row => row.time), [1_700_000_000, 1_700_000_002]);
  assert.equal(rows[1].close, 12);
  assert.equal(rows[1].source, "per-candle");
  assert.equal(rows[0].source, "provider");
});

test("rejects malformed OHLCV rows and never fabricates a candle", () => {
  assert.deepEqual(normalizeKlines([
    { time: 1_700_000_000, open: 0, high: 12, low: 9, close: 11, volume: 1 },
    { time: 1_700_000_001, open: 10, high: 12, low: 9, close: 11, volume: -1 },
    null,
    {},
  ]), []);
});
