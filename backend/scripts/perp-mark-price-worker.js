#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual mark-price worker.
// - Discovers enabled perpetual markets from Supabase unless PERP_MARK_SYMBOLS narrows the set.
// - Aggregates fresh spot references from Binance, OKX and CoinGecko (>=2 required).
// - Uses each market's stale-price and circuit-breaker limits; the DB remains authoritative.
// - Never writes balances. Requires SUPABASE_URL + service-role key.
// - Run one tick frequently (target ~5s) from a supervised worker runtime.
const CIRCUIT_BREAKER_PCT = Number(process.env.PERP_CIRCUIT_BREAKER_PCT || 5);
const FETCH_TIMEOUT_MS = Number(process.env.PERP_FETCH_TIMEOUT_MS || 4000);
const PAGE_SIZE = 500;
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
const SYMBOL_FILTER = String(process.env.PERP_MARK_SYMBOLS || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const DEFAULT_COINGECKO_IDS = {
  ADAUSDT: 'cardano',
  AVAXUSDT: 'avalanche-2',
  BNBUSDT: 'binancecoin',
  BTCUSDT: 'bitcoin',
  DOGEUSDT: 'dogecoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  XRPUSDT: 'ripple',
  LINKUSDT: 'chainlink',
  DOTUSDT: 'polkadot',
  TRXUSDT: 'tron',
  LTCUSDT: 'litecoin',
  BCHUSDT: 'bitcoin-cash',
  NEARUSDT: 'near-protocol',
  UNIUSDT: 'uniswap',
  ATOMUSDT: 'cosmos',
  ETCUSDT: 'ethereum-classic',
  APTUSDT: 'aptos',
  ARBUSDT: 'arbitrum',
  OPUSDT: 'optimism',
  SUIUSDT: 'sui',
  INJUSDT: 'injective-protocol',
  TIAUSDT: 'celestia',
  FILUSDT: 'filecoin'
};
function loadCoinGeckoIds() {
  const ids = { ...DEFAULT_COINGECKO_IDS };
  if (!process.env.PERP_COINGECKO_IDS) return ids;
  let extra;
  try { extra = JSON.parse(process.env.PERP_COINGECKO_IDS); }
  catch { throw new Error('PERP_COINGECKO_IDS must be a JSON object mapping market symbols to CoinGecko IDs'); }
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw new Error('PERP_COINGECKO_IDS must be a JSON object');
  for (const [symbol, id] of Object.entries(extra)) {
    if (!/^[A-Z0-9]{3,20}$/.test(symbol) || typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(id)) {
      throw new Error('PERP_COINGECKO_IDS contains an invalid symbol or provider ID');
    }
    ids[symbol] = id;
  }
  return ids;
}
const COINGECKO_IDS = loadCoinGeckoIds();
function headers() {
  return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };
}
async function restGetAll(query) {
  const rows = [];
  for (let offset = 0; offset < 500000; offset += PAGE_SIZE) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + query, {
      method: 'GET',
      headers: { ...headers(), 'Range-Unit': 'items', Range: offset + '-' + (offset + PAGE_SIZE - 1) }
    });
    if (!r.ok) throw new Error('Supabase market discovery failed: ' + r.status);
    const page = await r.json();
    if (!Array.isArray(page)) throw new Error('Supabase market discovery returned a non-array payload');
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error('Supabase market discovery pagination safety limit reached');
}
async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function binancePrice(symbol) {
  const j = await fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=' + encodeURIComponent(symbol), FETCH_TIMEOUT_MS);
  const p = Number(j && j.lastPrice);
  const ts = Number(j && j.closeTime);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(ts) || ts <= 0) throw new Error('binance bad price/timestamp');
  return { source: 'binance', price: p, ts };
}
async function okxPrice(symbol) {
  const instId = symbol.replace(/USDT$/, '-USDT');
  const j = await fetchJson('https://www.okx.com/api/v5/market/ticker?instId=' + encodeURIComponent(instId), FETCH_TIMEOUT_MS);
  const item = j && j.code === '0' && Array.isArray(j.data) ? j.data[0] : null;
  const p = Number(item && item.last);
  const ts = Number(item && item.ts);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(ts) || ts <= 0) throw new Error('okx bad price/timestamp');
  return { source: 'okx', price: p, ts };
}
async function coingeckoPrice(symbol) {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) throw new Error('coingecko mapping missing for ' + symbol + ' (configure PERP_COINGECKO_IDS)');
  const j = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(coinId) + '&vs_currencies=usdt&include_last_updated_at=true', FETCH_TIMEOUT_MS);
  const p = Number(j && j[coinId] && j[coinId].usdt);
  const updatedAtSec = Number(j && j[coinId] && j[coinId].last_updated_at);
  const ts = updatedAtSec * 1000;
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(ts) || ts <= 0) throw new Error('coingecko bad price/timestamp');
  return { source: 'coingecko', price: p, ts };
}
function calculateBookDepthMidPrice(bids, asks) {
  // Use multiple live price levels rather than a single easily spoofed top quote.
  // Resting orders remain valid liquidity even when updated_at is older than the
  // external price-feed freshness window; order status/remaining_quantity define
  // whether they are still executable.
  const weightedSide = (levels, side) => {
    if (!Array.isArray(levels)) throw new Error('invalid ' + side + ' book depth');
    const byPrice = new Map();
    for (const level of levels) {
      const price = Number(level && level.price);
      const remaining = Number(level && level.remaining_quantity);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(remaining) || remaining <= 0) {
        throw new Error('invalid ' + side + ' book level');
      }
      byPrice.set(price, (byPrice.get(price) || 0) + remaining);
    }
    const priceLevels = [...byPrice.entries()].sort((a, b) => side === 'bid' ? b[0] - a[0] : a[0] - b[0]).slice(0, 5);
    if (priceLevels.length < 2) throw new Error('insufficient two-level ' + side + ' book depth');
    let quantity = 0;
    let notional = 0;
    for (const [price, remaining] of priceLevels) {
      quantity += remaining;
      notional += price * remaining;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(notional)) {
      throw new Error('invalid ' + side + ' book depth');
    }
    return notional / quantity;
  };
  const bid = weightedSide(bids, 'bid');
  const ask = weightedSide(asks, 'ask');
  if (ask < bid) throw new Error('crossed perpetual order book');
  const mid = (bid + ask) / 2;
  const spreadPct = ((ask - bid) / mid) * 100;
  if (!Number.isFinite(mid) || mid <= 0 || spreadPct > 2) {
    throw new Error('perpetual order-book spread is too wide for mark-price sampling');
  }
  return mid;
}
async function perpetualBookMidPrice(symbol) {
  const base = 'perpetual_orders?select=price,remaining_quantity&symbol=eq.' + encodeURIComponent(symbol)
    + '&status=in.(open,partially_filled)&type=eq.limit&remaining_quantity=gt.0';
  const [bids, asks] = await Promise.all([
    restGetAll(base + '&side=eq.buy&order=price.desc,created_at.asc&limit=50'),
    restGetAll(base + '&side=eq.sell&order=price.asc,created_at.asc&limit=50')
  ]);
  return calculateBookDepthMidPrice(bids, asks);
}
async function recordMark(symbol, indexPrice, markPrice, freshSources, maxAgeSec) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/perp_record_mark_price', {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ p_symbol: symbol, p_index_price: String(indexPrice), p_mark_price: String(markPrice), p_sources: freshSources, p_max_age_sec: maxAgeSec })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw new Error('perp_record_mark_price failed: ' + r.status + ' ' + JSON.stringify(j));
  return j;
}
async function recordBootstrapMark(symbol, indexPrice, freshSources, maxAgeSec) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/perp_record_bootstrap_mark_price', {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ p_symbol: symbol, p_index_price: String(indexPrice), p_sources: freshSources, p_max_age_sec: maxAgeSec })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true || j.status !== 'bootstrap') {
    throw new Error('perp_record_bootstrap_mark_price failed: ' + r.status + ' ' + JSON.stringify(j));
  }
  return j;
}
async function fetchProviderPriceMaps(markets) {
  const symbols = markets.map(m => String(m.symbol || '').toUpperCase());
  const ids = [...new Set(symbols.map(s => COINGECKO_IDS[s]).filter(Boolean))];
  const results = await Promise.allSettled([
    fetchJson('https://api.binance.com/api/v3/ticker/24hr', FETCH_TIMEOUT_MS),
    fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SPOT', FETCH_TIMEOUT_MS),
    ids.length ? fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(ids.join(',')) + '&vs_currencies=usdt&include_last_updated_at=true', FETCH_TIMEOUT_MS) : Promise.resolve({})
  ]);
  const maps = { binance: new Map(), okx: new Map(), coingecko: new Map() };
  if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
    for (const row of results[0].value) {
      const symbol = String(row && row.symbol || '').toUpperCase();
      if (!symbols.includes(symbol)) continue;
      const price = Number(row.lastPrice), ts = Number(row && row.closeTime);
      if (Number.isFinite(price) && price > 0 && Number.isFinite(ts) && ts > 0) maps.binance.set(symbol, { source: 'binance', price, ts });
    }
  } else console.warn('[perp-mark] Binance batch ticker request failed:', results[0].status === 'rejected' ? results[0].reason.message : 'invalid payload');
  if (results[1].status === 'fulfilled' && results[1].value && results[1].value.code === '0' && Array.isArray(results[1].value.data)) {
    for (const row of results[1].value.data) {
      const symbol = String(row && row.instId || '').replace(/-/g, '').toUpperCase();
      if (!symbols.includes(symbol)) continue;
      const price = Number(row.last), ts = Number(row.ts);
      if (Number.isFinite(price) && price > 0 && Number.isFinite(ts) && ts > 0) maps.okx.set(symbol, { source: 'okx', price, ts });
    }
  } else console.warn('[perp-mark] OKX batch ticker request failed:', results[1].status === 'rejected' ? results[1].reason.message : 'invalid payload');
  if (results[2].status === 'fulfilled' && results[2].value && typeof results[2].value === 'object') {
    for (const symbol of symbols) {
      const id = COINGECKO_IDS[symbol], row = id && results[2].value[id];
      const price = Number(row && row.usdt), ts = Number(row && row.last_updated_at) * 1000;
      if (Number.isFinite(price) && price > 0 && Number.isFinite(ts) && ts > 0) maps.coingecko.set(symbol, { source: 'coingecko', price, ts });
    }
  } else console.warn('[perp-mark] CoinGecko batch price request failed:', results[2].status === 'rejected' ? results[2].reason.message : 'invalid payload');
  return maps;
}
function buildFreshSources(providerMaps, symbol, nowMs, maxAgeSec) {
  return ['binance', 'okx', 'coingecko'].map(provider => providerMaps[provider] && providerMaps[provider].get(symbol))
    .filter(source => source && Math.abs(nowMs - source.ts) <= maxAgeSec * 1000);
}
function canBootstrapWithSources(sources) {
  if (!Array.isArray(sources) || sources.length !== 3) return false;
  const names = new Set(sources.map(source => String(source && source.source || '').toLowerCase()));
  return names.size === 3 && ['binance', 'okx', 'coingecko'].every(name => names.has(name));
}
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[perp-mark] SUPABASE_URL/SERVICE_KEY not configured; exit.'); process.exit(1); }
  const markets = await restGetAll('perpetual_markets?select=symbol,base_asset,quote_asset,mark_price_stale_sec,circuit_breaker_deviation_pct&enabled=eq.true&order=symbol.asc');
  const selected = SYMBOL_FILTER.length ? markets.filter(m => SYMBOL_FILTER.includes(String(m.symbol).toUpperCase())) : markets;
  if (!selected.length) {
    console.log('[perp-mark] no enabled perpetual markets selected; no mark rows written.');
    process.exit(0);
  }
  const providerMaps = await fetchProviderPriceMaps(selected);
  let hadFailure = false;
  await mapWithConcurrency(selected, 4, async market => {
    const symbol = String(market.symbol || '').toUpperCase();
    const maxAgeSec = Number(market.mark_price_stale_sec) || 60;
    const breakerPct = Number(market.circuit_breaker_deviation_pct) || CIRCUIT_BREAKER_PCT;
    if (!/^[A-Z0-9]{3,20}$/.test(symbol) || market.quote_asset !== 'USDT'
        || symbol !== String(market.base_asset || '').toUpperCase() + String(market.quote_asset || '').toUpperCase()) {
      console.error('[perp-mark] invalid enabled market configuration; skipping', symbol);
      hadFailure = true;
      return;
    }
    const freshSources = buildFreshSources(providerMaps, symbol, Date.now(), maxAgeSec);
    if (freshSources.length < 2) {
      console.warn('[perp-mark]', symbol, 'only', freshSources.length, 'fresh source(s) available; skipping record (requires >=2).');
      hadFailure = true;
      return;
    }
    const prices = freshSources.map(s => s.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const maxDevPct = Math.max(...prices.map(p => Math.abs((p - mean) / mean) * 100));
    const indexPrice = mean;
    try {
      let res, markPrice;
      try {
        markPrice = await perpetualBookMidPrice(symbol);
        res = await recordMark(symbol, indexPrice, markPrice, freshSources, maxAgeSec);
      } catch (bookError) {
        if (!module.exports.shouldUseBootstrapMark(bookError)) throw bookError;
        if (!canBootstrapWithSources(freshSources)) throw new Error('bootstrap mark requires three distinct fresh providers; received ' + freshSources.length);
        markPrice = indexPrice;
        res = await recordBootstrapMark(symbol, indexPrice, freshSources, maxAgeSec);
        console.warn('[perp-mark]', symbol, 'bootstrap anchor active; order book is not yet deep enough; funding snapshots remain blocked.');
      }
      console.log('[perp-mark]', symbol, 'index=' + indexPrice, 'mark=' + markPrice, 'sources=' + freshSources.length,
        'deviation_pct=' + maxDevPct.toFixed(3), 'db_status=' + res.status, 'ts=' + new Date().toISOString());
      if (maxDevPct > breakerPct) console.warn('[perp-mark] CIRCUIT BREAKER: sources disagree >' + breakerPct + '% for ' + symbol + '; DB order-entry status is degraded.');
    } catch (e) {
      console.error('[perp-mark] record failed for', symbol, '-', e.message);
      hadFailure = true;
    }
  });
  process.exit(hadFailure ? 2 : 0);
}
if (require.main === module) {
  main().catch(e => { console.error('[perp-mark] fatal:', e.message); process.exit(3); });
}

module.exports = { calculateBookDepthMidPrice, shouldUseBootstrapMark: error => /insufficient two-level/.test(String(error && error.message || error)), DEFAULT_COINGECKO_IDS, buildFreshSources, canBootstrapWithSources, mapWithConcurrency };
