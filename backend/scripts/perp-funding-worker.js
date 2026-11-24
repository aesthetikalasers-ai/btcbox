#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual funding worker.
// - For each perpetual market: if now() >= next_funding_at, compute premium/rate (v1: rate capped at funding_rate_cap,
//   sign from last premium; v1 uses 0 premium → rate = clamp(last premium, -cap, +cap), default 0),
//   insert a row into perpetual_funding_rates (idempotent by (symbol, funding_at)), then loop over open positions
//   calling perp_settle_funding_one (idempotent per (symbol, funding_at, user)).
// - Safe to restart: duplicate rate insert conflicts on PK → skip; duplicate settle returns duplicate=true.
// - Never moves funds outside the atomic RPC. Requires SUPABASE_URL + SERVICE_KEY.
// - Run: node scripts/perp-funding-worker.js   (one pass; schedule at funding interval, e.g. every 8h)
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
function headers() { return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }; }
async function rpc(name, payload) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error('RPC ' + name + ' failed: ' + r.status); e.status = r.status; e.result = j; throw e; }
  return j;
}
async function restGet(q) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + q, { method: 'GET', headers: headers() });
  if (!r.ok) return [];
  return r.json().catch(() => []);
}
(async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[perp-funding] SUPABASE_URL/SERVICE_KEY not configured; exit.'); process.exit(1); }
  const markets = await restGet('perpetual_markets?select=symbol,funding_interval_sec,funding_rate_cap,next_funding_at,status&enabled=eq.true');
  let settled = 0, skipped = 0;
  for (const m of markets) {
    const intervalSec = Number(m.funding_interval_sec) || 28800;
    const cap = Number(m.funding_rate_cap) || 0.0075;
    const now = new Date();
    const next = m.next_funding_at ? new Date(m.next_funding_at) : null;
    if (next && now < next) { console.log('[perp-funding]', m.symbol, 'next funding at', next.toISOString(), '; skip.'); continue; }
    // funding_at = aligned interval boundary. v1: premium index = 0 (no orderbook premium yet) → rate = 0, capped.
    const fundingAt = next ? next : new Date(Math.floor(now.getTime() / 1000) * 1000);
    const rate = 0; // v1: zero funding until premium index is wired; always within cap.
    // Record rate (idempotent by (symbol, funding_at)).
    try {
      await fetch(SUPABASE_URL + '/rest/v1/perpetual_funding_rates', { method: 'POST', headers: { ...headers(), Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ symbol: m.symbol, funding_at: fundingAt.toISOString(), rate: rate, premium_index: 0, settled: false }) });
    } catch (e) { console.warn('[perp-funding] rate insert (duplicate?)', m.symbol, e.message); }
    // Settle per open position.
    const positions = await restGet('perpetual_positions?select=user_id,symbol&symbol=eq.' + encodeURIComponent(m.symbol) + '&closed_at=is.null');
    for (const pos of positions) {
      try {
        const res = await rpc('perp_settle_funding_one', { p_symbol: m.symbol, p_funding_at: fundingAt.toISOString(), p_rate: rate, p_user_id: pos.user_id });
        if (res.duplicate) skipped++; else settled++;
        console.log('[perp-funding] settled', m.symbol, pos.user_id, 'payment_delta=' + (res.payment_delta || 0), 'duplicate=' + !!res.duplicate);
      } catch (e) { console.error('[perp-funding] settle failed', m.symbol, pos.user_id, '-', e.message); }
    }
    // Mark rate settled + advance next_funding_at.
    try {
      await fetch(SUPABASE_URL + '/rest/v1/perpetual_funding_rates?symbol=eq.' + encodeURIComponent(m.symbol) + '&funding_at=eq.' + encodeURIComponent(fundingAt.toISOString()),
        { method: 'PATCH', headers: headers(), body: JSON.stringify({ settled: true }) });
      const nextFunding = new Date(fundingAt.getTime() + intervalSec * 1000).toISOString();
      await fetch(SUPABASE_URL + '/rest/v1/perpetual_markets?symbol=eq.' + encodeURIComponent(m.symbol),
        { method: 'PATCH', headers: headers(), body: JSON.stringify({ next_funding_at: nextFunding, updated_at: new Date().toISOString() }) });
    } catch (e) { console.warn('[perp-funding] advance next_funding_at failed', m.symbol, e.message); }
  }
  console.log('[perp-funding] pass complete. settled=' + settled, 'skipped_duplicates=' + skipped);
  process.exit(0);
})().catch(e => { console.error('[perp-funding] fatal:', e.message); process.exit(3); });
