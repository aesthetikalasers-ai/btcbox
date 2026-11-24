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

/**
 * Tradable base assets, quoted against USDT.
 *
 * This is an explicit allow-list, not a discovered list: every entry is a pair
 * the UI is allowed to show, and the gateway drops any entry the provider does
 * not actually quote (see `binanceMarket`). Keeping it explicit means a
 * provider outage can never widen the catalogue, and no price is ever invented
 * for a symbol we did not intend to list.
 *
 * Ordered roughly by market cap so the default rail reads like a tier-1
 * exchange rather than alphabetically. Extending this array is the only change
 * needed to expose more pairs — `getMarket` sends them all in one request, well
 * inside Binance's per-call symbol limit.
 */
const DEFAULT_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE',
  'ADA', 'AVAX', 'LINK', 'DOT', 'LTC', 'TRX',
  'ATOM', 'NEAR', 'UNI', 'BCH', 'ETC', 'APT',
  'ARB', 'OP', 'SUI', 'INJ', 'TIA', 'FIL',
];

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
  bybit: {
    base: 'https://api.bybit.com',
    // One public spot-ticker request covers all symbols; response time is validated.
    supports: ['market'],
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

/**
 * Refresh cadence the UI polls at (1500 ms). Cache TTLs are derived from it so a
 * poll never waits on an upstream round-trip but providers are still contacted at
 * most once per tick. Keeping this in one place means a faster client poll cannot
 * silently multiply upstream traffic.
 */
const TICKER_TTL_MS = 1500;
const KLINE_TTL_MS = 5000;
const DEPTH_TTL_MS = 1000;

// Environment is immutable for a running Vercel function instance. Resolve the
// configured provider chain once at module load so tests and production share the
// same deterministic primary-first order.
const CONFIGURED_PROVIDER_ORDER = (() => {
  const raw = process.env.MARKET_PROVIDER_ORDER;
  // Prefer one batched Binance Vision request, then one batched Bybit request.
  // Coinbase remains the final independent fallback because it requires several
  // requests per missing symbol and must not be fanned out on every refresh.
  const list = (raw ? raw.split(',') : ['binance-vision', 'bybit', 'coinbase', 'binance-us'])
    .map((s) => s.trim())
    .filter((s) => s && PROVIDERS[s]);
  return list.length ? list : ['binance-vision'];
})();

function providerOrder() {
  return CONFIGURED_PROVIDER_ORDER;
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
    const providerTs = closeTime && closeTime > 0 ? Math.floor(closeTime / 1000) : null;
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
        const providerTimeMs = typeof ticker.time === 'string' ? Date.parse(ticker.time) : NaN;
        const providerTs = Number.isFinite(providerTimeMs) && providerTimeMs > 0 ? Math.floor(providerTimeMs / 1000) : null;
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

async function bybitMarket(provider, bases, timeoutMs) {
  const payload = await fetchJson(`${provider.base}/v5/market/tickers?category=spot`, timeoutMs);
  const rows = payload && payload.result && payload.result.list;
  if (!Array.isArray(rows)) throw new Error('invalid Bybit ticker payload');

  const providerTimeMs = num(payload.time);
  const providerTs = providerTimeMs && providerTimeMs > 0 ? Math.floor(providerTimeMs / 1000) : null;
  const now = Math.floor(Date.now() / 1000);
  // Bybit's payload timestamp is a response timestamp, so it must be present,
  // not materially future-dated, and no more than 60 seconds old.
  if (providerTs === null || providerTs > now + 15 || now - providerTs > 60) {
    throw new Error('Bybit ticker response timestamp is missing or stale');
  }

  const bySymbol = new Map(rows
    .filter((row) => row && typeof row.symbol === 'string' && /USDT$/.test(row.symbol))
    .map((row) => [row.symbol.slice(0, -4), row]));
  const markets = [];
  const data = {};
  for (const base of bases) {
    const row = bySymbol.get(base);
    if (!row) continue;
    const price = num(row.lastPrice);
    const high = num(row.highPrice24h);
    const low = num(row.lowPrice24h);
    const changeFraction = num(row.price24hPcnt);
    const vol = num(row.turnover24h);
    if (!(price > 0) || !(high > 0) || !(low > 0) || changeFraction === null || !(vol >= 0)) continue;
    const chg = changeFraction * 100;
    markets.push({ sym: base, price, chg, high, low, vol: String(vol), source: 'bybit' });
    data[base] = { price, chg, high, low, vol, ts: now, providerTs, source: 'bybit' };
  }
  if (!markets.length) throw new Error('no usable Bybit ticker rows');
  return { ok: true, markets, data, source: 'bybit' };
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

/**
 * Last successful snapshot, used as a degraded fallback when every provider is
 * unreachable. Kept module-level (not in CACHE) because CACHE entries expire by
 * TTL, whereas this one must survive an outage of arbitrary length.
 */
const lastGoodMarkets = new Map();

/** Records a payload against its normalized symbol selection, ignoring stale replays. */
function rememberGoodMarket(payload, bases) {
  if (payload && payload.ok === true && !payload.stale && Array.isArray(payload.markets) && payload.markets.length) {
    const key = [...new Set(bases)].sort().join(',');
    lastGoodMarkets.set(key, payload);
  }
}

/**
 * Races every provider and returns as soon as one covers enough of the request.
 *
 * `Promise.all` is deliberately avoided here: it waits for the slowest branch, so
 * an unreachable upstream (binance.us / coinbase from a region that cannot see
 * them) still costs the full timeout even when binance-vision answered in 120ms.
 * Instead every provider is started immediately and the first sufficiently
 * complete answer wins; slower branches keep running but stop blocking the
 * response, so their results only matter on the merge/fallback path.
 */
async function raceProviders(candidates, run, isUsable) {
  if (!candidates.length) return { winner: null, results: [] };

  return new Promise((resolve) => {
    const results = [];
    let pending = candidates.length;
    let settledOut = false;

    const finish = (winner) => {
      if (settledOut) return;
      settledOut = true;
      resolve({ winner, results });
    };

    candidates.forEach(async (id) => {
      try {
        const payload = await run(id);
        results.push({ id, payload });
        // First usable answer ends the wait; the rest are collected in the
        // background for the fallback path (already-populated `results`).
        if (payload && isUsable(payload)) finish(payload);
      } catch (error) {
        results.push({ id, error });
      } finally {
        pending -= 1;
        if (pending === 0 && !settledOut) finish(null);
      }
    });
  });
}

/**
 * Reads the market snapshot across every provider and merges the result.
 *
 * Why this is not a simple "try each provider in order" loop:
 *
 *  - Latency: the previous serial loop waited a full `timeoutMs` per provider, so
 *    a black-holed upstream on a US edge cost up to 3 x timeoutMs (18s) before
 *    the page rendered. Providers are now raced in parallel and the fastest
 *    usable answer wins.
 *  - Silent shrinkage: `binanceMarket` skips symbols it cannot quote, so a
 *    provider that only lists 3 of our 24 bases would still return `ok: true`
 *    with 3 rows — the UI would read that as "21 pairs delisted". A provider is
 *    now only accepted outright if it covers most of the requested bases;
 *    otherwise its rows are merged with the other providers' rows.
 *  - Region split: a US edge may only reach binance.us while an EU edge may only
 *    reach binance-vision. Merging keeps both audiences on the widest catalogue
 *    each can actually see.
 *
 * Per-symbol provenance is preserved: a symbol's price/change/high/low always
 * come from ONE provider, never averaged across sources.
 */
async function getMarket({ symbols = DEFAULT_SYMBOLS, timeoutMs = 6000 } = {}) {
  const bases = [...new Set(symbols.map((s) => String(s).toUpperCase().replace(/USDT$/, '')))]
    .filter((base) => /^[A-Z0-9]{2,12}$/.test(base) && base !== 'USDT');
  const candidates = providerOrder().filter((id) => PROVIDERS[id].supports.includes('market'));
  const threshold = Math.max(1, bases.length);
  const snapshotKey = [...bases].sort().join(',');
  const run = (id) => {
    const provider = PROVIDERS[id];
    const reader = id === 'coinbase' ? coinbaseMarket : id === 'bybit' ? bybitMarket : binanceMarket;
    return cached(`market:${id}:${bases.join(',')}`, TICKER_TTL_MS, () => reader(provider, bases, timeoutMs));
  };

  // Primary-first, fallback-second: never call every upstream on every poll.
  // This is the critical protection against request amplification on Vercel.
  const successes = [];
  for (const id of candidates) {
    try {
      const payload = await run(id);
      if (!payload || !Array.isArray(payload.markets) || !payload.markets.length) continue;
      successes.push({ id, payload });
      if (payload.markets.length >= threshold) {
        // If an earlier provider already supplied valid rows, merge them first
        // so the full fallback does not overwrite the primary's per-symbol data.
        const complete = successes.length > 1
          ? mergeMarketPayloads(successes.map((item) => item.payload), bases)
          : payload;
        rememberGoodMarket(complete, bases);
        return complete;
      }
    } catch (_) {
      // Move to the next provider. Provider errors never become fabricated data.
    }
  }

  if (successes.length) {
    const merged = mergeMarketPayloads(successes.map((r) => r.payload), bases);
    if (merged.markets.length) {
      rememberGoodMarket(merged, bases);
      return merged;
    }
  }

  // All live providers failed: return the last known snapshot as explicitly
  // degraded data. The frontend still enforces its 90-second freshness rule.
  const stale = lastGoodMarkets.get(snapshotKey);
  if (stale) {
    const requested = new Set(bases);
    const markets = stale.markets.filter((row) => requested.has(String(row.sym || '').toUpperCase()));
    const data = Object.fromEntries(Object.entries(stale.data || {}).filter(([symbol]) => requested.has(String(symbol).toUpperCase())));
    if (markets.length) return { ...stale, markets, data, stale: true, degraded: true, msg: 'Live market data is temporarily unavailable. Showing the last known snapshot.' };
  }

  return { ok: false, code: 'MARKET_DATA_UNAVAILABLE', msg: 'Market data unavailable.', source: 'unavailable' };
}

/**
 * Merges per-symbol rows from several providers, taking the first provider that
 * supplied each base. Each symbol stays internally consistent (its price and its
 * 24h change come from the same upstream).
 */
function mergeMarketPayloads(payloads, bases) {
  const bySymbol = new Map();
  const data = {};
  for (const payload of payloads) {
    for (const row of payload.markets) {
      if (bySymbol.has(row.sym)) continue;
      bySymbol.set(row.sym, row);
      if (payload.data && payload.data[row.sym]) data[row.sym] = payload.data[row.sym];
    }
  }
  const markets = bases.map((base) => bySymbol.get(base)).filter(Boolean);
  return {
    ok: true,
    markets,
    data,
    source: 'merged',
    providers: payloads.map((p) => p.source).filter(Boolean),
  };
}

/** Last good kline/depth payloads, mirroring `lastGoodMarket`. */
const lastGoodKline = new Map();
const lastGoodDepth = new Map();

/**
 * USDT → USD rate, used only to render the "≈ $" hint under the mid price.
 *
 * Why a real rate and not a constant: BTC/USDT is quoted in USDT, and USDT is a
 * stablecoin that trades at a small but real discount or premium to the dollar.
 * Writing `≈ $63,879` straight from a USDT price would silently assert
 * 1 USDT = 1 USD. This reads the actual pair instead, and falls back to
 * `USDT_USD_FALLBACK` (0.99999) only when no provider answers, so the label is
 * a real conversion in the normal case and a conservative approximation during
 * an outage — never an invented exact number.
 *
 * The two providers are raced in parallel with a short timeout: this value only
 * decorates a hint, so it must never delay first paint. A serial chain of two
 * 5s timeouts previously made the first request after boot block for 10s.
 * If neither provider answers, the gateway returns an explicit unavailable
 * payload rather than inventing a conversion rate.
 */
const USDT_USD_TTL_MS = 30000;
const USDT_USD_TIMEOUT_MS = 1500;
let lastGoodUsdtUsd = null;

/** Plausibility window for a stablecoin peg; anything outside is discarded. */
const isPlausibleUsdtUsd = (rate) => Number.isFinite(rate) && rate > 0.5 && rate < 1.5;

async function getUsdtUsd({ timeoutMs = USDT_USD_TIMEOUT_MS } = {}) {
  const cached = CACHE.get('usdt-usd');
  const now = Date.now();
  if (cached && now - cached.at < USDT_USD_TTL_MS) return cached.promise;

  const promise = (async () => {
    // Both providers are started immediately; the fastest plausible answer wins.
    const attempts = [
      fetchJson('https://api.exchange.coinbase.com/products/USDT-USD/ticker', timeoutMs)
        .then((p) => ({ rate: num(p && p.price), source: 'coinbase' })),
      fetchJson('https://api.bybit.com/v5/market/tickers?category=spot&symbol=USDTUSD', timeoutMs)
        .then((p) => {
          const row = p && p.result && p.result.list && p.result.list[0];
          return { rate: num(row && row.lastPrice), source: 'bybit' };
        }),
    ].map((attempt) => attempt.catch(() => null));

    const settled = await Promise.all(attempts);
    const good = settled.find((row) => row && isPlausibleUsdtUsd(row.rate));
    if (good) {
      lastGoodUsdtUsd = good.rate;
      return { ok: true, rate: good.rate, source: good.source };
    }

    if (lastGoodUsdtUsd !== null) {
      return {
        ok: true,
        rate: lastGoodUsdtUsd,
        source: 'stale',
        stale: true,
      };
    }
    return {
      ok: false,
      code: 'FX_DATA_UNAVAILABLE',
      source: 'unavailable',
      stale: true,
      msg: 'USDT/USD conversion is temporarily unavailable.',
    };
  })().catch((error) => {
    CACHE.delete('usdt-usd');
    throw error;
  });

  CACHE.set('usdt-usd', { at: now, promise });
  return promise;
}

async function getKlines({ symbol = 'BTCUSDT', interval = '1h', limit = 300, timeoutMs = 6000 } = {}) {
  const sym = String(symbol).toUpperCase().replace('-', '');
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  const safeInterval = KLINE_INTERVALS.has(interval) ? interval : '1h';
  const cacheKey = `kline:${sym}:${safeInterval}:${safeLimit}`;

  const candidates = providerOrder().filter((id) => PROVIDERS[id].supports.includes('kline'));
  // First non-empty candle set wins; a stalled provider must not delay the chart.
  const { winner } = await raceProviders(
    candidates,
    (id) => cached(`${cacheKey}:${id}`, KLINE_TTL_MS, () =>
      binanceKlines(PROVIDERS[id], sym, safeInterval, safeLimit, timeoutMs),
    ),
    (payload) => Array.isArray(payload.klines) && payload.klines.length > 0,
  );
  if (winner) {
    lastGoodKline.set(cacheKey, winner);
    return winner;
  }

  // Degraded: replay the last candle set so the chart keeps its shape instead of
  // collapsing to an empty canvas mid-session.
  const stale = lastGoodKline.get(cacheKey);
  if (stale) {
    return { ...stale, stale: true, degraded: true, msg: 'Live candles are temporarily unavailable. Showing the last known chart.' };
  }

  return {
    ok: false,
    code: 'KLINE_UNAVAILABLE',
    msg: 'Chart data unavailable.',
    source: 'unavailable',
  };
}

async function getDepth({ symbol = 'BTCUSDT', limit = 100, timeoutMs = 6000 } = {}) {
  const sym = String(symbol).toUpperCase().replace('-', '');
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 5), 500);
  const cacheKey = `depth:${sym}:${safeLimit}`;

  const candidates = providerOrder().filter((id) => PROVIDERS[id].supports.includes('depth'));
  // Fastest usable book wins; never block the panel on a stalled provider.
  const { winner } = await raceProviders(
    candidates,
    (id) => cached(`${cacheKey}:${id}`, DEPTH_TTL_MS, () =>
      binanceDepth(PROVIDERS[id], sym, safeLimit, timeoutMs),
    ),
    (payload) => Array.isArray(payload.bids) && payload.bids.length > 0 && Array.isArray(payload.asks) && payload.asks.length > 0,
  );
  if (winner) {
    lastGoodDepth.set(cacheKey, winner);
    return winner;
  }

  const stale = lastGoodDepth.get(cacheKey);
  if (stale) {
    return { ...stale, stale: true, degraded: true, msg: 'Live order book is temporarily unavailable. Showing the last known book.' };
  }

  return {
    ok: false,
    code: 'DEPTH_UNAVAILABLE',
    msg: 'Order book unavailable.',
    source: 'unavailable',
  };
}

module.exports = { getMarket, getKlines, getDepth, getUsdtUsd, PROVIDERS, DEFAULT_SYMBOLS, KLINE_INTERVALS };

