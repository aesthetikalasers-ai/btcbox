'use strict';
/**
 * BTCBOX public-market gateway.
 *
 * Single place that talks to public exchange APIs and normalises every response
 * into the exact JSON shape `frontend/src/lib/api.ts` already parses. The
 * frontend performs no provider-specific logic, so switching a provider (or a
 * whole region) never touches rendering code.
 *
 * Provider selection is ordered and environment-driven:
 *   MARKET_PROVIDER_ORDER=binance-vision,binance-us,coinbase
 *
 * Why ordered + fallback:
 *   - Local development: only data-api.binance.vision is reachable here, and it
 *     serves /api/v3/klines, /api/v3/ticker/24hr and /api/v3/depth publicly.
 *   - Vercel (North America): the international api.binance.com often answers
 *     451 for US egress, so binance.us / Coinbase are tried first there.
 *
 * This module never fabricates data. If no provider answers, it returns an
 * explicit unavailable payload and the UI shows its honest error state.
 */

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];

/** Provider descriptors. `id` is what callers put in MARKET_PROVIDER_ORDER. */
const PROVIDERS = {
  'binance-vision': {
    base: 'https://data-api.binance.vision',
    // Public data endpoint, no API key, not geo-locked for US egress.
    supports: ['market', 'kline', 'depth'],
    mapSymbol: (base) => `${base}USDT`,
  },
  'binance-us': {
    base: 'https://api.binance.us',
    // US-regulated host; avoids the 451 returned by the international site.
    supports: ['market', 'kline', 'depth'],
    mapSymbol: (base) => `${base}USDT`,
  },
  coinbase: {
    base: 'https://api.exchange.coinbase.com',
    // Coinbase has no public REST depth/kline in this shape, so it is used for
    // tickers only; kline/depth fall through to the next capable provider.
    supports: ['market'],
    mapSymbol: (base) => `${base}-USDT`,
  },
};

/** Intervals the UI offers. Anything else is rejected, never silently coerced. */
const KLINE_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w']);

/** Cached upstream reads so a busy UI cannot exhaust provider rate limits. */
const CACHE = new Map();

function providerOrder() {
  const raw = process.env.MARKET_PROVIDER_ORDER;
  const list = (raw ? raw.split(',') : ['binance-vision', 'binance-us', 'coinbase'])
    .map((s) => s.trim())
    .filter((s) => s && PROVIDERS[s]);
  return list.length ? list : ['binance-vision'];
}

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'btcbox-market-gateway/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function cached(key, ttlMs, producer) {
  const hit = CACHE.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.promise;
  const promise = producer().catch((error) => {
    CACHE.delete(key); // never cache a failure
    throw error;
  });
  CACHE.set(key, { at: now, promise });
  return promise;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------------- *
 * Provider-specific readers. Each returns the normalised shape or throws.
 * ------------------------------------------------------------------------- */

function providerId(provider) {
  return Object.keys(PROVIDERS).find((k) => PROVIDERS[k] === provider) || 'unknown';
}

async function binanceMarket(provider, bases, timeoutMs) {
  const symbols = bases.map(provider.mapSymbol);
  const url = `${provider.base}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const rows = await fetchJson(url, timeoutMs);
  if (!Array.isArray(rows)) throw new Error('invalid ticker payload');

  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  const now = Math.floor(Date.now() / 1000);
  const source = providerId(provider);
  const markets = [];
  const data = {};

  for (const base of bases) {
    const row = bySymbol.get(provider.mapSymbol(base));
    if (!row) continue;
    const price = num(row.lastPrice);
    const high = num(row.highPrice);
    const low = num(row.lowPrice);
    const chg = num(row.priceChangePercent);
    const vol = num(row.quoteVolume);
    // Reject incomplete rows instead of letting NaN reach the UI.
    if (!(price > 0) || !(high > 0) || !(low > 0) || chg === null || vol === null) continue;
    const closeTime = num(row.closeTime);
    const providerTs = closeTime ? Math.floor(closeTime / 1000) : now;
    markets.push({ sym: base, price, chg, high, low, vol: String(vol), source });
    data[base] = { price, chg, high, low, vol, ts: now, providerTs, source };
  }

  if (!markets.length) throw new Error('no usable ticker rows');
  return { ok: true, markets, data, source };
}

async function coinbaseMarket(provider, bases, timeoutMs) {
  const products = await fetchJson(`${provider.base}/products`, timeoutMs);
  if (!Array.isArray(products)) throw new Error('invalid Coinbase product list');
  const tradable = new Set(
    products
      .filter((p) => p && p.quote_currency === 'USDT' && p.status === 'online' && p.trading_disabled !== true)
      .map((p) => p.id),
  );

  const now = Math.floor(Date.now() / 1000);
  const markets = [];
  const data = {};

  await Promise.all(
    bases.map(async (base) => {
      const id = provider.mapSymbol(base);
      if (!tradable.has(id)) return;
      try {
        const [ticker, stats] = await Promise.all([
          fetchJson(`${provider.base}/products/${id}/ticker`, timeoutMs),
          fetchJson(`${provider.base}/products/${id}/stats`, timeoutMs),
        ]);
        const price = num(ticker.price);
        const open = num(stats.open);
        const high = num(stats.high);
        const low = num(stats.low);
        const baseVol = num(stats.volume);
        if (!(price > 0) || !(open > 0) || !(high > 0) || !(low > 0) || baseVol === null) return;
        const chg = ((price - open) / open) * 100;
        const vol = baseVol * price;
        const providerTs = typeof ticker.time === 'string' ? Math.floor(Date.parse(ticker.time) / 1000) : now;
        markets.push({ sym: base, price, chg, high, low, vol: String(vol), source: 'coinbase' });
        data[base] = { price, chg, high, low, vol, ts: now, providerTs, source: 'coinbase' };
      } catch {
        /* one bad product must not sink the whole snapshot */
      }
    }),
  );

  if (!markets.length) throw new Error('no usable Coinbase rows');
  markets.sort((a, b) => bases.indexOf(a.sym) - bases.indexOf(b.sym));
  return { ok: true, markets, data, source: 'coinbase' };
}

async function binanceKlines(provider, symbol, interval, limit, timeoutMs) {
  if (!KLINE_INTERVALS.has(interval)) throw new Error(`unsupported interval ${interval}`);
  const url = `${provider.base}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const rows = await fetchJson(url, timeoutMs);
  if (!Array.isArray(rows) || !rows.length) throw new Error('invalid kline payload');

  const klines = rows
    .map((r) => {
      const time = num(r[0]);
      const open = num(r[1]);
      const high = num(r[2]);
      const low = num(r[3]);
      const close = num(r[4]);
      const volume = num(r[5]);
      if (time === null || !(open > 0) || !(high > 0) || !(low > 0) || !(close > 0) || volume === null) return null;
      // Same OHLC sanity rule the frontend enforces.
      if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return null;
      return { time, open, high, low, close, volume };
    })
    .filter(Boolean);

  if (!klines.length) throw new Error('no valid candles');
  return { ok: true, klines, source: providerId(provider) };
}

async function binanceDepth(provider, symbol, limit, timeoutMs) {
  const url = `${provider.base}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
  const payload = await fetchJson(url, timeoutMs);
  if (!payload || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) {
    throw new Error('invalid depth payload');
  }
  const clean = (rows) =>
    rows
      .filter((r) => Array.isArray(r) && r.length >= 2 && Number(r[0]) > 0 && Number(r[1]) > 0)
      .map((r) => [String(r[0]), String(r[1])]);
  const bids = clean(payload.bids);
  const asks = clean(payload.asks);
  if (!bids.length || !asks.length) throw new Error('empty depth book');
  return {
    ok: true,
    bids,
    asks,
    snapshotTs: Math.floor(Date.now() / 1000),
    source: providerId(provider),
  };
}

/* ------------------------------------------------------------------------- *
 * Public API — every entry point returns the frontend's normalised shape.
 * ------------------------------------------------------------------------- */

async function getMarket({ symbols = DEFAULT_SYMBOLS, timeoutMs = 6000 } = {}) {
  const bases = symbols.map((s) => String(s).toUpperCase().replace(/USDT$/, ''));
  let lastError = null;

  for (const id of providerOrder()) {
    const provider = PROVIDERS[id];
    if (!provider.supports.includes('market')) continue;
    const reader = id === 'coinbase' ? coinbaseMarket : binanceMarket;
    try {
      return await cached(`market:${id}:${bases.join(',')}`, 1500, () =>
        reader(provider, bases, timeoutMs),
      );
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    code: 'MARKET_DATA_UNAVAILABLE',
    msg: lastError ? String(lastError.message || lastError) : 'Market data unavailable.',
    source: 'unavailable',
  };
}

async function getKlines({ symbol = 'BTCUSDT', interval = '1h', limit = 300, timeoutMs = 6000 } = {}) {
  const sym = String(symbol).toUpperCase().replace('-', '');
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  const safeInterval = KLINE_INTERVALS.has(interval) ? interval : '1h';
  let lastError = null;

  for (const id of providerOrder()) {
    const provider = PROVIDERS[id];
    if (!provider.supports.includes('kline')) continue;
    try {
      return await cached(`kline:${id}:${sym}:${safeInterval}:${safeLimit}`, 5000, () =>
        binanceKlines(provider, sym, safeInterval, safeLimit, timeoutMs),
      );
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    code: 'KLINE_UNAVAILABLE',
    msg: lastError ? String(lastError.message || lastError) : 'Chart data unavailable.',
    source: 'unavailable',
  };
}

async function getDepth({ symbol = 'BTCUSDT', limit = 100, timeoutMs = 6000 } = {}) {
  const sym = String(symbol).toUpperCase().replace('-', '');
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 5), 500);
  let lastError = null;

  for (const id of providerOrder()) {
    const provider = PROVIDERS[id];
    if (!provider.supports.includes('depth')) continue;
    try {
      return await cached(`depth:${id}:${sym}:${safeLimit}`, 1000, () =>
        binanceDepth(provider, sym, safeLimit, timeoutMs),
      );
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    code: 'DEPTH_UNAVAILABLE',
    msg: lastError ? String(lastError.message || lastError) : 'Order book unavailable.',
    source: 'unavailable',
  };
}

module.exports = { getMarket, getKlines, getDepth, PROVIDERS, DEFAULT_SYMBOLS, KLINE_INTERVALS };

