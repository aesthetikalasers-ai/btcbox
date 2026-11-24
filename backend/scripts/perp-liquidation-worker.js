#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual liquidation worker.
// - Reads every open position using bounded REST pagination; never silently treats REST errors as an empty book.
// - The database remains authoritative for mark freshness, maintenance margin and the loss waterfall.
// - A stale mark pauses liquidation for that position; other positions continue.
// - Requires SUPABASE_URL + service-role key. Run as a frequent one-pass scheduled job.
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
(async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[perp-liq] SUPABASE_URL/SERVICE_KEY not configured; exit.'); process.exit(1); }
  const positions = await restGetAll('perpetual_positions?select=user_id,symbol,side,quantity,entry_price,isolated_margin&closed_at=is.null&order=created_at.asc,user_id.asc');
  let liquidated = 0, safe = 0, paused = 0, failed = 0;
  for (const pos of positions) {
    try {
      const res = await rpc('perp_liquidate_position', { p_user_id: pos.user_id, p_symbol: pos.symbol });
      if (!res || res.ok !== true) throw new Error('liquidation RPC returned an unsuccessful payload');
      if (res.liquidated === true) {
        liquidated++;
        console.log('[perp-liq] LIQUIDATED', pos.symbol, pos.user_id, 'side=' + pos.side, 'mark=' + res.mark_price, 'liq_price=' + res.liq_price,
          'margin_lost=' + res.margin_lost, 'insurance_cover=' + (res.insurance_cover || 0), 'bad_debt=' + (res.bad_debt || 0));
        if (Number(res.bad_debt || 0) > 0) console.error('[perp-liq] BAD DEBT', pos.symbol, pos.user_id, 'amount=' + res.bad_debt, '- insurance fund insufficient; escalate.');
      } else if (res.liquidatable === false || res.duplicate || res.no_position) {
        safe++;
      } else {
        failed++;
        console.error('[perp-liq] unexpected RPC response', pos.symbol, pos.user_id);
      }
    } catch (e) {
      const msg = String(e.message || '');
      if (/mark price stale/i.test(msg)) { paused++; console.warn('[perp-liq] PAUSED (mark stale) for', pos.symbol, '- positions protected.'); }
      else { failed++; console.error('[perp-liq] failed', pos.symbol, pos.user_id, '-', msg); }
    }
  }
  console.log('[perp-liq] pass complete. liquidated=' + liquidated, 'safe=' + safe, 'paused_stale=' + paused, 'failed=' + failed);
  if (paused > 0) console.warn('[perp-liq] mark-price feed stale for ' + paused + ' position(s); check perp-mark-price-worker.');
  process.exit(failed > 0 ? 2 : 0);
})().catch(e => { console.error('[perp-liq] fatal:', e.message); process.exit(3); });
