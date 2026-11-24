#!/usr/bin/env node
'use strict';
// BTCBOX perpetual funding-rate producer (one pass).
// Impact Bid/Ask v1 are quantity-weighted VWAPs across the best five DISTINCT
// executable limit-order price levels on each side. The database owns the
// fixed-rate formula and validates the latest independent spot index/mark feed.
// Run frequently (recommended 5s); this script never settles positions or moves funds.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
const PAGE_SIZE = 500;
const SYMBOL_FILTER = String(process.env.PERP_FUNDING_SYMBOLS || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
function headers() {
  return { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json', Accept: 'application/json' };
}
async function restGetAll(query) {
  const rows = [];
  for (let offset=0; offset<500000; offset+=PAGE_SIZE) {
    const r=await fetch(SUPABASE_URL+'/rest/v1/'+query,{method:'GET',
      headers:{...headers(),'Range-Unit':'items',Range:offset+'-'+(offset+PAGE_SIZE-1)}});
    if(!r.ok) throw new Error('REST GET failed: '+r.status);
    const page=await r.json();
    if(!Array.isArray(page)) throw new Error('REST GET returned non-array payload');
    rows.push(...page);
    if(page.length<PAGE_SIZE) return rows;
  }
  throw new Error('REST pagination safety limit reached');
}
async function recordSnapshot(symbol,fundingAt,bid,ask) {
  const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/perp_record_funding_rate_snapshot',{
    method:'POST',headers:headers(),
    body:JSON.stringify({p_symbol:symbol,p_funding_at:fundingAt,
      p_impact_bid_price:String(bid),p_impact_ask_price:String(ask)})
  });
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j||j.ok!==true) throw new Error('funding snapshot RPC failed: '+r.status+' '+JSON.stringify(j));
  return j;
}
function calculateImpactPrices(bids,asks) {
  function sideVwap(rows,side) {
    if(!Array.isArray(rows)) throw new Error('invalid '+side+' book');
    const byPrice=new Map();
    for(const row of rows) {
      const price=Number(row&&row.price), qty=Number(row&&row.remaining_quantity);
      if(!Number.isFinite(price)||price<=0||!Number.isFinite(qty)||qty<=0)
        throw new Error('invalid '+side+' book level');
      byPrice.set(price,(byPrice.get(price)||0)+qty);
    }
    const levels=[...byPrice.entries()]
      .sort((a,b)=>side==='bid'?b[0]-a[0]:a[0]-b[0]).slice(0,5);
    if(levels.length<2) throw new Error('insufficient two-level '+side+' book depth');
    let qty=0,notional=0;
    for(const [price,size] of levels){qty+=size;notional+=price*size;}
    if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(notional)) throw new Error('invalid '+side+' VWAP');
    return {vwap:notional/qty,best:levels[0][0]};
  }
  const bidSide=sideVwap(bids,'bid'), askSide=sideVwap(asks,'ask');
  if(bidSide.best>askSide.best) throw new Error('crossed perpetual order book');
  const bid=bidSide.vwap, ask=askSide.vwap;
  const mid=(bid+ask)/2;
  if(!Number.isFinite(mid)||mid<=0||((ask-bid)/mid)*100>2)
    throw new Error('perpetual order-book spread is too wide');
  return {bid,ask};
}
async function produceMarket(market) {
  const symbol=String(market.symbol||'').toUpperCase();
  if(!/^[A-Z0-9]{3,20}$/.test(symbol)||!market.next_funding_at)
    throw new Error('invalid market funding boundary');
  const base='perpetual_orders?select=price,remaining_quantity&symbol=eq.'+encodeURIComponent(symbol)
    +'&status=in.(open,partially_filled)&type=eq.limit&remaining_quantity=gt.0';
  const [bids,asks]=await Promise.all([
    restGetAll(base+'&side=eq.buy&order=price.desc,created_at.asc&limit=50'),
    restGetAll(base+'&side=eq.sell&order=price.asc,created_at.asc&limit=50')
  ]);
  const impact=calculateImpactPrices(bids,asks);
  return recordSnapshot(symbol,market.next_funding_at,impact.bid,impact.ask);
}
async function main() {
  if(!SUPABASE_URL||!SERVICE_KEY) throw new Error('SUPABASE_URL/SERVICE_KEY not configured');
  const markets=await restGetAll('perpetual_markets?select=symbol,next_funding_at,funding_interval_sec,status&next_funding_at=not.is.null&order=symbol.asc');
  const selected=SYMBOL_FILTER.length?markets.filter(m=>SYMBOL_FILTER.includes(String(m.symbol).toUpperCase())):markets;
  let produced=0,failed=0;
  for(const market of selected) {
    if(Number(market.funding_interval_sec)!==28800) {
      failed++; console.error('[perp-funding-rate] unsupported funding interval',market.symbol); continue;
    }
    try {
      const result=await produceMarket(market); produced++;
      console.log('[perp-funding-rate]',market.symbol,'boundary='+result.funding_at,
        'rate='+result.rate,'premium='+result.premium_index,'formula='+result.formula_version);
    } catch(error) {
      failed++; console.error('[perp-funding-rate] skipped',market.symbol,'-',error.message);
    }
  }
  console.log('[perp-funding-rate] pass complete. produced='+produced,'failed='+failed);
  if(failed) process.exitCode=2;
}
if(require.main===module) main().catch(error=>{console.error('[perp-funding-rate] fatal:',error.message);process.exit(3);});
module.exports={calculateImpactPrices};
