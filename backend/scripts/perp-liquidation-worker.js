#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual liquidation worker.
// - Loops all open perpetual positions; calls perp_liquidate_position (DB-authoritative: checks mark freshness,
//   maintenance margin, loss waterfall margin→insurance→bad_debt). Pauses (skips) if mark price is stale.
// - Idempotent: perp_liquidate_position uses a deterministic idempotency key (position id); a retry on the same
//   position returns duplicate or no_position. Safe to restart.
// - Never computes liquidation prices authoritatively here; DB does. Requires SUPABASE_URL + SERVICE_KEY.
// - Run: node scripts/perp-liquidation-worker.js   (one pass; schedule frequently, e.g. every 2-5s)
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
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('[perp-liq] SUPABASE_URL/SERVICE_KEY not configured; exit.'); process.exit(1); }
  const positions = await restGet('perpetual_positions?select=user_id,symbol,side,quantity,entry_price,isolated_margin&closed_at=is.null&order=created_at.asc&limit=500');
  let liquidated = 0, safe = 0, paused = 0, failed = 0;
  for (const pos of positions) {
    try {
      const res = await rpc('perp_liquidate_position', { p_user_id: pos.user_id, p_symbol: pos.symbol });
      if (res.liquidated === true) {
        liquidated++;
        console.log('[perp-liq] LIQUIDATED', pos.symbol, pos.user_id, 'side=' + pos.side, 'mark=' + res.mark_price, 'liq_price=' + res.liq_price,
          'margin_lost=' + res.margin_lost, 'insurance_cover=' + (res.insurance_cover || 0), 'bad_debt=' + (res.bad_debt || 0));
        if (Number(res.bad_debt || 0) > 0) console.error('[perp-liq] BAD DEBT', pos.symbol, pos.user_id, 'amount=' + res.bad_debt, '- insurance fund insufficient; escalate.');
      } else if (res.liquidatable === false) {
        safe++;
      } else if (res.duplicate) {
        safe++;
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
