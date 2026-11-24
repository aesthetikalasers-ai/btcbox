#!/usr/bin/env node
'use strict';
// BTCBOX Perpetual funding worker.
// - One atomic database RPC settles every open position for a due market.
// - The RPC holds the shared market lock and advances the funding boundary in the same transaction.
// - v1 deliberately uses zero funding until a validated premium-index calculation is implemented.
// - Never moves funds outside the database RPC. Requires SUPABASE_URL + service-role key.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
const PAGE_SIZE = 500;
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
    if (!r.ok) throw new Error('REST GET failed: ' + r.status);
    const page = await r.json();
    if (!Array.isArray(page)) throw new Error('REST GET returned a non-array payload');
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new Error('REST pagination safety limit reached');
}
async function rpc(name, payload) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: headers(), body: JSON.stringify(payload)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error('RPC ' + name + ' failed: ' + r.status);
    e.status = r.status; e.result = j; throw e;
  }
  return j;
}
(async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[perp-funding] SUPABASE_URL/SERVICE_KEY not configured; exit.');
    process.exit(1);
  }
  const markets = await restGetAll(
    'perpetual_markets?select=symbol,next_funding_at,enabled,status&enabled=eq.true&order=symbol.asc'
  );
  let settled = 0, duplicates = 0, skipped = 0, failed = 0;
  for (const market of markets) {
    if (!market.next_funding_at) {
      skipped++;
      console.warn('[perp-funding] no configured funding boundary for', market.symbol, '; skip.');
      continue;
    }
    const fundingAt = new Date(market.next_funding_at);
    if (!Number.isFinite(fundingAt.getTime())) {
      failed++;
      console.error('[perp-funding] invalid funding boundary for', market.symbol);
      continue;
    }
    if (Date.now() < fundingAt.getTime()) continue;
    try {
      const result = await rpc('perp_settle_funding_market', {
        p_symbol: market.symbol,
        p_funding_at: fundingAt.toISOString()
      });
      if (!result || result.ok !== true) throw new Error('atomic funding RPC returned an unsuccessful payload');
      if (result.stale_boundary) {
        skipped++;
        console.warn('[perp-funding] boundary changed before settlement for', market.symbol, '; reread next pass.');
        continue;
      }
      settled += Number(result.settled || 0);
      duplicates += Number(result.duplicates || 0);
      console.log('[perp-funding] market settled', market.symbol,
        'funding_at=' + result.funding_at,
        'settled=' + (result.settled || 0),
        'duplicates=' + (result.duplicates || 0),
        'no_position=' + (result.no_position || 0),
        'next=' + result.next_funding_at);
    } catch (error) {
      failed++;
      console.error('[perp-funding] atomic market settlement failed', market.symbol, '-', error.message);
    }
  }
  console.log('[perp-funding] pass complete. settled=' + settled,
    'duplicates=' + duplicates, 'skipped=' + skipped, 'failed=' + failed);
  process.exit(failed > 0 ? 2 : 0);
})().catch(error => {
  console.error('[perp-funding] fatal:', error.message);
  process.exit(3);
});
