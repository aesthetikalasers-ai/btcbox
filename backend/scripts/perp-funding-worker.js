#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual funding worker.
// - Reads every enabled market and every open position using bounded REST pagination.
// - A market's funding boundary is advanced ONLY after every position settlement succeeds.
// - Failed settlements leave the boundary unchanged; successful users safely replay as duplicates.
// - Never moves funds outside perp_settle_funding_one. Requires SUPABASE_URL + service-role key.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
const PAGE_SIZE = 500;
function headers() {
  return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };
}
async function rpc(name, payload) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error('RPC ' + name + ' failed: ' + r.status); e.status = r.status; e.result = j; throw e; }
  return j;
}
async function restGetAll(query) {
  const rows = [];
  for (let offset = 0; offset < 500000; offset += PAGE_SIZE) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + query, {
      method: 'GET',
      headers: { ...headers(), 'Range-Unit': 'items', Range: offset + '-' + (offset + PAGE_SIZE - 1) }
    });
    if (!r.ok) throw new Error('REST GET failed: ' + r.status);
    const page = await r.json();
    if (!Array.isArray(page)) throw new Error('REST GET returned a non-array payload');
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error('REST pagination safety limit reached');
}
async function patch(query, payload, label) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + query, {
    method: 'PATCH', headers: headers(), body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(label + ' failed: ' + r.status);
}
(async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[perp-funding] SUPABASE_URL/SERVICE_KEY not configured; exit.'); process.exit(1); }
  const markets = await restGetAll('perpetual_markets?select=symbol,funding_interval_sec,funding_rate_cap,next_funding_at,status&enabled=eq.true&order=symbol.asc');
  let settled = 0, skipped = 0, failed = 0;
  for (const m of markets) {
    const intervalSec = Number(m.funding_interval_sec) || 28800;
    const now = new Date();
    const next = m.next_funding_at ? new Date(m.next_funding_at) : null;
    if (next && now < next) { console.log('[perp-funding]', m.symbol, 'next funding at', next.toISOString(), '; skip.'); continue; }
    // v1 deliberately uses zero funding until a validated premium-index source is implemented.
    const fundingAt = next ? next : new Date(Math.floor(now.getTime() / 1000) * 1000);
    const rate = 0;
    const rateResponse = await fetch(SUPABASE_URL + '/rest/v1/perpetual_funding_rates', {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ symbol: m.symbol, funding_at: fundingAt.toISOString(), rate, premium_index: 0, settled: false })
    });
    if (!rateResponse.ok) throw new Error('funding rate insert failed for ' + m.symbol + ': ' + rateResponse.status);

    const positions = await restGetAll('perpetual_positions?select=user_id,symbol&symbol=eq.' + encodeURIComponent(m.symbol) + '&closed_at=is.null&order=user_id.asc');
    let marketFailed = false;
    for (const pos of positions) {
      try {
        const res = await rpc('perp_settle_funding_one', { p_symbol: m.symbol, p_funding_at: fundingAt.toISOString(), p_rate: rate, p_user_id: pos.user_id });
        if (res && res.duplicate) skipped++; else settled++;
        console.log('[perp-funding] settled', m.symbol, pos.user_id, 'payment_delta=' + (res?.payment_delta || 0), 'duplicate=' + !!res?.duplicate);
      } catch (e) {
        marketFailed = true; failed++;
        console.error('[perp-funding] settle failed', m.symbol, pos.user_id, '-', e.message);
      }
    }
    if (marketFailed) {
      console.error('[perp-funding] boundary NOT advanced for', m.symbol, '- retry will replay successful users and retry failed users.');
      continue;
    }

    // These writes are checked. If either fails, the old boundary remains/replays safely next pass.
    await patch('perpetual_funding_rates?symbol=eq.' + encodeURIComponent(m.symbol) + '&funding_at=eq.' + encodeURIComponent(fundingAt.toISOString()),
      { settled: true }, 'funding settled marker');
    const nextFunding = new Date(fundingAt.getTime() + intervalSec * 1000).toISOString();
    await patch('perpetual_markets?symbol=eq.' + encodeURIComponent(m.symbol),
      { next_funding_at: nextFunding, updated_at: new Date().toISOString() }, 'next funding boundary');
  }
  console.log('[perp-funding] pass complete. settled=' + settled, 'skipped_duplicates=' + skipped, 'failed=' + failed);
  process.exit(failed > 0 ? 2 : 0);
})().catch(e => { console.error('[perp-funding] fatal:', e.message); process.exit(3); });
