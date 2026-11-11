#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual mark-price worker.
// - Aggregates >=2 public price sources per symbol (Binance + CoinGecko).
// - Calls perp_record_mark_price RPC (DB computes deviation, sets status ok/degraded/stale).
// - Idempotent & restart-safe: each tick is an append-only feed row.
// - Circuit breaker: if sources disagree beyond circuit_breaker_deviation_pct, status is degraded;
//   the RPC still records the mark but order entry is reduce/close-only until deviation recovers.
// - Never writes balances. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// - Run: node scripts/perp-mark-price-worker.js   (one tick; loop via cron/scheduler, e.g. every 5s)
const SYMBOLS = (process.env.PERP_MARK_SYMBOLS || 'BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT').split(',').map(s => s.trim()).filter(Boolean);
const CIRCUIT_BREAKER_PCT = Number(process.env.PERP_CIRCUIT_BREAKER_PCT || 5);
const FETCH_TIMEOUT_MS = Number(process.env.PERP_FETCH_TIMEOUT_MS || 4000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');

function headers() { return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }; }
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
  const j = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbol=' + encodeURIComponent(symbol), FETCH_TIMEOUT_MS);
  const p = Number(j && j.price);
  if (!Number.isFinite(p) || p <= 0) throw new Error('binance bad price');
  return { source: 'binance', price: p, ts: Date.now() };
}
async function coingeckoPrice(symbol) {
  const coinId = { BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana', BNBUSDT: 'binancecoin' }[symbol];
  if (!coinId) throw new Error('coingecko: unknown symbol ' + symbol);
  const j = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + coinId + '&vs_currencies=usdt', FETCH_TIMEOUT_MS);
  const p = Number(j && j[coinId] && j[coinId].usdt);
  if (!Number.isFinite(p) || p <= 0) throw new Error('coingecko bad price');
  return { source: 'coingecko', price: p, ts: Date.now() };
}
async function recordMark(symbol, indexPrice, markPrice, sources) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/perp_record_mark_price', {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ p_symbol: symbol, p_index_price: String(indexPrice), p_mark_price: String(markPrice), p_sources: sources, p_max_age_sec: 60 })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw new Error('perp_record_mark_price failed: ' + r.status + ' ' + JSON.stringify(j));
  return j;
}
(async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[perp-mark] SUPABASE_URL/SERVICE_KEY not configured; exit.'); process.exit(1); }
  let hadFailure = false;
  for (const symbol of SYMBOLS) {
    const sources = [];
    for (const fn of [binancePrice, coingeckoPrice]) {
      try { sources.push(await fn(symbol)); }
      catch (e) { console.warn('[perp-mark] source failed for', symbol, '-', e.message); }
    }
    if (sources.length < 2) { console.warn('[perp-mark]', symbol, 'only', sources.length, 'source(s) available; skipping record (requires >=2).'); hadFailure = true; continue; }
    const prices = sources.map(s => s.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const maxDevPct = Math.max(...prices.map(p => Math.abs((p - mean) / mean) * 100));
    const indexPrice = mean; // index = mean of sources; mark = index (no premium index in v1)
    const markPrice = mean;
    const status = maxDevPct > CIRCUIT_BREAKER_PCT ? 'degraded' : 'ok';
    try {
      const res = await recordMark(symbol, indexPrice, markPrice, sources);
      console.log('[perp-mark]', symbol, 'index=' + indexPrice, 'mark=' + markPrice, 'sources=' + sources.length, 'deviation_pct=' + maxDevPct.toFixed(3), 'db_status=' + res.status, 'ts=' + new Date().toISOString());
      if (status === 'degraded') console.warn('[perp-mark] CIRCUIT BREAKER: sources disagree >' + CIRCUIT_BREAKER_PCT + '% for ' + symbol + '; order entry degraded (reduce/close only).');
    } catch (e) { console.error('[perp-mark] record failed for', symbol, '-', e.message); hadFailure = true; }
  }
  process.exit(hadFailure ? 2 : 0);
})().catch(e => { console.error('[perp-mark] fatal:', e.message); process.exit(3); });
