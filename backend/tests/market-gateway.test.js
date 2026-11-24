'use strict';
/**
 * Tests for the public-market gateway.
 *
 * Network access is stubbed so the suite is deterministic and offline-safe: it
 * verifies the normalisation contract the frontend depends on (field names,
 * types, ordering, sanity filtering) rather than live provider availability.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// The gateway caches per module instance, so each test reloads a fresh copy.
function freshGateway(env = {}) {
  const modulePath = require.resolve('../market-gateway');
  delete require.cache[modulePath];
  const restore = [];
  for (const [key, value] of Object.entries(env)) {
    restore.push([key, process.env[key]]);
    process.env[key] = value;
  }
  const gw = require(modulePath);
  for (const [key, previous] of restore) {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
  return gw;
}

function stubFetch(handler) {
  const original = global.fetch;
  global.fetch = handler;
  return () => {
    global.fetch = original;
  };
}

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

const TICKER_ROWS = [
  {
    symbol: 'BTCUSDT',
    lastPrice: '64200.10',
    highPrice: '65447.00',
    lowPrice: '63336.00',
    priceChangePercent: '-1.02',
    quoteVolume: '1286341428.69',
    closeTime: 1763500000000,
  },
  {
    symbol: 'ETHUSDT',
    lastPrice: '1802.22',
    highPrice: '1836.00',
    lowPrice: '1780.00',
    priceChangePercent: '0.55',
    quoteVolume: '482300000.00',
    closeTime: 1763500000000,
  },
];

test('getMarket returns the normalised ticker shape the frontend parses', async () => {
  const restore = stubFetch(async (url) => {
    assert.ok(String(url).includes('/api/v3/ticker/24hr'));
    return jsonResponse(TICKER_ROWS);
  });
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const snapshot = await gw.getMarket({ symbols: ['BTC', 'ETH'] });

    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.source, 'binance-vision');
    assert.equal(snapshot.markets.length, 2);

    const btc = snapshot.markets[0];
    assert.equal(btc.sym, 'BTC');
    assert.equal(btc.price, 64200.1);
    assert.equal(btc.chg, -1.02);
    assert.equal(btc.high, 65447);
    assert.equal(btc.low, 63336);
    // `vol` is a string: the UI renders it as text and never does math on it.
    assert.equal(typeof btc.vol, 'string');
    assert.equal(btc.source, 'binance-vision');

    assert.equal(snapshot.data.BTC.price, 64200.1);
    assert.equal(typeof snapshot.data.BTC.ts, 'number');
    assert.ok(snapshot.data.BTC.providerTs > 0);
  } finally {
    restore();
  }
});

test('getMarket drops rows with invalid numbers instead of emitting NaN', async () => {
  const restore = stubFetch(async () =>
    jsonResponse([
      ...TICKER_ROWS,
      { symbol: 'SOLUSDT', lastPrice: 'abc', highPrice: '0', lowPrice: '0', priceChangePercent: '1', quoteVolume: '1' },
    ]),
  );
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const snapshot = await gw.getMarket({ symbols: ['BTC', 'SOL'] });
    assert.equal(snapshot.ok, true);
    assert.deepEqual(snapshot.markets.map((m) => m.sym), ['BTC']);
    for (const row of snapshot.markets) {
      for (const key of ['price', 'chg', 'high', 'low']) {
        assert.ok(Number.isFinite(row[key]), `${key} must be finite`);
      }
    }
  } finally {
    restore();
  }
});

test('provider order falls back when the first provider fails', async () => {
  const seen = [];
  const restore = stubFetch(async (url) => {
    const href = String(url);
    seen.push(href);
    if (href.includes('data-api.binance.vision')) throw new Error('geo blocked');
    return jsonResponse(TICKER_ROWS);
  });
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision,binance-us' });
    const snapshot = await gw.getMarket({ symbols: ['BTC'] });
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.source, 'binance-us');
    assert.ok(seen.some((u) => u.includes('data-api.binance.vision')));
    assert.ok(seen.some((u) => u.includes('api.binance.us')));
  } finally {
    restore();
  }
});

test('partial primary coverage is merged with the batched Bybit fallback without replacing primary rows', async () => {
  const now = Date.now();
  const primary = [{ ...TICKER_ROWS[0], closeTime: now }];
  const bybitRows = [
    { symbol: 'BTCUSDT', lastPrice: '64201', highPrice24h: '65447', lowPrice24h: '63336', price24hPcnt: '-0.0102', turnover24h: '1286341428.69' },
    { symbol: 'ETHUSDT', lastPrice: '1803', highPrice24h: '1836', lowPrice24h: '1780', price24hPcnt: '0.0055', turnover24h: '482300000.00' },
  ];
  const restore = stubFetch(async (url) => {
    const href = String(url);
    if (href.includes('data-api.binance.vision')) return jsonResponse(primary);
    if (href.includes('api.bybit.com/v5/market/tickers')) return jsonResponse({ time: now, result: { list: bybitRows } });
    throw new Error('unexpected provider request');
  });
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision,bybit' });
    const snapshot = await gw.getMarket({ symbols: ['BTC', 'ETH'] });
    assert.equal(snapshot.ok, true);
    assert.deepEqual(snapshot.markets.map((row) => row.sym), ['BTC', 'ETH']);
    assert.equal(snapshot.markets[0].source, 'binance-vision');
    assert.equal(snapshot.markets[1].source, 'bybit');
    assert.ok(snapshot.data.ETH.providerTs > 0);
  } finally {
    restore();
  }
});

test('Bybit market fallback rejects missing, stale and future response timestamps', async () => {
  const now = Date.now();
  for (const time of [undefined, now - 120_000, now + 60_000]) {
    const restore = stubFetch(async () => jsonResponse({
      ...(time === undefined ? {} : { time }),
      result: { list: [{ symbol: 'BTCUSDT', lastPrice: '64200', highPrice24h: '65447', lowPrice24h: '63336', price24hPcnt: '0.01', turnover24h: '10' }] },
    }));
    try {
      const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'bybit' });
      const snapshot = await gw.getMarket({ symbols: ['BTC'] });
      assert.equal(snapshot.ok, false);
      assert.equal(snapshot.code, 'MARKET_DATA_UNAVAILABLE');
    } finally {
      restore();
    }
  }
});

test('an unavailable provider yields an explicit failure, never synthetic prices', async () => {
  const restore = stubFetch(async () => {
    throw new Error('network down');
  });
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const snapshot = await gw.getMarket({ symbols: ['BTC'] });
    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.code, 'MARKET_DATA_UNAVAILABLE');
    assert.equal(snapshot.markets, undefined);
  } finally {
    restore();
  }
});


test('getKlines normalises candles and rejects impossible OHLC ranges', async () => {
  const restore = stubFetch(async () =>
    jsonResponse([
      [1763500000000, '64000', '64200', '63900', '64100', '12.5'],
      // high below close -> must be dropped
      [1763503600000, '64100', '64050', '63900', '64100', '8.1'],
      [1763507200000, '64100', '64500', '64000', '64400', '9.9'],
    ]),
  );
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const result = await gw.getKlines({ symbol: 'BTCUSDT', interval: '1h', limit: 3 });

    assert.equal(result.ok, true);
    assert.equal(result.klines.length, 2, 'the impossible candle is filtered out');
    for (const candle of result.klines) {
      assert.ok(candle.high >= Math.max(candle.open, candle.close, candle.low));
      assert.ok(candle.low <= Math.min(candle.open, candle.close, candle.high));
      assert.equal(typeof candle.time, 'number');
      assert.equal(typeof candle.volume, 'number');
    }
  } finally {
    restore();
  }
});

test('getKlines coerces an unknown interval to the safe default', async () => {
  const restore = stubFetch(async (url) => {
    assert.ok(String(url).includes('interval=1h'), 'unknown interval must fall back to 1h');
    return jsonResponse([[1763500000000, '64000', '64200', '63900', '64100', '12.5']]);
  });
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const result = await gw.getKlines({ symbol: 'BTCUSDT', interval: '7x' });
    assert.equal(result.ok, true);
  } finally {
    restore();
  }
});

test('getDepth returns string price/size pairs with a snapshot timestamp', async () => {
  const restore = stubFetch(async () =>
    jsonResponse({
      lastUpdateId: 1,
      bids: [['64199.99', '0.5'], ['64199.00', '1.2'], ['0', '5']],
      asks: [['64200.01', '0.4'], ['64201.00', '0.9']],
    }),
  );
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const book = await gw.getDepth({ symbol: 'BTCUSDT' });

    assert.equal(book.ok, true);
    assert.equal(book.source, 'binance-vision');
    assert.equal(typeof book.snapshotTs, 'number');
    // The zero-price level is dropped; the rest stay as strings.
    assert.deepEqual(book.bids, [['64199.99', '0.5'], ['64199.00', '1.2']]);
    assert.deepEqual(book.asks, [['64200.01', '0.4'], ['64201.00', '0.9']]);
  } finally {
    restore();
  }
});

test('getDepth refuses to return a half-empty book', async () => {
  const restore = stubFetch(async () => jsonResponse({ bids: [], asks: [['64200.01', '1']] }));
  try {
    const gw = freshGateway({ MARKET_PROVIDER_ORDER: 'binance-vision' });
    const book = await gw.getDepth({ symbol: 'BTCUSDT' });
    assert.equal(book.ok, false);
    assert.equal(book.code, 'DEPTH_UNAVAILABLE');
    assert.equal(book.bids, undefined);
  } finally {
    restore();
  }
});

test('every provider declares which endpoints it can serve', () => {
  const gw = freshGateway();
  assert.deepEqual(gw.PROVIDERS['binance-vision'].supports, ['market', 'kline', 'depth']);
  assert.deepEqual(gw.PROVIDERS['binance-us'].supports, ['market', 'kline', 'depth']);
  // Coinbase provides tickers only; kline/depth must fall through to a capable host.
  assert.deepEqual(gw.PROVIDERS.coinbase.supports, ['market']);
});

