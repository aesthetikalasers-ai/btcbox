import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldAlert } from "lucide-react";
import { getAccount, getOrders, getSecondsPositions, type AccountBalance, type AccountSnapshot, type OrderRecord, type SecondsPositionsSnapshot } from "../../lib/api";
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
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  getSecondsPositions(controller.signal).then(setSnapshot).catch((reason:unknown)=>{
   if(reason instanceof Error && reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Seconds positions are temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const money=(value:number|string)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed.toLocaleString(undefined,{maximumFractionDigits:8}):"—";};
 const date=(seconds:number)=>new Date(seconds*1000).toLocaleString();
 const positionCard=(item:SecondsPositionsSnapshot["open"][number],history=false)=>{
  const directionUp=item.direction==="up";
  const historyItem=history?item as SecondsPositionsSnapshot["history"][number]:null;
  return <Card key={item.position_id} className="min-w-0 border-brand-border bg-brand-surface"><CardContent className="grid gap-3 p-4 sm:p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="font-semibold">{item.symbol}/USDT</span><Badge variant="outline" className={directionUp?"border-emerald-500/30 text-emerald-400":"border-rose-500/30 text-rose-400"}>{directionUp?<TrendingUp className="mr-1 h-3.5 w-3.5"/>:<TrendingDown className="mr-1 h-3.5 w-3.5"/>}{directionUp?t("Up"):t("Down")}</Badge></div><span className="text-xs text-brand-text-muted">{item.duration_sec}s</span></div>
   <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-brand-text-muted">{t("Amount")}</p><p className="mt-1 font-semibold tabular-nums">{money(item.amount)} USDT</p></div><div><p className="text-xs text-brand-text-muted">{t("Open price")}</p><p className="mt-1 font-semibold tabular-nums">{money(item.open_price)}</p></div>{historyItem?<div><p className="text-xs text-brand-text-muted">{t("Close price")}</p><p className="mt-1 font-semibold tabular-nums">{money(historyItem.settle_price)}</p></div>:<div><p className="text-xs text-brand-text-muted">{t("Settlement time")}</p><p className="mt-1 font-medium">{date(item.settle_at)}</p></div>}</div>
   {historyItem?<div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-3 text-xs"><span className="text-brand-text-muted">{date(historyItem.settled_at)}</span><span className={Number(historyItem.pnl)>0?"font-semibold text-emerald-400":Number(historyItem.pnl)<0?"font-semibold text-rose-400":"font-semibold text-brand-text-secondary"}>{historyItem.win?t("Win"):historyItem.tie?t("Tie"):t("Loss")} · {Number(historyItem.pnl)>0?"+":""}{money(historyItem.pnl)} USDT</span></div>:<div className="flex items-center gap-2 border-t border-brand-border pt-3 text-xs text-brand-text-muted"><Clock3 className="h-3.5 w-3.5"/>{t("Position is open. Trading actions are not enabled in this view.")}</div>}
  </CardContent></Card>;
 };
 return <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t("BTCBOX / TRADE")}</p><h1 className="type-page-title text-brand-text">{t("Seconds contracts")}</h1><p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t("View your actual open seconds positions and settled history. No orders can be placed or settled from this page.")}</p></div><Button variant="outline" size="sm" disabled={loading} onClick={()=>setReload((value)=>value+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading positions…")}</CardContent></Card>:error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload((value)=>value+1)}>{t("Try again")}</Button></CardContent></Card>:snapshot?.cutover_incomplete?<Card className="border-amber-500/30 bg-brand-surface"><CardContent className="flex items-start gap-3 p-5"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"/><div><p className="font-semibold text-amber-300">{t("Seconds service is not available yet")}</p><p className="mt-1 text-sm text-brand-text-secondary">{t("Financial cutover is incomplete. Position data is intentionally withheld; an empty response does not mean you have no positions.")}</p></div></CardContent></Card>:<>
   <div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-brand-border">{t("Read-only mode")}</Badge><Badge variant="outline" className="border-brand-border">{t("Live account data")}</Badge></div>
   <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="type-section-title">{t("Open positions")}</h2><span className="text-xs text-brand-text-muted">{snapshot?.open.length||0}</span></div>{snapshot?.open.length?snapshot.open.map((item)=>positionCard(item)): <Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No open seconds positions were returned by the account service.")}</CardContent></Card>}</section>
   <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="type-section-title">{t("History")}</h2><span className="text-xs text-brand-text-muted">{snapshot?.history.length||0}</span></div>{snapshot?.history.length?snapshot.history.map((item)=>positionCard(item,true)):<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No settled seconds positions were returned by the account service.")}</CardContent></Card>}</section>
  </>}
 </div>;
}
