import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldAlert, Send, MessageCircle } from "lucide-react";
import { ApiError, getAccount, getOrders, getSecondsPositions, getSecondsPolicy, submitSecondsOrder, settleSecondsPosition, getSupportMessages, sendSupportMessage, getDepositAddress, getSavedCryptoAddresses, getSelectedCryptoAddress, getWithdrawalConfig, submitWithdrawal, getEarnCatalog, submitEarnAction, type EarnProduct, type EarnPosition, type SavedCryptoAddress, type AccountBalance, type AccountSnapshot, type OrderRecord, type SecondsPositionsSnapshot, type SecondsOrderInput, type SecondsPolicyResponse, type SupportMessage, type SelectedCryptoAddress, type WithdrawalConfig, type WithdrawalRecord } from "../../lib/api";
import { useAuth } from "../../lib/auth";

import type { ReactNode } from "react";
import { ArrowUpRight, LockKeyhole, Wallet, ChartNoAxesCombined, ArrowLeftRight } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../lib/i18n";

function PageFrame({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children:ReactNode}){
 const {t}=useI18n();
 return <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t(eyebrow)}</p><h1 className="type-page-title text-brand-text">{t(title)}</h1><p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t(description)}</p></div>{children}</div>;
}
export function TradeHubPage(){
 const {t}=useI18n();
 const products=[{title:"Spot",desc:"Buy and sell supported digital assets at market or limit prices.",to:"/trade/BTCUSDT",icon:ChartNoAxesCombined,state:"API integration pending"},{title:"Seconds",desc:"Review your actual open positions and settled history. New order entry is not enabled yet.",to:"/seconds",icon:ArrowLeftRight,state:"Positions & history available"}];
 return <PageFrame eyebrow="BTCBOX / TRADE" title="Choose your trading mode" description="Trading interfaces are being connected to BTCBOX's existing order and position services."><div className="grid gap-4 md:grid-cols-2">{products.map(({title,desc,to,icon:Icon,state})=><Card key={title} className="border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><Icon className="h-5 w-5"/></div><CardTitle>{t(title)}</CardTitle><CardDescription>{t(desc)}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className="max-w-full whitespace-normal text-center leading-tight border-amber-400/25 bg-amber-400/5 text-amber-200">{t(state)}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to={to}>{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>)}</div><Card className="border-dashed border-brand-border bg-transparent"><CardContent className="flex min-w-0 flex-wrap items-center gap-3 p-4 sm:p-5"><LockKeyhole className="h-5 w-5 shrink-0 text-brand-text-muted"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t("Futures")}</p><p className="text-sm break-words text-brand-text-muted">{t("Coming soon — no supported futures service is registered in the current backend.")}</p></div><Badge variant="secondary" className="shrink-0">{t("Unavailable")}</Badge></CardContent></Card></PageFrame>;
}
export function AssetsPage(){
 const {t}=useI18n();
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  getAccount(controller.signal).then(setAccount).catch((reason:unknown)=>{
   if(reason instanceof Error && reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Account balances are temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const amount=(raw:number|string|undefined)=>{if(raw===undefined||raw===null||raw==="")return "—";const n=Number(raw);return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:10}):"—";};
 const balances: Array<[string, AccountBalance]> = account ? Object.entries(account.balances) as Array<[string, AccountBalance]> : [];
 return <PageFrame eyebrow="BTCBOX / WALLET" title="Assets" description="Your balances are loaded from the authenticated BTCBOX account service.">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline" className="border-brand-border">{t("Live account data")}</Badge>{account&&!loading?<span className="text-xs text-brand-text-muted">{balances.length} {t("assets")}</span>:null}</div><Button size="sm" variant="outline" disabled={loading} onClick={()=>setReload((n)=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account balances…")}</CardContent></Card>
   :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
   :account?<>
    <Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-wider text-brand-text-muted">{t("Estimated account value")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-text">{account.valuation_complete?amount(account.totalUsdt)+" USDT":"—"}</p><p className="mt-2 text-xs text-brand-text-muted">{account.valuation_complete?t("All listed assets have a returned valuation."):t("Complete valuation is unavailable; no partial total is presented as a complete balance.")}</p>{account.unpriced_assets.length?<p className="mt-2 break-words text-xs text-amber-300">{t("Unpriced assets")}: {account.unpriced_assets.join(", ")}</p>:null}</CardContent></Card>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="type-section-title">{t("Your assets")}</h2><span className="text-xs text-brand-text-muted">{balances.length}</span></div>
     {balances.length?balances.map(([asset,balance])=><Card key={asset} className="border-brand-border bg-brand-surface"><CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5"><div><p className="text-xs text-brand-text-muted">{t("Asset")}</p><p className="mt-1 font-semibold">{asset}</p></div><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 font-medium tabular-nums">{amount(balance.free)}</p></div><div><p className="text-xs text-brand-text-muted">{t("In orders")}</p><p className="mt-1 font-medium tabular-nums">{amount(balance.frozen)}</p></div><div><p className="text-xs text-brand-text-muted">{t("USDT value")}</p><p className="mt-1 font-medium tabular-nums">{balance.usdt===undefined?"—":amount(balance.usdt)}</p></div></CardContent></Card>)
      :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No asset balances were returned by the account service.")}</CardContent></Card>}
    </section>
   </>:null}
  <div className="grid gap-4 sm:grid-cols-3">{[{title:"Deposit",to:"/deposit",label:"Open deposit"},{title:"Withdraw",to:"/withdraw",label:"Open withdrawal"},{title:"Earn",to:"/earn",label:"Explore Earn"}].map(x=><Card key={x.to} className="border-brand-border bg-brand-surface"><CardContent className="p-5"><p className="type-label text-brand-text-secondary">{t(x.title)}</p><Button asChild variant="link" className="mt-2 min-h-0 h-auto px-0 py-0 text-left text-brand-text-secondary"><Link to={x.to}>{t(x.label)} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>)}</div>
 </PageFrame>;
}
export function MyPage(){
 const {t}=useI18n();
 const {status}=useAuth();
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [loading,setLoading]=useState(status==="loading");
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  if(status==="loading"){setLoading(true);return;}
  if(status!=="authenticated"){setAccount(null);setLoading(false);setError("");return;}
  const controller=new AbortController();
  setLoading(true);setError("");
  getAccount(controller.signal).then(setAccount).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Account profile is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[status,reload]);
 const links=[{title:"Verification",to:"/kyc"},{title:"Orders",to:"/orders"},{title:"Support",to:"/support"},{title:"Settings",to:"/settings"}];
 return <PageFrame eyebrow="BTCBOX / ACCOUNT" title="My account" description="Manage your profile, verification, security and support.">
  {status!=="authenticated"?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-start gap-3 p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><LockKeyhole className="h-5 w-5"/></div><div><p className="type-card-title">{t("Sign in to continue")}</p><p className="type-body-compact mt-1 text-brand-text-muted">{t("Sign in to view your BTCBOX account profile.")}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Button asChild className="min-w-[112px] flex-1 sm:flex-none"><Link to="/login">{t("Sign in")}</Link></Button><Button asChild variant="outline" className="min-w-[112px] flex-1 sm:flex-none"><Link to="/register">{t("Create account")}</Link></Button></div></CardContent></Card>
  :loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account profile…")}</CardContent></Card>
  :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<Card className="border-brand-border bg-brand-surface"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
   <div><p className="text-xs text-brand-text-muted">{t("Username")}</p><p className="mt-1 break-all font-semibold">{account.username||"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Email")}</p><p className="mt-1 break-all font-semibold">{account.email||"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Verification")}</p><p className="mt-1 font-semibold capitalize">{account.kyc?.status||"not submitted"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Two-factor authentication")}</p><p className="mt-1 font-semibold">{account.twofa_enabled?t("Enabled"):t("Not enabled")}</p></div>
   <div className="sm:col-span-2"><p className="text-xs text-brand-text-muted">{t("Linked sign-in methods")}</p><div className="mt-2 flex flex-wrap gap-2">{(account.auth_providers||[]).length?(account.auth_providers||[]).map(provider=><Badge key={provider} variant="outline" className="border-brand-border capitalize">{provider}</Badge>):<span className="text-sm text-brand-text-muted">—</span>}</div></div>
   <div className="sm:col-span-2 border-t border-brand-border pt-3"><p className="text-xs text-brand-text-muted">{t("BTCBOX account ID")}</p><p className="mt-1 break-all font-mono text-xs text-brand-text-secondary">{account.uid?account.uid.slice(0,8)+"…"+account.uid.slice(-4):"—"}</p></div>
  </CardContent></Card>:null}
  <div className="grid gap-3 sm:grid-cols-2">{links.map(x=><Link key={x.to} to={x.to} className="rounded-xl border border-brand-border bg-brand-surface p-4 text-sm font-semibold transition-colors hover:border-brand-accent/40 hover:bg-brand-surface-2">{t(x.title)}<ArrowUpRight className="ml-2 inline h-4 w-4 text-brand-text-secondary"/></Link>)}</div>
 </PageFrame>;
}


export function OrdersPage(){
 const {t}=useI18n();
 const [orders,setOrders]=useState<OrderRecord[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  getOrders(controller.signal).then(setOrders).catch((reason:unknown)=>{
   if(reason instanceof Error && reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Order history is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const value=(raw:unknown)=>raw===null||raw===undefined||raw===""?"—":String(raw);
 const date=(raw?:string)=>{if(!raw)return "—";const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?raw:parsed.toLocaleString();};
 const statusTone=(status?:string)=>{
  const normalized=String(status||"").toLowerCase();
  if(["filled","completed","success","settled"].includes(normalized))return "border-emerald-500/30 text-emerald-400";
  if(["cancelled","canceled","rejected","failed","expired"].includes(normalized))return "border-rose-500/30 text-rose-400";
  return "border-amber-500/30 text-amber-300";
 };
 return <PageFrame eyebrow="BTCBOX / ACCOUNT" title="Orders" description="Review order records returned by your authenticated BTCBOX account service. This page is read-only.">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-2"><Badge variant="outline" className="border-brand-border">{t("Read-only history")}</Badge>{!loading&&!error?<span className="text-xs text-brand-text-muted">{orders.length} {t("records")}</span>:null}</div>
   <Button size="sm" variant="outline" disabled={loading} onClick={()=>setReload((n)=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button>
  </div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading orders…")}</CardContent></Card>
   :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
   :orders.length===0?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-border bg-brand-surface-2"><Clock3 className="h-5 w-5 text-brand-text-muted"/></div><p className="font-semibold">{t("No orders returned")}</p><p className="mt-2 max-w-md text-sm text-brand-text-muted">{t("The account service returned no order records. No sample or simulated orders are shown.")}</p><Button asChild variant="secondary" className="mt-5"><Link to="/trade-hub">{t("Explore trading")}</Link></Button></CardContent></Card>
   :<div className="space-y-3">{orders.map((order,index)=>{
    const id=value(order.order_id??order.id);
    const side=String(order.side||"").toLowerCase();
    return <Card key={id!=="—"?id:index} className="min-w-0 border-brand-border bg-brand-surface"><CardContent className="grid gap-3 p-4 sm:p-5">
     <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-semibold">{value(order.symbol)}</span><Badge variant="outline" className={side==="buy"?"border-emerald-500/30 text-emerald-400":side==="sell"?"border-rose-500/30 text-rose-400":"border-brand-border"}>{value(order.side)}</Badge><span className="text-xs text-brand-text-muted">{value(order.type)}</span></div><Badge variant="outline" className={statusTone(order.status)}>{value(order.status)}</Badge></div>
     <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><p className="text-xs text-brand-text-muted">{t("Price")}</p><p className="mt-1 font-medium tabular-nums">{value(order.price)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Quantity")}</p><p className="mt-1 font-medium tabular-nums">{value(order.quantity)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Amount")}</p><p className="mt-1 font-medium tabular-nums">{value(order.amount)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Created")}</p><p className="mt-1 font-medium">{date(order.created_at)}</p></div></div>
     <p className="border-t border-brand-border pt-2 text-[11px] text-brand-text-muted">{t("Order ID")}: <span className="break-all font-mono">{id}</span></p>
    </CardContent></Card>;
   })}</div>}
 </PageFrame>;
}

export function SectionPage({title,description}:{title:string;description:string}){const {t}=useI18n();return <PageFrame eyebrow="BTCBOX / WORKSPACE" title={title} description={description}><Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-start gap-3 p-4 sm:p-5"><Badge variant="outline" className="shrink-0 border-amber-400/25 bg-amber-400/5 text-amber-200">{t("Integration pending")}</Badge><p className="type-body-compact min-w-0 flex-1 text-brand-text-muted">{t("This page is scaffolded; no live action is enabled in this preview.")}</p></CardContent></Card></PageFrame>}


export function SecondsPage(){
 const {t}=useI18n();
 const [snapshot,setSnapshot]=useState<SecondsPositionsSnapshot|null>(null);
 const [policy,setPolicy]=useState<SecondsPolicyResponse|null>(null);
 const [uid,setUid]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [policyError,setPolicyError]=useState("");
 const [notice,setNotice]=useState("");
 const [reload,setReload]=useState(0);
 const [symbol,setSymbol]=useState("BTC");
 const [direction,setDirection]=useState<"up"|"down">("up");
 const [duration,setDuration]=useState(30);
 const [amount,setAmount]=useState("");
 const [pendingIntent,setPendingIntent]=useState<SecondsOrderInput|null>(null);
 const [submitting,setSubmitting]=useState(false);
 const [clockNow,setClockNow]=useState(Date.now());
 const settling=useRef(new Set<string>());
 const storageKey=uid?"btcbox.seconds.pending.v1."+uid:"";

 useEffect(()=>{
  const timer=window.setInterval(()=>setClockNow(Date.now()),1000);
  return ()=>window.clearInterval(timer);
 },[]);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");setPolicyError("");
  Promise.allSettled([getAccount(controller.signal),getSecondsPositions(controller.signal),getSecondsPolicy(controller.signal)]).then(([accountResult,positionsResult,policyResult])=>{
   if(controller.signal.aborted)return;
   let restoredIntent:SecondsOrderInput|null=null;
   if(accountResult.status==="fulfilled"){
    const nextUid=accountResult.value.uid;
    setUid(nextUid);
    try{
     const raw=window.localStorage.getItem("btcbox.seconds.pending.v1."+nextUid);
     if(raw){
      const saved=JSON.parse(raw) as SecondsOrderInput;
      if(saved&&typeof saved.request_id==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(saved.request_id)&&
         ["BTC","ETH","SOL","BNB"].includes(saved.symbol)&&(saved.direction==="up"||saved.direction==="down")&&
         [30,60,300,900].includes(saved.duration_sec)&&typeof saved.amount==="string"){
       restoredIntent=saved;
      }else window.localStorage.removeItem("btcbox.seconds.pending.v1."+nextUid);
     }
    }catch{restoredIntent=null;}
   }else setError(accountResult.reason instanceof Error?accountResult.reason.message:"Account identity is unavailable.");
   setPendingIntent(restoredIntent);
   if(restoredIntent){setSymbol(restoredIntent.symbol);setDirection(restoredIntent.direction);setDuration(restoredIntent.duration_sec);setAmount(restoredIntent.amount);}
   if(positionsResult.status==="fulfilled")setSnapshot(positionsResult.value);
   else setError(positionsResult.reason instanceof Error?positionsResult.reason.message:"Seconds positions are temporarily unavailable.");
   if(policyResult.status==="fulfilled"){
    setPolicy(policyResult.value);
    if(!restoredIntent){
     setSymbol(current=>policyResult.value.policy.symbols.includes(current)?current:policyResult.value.policy.symbols[0]);
     setDuration(current=>policyResult.value.policy.durations_sec.includes(current)?current:policyResult.value.policy.durations_sec[0]);
    }
   }else{
    setPolicy(null);
    setPolicyError(policyResult.reason instanceof Error?policyResult.reason.message:"Seconds policy is unavailable.");
   }
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);

 const refresh=()=>setReload(value=>value+1);
 const clearPending=()=>{
  if(storageKey){try{window.localStorage.removeItem(storageKey);}catch{}}
  setPendingIntent(null);
 };
 const submit=async(event?:FormEvent<HTMLFormElement>)=>{
  event?.preventDefault();
  if(submitting||!uid||!policy?.actions_enabled||!policy.policy)return;
  let intent=pendingIntent;
  if(!intent){
   const numeric=Number(amount);
   if(!Number.isFinite(numeric)||numeric<Number(policy.policy.min_stake)||numeric>Number(policy.policy.max_stake)){
    setError(t("Enter an amount within the active backend policy limits."));return;
   }
   intent={request_id:window.crypto.randomUUID().replace(/-/g,""),symbol,direction,duration_sec:duration,amount:amount.trim()};
   try{window.localStorage.setItem(storageKey,JSON.stringify(intent));}
   catch{setError(t("This browser cannot safely save the order request. No order was sent."));return;}
   setPendingIntent(intent);
  }
  setSubmitting(true);setError("");setNotice("");
  try{
   const result=await submitSecondsOrder(intent);
   const latest=await getSecondsPositions();
   const confirmed=latest.open.some(item=>item.position_id===result.position_id)||latest.history.some(item=>item.position_id===result.position_id);
   if(!confirmed){
    setSnapshot(latest);
    setError(t("The order response arrived, but the positions list has not confirmed it. Do not create another order; retry this same request."));
    return;
   }
   setSnapshot(latest);
   clearPending();
   setAmount("");
   setNotice(result.duplicate?t("This order was already received and has been confirmed."):t("Order confirmed. Funds are reserved and the position has its own settlement time."));
  }catch(reason){
   if(reason instanceof ApiError&&((reason.status>=400&&reason.status<500)||['FINANCIAL_CUTOVER_INCOMPLETE','REFERENCE_PRICE_UNAVAILABLE'].includes(reason.code||''))){
    clearPending();
    setError(reason.message);
   }else{
    setError(reason instanceof Error?reason.message:t("Order status is unconfirmed. Keep this request and retry only with the same request ID."));
   }
  }finally{setSubmitting(false);}
 };

 useEffect(()=>{
  if(!policy?.actions_enabled||!snapshot?.open.length)return;
  const timers=snapshot.open.map(position=>{
   const delay=Math.max(0,position.settle_at*1000-Date.now());
   return window.setTimeout(async()=>{
    if(settling.current.has(position.position_id))return;
    settling.current.add(position.position_id);
    try{
     const result=await settleSecondsPosition({
      position_id:position.position_id,
      symbol:position.symbol,
      request_id:"settle_"+position.position_id
     });
     if(result.settled)setReload(value=>value+1);
     else window.setTimeout(()=>setReload(value=>value+1),5000);
    }catch{
     window.setTimeout(()=>setReload(value=>value+1),10000);
    }finally{settling.current.delete(position.position_id);}
   },Math.min(delay,2147483000));
  });
  return ()=>timers.forEach(timer=>window.clearTimeout(timer));
 },[policy?.actions_enabled,snapshot?.open]);

 const money=(value:number|string)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed.toLocaleString(undefined,{maximumFractionDigits:8}):"—";};
 const date=(seconds:number)=>new Date(seconds*1000).toLocaleString();
 const positionCard=(item:SecondsPositionsSnapshot["open"][number],history=false)=>{
  const directionUp=item.direction==="up";
  const historyItem=history?item as SecondsPositionsSnapshot["history"][number]:null;
  const secondsLeft=Math.max(0,Math.ceil((item.settle_at*1000-clockNow)/1000));
  return <Card key={item.position_id} className="min-w-0 border-brand-border bg-brand-surface"><CardContent className="grid gap-3 p-4 sm:p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="font-semibold">{item.symbol}/USDT</span><Badge variant="outline" className={directionUp?"border-emerald-500/30 text-emerald-400":"border-rose-500/30 text-rose-400"}>{directionUp?<TrendingUp className="mr-1 h-3.5 w-3.5"/>:<TrendingDown className="mr-1 h-3.5 w-3.5"/>}{directionUp?t("Up"):t("Down")}</Badge></div><span className="text-xs text-brand-text-muted">{item.duration_sec}s</span></div>
   <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-brand-text-muted">{t("Amount")}</p><p className="mt-1 font-semibold tabular-nums">{money(item.amount)} USDT</p></div><div><p className="text-xs text-brand-text-muted">{t("Open price")}</p><p className="mt-1 font-semibold tabular-nums">{money(item.open_price)}</p></div>{historyItem?<div><p className="text-xs text-brand-text-muted">{t("Close price")}</p><p className="mt-1 font-semibold tabular-nums">{money(historyItem.settle_price)}</p></div>:<div><p className="text-xs text-brand-text-muted">{t("Time remaining")}</p><p className="mt-1 font-medium tabular-nums">{secondsLeft>0?secondsLeft+"s":t("Settlement pending")}</p></div>}</div>
   {historyItem?<div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-3 text-xs"><span className="text-brand-text-muted">{date(historyItem.settled_at)}</span><span className={Number(historyItem.pnl)>0?"font-semibold text-emerald-400":Number(historyItem.pnl)<0?"font-semibold text-rose-400":"font-semibold text-brand-text-secondary"}>{historyItem.win?t("Win"):historyItem.tie?t("Tie"):t("Loss")} · {Number(historyItem.pnl)>0?"+":""}{money(historyItem.pnl)} USDT</span></div>:<div className="flex items-center gap-2 border-t border-brand-border pt-3 text-xs text-brand-text-muted"><Clock3 className="h-3.5 w-3.5"/>{t("Each position settles independently using the server reference price.")}</div>}
  </CardContent></Card>;
 };
 const activePolicy=policy?.policy;
 const canSubmit=!!activePolicy&&!!policy?.actions_enabled&&!!snapshot&&!snapshot.cutover_incomplete&&!loading&&!submitting&&!pendingIntent&&
  activePolicy.symbols.includes(symbol)&&activePolicy.durations_sec.includes(duration)&&
  Number.isFinite(Number(amount))&&Number(amount)>=Number(activePolicy.min_stake)&&Number(amount)<=Number(activePolicy.max_stake);
 return <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t("BTCBOX / TRADE")}</p><h1 className="type-page-title text-brand-text">{t("Seconds contracts")}</h1><p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t("Place orders under the active BTCBOX policy. Every position has its own frozen amount, timer and server-side settlement.")}</p></div><Button variant="outline" size="sm" disabled={loading} onClick={refresh}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Active contract policy")}</CardTitle><CardDescription>{activePolicy?t("Policy version")+" "+activePolicy.policy_version:t("The active backend policy has not been loaded.")}</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <div><p className="text-xs text-brand-text-muted">{t("Winning profit rate")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?(activePolicy.payout_bps/100).toFixed(2)+"%": "—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Minimum amount")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?money(activePolicy.min_stake)+" USDT":"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Maximum amount")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?money(activePolicy.max_stake)+" USDT":"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Open exposure limit")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?.per_user_open_exposure==null?t("No aggregate cap configured"):money(activePolicy.per_user_open_exposure)+" USDT"}</p></div>
  </CardContent></Card>
  {policyError?<Card className="border-amber-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-amber-200" role="alert">{policyError}</CardContent></Card>:null}
  {policy&&!policy.actions_enabled?<Card className="border-amber-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-amber-200" role="status">{t("Order entry is currently disabled by the backend financial cutover switch. No funds can be reserved until the required services are enabled.")}</CardContent></Card>:null}
  {error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-rose-300" role="alert">{error}</CardContent></Card>:null}
  {notice?<Card className="border-emerald-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-emerald-300" role="status">{notice}</CardContent></Card>:null}
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("New position")}</CardTitle><CardDescription>{t("The backend validates every order against the active policy and reserves funds atomically.")}</CardDescription></CardHeader><CardContent>
   <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Market")}</span><select value={symbol} onChange={event=>setSymbol(event.target.value)} disabled={!activePolicy||!!pendingIntent} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{(activePolicy?.symbols||[]).map(item=><option key={item} value={item}>{item}/USDT</option>)}</select></label>
    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Duration")}</span><select value={duration} onChange={event=>setDuration(Number(event.target.value))} disabled={!activePolicy||!!pendingIntent} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{(activePolicy?.durations_sec||[]).map(item=><option key={item} value={item}>{item}s</option>)}</select></label>
    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount (USDT)")}</span><input inputMode="decimal" type="number" min={activePolicy?String(activePolicy.min_stake):undefined} max={activePolicy?String(activePolicy.max_stake):undefined} step="any" value={pendingIntent?.amount??amount} onChange={event=>setAmount(event.target.value)} disabled={!activePolicy||!!pendingIntent} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" placeholder={activePolicy?String(activePolicy.min_stake):"—"}/></label>
    <div className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Direction")}</span><div className="grid grid-cols-2 gap-2"><Button type="button" variant={direction==="up"?"default":"outline"} disabled={!!pendingIntent} onClick={()=>setDirection("up")}><TrendingUp className="mr-2 h-4 w-4"/>{t("Up")}</Button><Button type="button" variant={direction==="down"?"default":"outline"} disabled={!!pendingIntent} onClick={()=>setDirection("down")}><TrendingDown className="mr-2 h-4 w-4"/>{t("Down")}</Button></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
     <p className="text-xs text-brand-text-muted">{t("Minimum payout is 85%; the active backend policy may configure a higher rate.")}</p>
     <Button type="submit" disabled={submitting||!policy?.actions_enabled||(!pendingIntent&&!canSubmit)}>{submitting?t("Submitting…"):pendingIntent?t("Retry same request"):t("Open position")}</Button>
    </div>
   </form>
   {pendingIntent?<div className="mt-4 rounded-xl border border-amber-500/30 p-3 text-sm text-amber-200">{t("A previous request is awaiting confirmation. Do not create another order. Retrying uses the exact same request ID and order details.")}</div>:null}
  </CardContent></Card>
  <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="type-section-title text-brand-text">{t("Open positions")} ({snapshot?.open.length||0})</h2><span className="text-xs text-brand-text-muted">{t("Each position is tracked and settled independently.")}</span></div>
   {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading positions…")}</CardContent></Card>:snapshot?.open.length?<div className="grid gap-3 md:grid-cols-2">{snapshot.open.map(item=>positionCard(item))}</div>:<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted">{snapshot?.cutover_incomplete?t("Seconds positions will appear when the backend financial cutover is ready."):t("No open positions.")}</CardContent></Card>}
  </section>
  <section className="space-y-3"><h2 className="type-section-title text-brand-text">{t("Contract history")}</h2>
   {snapshot?.history.length?<div className="grid gap-3 md:grid-cols-2">{snapshot.history.map(item=>positionCard(item,true))}</div>:<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted">{t("No settled positions yet.")}</CardContent></Card>}
  </section>
 </div>;
}

export function KycPage(){
 const {t}=useI18n();
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  getAccount(controller.signal).then(setAccount).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Verification status is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const status=String(account?.kyc?.status||"not_submitted").toLowerCase();
 const label=status.replace(/[_-]+/g," ");
 const submitted=["pending","processing","under_review","approved","verified","rejected","failed"].includes(status);
 const tone=["approved","verified"].includes(status)?"border-emerald-500/30 text-emerald-400":["rejected","failed"].includes(status)?"border-rose-500/30 text-rose-300":"border-amber-500/30 text-amber-300";
 return <PageFrame eyebrow="BTCBOX / ACCOUNT" title="Identity verification" description="Review the verification status returned by your authenticated BTCBOX account.">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading verification status…")}</CardContent></Card>
  :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<Card className="border-brand-border bg-brand-surface"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
   <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-brand-text-muted">{t("Current status")}</p><p className="mt-1 text-lg font-semibold capitalize">{t(label)}</p></div><Badge variant="outline" className={tone}>{t(label)}</Badge></div>
   <div><p className="text-xs text-brand-text-muted">{t("Applicant name")}</p><p className="mt-1 font-medium">{account.kyc?.name||"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Document type")}</p><p className="mt-1 font-medium">{account.kyc?.id_type||"—"}</p></div>
   <div className="sm:col-span-2"><p className="text-xs text-brand-text-muted">{t("Document number")}</p><p className="mt-1 break-all font-mono text-sm">{account.kyc?.id_number?"••••"+account.kyc.id_number.slice(-4):"—"}</p></div>
   <div className="sm:col-span-2 border-t border-brand-border pt-3"><p className="text-sm text-brand-text-muted">{submitted?t("Your verification record is on file. Contact support if you need to correct or update the submission."):t("No verification submission is recorded on your account yet. Submission is not enabled in this frontend build.")}</p></div>
   <div className="sm:col-span-2 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/support">{t("Contact support")}</Link></Button><Button size="sm" variant="ghost" onClick={()=>setReload(n=>n+1)}>{t("Refresh status")}</Button></div>
  </CardContent></Card>:null}
 </PageFrame>;
}


export function SupportPage(){
 const {t}=useI18n();
 const [messages,setMessages]=useState<SupportMessage[]>([]);
 const [draft,setDraft]=useState("");
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState("");
 const [sendError,setSendError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  getSupportMessages(controller.signal).then(setMessages).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Support conversation is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const message=draft.trim();
  if(!message||sending)return;
  setSending(true);setSendError("");
  try{
   await sendSupportMessage(message);
   setDraft("");
   setReload(n=>n+1);
  }catch(reason){
   setSendError(reason instanceof Error?reason.message:"Message could not be sent. Please try again.");
  }finally{setSending(false);}
 };
 const date=(raw:string)=>{const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?raw:parsed.toLocaleString();};
 return <PageFrame eyebrow="BTCBOX / HELP CENTER" title="Customer support" description="Send a message to the BTCBOX support team and review replies in your account conversation.">
  <div className="flex items-center justify-between gap-3"><Badge variant="outline" className="border-brand-border"><MessageCircle className="mr-1.5 h-3.5 w-3.5"/>{t("Private account conversation")}</Badge><Button size="sm" variant="outline" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading support conversation…")}</CardContent></Card>
  :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :<Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Conversation")}</CardTitle><CardDescription>{messages.length} {t("messages · newest 50 available")}</CardDescription></CardHeader><CardContent className="space-y-3">
   {messages.length?messages.map(message=><div key={message.id} className={"flex "+(message.from==="user"?"justify-end":"justify-start")}><div className={"max-w-[92%] rounded-2xl border p-3 sm:max-w-[80%] "+(message.from==="user"?"border-brand-accent/25 bg-brand-accent/10":"border-brand-border bg-brand-surface-2")}><div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-text-muted"><span className="font-semibold uppercase">{message.from==="user"?t("You"):t("BTCBOX support")}</span><span>{date(message.time)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{message.content}</p></div></div>)
   :<div className="rounded-xl border border-dashed border-brand-border px-4 py-10 text-center"><MessageCircle className="mx-auto mb-3 h-6 w-6 text-brand-text-muted"/><p className="font-semibold">{t("No messages yet")}</p><p className="mt-1 text-sm text-brand-text-muted">{t("Send a message below to start a conversation with support.")}</p></div>}
  </CardContent></Card>}
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Send a message")}</CardTitle><CardDescription>{t("Do not send passwords, two-factor codes, or wallet recovery phrases.")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submit}>
   <textarea value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} rows={4} placeholder={t("Describe how we can help…")} aria-label={t("Support message")} className="w-full resize-y rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text outline-none placeholder:text-brand-text-muted focus:border-brand-accent/60" disabled={sending}/>
   <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-brand-text-muted">{draft.length}/2000</span><Button type="submit" disabled={sending||!draft.trim()||draft.trim().length>2000}><Send className="mr-2 h-4 w-4"/>{sending?t("Sending…"):t("Send message")}</Button></div>
   {sendError?<p className="text-sm text-rose-300" role="alert">{sendError}</p>:null}
  </form></CardContent></Card>
 </PageFrame>;
}


const depositNetworks:Record<string,string[]>={BTC:["BTC"],ETH:["ERC20"],USDT:["TRC20","ERC20","BEP20"],SOL:["SOL"],BNB:["BEP20"],USDC:["ERC20"]};
export function DepositPage(){
 const {t}=useI18n();
 const [coin,setCoin]=useState("USDT");
 const [network,setNetwork]=useState("TRC20");
 const [address,setAddress]=useState("");
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setAddress("");setError("");setLoading(true);
  getDepositAddress(coin,network,controller.signal).then(setAddress).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Deposit address is unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[coin,network,reload]);
 const changeCoin=(next:string)=>{setCoin(next);setNetwork(depositNetworks[next][0]);};
 return <PageFrame eyebrow="BTCBOX / WALLET" title="Deposit" description="View the deposit address configured by BTCBOX for the selected asset and network. BTCBOX staff verify incoming transfers and manually credit the account.">
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Deposit address")}</CardTitle><CardDescription>{t("Always verify the asset and network before sending funds.")}</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Asset")}</span><select value={coin} onChange={e=>changeCoin(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{Object.keys(depositNetworks).map(x=><option key={x}>{x}</option>)}</select></label><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Network")}</span><select value={network} onChange={e=>setNetwork(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{depositNetworks[coin].map(x=><option key={x}>{x}</option>)}</select></label></div>
   {loading?<p className="rounded-xl border border-brand-border p-4 text-sm text-brand-text-muted" role="status">{t("Loading configured deposit address…")}</p>
   :error?<div className="rounded-xl border border-amber-400/30 p-4"><p className="text-sm text-amber-200" role="alert">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>
   :<div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">{coin} · {network}</p><div className="break-all rounded-xl border border-brand-border bg-brand-surface-2 p-4 font-mono text-sm">{address}</div><Button variant="outline" size="sm" onClick={()=>navigator.clipboard?.writeText(address)}>{t("Copy address")}</Button></div>}
   <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-brand-text-secondary"><p className="font-semibold text-amber-200">{t("Important")}</p><p className="mt-1">{t("Send only the selected asset on the selected network. Sending unsupported assets or using another network may result in permanent loss. After the transfer, BTCBOX staff verify receipt and manually credit the account. This page does not create a deposit order or automatically credit funds.")}</p></div>
  </CardContent></Card>
 </PageFrame>;
}


export function EarnPage(){
 const {t}=useI18n();
 const [products,setProducts]=useState<EarnProduct[]>([]);
 const [positions,setPositions]=useState<EarnPosition[]>([]);
 const [actionsEnabled,setActionsEnabled]=useState(false);
 const [selectedProduct,setSelectedProduct]=useState("");
 const [amount,setAmount]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [actionMessage,setActionMessage]=useState("");
 const [requestIds,setRequestIds]=useState<Record<string,string>>({});
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  Promise.allSettled([getAccount(controller.signal),getEarnCatalog(controller.signal)]).then(([accountResult,catalogResult])=>{
   const issues:string[]=[];
   if(accountResult.status==="fulfilled")setPositions(Array.isArray(accountResult.value.earn_records)?accountResult.value.earn_records:[]);
   else issues.push(accountResult.reason instanceof Error?accountResult.reason.message:"Earn positions are unavailable.");
   if(catalogResult.status==="fulfilled"){
    setProducts(catalogResult.value.products);
    setActionsEnabled(catalogResult.value.actions_enabled);
    setSelectedProduct(current=>catalogResult.value.products.some(p=>p.product_id===current)?current:(catalogResult.value.products[0]?.product_id||""));
   }else{
    setProducts([]);setActionsEnabled(false);
    issues.push(catalogResult.reason instanceof Error?catalogResult.reason.message:"Earn products are unavailable.");
   }
   setError(issues.join(" "));
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const selected=products.find(item=>item.product_id===selectedProduct);
 const requestIdFor=(key:string)=>requestIds[key]||crypto.randomUUID();
 const number=(value:number|string|undefined)=>{const n=Number(value);return Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:10}):"—";};
 const operate=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!selected||!actionsEnabled||busy)return;
  const parsed=Number(amount);
  const decimals=amount.includes(".")?amount.split(".")[1].length:0;
  if(!Number.isFinite(parsed)||parsed<=0){setError("Enter an amount greater than zero.");return;}
  if(decimals>selected.amount_scale){setError(`This product supports at most ${selected.amount_scale} decimal places.`);return;}
  const requestKey=`subscribe:${selected.product_id}:${amount.trim()}`;
  const requestId=requestIdFor(requestKey);
  setRequestIds(current=>({...current,[requestKey]:requestId}));
  setBusy(true);setError("");setActionMessage("");
  try{
   const result=await submitEarnAction("subscribe",{request_id:requestId,product_id:selected.product_id,amount:amount.trim()});
   setActionMessage(result.duplicate?"This request was already processed.":"Subscription confirmed by BTCBOX.");
   setRequestIds(current=>{const next={...current};delete next[requestKey];return next;});
   setAmount("");
   setReload(n=>n+1);
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Earn subscription was not confirmed. Check your Earn history before retrying.");
  }finally{setBusy(false);}
 };
 const redeem=async(position:EarnPosition)=>{
  if(!actionsEnabled||busy)return;
  const requestKey=`redeem:${position.id}`;
  const requestId=requestIdFor(requestKey);
  setRequestIds(current=>({...current,[requestKey]:requestId}));
  setBusy(true);setError("");setActionMessage("");
  try{
   const result=await submitEarnAction("redeem",{request_id:requestId,record_id:position.id});
   setActionMessage(result.duplicate?"This redemption request was already processed.":"Redemption confirmed by BTCBOX.");
   setRequestIds(current=>{const next={...current};delete next[requestKey];return next;});
   setReload(n=>n+1);
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Redemption was not confirmed. Check your Earn history before retrying.");
  }finally{setBusy(false);}
 };
 return <PageFrame eyebrow="BTCBOX / WEALTH" title="Earn" description="Live Earn products, account positions and database-calculated interest from BTCBOX. Rates and terms are controlled by the backend.">
  <div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className="border-brand-border">{t("Live product catalog")}</Badge><Button size="sm" variant="outline" disabled={loading||busy} onClick={()=>setReload(n=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading Earn products and positions…")}</CardContent></Card>
  :<>
   {error?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 p-3"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>:null}
   {actionMessage?<p className="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-300" role="status">{actionMessage}</p>:null}
   {!actionsEnabled?<Card className="border-amber-400/25 bg-brand-surface"><CardContent className="p-4"><Badge variant="outline" className="border-amber-400/30 text-amber-200">{t("Operations not enabled")}</Badge><p className="mt-2 text-sm text-brand-text-secondary">{t("You can review the live product catalog and your positions. Subscribe and redeem will become available after the financial ledger and database controls are verified and enabled. No funds can be moved now.")}</p></CardContent></Card>:null}
   <section className="space-y-3"><h2 className="type-section-title">{t("Available products")}</h2>
    {products.length?products.map(product=><Card key={product.product_id} className="border-brand-border bg-brand-surface"><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-semibold">{product.asset} · {product.product_type==="demand"?t("Flexible"):t("Fixed term")}</p><p className="mt-1 text-xs text-brand-text-muted">{product.term_days===0?t("Withdraw according to flexible-product rules"):`${product.term_days} ${t("days")}`} · {t("Early redemption fee")}: {number(product.early_fee_percent)}%</p></div><div><p className="text-xs text-brand-text-muted">{t("Annual rate")}</p><p className="text-lg font-semibold tabular-nums">{number(product.apy_percent)}%</p></div><Button size="sm" variant={selectedProduct===product.product_id?"default":"outline"} onClick={()=>setSelectedProduct(product.product_id)}>{selectedProduct===product.product_id?t("Selected"):t("Select")}</Button></CardContent></Card>)
    :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No active Earn products are currently returned by the backend.")}</CardContent></Card>}
   </section>
   {products.length?<Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Subscribe")}</CardTitle><CardDescription>{t("Your available balance and product limits are validated by the financial database.")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={operate}><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Product")}</span><select value={selectedProduct} onChange={e=>setSelectedProduct(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{products.map(product=><option key={product.product_id} value={product.product_id}>{product.asset} · {product.product_type==="demand"?t("Flexible"):`${product.term_days} ${t("days fixed")}`}</option>)}</select></label><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} ({selected?.asset||""})</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" /></label><Button type="submit" disabled={!actionsEnabled||busy||!selected}>{busy?t("Processing…"):t("Subscribe")}</Button></form></CardContent></Card>:null}
   <section className="space-y-3"><h2 className="type-section-title">{t("My Earn positions")}</h2>
    {positions.length?positions.map(position=><Card key={position.id} className="border-brand-border bg-brand-surface"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{position.product||position.product_id}</p><p className="text-xs text-brand-text-muted">{position.type==="flexible"?t("Flexible"):t("Fixed")} · {number(position.apy)}% {t("APY")}</p></div><Badge variant={position.status==="持有中"||position.status==="active"?"outline":"secondary"}>{position.status}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-brand-text-muted">{t("Principal")}</p><p className="mt-1 tabular-nums">{number(position.amount)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Estimated interest")}</p><p className="mt-1 tabular-nums">{number(position.expected_interest)}</p></div><div><p className="text-xs text-brand-text-muted">{t("End / maturity")}</p><p className="mt-1">{position.end||"—"}</p></div></div>{position.status==="持有中"||position.status==="active"?<Button size="sm" variant="outline" disabled={!actionsEnabled||busy} onClick={()=>redeem(position)}>{t("Redeem")}</Button>:null}</CardContent></Card>)
    :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No Earn positions were returned for this account.")}</CardContent></Card>}
   </section>
  </>}
 </PageFrame>;
}


export function WithdrawPage(){
 const {t}=useI18n();
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [addresses,setAddresses]=useState<SavedCryptoAddress[]>([]);
 const [config,setConfig]=useState<WithdrawalConfig|null>(null);
 const [selectedId,setSelectedId]=useState("");
 const [selectedAddress,setSelectedAddress]=useState<SelectedCryptoAddress|null>(null);
 const [amount,setAmount]=useState("");
 const [fundPassword,setFundPassword]=useState("");
 const [twofaCode,setTwofaCode]=useState("");
 const [loading,setLoading]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState("");
 const [actionMessage,setActionMessage]=useState("");
 const [requestId,setRequestId]=useState("");
 const [reload,setReload]=useState(0);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  Promise.all([getAccount(controller.signal),getSavedCryptoAddresses(controller.signal),getWithdrawalConfig(controller.signal)])
   .then(([snapshot,book,withdrawalConfig])=>{
    if(controller.signal.aborted)return;
    setAccount(snapshot);setAddresses(book);setConfig(withdrawalConfig);
    const usable=book.filter(item=>!item.blocked&&!item.unbound);
    setSelectedId(current=>usable.some(item=>item.id===current)?current:(usable[0]?.id||""));
   })
   .catch(reason=>{
    if(reason instanceof Error&&reason.name==="AbortError")return;
    if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Wallet data is temporarily unavailable.");
   })
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);

 useEffect(()=>{
  if(!selectedId){setSelectedAddress(null);return;}
  const controller=new AbortController();
  setSelectedAddress(null);
  getSelectedCryptoAddress(selectedId,controller.signal).then(value=>{
   if(!controller.signal.aborted)setSelectedAddress(value);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Selected withdrawal address is unavailable.");
  });
  return ()=>controller.abort();
 },[selectedId]);

 const usableAddresses=addresses.filter(item=>!item.blocked&&!item.unbound);
 const balance=selectedAddress&&account?.balances?account.balances[selectedAddress.coin]:undefined;
 const fee=selectedAddress&&config?Number(config.fees[selectedAddress.coin]??0):0;
 const available=Number(balance?.free??0);
 const parsedAmount=Number(amount);
 const canSubmit=!!config?.actions_enabled&&!!selectedAddress&&Number.isFinite(parsedAmount)&&parsedAmount>0&&parsedAmount<=available&&!!fundPassword.trim()&&(!account?.twofa_enabled||/^\d{6}$/.test(twofaCode))&&!submitting&&!loading;

 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!canSubmit||!selectedAddress)return;
  const stableRequestId=requestId||window.crypto.randomUUID();
  setRequestId(stableRequestId);setSubmitting(true);setError("");setActionMessage("");
  try{
   const result=await submitWithdrawal({
    request_id:stableRequestId,coin:selectedAddress.coin,network:selectedAddress.network,
    amount:amount.trim(),address:selectedAddress.address,fund_password:fundPassword,
    ...(account?.twofa_enabled?{twofa_code:twofaCode}:{})
   });
   setActionMessage(result.duplicate?t("This withdrawal request was already received."):result.require_admin_review?t("Withdrawal submitted for staff review."):t("Withdrawal submitted and is awaiting staff processing."));
   setRequestId("");setAmount("");setFundPassword("");setTwofaCode("");
   setReload(value=>value+1);
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Withdrawal result is unconfirmed. Keep this request unchanged and retry with the same request ID.");
   if(reason instanceof ApiError&&reason.status>=400&&reason.status<500)setRequestId("");
  }finally{setSubmitting(false);}
 };

 return <PageFrame eyebrow="BTCBOX / WALLET" title="Withdraw" description="Choose a saved address and submit a withdrawal request. BTCBOX staff review requests and manually transfer approved withdrawals.">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading wallet and saved addresses…")}</CardContent></Card>
  :error&&!account?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :<>
   <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Available balances")}</CardTitle><CardDescription>{account?.valuation_complete?t("Estimated total value"):t("Some asset prices are unavailable; total valuation is incomplete.")}</CardDescription></CardHeader><CardContent className="space-y-2">
    {(Object.entries(account?.balances||{}) as Array<[string,AccountBalance]>).map(([asset,row])=><div key={asset} className="flex items-center justify-between gap-3 rounded-lg border border-brand-border p-3"><span className="font-semibold">{asset}</span><div className="text-right text-sm"><p>{String(row.free??"0")} {asset}</p><p className="text-xs text-brand-text-muted">{t("Frozen")}: {String(row.frozen??"0")}</p></div></div>)}
   </CardContent></Card>

   <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Submit withdrawal")}</CardTitle><CardDescription>{t("Select a saved address. Asset and network are taken from that address; staff review and manually pay approved requests.")}</CardDescription></CardHeader><CardContent>
    {usableAddresses.length===0?<div className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No eligible saved withdrawal addresses are available. Add an address to your address book or contact support.")}</div>
    :<form className="space-y-3" onSubmit={submit}>
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Saved withdrawal address")}</span><select value={selectedId} disabled={!!requestId||submitting} onChange={event=>{setSelectedId(event.target.value);setError("");}} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{usableAddresses.map(item=><option key={item.id} value={item.id}>{item.coin} · {item.network} · {item.address}</option>)}</select></label>
     {selectedAddress?<div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-xs text-brand-text-muted"><p>{t("Selected destination")}: {selectedAddress.coin} · {selectedAddress.network}</p><p className="mt-1 break-all font-mono">{selectedAddress.address.length>18?selectedAddress.address.slice(0,8)+"…"+selectedAddress.address.slice(-8):selectedAddress.address}</p></div>:<p className="text-xs text-brand-text-muted">{t("Loading selected address…")}</p>}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} {selectedAddress ? "(" + selectedAddress.coin + ")" : ""}</span><input inputMode="decimal" value={amount} disabled={!!requestId||submitting} onChange={event=>setAmount(event.target.value)} placeholder="0.00" className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text"/></label>
     {selectedAddress?<div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-border p-3 text-sm"><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 tabular-nums">{available.toLocaleString(undefined,{maximumFractionDigits:10})} {selectedAddress.coin}</p></div><div><p className="text-xs text-brand-text-muted">{t("Withdrawal fee")}</p><p className="mt-1 tabular-nums">{Number.isFinite(fee)?fee:"—"} {selectedAddress.coin}</p></div></div>:null}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Fund password")}</span><input type="password" autoComplete="current-password" value={fundPassword} disabled={!!requestId||submitting} onChange={event=>setFundPassword(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" required/></label>
     {account?.twofa_enabled?<label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Two-factor code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twofaCode} disabled={!!requestId||submitting} onChange={event=>setTwofaCode(event.target.value.replace(/\D/g,"").slice(0,6))} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" required/></label>:null}
     {config&&!config.actions_enabled?<div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-brand-text-secondary"><Badge variant="outline" className="border-amber-400/30 text-amber-200">{t("Withdrawals temporarily unavailable")}</Badge><p className="mt-2">{t("The financial ledger cutover has not been enabled. You can review your wallet, but no withdrawal request can be submitted yet.")}</p></div>:null}
     {error?<p role="alert" className="text-sm text-rose-300">{error}</p>:null}
     {actionMessage?<p role="status" className="text-sm text-emerald-300">{actionMessage}</p>:null}
     <Button type="submit" disabled={!canSubmit}>{submitting?t("Submitting…"):requestId?t("Retry same request"):t("Submit for staff review")}</Button>
     {requestId?<p className="break-all text-xs text-amber-300">{t("Request result is not yet confirmed. Keep this form unchanged and retry with the same request ID.")} · {requestId}</p>:null}
    </form>}
   </CardContent></Card>

   <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Withdrawal history")}</CardTitle><CardDescription>{t("Track staff review and manual payout completion. Approval does not mean the transfer has been sent.")}</CardDescription></CardHeader><CardContent className="space-y-2">
    {account?.withdrawals?.length?account.withdrawals.slice().reverse().map((item:WithdrawalRecord)=> <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border p-3"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 break-all text-xs text-brand-text-muted">{item.address||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||item.paid_at||"—"}</p>{item.payout_reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">TxID / reference: {item.payout_reference||item.txid}</p>:null}</div><Badge variant={item.status==="completed"?"outline":item.status==="rejected"?"destructive":"secondary"}>{item.status}</Badge></div>)
    :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No withdrawal requests have been returned for this account.")}</p>}
   </CardContent></Card>

   <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Saved crypto addresses")}</CardTitle><CardDescription>{t("Full addresses are only retrieved for the address selected for withdrawal.")}</CardDescription></CardHeader><CardContent className="space-y-2">
    {addresses.length?addresses.map(item=><div key={item.id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{item.coin} · {item.network}</span><Badge variant={item.blocked||item.unbound?"destructive":"outline"}>{item.blocked?"Blocked":item.unbound?"Unbound":"Saved"}</Badge></div><p className="mt-2 break-all font-mono text-sm text-brand-text-muted">{item.address}</p>{item.note?<p className="mt-1 text-xs text-brand-text-muted">{item.note}</p>:null}</div>)
    :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No saved crypto withdrawal addresses were found.")}</p>}
   </CardContent></Card>
  </>}
 </PageFrame>;
}