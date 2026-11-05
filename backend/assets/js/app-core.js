/* BTCBOX app-core.js — extracted from index.html, IIFE unwrapped, load order preserved. */
"use strict";

/* ============================================================
   apiAdapter — maps every data call to the original backend
   path under /api (46 contract endpoints + 5 extra admin).
   LIVE adapter: every method calls the real backend at API_BASE
   (/api) via same-origin unified apiFetch() with
   credentials:'include'. Admin endpoints use HTTP Basic Auth.
   401 or {ok:false,need_login:true} clears the session and redirects
   to #/login. Market/kline/depth are real (Coinbase/Bybit) — never synthesized.
   ============================================================
   AUTH (5)      : POST /api/register | /api/login | /api/login/2fa | /api/logout | /api/supabase-login
   ACCOUNT (6)   : GET  /api/account | /api/addresses | /api/addresses/select
                   POST /api/addresses | /api/deposit | /api/withdraw
   TRADE (3)     : POST /api/order | /api/order/cancel | GET /api/orders
   MARKET (5)    : GET  /api/config | /api/market | /api/kline | /api/depth | POST /api/captcha
   SECONDS (3)   : POST /api/seconds/order | /api/seconds/settle | GET /api/seconds/positions
   EARN (1)      : POST /api/earn
   KYC/SETTINGS/SUPPORT (10): POST /api/kyc | /api/settings/password | /api/settings/fundpwd | /api/settings/2fa
                   POST /api/2fa/enable | /api/2fa/disable | /api/2fa/confirm
                   POST /api/support/chat | GET /api/support/messages | GET /api/chat/unread
   ADMIN (13 contract + 5 extra): GET /api/admin/stats | /users | /user | /addresses | /withdrawals | /orders | /support/messages | /config
     POST /api/admin/user/balance | /user/freeze | /user/reset-pwd | /user/reset-email
     POST /api/admin/deposit/confirm | /withdraw/approve | /kyc/reject | /push | /support/reply | /config
     EXTRA: POST /admin/withdraw/reject | /kyc/approve | /address/manage | GET /admin/audit-logs | GET /admin/config
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const delay = ms => new Promise(r=>setTimeout(r,ms));
const rnd = (a,b)=>a+Math.random()*(b-a);
const fmt = (n,d=2)=>{ if(n==null||isNaN(n))return'-'; return Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); };
const fmtPrice = (n,base)=>{ const d = (base==='BTC'||base==='ETH')?2:4; return fmt(n,d); };
const pct = n=> (n>=0?'+':'')+fmt(n,2)+'%';
const uid = ()=> 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g,()=>((Math.random()*16)|0).toString(16)); // 32 hex chars — satisfies 16-80/100 idempotency-key length
/* API base — production backend. For local dev change to http://localhost:8080/api */
const API_BASE = '/api';

/* ---------- market data (filled by polling /api/market; never synthesized locally) ---------- */
const PAIRS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT','TRXUSDT','MATICUSDT','LTCUSDT','BCHUSDT','NEARUSDT','UNIUSDT','ATOMUSDT','ETCUSDT'];
const market = {};
/* zero placeholder until first /api/market poll completes; immediately overwritten with real prices */
PAIRS.forEach(sym=>{ const base=sym.replace('USDT',''); market[sym]={sym:sym, base:base, price:0, open:0, chg:0, high:0, low:0, vol:0, ts:0, source:'loading'}; });
const NOT_TRADEABLE = {MATICUSDT:true};

/* ---------- app state ---------- */
const state = {
  user: null, // {email}
  balances: {}, // filled from GET /api/account after login — no demo seed
  accountLoaded: false, // distinguishes a confirmed empty wallet from a failed/unavailable account read
  favorites: new Set(['BTCUSDT','ETHUSDT','SOLUSDT']),
  orders: [], // {order_id,symbol,side,type,price,qty,remaining,status,created_at}
  trades: [],
  secondsPositions: {open:[],history:[]},
  kyc: {level:0,status:'unverified'}, // 0 unverified,1 basic,2 advanced
  settings: {twofa:false, fundPwdSet:false, hideSmall:false, lang:'en'},
  admin: { users:[], deposits:[], withdrawals:[], kycs:[] },
  adminAuth: null, // base64(user:pass) for HTTP Basic Auth on admin endpoints (independent of user cookie)
  depthCache: null, // {sym,bids,asks} from real /api/depth polling
  depthTimer: null,
  marketUnavailable: true, // until first successful /api/market poll
  currentPair: 'BTCUSDT',
  currentInterval: '15m',
  chart: null,
  chartKline: null,
  tickTimer: null,
  secondsTimer: null,
  supportMsgs: [{from:'bot',text:'Welcome to BTCBOX Support. How can we help you today?',ts:Date.now()-60000}],
};

/* orders/trades filled from GET /api/account and /api/orders — no demo seed */

/* ---------- escapeHtml — global HTML/attribute-safe escaper.
   MUST wrap every user-controlled string interpolated into innerHTML (admin tables, order tables,
   addresses, emails, names, references, ids, coin/network/symbol labels, attribute values).
   Numeric formatters (fmt/fmtPrice) and status mappers return controlled text and need no wrapping. ---------- */
function escapeHtml(value){
  return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});
}
if(typeof window!=='undefined'){ window.escapeHtml=escapeHtml; }

/* ---------- toast / modal / skeleton / emptyState ---------- */
function toast(msg,type='ok'){
  const el=document.createElement('div');
  el.className='toast '+(type==='err'?'err':type==='warn'?'warn':'');
  el.setAttribute('role',type==='err'?'alert':'status');
  el.setAttribute('aria-live',type==='err'?'assertive':'polite');
  const icon=document.createElement('span');
  icon.style.color=type==='err'?'var(--down)':type==='warn'?'var(--warning)':'var(--brand-bright)';
  icon.style.fontWeight='700';
  icon.textContent=type==='err'?'!':'i';
  const message=document.createElement('span');
  message.textContent=String(msg==null?'':msg);
  el.append(icon,message);
  $('#toast-root').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300)},3200);
}
let _modalDepth=0;
function _lockBodyScroll(){ if(_modalDepth===0) document.body.classList.add('modal-open'); _modalDepth++; }
function _unlockBodyScroll(){ _modalDepth=Math.max(0,_modalDepth-1); if(_modalDepth===0) document.body.classList.remove('modal-open'); }
function modal(title,bodyHTML,onMount){
  const root=$('#modal-root');
  if(root.children.length) _unlockBodyScroll();
  root.innerHTML='<div class="modal-mask" id="modal-mask"><div class="modal-box"><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)"><div style="font-weight:600;font-size:16px">'+title+'</div><button id="modal-x" style="color:var(--text-muted);font-size:20px;line-height:1">&times;</button></div><div style="padding:20px">'+bodyHTML+'</div></div></div>';
  const close=()=>{root.innerHTML='';_unlockBodyScroll();};
  $('#modal-x').onclick=close;
  $('#modal-mask').onclick=e=>{if(e.target.id==='modal-mask')close();};
  document.addEventListener('keydown',function esc(e){ if(e.key==='Escape'){close();document.removeEventListener('keydown',esc);} });
  _lockBodyScroll();
  if(onMount)onMount(close);
  return close;
}
function skeleton(rows=6,cols=4){
  let h='<div style="padding:8px 0">';
  for(let i=0;i<rows;i++){h+='<div style="display:flex;gap:12px;margin-bottom:12px">';for(let c=0;c<cols;c++)h+='<div class="skel" style="height:14px;flex:1;opacity:'+(0.5+Math.random()*0.5)+'"></div>';h+='</div>';}
  return h+'</div>';
}
function emptyState(title,sub){
  return '<div style="text-align:center;padding:48px 24px;color:var(--text-secondary)"><svg viewBox="0 0 100 100" role="img" aria-label="BTCBOX" style="width:64px;height:64px;object-fit:contain;opacity:.35;margin-bottom:16px"><g fill="none" stroke="#EAECEF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M82 36 L90 50 L50 90 L10 50 L50 10 L68 24"/></g><polygon points="17,45 50,68 97,25 50,80 21,55" fill="#2E9E6B"/></svg><div style="font-weight:600;color:var(--text-primary);margin-bottom:6px">'+title+'</div><div style="font-size:13px">'+(sub||'')+'</div></div>';
}

/* ---------- network error banner (fixed top, closable, retry) ---------- */
let netBannerEl=null, netRetryFn=null;
function showNetError(msg, retryFn){
  netRetryFn = retryFn || (typeof refreshMarket==='function'?refreshMarket:null);
  if(!netBannerEl){
    netBannerEl=document.createElement('div');
    netBannerEl.id='net-banner';
    netBannerEl.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#3a1c10;border-bottom:2px solid var(--warning);color:#ffd98a;padding:10px 16px;font-size:13px;display:none;align-items:center;gap:12px;flex-wrap:wrap';
    document.body.appendChild(netBannerEl);
  }
  netBannerEl.innerHTML='<span style="font-weight:700">&#9888;</span><span id="net-banner-msg" style="flex:1;min-width:200px">'+msg+'</span>'+
    '<button id="net-banner-retry" class="btn btn-primary" style="padding:5px 12px;font-size:12px">Retry</button>'+
    '<button id="net-banner-close" style="color:var(--text-muted);font-size:18px;line-height:1;background:none;border:none;cursor:pointer">&times;</button>';
  netBannerEl.style.display='flex';
  const rb=$('#net-banner-retry'); if(rb) rb.onclick=()=>{ hideNetError(); if(netRetryFn) netRetryFn(); };
  const cb=$('#net-banner-close'); if(cb) cb.onclick=hideNetError;
}
function hideNetError(){ if(netBannerEl) netBannerEl.style.display='none'; }

function handleSessionExpired(){
  if(!state.user) return;
  try{ rememberLoginReturn(location.hash); }catch(e){}
  state.user=null;state.accountLoaded=false;state.balances={};state.orders=[];state.trades=[];state.secondsPositions={open:[],history:[]};state.kyc={level:0,status:'unverified'};state.settings.twofa=false;state.settings.fundPwdSet=false;state.supportMsgs=[];state.adminAuth=null;
  toast('Session expired — please log in again.','warn');
  try{ location.hash='#/login'; }catch(e){}
}

/* ---------- unified fetch helper (all requests credentials:include) ---------- */
async function apiFetch(path, opts){
  opts = opts||{};
  const method = opts.method||'GET';
  const body = opts.body!=null?opts.body:null;
  const isAdmin = !!opts.admin;
  const skipAuthRedirect = !!opts.skipAuthRedirect;
  const url = API_BASE + (path.charAt(0)==='/'?'':'/') + path;
  const headers = {'Content-Type':'application/json'};
  if(isAdmin && state.adminAuth) headers['Authorization']='Basic '+state.adminAuth;
  let resp, text;
  try{
    resp = await fetch(url, {method:method, headers:headers, credentials:'include', body: (body!=null)?JSON.stringify(body):undefined});
  }catch(e){
    showNetError('Network unreachable — cannot reach '+API_BASE+'. Check connection or API_BASE constant.');
    return {ok:false, msg:'Network error', code:'NETWORK_ERROR', status:0};
  }
  text = await resp.text();
  let data={};
  try{ data = text?JSON.parse(text):{}; }catch(e){ data={ok:false, msg:'Invalid JSON from server', raw:text}; }
  if(!data || typeof data!=='object') data={ok:false, msg:'Bad response', raw:text};
  // Admin 401 -> signal caller to re-prompt credentials
  if(resp.status===401 && isAdmin){ state.adminAuth=null; data._adminAuthFailed=true; data.status=401; return data; }
  // User 401 -> clear session, redirect to login
  if(resp.status===401){
    if(!skipAuthRedirect) handleSessionExpired();
    data.status=401; return data;
  }
  // Inconsistent endpoints return HTTP 200 + {ok:false, need_login:true}
  if(resp.status===200 && data.ok===false && data.need_login===true){
    if(!skipAuthRedirect) handleSessionExpired();
    return data;
  }
  if(!resp.ok){
    if(resp.status>=500) showNetError('Server error '+resp.status+' — '+((data&&data.msg)||'please retry later.'));
    data.status=resp.status; return data;
  }
  hideNetError();
  return data;
}

/* ---------- admin Basic Auth prompt (reuses existing modal) ---------- */
function promptAdminAuth(){
  return new Promise(resolve=>{
    modal('Admin Authentication','<form id="aa-form"><div style="margin-bottom:12px"><label class="auth-label">Admin Username</label><input id="aa-user" class="auth-input" autocomplete="off" required></div><div style="margin-bottom:16px"><label class="auth-label">Admin Password</label><input id="aa-pass" class="auth-input" type="password" autocomplete="off" required></div><button class="btn btn-primary btn-block">Continue</button></form>', close=>{
      $('#aa-form').onsubmit=e=>{ e.preventDefault(); const u=$('#aa-user').value.trim(), p=$('#aa-pass').value; if(!u||!p){ toast('Enter admin username and password.','err'); return; } try{ state.adminAuth=btoa(u+':'+p); }catch(err){ state.adminAuth=btoa(unescape(encodeURIComponent(u+':'+p))); } close(); resolve(state.adminAuth); };
    });
  });
}
async function adminFetch(path, opts){
  opts = opts||{};
  if(!state.adminAuth) await promptAdminAuth();
  let r = await apiFetch(path, Object.assign({}, opts, {admin:true}));
  if(r && r._adminAuthFailed){
    toast('Admin credentials rejected — please re-enter.','err');
    await promptAdminAuth();
    r = await apiFetch(path, Object.assign({}, opts, {admin:true}));
    if(r && r._adminAuthFailed){ state.adminAuth=null; return {ok:false, msg:'Admin authentication failed', status:401}; }
  }
  return r;
}

/* ---------- account / market data mappers (real response -> state) ---------- */
function applyAccount(r){
  if(!r) return;
  if(r.ok===true) state.accountLoaded=true;
  if(r.balances){
    state.balances={};
    for(const c in r.balances){ const b=r.balances[c]||{}; state.balances[c]={free:Number(b.free||0), frozen:Number(b.frozen||0), amount:b.amount, usdt:b.usdt, valuation_available:b.valuation_available}; }
  }
  if(r.email){ if(!state.user) state.user={email:r.email}; else state.user.email=r.email; }
  if(r.uid && state.user) state.user.uid=r.uid;
  state.kyc={level:r.kyc_level||0, status:r.kyc||'unverified'};
  state.settings.twofa=!!r.twofa_enabled;
  state.settings.fundPwdSet=!!r.fund_password_set;
  if(Array.isArray(r.orders)){
    state.orders=r.orders.map(o=>({order_id:o.order_id, symbol:o.symbol, side:(o.side||'').toUpperCase(), type:o.type||'limit', price:Number(o.price||0), qty:Number(o.quantity||0), remaining:Number(o.remaining_quantity!=null?o.remaining_quantity:(o.quantity||0)), status:o.status, created_at:o.created_at, client_order_id:o.client_order_id}));
  }
}
function applyMarket(r){
  if(!r||typeof r!=='object') return;
  const supported=new Set(PAIRS);
  const nowSeconds=Math.floor(Date.now()/1000);
  const normalizeSymbol=raw=>{
    if(typeof raw!=='string') return null;
    let base=raw.trim().toUpperCase();
    if(base.endsWith('USDT')) base=base.slice(0,-4);
    if(!/^[A-Z0-9]{2,12}$/.test(base)) return null;
    const sym=base+'USDT';
    return supported.has(sym)?{sym:sym,base:base}:null;
  };
  const validTimestamp=value=>{
    if(value===undefined||value===null||value==='') return null;
    const ts=Number(value);
    return Number.isSafeInteger(ts)&&ts>=946684800&&ts<=nowSeconds+300?ts:null;
  };
  const applyRecord=(rawSymbol,record)=>{
    const normalized=normalizeSymbol(rawSymbol);
    if(!normalized||!record||typeof record!=='object'||Array.isArray(record)) return;
    const current=market[normalized.sym];
    const incomingPrice=record.price===undefined||record.price===null||record.price===''?NaN:Number(record.price);
    // Never create a new pair from an invalid/empty price record.
    if(!current&&(!Number.isFinite(incomingPrice)||incomingPrice<=0)) return;
    const next=current||{sym:normalized.sym,base:normalized.base,price:0,chg:0,high:0,low:0,vol:0,ts:0,source:null};
    const fields=['price','chg','high','low','vol'];
    fields.forEach(key=>{
      const raw=record[key];
      if(raw===undefined||raw===null||raw==='') return;
      const value=Number(raw);
      if(!Number.isFinite(value)) return;
      if((key==='price'||key==='high'||key==='low')&&value<=0) return;
      if(key==='vol'&&value<0) return;
      next[key]=value;
    });
    const timestampValue=record.ts===undefined?r.ts:record.ts;
    const incomingTs=validTimestamp(timestampValue);
    if(incomingTs!==null) next.ts=incomingTs;
    else if(!validTimestamp(next.ts)) next.ts=0;
    if(typeof record.source==='string'&&record.source.trim()) next.source=record.source.trim();
    else if(typeof r.source==='string'&&r.source.trim()) next.source=r.source.trim();
    market[normalized.sym]=next;
  };
  if(r.data&&typeof r.data==='object'&&!Array.isArray(r.data)){
    Object.entries(r.data).forEach(([base,record])=>applyRecord(base,record));
  }
  if(Array.isArray(r.markets)){
    r.markets.forEach(record=>{if(record) applyRecord(record.sym,record);});
  }
}
function updateLivePriceEls(){
  $$('[data-live-price]').forEach(el=>{ const sym=el.getAttribute('data-live-price'); if(market[sym]&&market[sym].price){ el.textContent=fmtPrice(market[sym].price, sym.replace('USDT','')); } });
  $$('[data-live-chg]').forEach(el=>{ const sym=el.getAttribute('data-live-chg'); if(market[sym]){ const c=market[sym].chg; el.textContent=pct(c); el.style.color=c>=0?'var(--up)':'var(--down)'; } });
}
async function refreshMarket(){
  const r=await apiFetch('/market');
  if(r.ok && (r.data||r.markets)){ state.marketUnavailable=false; hideNetError(); applyMarket(r); updateLivePriceEls(); }
  else { state.marketUnavailable=true; showNetError((r&&r.msg)?r.msg:'Market data unavailable (backend 503). Prices are NOT simulated.', refreshMarket); }
}
async function refreshDepth(){
  const sym=state.currentPair; if(!sym) return;
  const r=await apiAdapter.depth(sym);
  if(r.ok){ state.depthCache={sym:sym, bids:r.bids, asks:r.asks, ts:Date.now()}; const ob=$('#orderbook'); if(ob && location.hash.indexOf('/trade')>=0) ob.innerHTML=renderOrderbook(sym); }
}

/* ---------- apiAdapter (live backend — 46 contract + 5 extra admin endpoints) ---------- */
const apiAdapter = {
  // AUTH -> POST /api/login/2fa {temp_token,code} — retained for the optional server-side 2FA challenge after Google OAuth
  async login2fa(temp_token,code){ return apiFetch('/login/2fa',{method:'POST',body:{temp_token:temp_token,code:code,twofa_code:code},skipAuthRedirect:true}); },
  // AUTH -> POST /api/logout (backend clears cookie)
  async logout(){ const r=await apiFetch('/logout',{method:'POST',skipAuthRedirect:true}); state.user=null; return r; },
  // AUTH -> POST /api/supabase-login {supabase_access_token}
  async supabaseLogin(supabase_access_token){ return apiFetch('/supabase-login',{method:'POST',body:{supabase_access_token:supabase_access_token},skipAuthRedirect:true}); },
  // ACCOUNT -> GET /api/account
  async account(){ const r=await apiFetch('/account'); if(r.ok) applyAccount(r); return r; },
  // ACCOUNT -> GET /api/addresses (address book, masked)
  async addresses(coin){ return apiFetch('/addresses'); },
  // ACCOUNT -> GET /api/addresses/select?id= (full address)
  async addressSelect(id){ return apiFetch('/addresses/select?id='+encodeURIComponent(id)); },
  // ACCOUNT -> POST /api/addresses
  async addAddress(p){ return apiFetch('/addresses',{method:'POST',body:p}); },
  // ACCOUNT -> POST /api/deposit {coin,network,amount:0} -> deposit address (query mode; amount>0 is 403)
  async deposit(p){ return apiFetch('/deposit',{method:'POST',body:{coin:p.coin||'USDT', network:p.network||'TRC20', amount:0}}); },
  // ACCOUNT -> POST /api/withdraw {coin,amount,address,network,request_id(16-80),fund_password,twofa_code?}
  async withdraw(p){
    const body={coin:p.coin, amount:p.amount, address:p.address, network:p.network, request_id:p.request_id||uid(), fund_password:p.fund_password};
    if(p.twofa_code) body.twofa_code=p.twofa_code;
    return apiFetch('/withdraw',{method:'POST',body:body});
  },
  // TRADE -> POST /api/order {symbol(BTCUSDT),side(BUY/SELL),type(limit),qty(number),price,client_order_id(16+),request_id}
  async placeOrder(o){
    const body={symbol:o.symbol, side:String(o.side||'').toUpperCase(), type:String(o.type||'limit').toLowerCase(), qty:Number(o.qty), price:Number(o.price), client_order_id:o.client_order_id||uid(), request_id:o.request_id||uid()};
    return apiFetch('/order',{method:'POST',body:body});
  },
  // TRADE -> POST /api/order/cancel {order_id,client_cancel_id(16+),request_id}
  async cancelOrder(order_id){ return apiFetch('/order/cancel',{method:'POST',body:{order_id:order_id, client_cancel_id:uid(), request_id:uid()}}); },
  // TRADE -> GET /api/orders
  async orders(status){ const r=await apiFetch('/orders'); if(r.ok && Array.isArray(r.orders)){ applyAccount({orders:r.orders}); if(status) r.orders=r.orders.filter(o=>o.status===status); } return r; },
  // MARKET -> GET /api/config
  async config(){ return apiFetch('/config'); },
  // MARKET -> GET /api/market (real Coinbase/Bybit; 503 on failure — never synthesized)
  async marketList(){ const r=await apiFetch('/market'); if(r.ok) applyMarket(r); return r; },
  // MARKET -> GET /api/kline?symbol=&interval= ; remap [t,o,h,l,c,v] -> [t,o,c,l,h,v] for candleOption
  async kline(symbol,interval){
    const r=await apiFetch('/kline?symbol='+encodeURIComponent(symbol||'BTCUSDT')+'&interval='+encodeURIComponent(interval||'15m'));
    if(!r.ok) return {ok:false, msg:r.msg||'K-line data unavailable', klines:[], source:r.source};
    let rows=[];
    if(Array.isArray(r.data)) rows=r.data;
    else if(Array.isArray(r.klines)) rows=r.klines.map(k=>[k.time,k.open,k.high,k.low,k.close,k.volume]);
    const klines=rows.map(row=>[Number(row[0]), Number(row[1]), Number(row[4]), Number(row[3]), Number(row[2]), Number(row[5])]);
    return {ok:true, klines:klines, source:r.source};
  },
  // MARKET -> GET /api/depth?symbol= ; Number()-normalize string price/size
  async depth(symbol){
    const r=await apiFetch('/depth?symbol='+encodeURIComponent(symbol||'BTCUSDT'));
    if(!r.ok) return {ok:false, msg:r.msg||'Depth data unavailable', bids:[], asks:[]};
    return {ok:true, bids:(r.bids||[]).map(x=>[Number(x[0]),Number(x[1])]), asks:(r.asks||[]).map(x=>[Number(x[0]),Number(x[1])]), source:r.source, ts:Date.now()};
  },
  // MARKET -> POST /api/captcha (always 503 in live; optional — never blocks flow)
  async captcha(){ try{ const r=await apiFetch('/captcha',{method:'POST',body:{},skipAuthRedirect:true}); return r; }catch(e){ return {ok:false, code:'VERIFICATION_UNAVAILABLE', msg:'Captcha unavailable — treated as optional'}; } },
  // SECONDS -> POST /api/seconds/order {symbol(bare base e.g. BTC/ETH/SOL/BNB),direction,duration_sec,amount,request_id(16+)}
  async secondsOrder(o){
    const r=await apiFetch('/seconds/order',{method:'POST',body:{symbol:o.symbol, direction:o.direction, duration_sec:o.duration_sec||o.duration, amount:o.amount, request_id:o.request_id||uid()}});
    if(r.ok){
      r.position={position_id:r.position_id, symbol:r.symbol, direction:r.direction, amount:r.amount, duration_sec:r.duration_sec, open_price:r.open_price, settle_at:r.settle_at, status:'open'};
      await this.secondsPositionsGet();
    }
    return r;
  },
  // SECONDS -> POST /api/seconds/settle {position_id,request_id,symbol(bare base)}
  async secondsSettle(p){
    const r=await apiFetch('/seconds/settle',{method:'POST',body:{position_id:p.position_id, request_id:p.request_id||uid(), symbol:p.symbol}});
    if(r.ok && r.settled!==false){
      // Move to history only after the API explicitly confirms settlement.
      const idx=state.secondsPositions.open.findIndex(x=>x.position_id===p.position_id);
      if(idx>=0){ const pos=state.secondsPositions.open.splice(idx,1)[0]; pos.win=r.win; pos.tie=r.tie; pos.pnl=r.pnl; pos.settle_price=r.settle_price; pos.status='settled'; state.secondsPositions.history.unshift(pos); }
      else { await this.secondsPositionsGet(); }
    }
    return r;
  },
  // SECONDS -> GET /api/seconds/positions
  async secondsPositionsGet(){ const r=await apiFetch('/seconds/positions'); if(r.ok){ state.secondsPositions={open:r.open||[], history:r.history||[]}; } return r; },
  // EARN -> POST /api/earn {action subscribe|redeem,request_id,amount,product_id,record_id?}
  async earn(p){
    const body={action:p.action||'subscribe', request_id:p.request_id||uid()};
    if(p.amount!=null) body.amount=p.amount;
    if(p.product_id) body.product_id=p.product_id;
    if(p.record_id) body.record_id=p.record_id;
    return apiFetch('/earn',{method:'POST',body:body});
  },
  // KYC -> POST /api/kyc {name,id_type,id_number} (no image upload in core.js)
  async kycSubmit(p){ return apiFetch('/kyc',{method:'POST',body:{name:p.name, id_type:p.id_type||'id_card', id_number:p.id_number}}); },
  // SETTINGS -> POST /api/settings/password {old_password,new_password,twofa_code?} (success clears all sessions)
  async changePassword(p){
    const body={old_password:p.old_password, new_password:p.new_password};
    if(p.twofa_code) body.twofa_code=p.twofa_code;
    const r=await apiFetch('/settings/password',{method:'POST',body:body});
    if(r.ok){ state.user=null;state.accountLoaded=false;state.balances={};state.orders=[];state.trades=[];state.secondsPositions={open:[],history:[]};state.kyc={level:0,status:'unverified'};state.settings.twofa=false;state.settings.fundPwdSet=false;state.supportMsgs=[];state.adminAuth=null; toast('Password changed — please log in again.','ok'); try{location.hash='#/login';}catch(e){} }
    return r;
  },
  // SETTINGS -> POST /api/settings/fundpwd {fund_password,current_password?,twofa_code?}
  async setFundPassword(p){
    const body={fund_password:p.fund_password};
    if(p.current_password) body.current_password=p.current_password;
    if(p.twofa_code) body.twofa_code=p.twofa_code;
    const r=await apiFetch('/settings/fundpwd',{method:'POST',body:body});
    if(r.ok) state.settings.fundPwdSet=true;
    return r;
  },
  // 2FA -> POST /api/2fa/enable (returns secret) -> modal prompts code -> POST /api/2fa/confirm {code}
  async twofaEnable(){
    const r=await apiFetch('/2fa/enable',{method:'POST',body:{}});
    if(!r.ok) return r;
    const secret=r.secret||'';
    return await new Promise(resolve=>{
      modal('Enable 2FA','<div style="margin-bottom:12px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">Scan with Google Authenticator or enter secret manually:</div><div class="auth-input num" style="word-break:break-all;font-size:12px;user-select:text">'+secret+'</div>'+(r.otpauth_url?'<div style="font-size:11px;color:var(--text-muted);margin-top:6px;word-break:break-all">'+r.otpauth_url+'</div>':'')+'</div><form id="tfc-form"><div style="margin-bottom:16px"><label class="auth-label">Enter 6-digit code</label><input id="tfc-code" class="auth-input num" maxlength="6" required></div><button class="btn btn-primary btn-block">Confirm &amp; Enable</button></form>', close=>{
        $('#tfc-form').onsubmit=async e=>{ e.preventDefault(); const code=$('#tfc-code').value.trim(); if(code.length!==6){toast('Enter 6-digit code.','err');return;} const c=await apiFetch('/2fa/confirm',{method:'POST',body:{code:code}}); if(c.ok){ state.settings.twofa=true; } close(); resolve(Object.assign({},c,{secret:secret})); };
      });
    });
  },
  // 2FA -> POST /api/2fa/disable {code} — prompts code via modal
  async twofaDisable(){
    return await new Promise(resolve=>{
      modal('Disable 2FA','<form id="tfd-form"><div style="margin-bottom:16px"><label class="auth-label">Enter 6-digit 2FA code</label><input id="tfd-code" class="auth-input num" maxlength="6" required></div><button class="btn btn-primary btn-block">Disable 2FA</button></form>', close=>{
        $('#tfd-form').onsubmit=async e=>{ e.preventDefault(); const code=$('#tfd-code').value.trim(); if(code.length!==6){toast('Enter 6-digit code.','err');return;} const r=await apiFetch('/2fa/disable',{method:'POST',body:{code:code}}); if(r.ok){ state.settings.twofa=false; } close(); resolve(r); };
      });
    });
  },
  // 2FA -> POST /api/2fa/confirm {code}
  async twofaConfirm(code){ const r=await apiFetch('/2fa/confirm',{method:'POST',body:{code:code}}); if(r.ok) state.settings.twofa=true; return r; },
  // SUPPORT -> POST /api/support/chat {content}
  async supportChat(content){ return apiFetch('/support/chat',{method:'POST',body:{content:content}}); },
  // SUPPORT -> GET /api/support/messages (last 50; map content->text, admin->bot for UI)
  async supportMessages(){ const r=await apiFetch('/support/messages'); if(r.ok && Array.isArray(r.messages)){ state.supportMsgs=r.messages.map(m=>({id:m.id, from:(m.from==='admin'?'bot':m.from), text:m.content, ts:m.time})); } return r; },
  // SUPPORT -> GET /api/chat/unread
  async chatUnread(){ return apiFetch('/chat/unread'); },
  // ADMIN (all HTTP Basic Auth, independent of user cookie) -> GET /api/admin/stats
  async adminStats(){ return adminFetch('/admin/stats'); },
  // ADMIN -> GET /api/admin/users?search=
  async adminUsers(q){ return adminFetch('/admin/users'+(q?'?search='+encodeURIComponent(q):'')); },
  // ADMIN -> GET /api/admin/user?uid=
  async adminUser(id){ return adminFetch('/admin/user?uid='+encodeURIComponent(id)); },
  // ADMIN -> POST /api/admin/user/balance {uid,coin,delta,mode,request_id(16+),reason}
  async adminAdjustBalance(p){ return adminFetch('/admin/user/balance',{method:'POST',body:{uid:p.uid, coin:p.coin, delta:p.delta, mode:p.mode||'adjust', request_id:p.request_id||uid(), reason:p.reason}}); },
  // ADMIN -> POST /api/admin/user/freeze {uid,frozen,reason}
  async adminFreeze(p){ return adminFetch('/admin/user/freeze',{method:'POST',body:{uid:p.uid, frozen:p.frozen, reason:p.reason}}); },
  // ADMIN -> POST /api/admin/user/reset-pwd {uid,new_password}
  async adminResetPwd(p){ return adminFetch('/admin/user/reset-pwd',{method:'POST',body:{uid:p.uid, new_password:p.new_password}}); },
  // ADMIN -> POST /api/admin/user/reset-email {uid,new_email}
  async adminResetEmail(p){ return adminFetch('/admin/user/reset-email',{method:'POST',body:{uid:p.uid, new_email:p.new_email}}); },
  // ADMIN -> POST /api/admin/deposit/confirm {uid,coin,amount,reference?,note?,idempotency_key(16+)}
  async adminConfirmDeposit(p){ return adminFetch('/admin/deposit/confirm',{method:'POST',body:{uid:p.uid, coin:p.coin, amount:p.amount, reference:p.reference, note:p.note, idempotency_key:p.idempotency_key||uid()}}); },
  // ADMIN -> POST /api/admin/withdraw/approve {id}
  async adminApproveWithdraw(id){ return adminFetch('/admin/withdraw/approve',{method:'POST',body:{id:id}}); },
  // ADMIN -> POST /api/admin/withdraw/reject {id,reason?} (extra)
  async adminRejectWithdraw(p){ return adminFetch('/admin/withdraw/reject',{method:'POST',body:{id:p.id, reason:p.reason}}); },
  // ADMIN -> POST /api/admin/kyc/approve {uid,admin_override?,reason?} (extra)
  async adminApproveKyc(p){ return adminFetch('/admin/kyc/approve',{method:'POST',body:{uid:p.uid, admin_override:!!p.admin_override, reason:p.reason}}); },
  // ADMIN -> POST /api/admin/kyc/reject {uid,reason}
  async adminRejectKyc(p){ return adminFetch('/admin/kyc/reject',{method:'POST',body:{uid:p.uid, reason:p.reason||'Rejected by admin'}}); },
  // ADMIN -> POST /api/admin/push {content,uid?}
  async adminPush(p){ return adminFetch('/admin/push',{method:'POST',body:{content:p.content, uid:p.uid}}); },
  // ADMIN -> POST /api/admin/support/reply {uid,content}
  async adminSupportReply(p){ return adminFetch('/admin/support/reply',{method:'POST',body:{uid:p.uid, content:p.content}}); },
  // ADMIN -> GET /api/admin/addresses
  async adminAddresses(){ return adminFetch('/admin/addresses'); },
  // ADMIN -> GET /api/admin/withdrawals
  async adminWithdrawals(){ return adminFetch('/admin/withdrawals'); },
  // ADMIN -> GET /api/admin/orders
  async adminOrders(){ return adminFetch('/admin/orders'); },
  // ADMIN -> GET /api/admin/support/messages
  async adminSupportMessages(){ return adminFetch('/admin/support/messages'); },
  // ADMIN -> POST /api/admin/config (body) / GET (no body) (extra)
  async adminConfig(p){ if(p && typeof p==='object' && !(p instanceof Event)) return adminFetch('/admin/config',{method:'POST',body:p}); return adminFetch('/admin/config'); },
};


/* ---------- helpers: balances, kline gen, depth, deposit address, bot reply ---------- */
function totalBalanceUsdt(){
  let t=0;
  for(const coin in state.balances){
    const b=state.balances[coin];
    if(coin==='USDT') t+=b.free+b.frozen;
    else { const sym=coin+'USDT'; if(market[sym]) t+=(b.free+b.frozen)*market[sym].price; }
  }
  return t;
}
/* Removed: genKlines / genDepth / depositAddress / botReply — all synthesized local data. Market data comes only from backend /api/market, /api/kline, /api/depth; deposit addresses only from POST /api/deposit. */

/* ---------- live ticks via real /api/market + /api/depth polling (no local synthesis) ---------- */
function startTicker(){
  if(state.tickTimer)clearInterval(state.tickTimer);
  if(state.depthTimer)clearInterval(state.depthTimer);
  refreshMarket(); refreshDepth();
  state.tickTimer=setInterval(()=>{ refreshMarket(); }, 3000);
  state.depthTimer=setInterval(()=>{ refreshDepth(); }, 2500);
}

/* ---------- sidebar nav definition ---------- */
const NAV = [
  {route:'home',label:'Home',icon:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>'},
  {route:'markets',label:'Markets',icon:'<path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/>'},
  {route:'trade',label:'Trade (Spot)',icon:'<path d="M7 7h11l-3-3M17 17H6l3 3"/>'},
  {route:'kline',label:'K-Line Full',icon:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12v4M12 9v7M16 6v10"/>'},
  {route:'seconds',label:'Seconds',icon:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'},
  {route:'orders',label:'Orders',icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>'},
  {route:'assets',label:'Assets',icon:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>'},
  {route:'deposit',label:'Deposit',icon:'<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/>'},
  {route:'withdraw',label:'Withdraw',icon:'<path d="M12 21V9m0 0 4 4m-4-4-4 4M4 3h16"/>'},
  {route:'earn',label:'Earn',icon:'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'},
  {route:'kyc',label:'Identity (KYC)',icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'},
  {route:'support',label:'Support',icon:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'},
  {route:'settings',label:'Settings',icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'},
  {route:'admin',label:'Admin Console',icon:'<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/>'},
];
function renderSidebar(active){
  $('#side-nav').innerHTML=NAV.map(n=>{
    const href = n.route==='trade'?'#/trade/'+state.currentPair : n.route==='kline'?'#/kline/'+state.currentPair : '#/'+n.route;
    return '<a class="nav-item '+(active===n.route?'active':'')+'" href="'+href+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+n.icon+'</svg>'+n.label+'</a>';
  }).join('');
  const mobileActive = ({trade:'tradehub','trade-hub':'tradehub',seconds:'tradehub',orders:'tradehub',kline:'tradehub',earn:'tradehub',deposit:'assets',withdraw:'assets',kyc:'me',settings:'me',support:'me'})[active] || active;
  $$('.mob-tab').forEach(t=>t.classList.toggle('active',t.dataset.route===mobileActive));
}

/* ---------- guest access and return-to routing ---------- */
const GUEST_PUBLIC_ROUTES = new Set(['home','markets','trade','tradehub','kline','seconds','help','404','admin']);
const GUEST_PREVIEW_ROUTES = new Set(['assets','me']);
function rememberLoginReturn(target,intent){
  const value=String(target||location.hash||'#/markets');
  // Only retain an internal hash route; never allow an external redirect target.
  if(!/^#\/[a-z0-9-]+(?:\/[a-z0-9._-]+)?$/i.test(value)) return;
  try{
    sessionStorage.setItem('btcbox_login_return_to',value);
    if(intent==='BUY'||intent==='SELL') sessionStorage.setItem('btcbox_login_intent',intent);
  }catch(e){}
}
window.BTCBoxRequireLogin=function(target,intent){
  rememberLoginReturn(target||location.hash||'#/markets',intent);
  if(!state.user) location.hash='#/login';
  return !!state.user;
};
function guestAccessView(route){
  const asset=route==='assets';
  const title=asset?'Your assets, in one secure place':'Your BTCBOX account';
  const copy=asset?'Sign in to view balances, deposits, withdrawals and asset records. Public market prices remain available without an account.':'Sign in to manage your profile, identity verification, security and support conversations.';
  const target=location.hash||('#/'+route);
  return '<section class="guest-access-view card"><div class="guest-access-icon" aria-hidden="true">↗</div><div class="home-eyebrow">BTCBOX ACCOUNT</div><h1>'+title+'</h1><p>'+copy+'</p><div class="guest-access-actions"><button class="btn btn-primary" type="button" data-guest-login>Log in</button><a class="btn btn-ghost" href="#/register" data-guest-register>Create account</a></div><p class="guest-access-note">Your private account information is only shown after successful authentication.</p></section>';
}

/* ---------- router ---------- */
const HIDE_NAV = {login:true,register:true,kline:true,admin:true};
function parseHash(){
  const h=(location.hash||'#/').replace(/^#\/?/,'');
  const parts=h.split('/').filter(Boolean);
  return {route:parts[0]||'home', params:parts.slice(1)};
}
async function router(){
  if(state._klineDrawerCleanup){try{state._klineDrawerCleanup();}catch(e){}state._klineDrawerCleanup=null;}
  if(state._secCleanup){clearInterval(state._secCleanup);state._secCleanup=null;}
  if(state._secCd){clearInterval(state._secCd);state._secCd=null;}
  if(state.chartKline){try{state.chartKline.dispose();}catch(e){}state.chartKline=null;}
  if(state.chart){try{state.chart.dispose();}catch(e){}state.chart=null;}
  if(state._tradeResize){window.removeEventListener('resize',state._tradeResize);state._tradeResize=null;}
  if(state._klineResize){window.removeEventListener('resize',state._klineResize);state._klineResize=null;}
  try{$('#avatar-menu').style.display='none';}catch(e){}
  let {route,params}=parseHash();
  // Accept the public navigation slug used by desktop/mobile links.
  if(route==='trade-hub') route='tradehub';
  const main=$('#main-content');
  // Public market pages remain explorable before sign-in. Private routes retain
  // their original destination so a successful login can return the visitor there.
  if(!state.user && !GUEST_PUBLIC_ROUTES.has(route) && !GUEST_PREVIEW_ROUTES.has(route) && !['login','register'].includes(route)){
    rememberLoginReturn(location.hash||('#/'+route));
    location.hash='#/login';
    return;
  }
  if(state.user && ['login','register'].includes(route)){
    let destination='#/markets';
    try{
      const saved=sessionStorage.getItem('btcbox_login_return_to');
      if(saved && /^#\/[a-z0-9-]+(?:\/[a-z0-9._-]+)?$/i.test(saved)){destination=saved;sessionStorage.removeItem('btcbox_login_return_to');}
    }catch(e){}
    location.hash=destination;
    return;
  }
  const hide = !!HIDE_NAV[route];
  $('#sidebar').style.display = hide?'none':'';
  $('#topbar').style.display = hide?'none':'';
  $('#main-wrap').style.marginLeft = ''; document.body.classList.toggle('hide-nav', hide);
  $('#mobile-nav').style.display = hide?'none':'';
  if(!hide) renderSidebar(route);
  const guestAuth=$('#topbar-guest-auth'), avatarButton=$('#avatar-btn');
  if(guestAuth) guestAuth.style.display=state.user?'none':'flex';
  if(avatarButton) avatarButton.style.display=state.user?'flex':'none';
  // skeleton
  main.innerHTML='<div class="view-enter" style="max-width:1440px;margin:0 auto">'+skeleton(8,5)+'</div>';
  await delay(180);
  const view = VIEWS[route]||VIEWS['404'];
  const guestPreview=!state.user && GUEST_PREVIEW_ROUTES.has(route);
  main.innerHTML='<div class="view-enter" style="max-width:'+(route==='trade'||route==='kline'?'1600px':'1440px')+';margin:0 auto">'+(guestPreview?guestAccessView(route):view(params))+'</div>';
  if(guestPreview){
    const loginButton=main.querySelector('[data-guest-login]');
    const registerLink=main.querySelector('[data-guest-register]');
    if(loginButton) loginButton.onclick=()=>window.BTCBoxRequireLogin(location.hash);
    if(registerLink) registerLink.onclick=e=>{e.preventDefault();rememberLoginReturn(location.hash);location.hash='#/register';};
  } else if(view.afterRender) view.afterRender(params);
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',router);

/* view stubs — replaced by appended batches */
const VIEWS = {
  login: ()=> '<div class="card" style="padding:32px">Login view loading…</div>',
  register: ()=> '<div class="card" style="padding:32px">Register view loading…</div>',
  markets: ()=> '<div class="card" style="padding:32px">Markets view loading…</div>',
  trade: ()=> '<div class="card" style="padding:32px">Trade view loading…</div>',
  kline: ()=> '<div class="card" style="padding:32px">Kline view loading…</div>',
  seconds: ()=> '<div class="card" style="padding:32px">Seconds view loading…</div>',
  orders: ()=> '<div class="card" style="padding:32px">Orders view loading…</div>',
  assets: ()=> '<div class="card" style="padding:32px">Assets view loading…</div>',
  deposit: ()=> '<div class="card" style="padding:32px">Deposit view loading…</div>',
  withdraw: ()=> '<div class="card" style="padding:32px">Withdraw view loading…</div>',
  earn: ()=> '<div class="card" style="padding:32px">Earn view loading…</div>',
  kyc: ()=> '<div class="card" style="padding:32px">KYC view loading…</div>',
  support: ()=> '<div class="card" style="padding:32px">Support view loading…</div>',
  settings: ()=> '<div class="card" style="padding:32px">Settings view loading…</div>',
  admin: ()=> '<div class="card" style="padding:32px">Admin view loading…</div>',
  '404': ()=> '<div class="card" style="padding:48px;text-align:center"><h2 style="font-size:26px;font-weight:700">404 — Page not found</h2><p style="color:var(--text-secondary);margin:16px 0">The page you requested does not exist on BTCBOX.</p><a href="#/markets" class="btn btn-primary">Back to Markets</a></div>',
};

/* ---------- topbar: search, avatar, notif, logout ---------- */
function bindTopbar(){
  const s=$('#global-search');
  const r=$('#search-results');
  s.addEventListener('input',()=>{
    const q=s.value.trim().toUpperCase();
    if(!q){r.style.display='none';return;}
    const hits=PAIRS.filter(p=>p.includes(q)).slice(0,8);
    if(!hits.length){r.innerHTML='<div style="padding:16px;color:var(--text-muted);font-size:13px">No markets found</div>';}
    else r.innerHTML=hits.map(p=>'<a href="#/trade/'+escapeHtml(p)+'" style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px"><span style="font-weight:600">'+escapeHtml(p.replace('USDT','/USDT'))+'</span><span class="num" style="color:var(--text-secondary)">'+fmtPrice(market[p].price,p.replace('USDT',''))+'</span></a>').join('');
    r.style.display='block';
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('#global-search')&&!e.target.closest('#search-results')) r.style.display='none'; });
  $('#avatar-btn').addEventListener('click',e=>{e.stopPropagation();$('#avatar-menu').style.display=$('#avatar-menu').style.display==='block'?'none':'block';});
  document.addEventListener('click',()=>{$('#avatar-menu').style.display='none';});
  $('#notif-btn').addEventListener('click',()=>toast('No new notifications.','ok'));
  $('#logout-btn').addEventListener('click',async()=>{ try{ if(window.supabaseClient){ await window.supabaseClient.auth.signOut(); } }catch(e){} await apiAdapter.logout(); state.user=null; state.accountLoaded=false; state.balances={}; state.orders=[]; state.trades=[]; state.secondsPositions={open:[],history:[]};state.kyc={level:0,status:'unverified'};state.settings.twofa=false;state.settings.fundPwdSet=false;state.supportMsgs=[];state.adminAuth=null; toast('Logged out.','ok'); location.hash='#/login'; });
}

/* ================= Supabase Auth helper (client-side; backend cookie exchange via /api/supabase-login) ================= */
window.supabaseClient = null;
window.authConfigured = false;
function clearPrivateUserState(){
  state.user=null;
  state.accountLoaded=false;
  state.balances={};
  state.orders=[];
  state.trades=[];
  state.secondsPositions={open:[],history:[]};
  state.kyc={level:0,status:'unverified'};
  state.settings.twofa=false;
  state.settings.fundPwdSet=false;
  state.supportMsgs=[];
  state.adminAuth=null;
}


function consumeOAuthReturnTarget(){
  let raw='';
  try{
    raw=sessionStorage.getItem('oauth_return_to')||sessionStorage.getItem('btcbox_login_return_to')||'';
    sessionStorage.removeItem('oauth_return_to');
    sessionStorage.removeItem('btcbox_login_return_to');
  }catch(e){}
  if(!raw)return '';
  try{
    const target=new URL(raw,window.location.origin+window.location.pathname);
    if(target.origin!==window.location.origin||target.pathname!==window.location.pathname)return '';
    if(!/^#[/][a-z0-9-]+(?:[/][a-z0-9._-]+)?$/i.test(target.hash))return '';
    return target.href;
  }catch(e){return '';}
}


const Auth = {
  async init(){
    try{
      const r = await apiAdapter.config();
      const url = r && r.supabase_auth_url;
      const key = r && r.supabase_auth_publishable_key;
      if(url && key && window.supabase && typeof window.supabase.createClient==='function'){
        window.supabaseClient = window.supabase.createClient(url, key);
        window.authConfigured = true;
      } else {
        window.authConfigured = false;
      }
    }catch(e){ window.authConfigured = false; }
  },
  notConfiguredBanner(){
    return '<div style="margin-bottom:16px;padding:12px;border-radius:8px;background:rgba(246,70,93,.1);border:1px solid rgba(246,70,93,.3);font-size:12px;color:var(--text-secondary)">Authentication service is not configured. Please try again later or contact support.</div>';
  },
  async completeLogin(email){
    // Do not show a successful login until the backend account/session is usable.
    let account;
    try{ account=await apiAdapter.account(); }
    catch(e){
      clearPrivateUserState();
      toast('Signed in, but your BTCBOX account could not be loaded. Please try again.','err');
      return false;
    }
    if(!account || !account.ok){
      clearPrivateUserState();
      toast((account&&account.msg)||'Your BTCBOX account could not be loaded. Please try again.','err');
      return false;
    }
    state.user=Object.assign({},state.user,{email:account.email||email});
    const accountEmail=account.email||email;
    const returnTarget=consumeOAuthReturnTarget(); if(returnTarget){location.replace(returnTarget);return true;}
    const ae=$('#avatar-email'); if(ae)ae.textContent=accountEmail;
    const al=$('#avatar-letter'); if(al)al.textContent=(accountEmail[0]||'?').toUpperCase();
    toast('Logged in.','ok');
    location.hash='#/markets';
    return true;
  },
  friendlyError(err){
    if(!err) return 'Something went wrong. Please try again.';
    const msg = (String(err.message||err||'')+' '+String(err.code||'')).toLowerCase();
    if(msg.indexOf('rate limit')>=0) return 'Too many attempts. Please wait a moment and try again.';
    if(msg.indexOf('network')>=0||msg.indexOf('fetch')>=0) return 'Cannot reach the authentication service. Check your connection and try again.';
    return String(err.message||err||'Authentication failed. Please try again.');
  },
  showLoginTwoFactor(email,tempToken){
    modal('2FA Required','<form id="l2fa-form"><div style="margin-bottom:16px"><label class="auth-label">Enter 6-digit authenticator code</label><input id="l2fa-code" class="auth-input num" maxlength="6" required></div><button class="btn btn-primary btn-block">Verify</button></form>', function(close){
      let outcomeUnknown=false;
      $('#l2fa-form').onsubmit=async function(e){
        e.preventDefault();
        const code=$('#l2fa-code').value.trim();
        if(outcomeUnknown)return;
        if(!/^\d{6}$/.test(code)){ toast('Enter a 6-digit code.','err'); return; }
        const btn=$('#l2fa-form button'); if(btn){btn.disabled=true;btn.textContent='Verifying…';}
        try{
          const result=await apiAdapter.login2fa(tempToken,code);
          if(result && result.ok===true){ close(); await Auth.completeLogin(email); return; }
          const status=Number(result&&result.status||0);
          const unknown=!result||status===0||status>=500||!!(result&&(result.code==='NETWORK_ERROR'||result.code==='NETWORK_RESPONSE_ERROR'));
          if(unknown){
            outcomeUnknown=true;
            if(btn){btn.textContent='Status Unconfirmed';}
            toast('The sign-in result could not be confirmed. Do not submit another code; refresh the page and sign in again.','warn');
            return;
          }
          toast((result&&result.msg)||'2FA verification failed. Please check the code and try again.','err');
        }catch(e){
          outcomeUnknown=true;
          if(btn){btn.textContent='Status Unconfirmed';}
          toast('The sign-in result could not be confirmed. Do not submit another code; refresh the page and sign in again.','warn');
          return;
        }finally{
          if(btn&&!outcomeUnknown){btn.disabled=false;btn.textContent='Verify';}
        }
      };
    });
  },
  async exchangeSupabaseSession(email,accessToken){
    let result;
    try{ result=await apiAdapter.supabaseLogin(accessToken); }
    catch(e){ toast(Auth.friendlyError(e),'err'); return false; }
    if(result && result.require_2fa===true && result.temp_token){
      this.showLoginTwoFactor(email,result.temp_token);
      return true;
    }
    if(result && result.ok){
      return await this.completeLogin(email);
    }
    if(result && /not verified/i.test(String(result.msg||''))){
      toast('Google sign-in could not be completed because the identity provider did not confirm the account. Please try again or contact support.','err');
      return false;
    }
    toast((result&&result.msg)||'Could not complete sign-in. Please try again.','err');
    return false;
  },


};
