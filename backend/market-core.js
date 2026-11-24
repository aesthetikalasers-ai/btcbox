'use strict';
/**
 * Market snapshot reader - the ONE implementation of what the current price is.
 *
 * Both GET /api/market and the SSE ticker channel call this, so a quote in a page
 * header, in the order book and in a chart always comes from the same provider
 * chain and the same rules.
 *
 * Coinbase is primary for BASE-USDT spot pairs; Bybit fills only the symbols
 * Coinbase does not serve. A symbol neither provider reports is omitted - no
 * price is ever invented.
 */

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

async function fetchJson(url, timeoutMs) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('market provider HTTP ' + response.status);
  return response.json();
}

async function readMarketSnapshot({ readSpotMarketCatalog, timeoutMs = 5000 }) {
  let bases;
  try {
    const catalog = await readSpotMarketCatalog();
    bases = [...new Set(catalog
      .filter((market) => market.enabled && market.quote_asset === 'USDT')
      .map((market) => market.base_asset))];
  } catch (_) {
    return { ok: false, code: 'MARKET_CATALOG_UNAVAILABLE', msg: 'Spot market catalogue is temporarily unavailable.', source: 'unavailable' };
  }
  if (!bases.length) return { ok: true, markets: [], data: {}, source: 'configured_empty' };

  const now = Math.floor(Date.now() / 1000);
  const normalize = (base, ticker, source, providerTs = null) => {
    const price = Number(ticker.price);
    const high = Number(ticker.high);
    const low = Number(ticker.low);
    const chg = Number(ticker.chg);
    const vol = Number(ticker.vol);
    if (![price, high, low, chg, vol].every(Number.isFinite) || price <= 0 || high <= 0 || low <= 0 || vol < 0) return null;
    return { sym: base, price, chg, high, low, vol, ts: now, providerTs, source };
  };

  const marketsByBase = {};
  let coinbaseAvailable = false;
  try {
    const products = await fetchJson('https://api.exchange.coinbase.com/products', timeoutMs);
    if (!Array.isArray(products)) throw new Error('invalid Coinbase product list');
    const enabled = new Set(products
      .filter((p) => p && p.quote_currency === 'USDT' && p.status === 'online' && p.trading_disabled !== true)
      .map((p) => p.id));
    const rows = await Promise.all(bases.map(async (base) => {
      const productId = base + '-USDT';
      if (!enabled.has(productId)) return null;
      try {
        const [ticker, stats] = await Promise.all([
          fetchJson('https://api.exchange.coinbase.com/products/' + productId + '/ticker', timeoutMs),
          fetchJson('https://api.exchange.coinbase.com/products/' + productId + '/stats', timeoutMs),
        ]);
        const price = Number(ticker.price);
        const open = Number(stats.open);
        const baseVolume = Number(stats.volume);
        const providerTs = typeof ticker.time === 'string' ? Math.floor(Date.parse(ticker.time) / 1000) : null;
        if (!finitePositive(price) || !finitePositive(open) || !finitePositive(stats.high) || !finitePositive(stats.low) || !Number.isFinite(baseVolume) || baseVolume < 0) return null;
        return normalize(base, { price, high: Number(stats.high), low: Number(stats.low), chg: (price - open) / open * 100, vol: baseVolume * price }, 'coinbase', Number.isFinite(providerTs) && providerTs > 0 ? providerTs : null);
      } catch (_) { return null; }
    }));
    rows.forEach((row) => { if (row) marketsByBase[row.sym] = row; });
    coinbaseAvailable = rows.some(Boolean);
  } catch (_) {
    // Provider failure falls through to the Bybit fallback below.
  }

  const missingBases = bases.filter((base) => !marketsByBase[base]);
  if (missingBases.length) {
    try {
      const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot', timeoutMs);
      const list = payload && payload.result && payload.result.list;
      if (!Array.isArray(list)) throw new Error('invalid Bybit ticker payload');
      const bybit = new Map(list.filter((t) => t && /USDT$/.test(t.symbol || '')).map((t) => [t.symbol.slice(0, -4), t]));
      missingBases.forEach((base) => {
        const t = bybit.get(base);
        if (!t) return;
        const price = Number(t.lastPrice), high = Number(t.highPrice24h), low = Number(t.lowPrice24h);
        const chg = Number(t.price24hPcnt) * 100, vol = Number(t.turnover24h);
        const providerTimeMs = Number(payload.time);
        const providerTs = Number.isFinite(providerTimeMs) && providerTimeMs > 0 ? Math.floor(providerTimeMs / 1000) : null;
        if (providerTs === null || providerTs > now + 15 || now - providerTs > 60) return;
        const row = normalize(base, { price, high, low, chg, vol }, 'bybit', providerTs);
        if (row) marketsByBase[base] = row;
      });
    } catch (_) {
      // Keep valid Coinbase rows; never invent prices for missing symbols.
    }
  }

  const snapshotTs = Math.floor(Date.now() / 1000);
  const markets = bases.filter((base) => marketsByBase[base]).map((base) => {
    const row = marketsByBase[base];
    return { sym: row.sym, price: row.price, chg: row.chg, high: row.high, low: row.low, vol: Number.isFinite(row.vol) && row.vol >= 0 ? String(row.vol) : '0', source: row.source };
  });
  const data = {};
  markets.forEach((row) => {
    const row2 = marketsByBase[row.sym];
    data[row.sym] = { price: row.price, chg: row.chg, high: row.high, low: row.low, vol: row2.vol, ts: snapshotTs, providerTs: row2.providerTs, source: row.source };
  });
  if (!markets.length) {
    return { ok: false, code: 'MARKET_DATA_UNAVAILABLE', msg: 'Market data unavailable.', source: coinbaseAvailable ? 'coinbase_partial' : 'unavailable' };
  }
  return { ok: true, markets, data, source: missingBases.length ? 'coinbase_primary_bybit_fallback' : 'coinbase' };
}

module.exports = { readMarketSnapshot };
