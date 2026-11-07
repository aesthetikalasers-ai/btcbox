import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldAlert, Send, MessageCircle } from "lucide-react";
import { ApiError, getAccount, getOrders, getMarkets, getSpotMarketPairs, getKlines, getOrderBook, getTradingStatus, submitSpotOrder, cancelSpotOrder, getSecondsPositions, getSecondsPolicy, submitSecondsOrder, settleSecondsPosition, getSupportMessages, sendSupportMessage, getDepositAddress, getSavedCryptoAddresses, getSelectedCryptoAddress, getWithdrawalConfig, submitWithdrawal, getEarnCatalog, submitEarnAction, type EarnProduct, type EarnPosition, type SavedCryptoAddress, type AccountBalance, type AccountSnapshot, type DepositRecord, type OrderRecord, type MarketTicker, type MarketCandle, type OrderBookSnapshot, type SpotMarketPair, type TradingStatus, type SecondsPositionsSnapshot, type SecondsOrderInput, type SecondsPolicyResponse, type SupportMessage, type SelectedCryptoAddress, type WithdrawalConfig, type WithdrawalRecord, submitKyc } from "../../lib/api";
import { useAuth } from "../../lib/auth";

import type { ReactNode } from "react";
import { ArrowUpRight, LockKeyhole, Wallet, ChartNoAxesCombined, ArrowLeftRight, Sprout } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../lib/i18n";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

function PageFrame({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children:ReactNode}){
 const {t}=useI18n();
 return <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8"><div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t(eyebrow)}</p><h1 className="type-page-title text-brand-text">{t(title)}</h1><p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t(description)}</p></div>{children}</div>;
}
export function TradeHubPage(){
 const {t}=useI18n();
 const [spotPairs,setSpotPairs]=useState<SpotMarketPair[]>([]);
 const [pairsLoading,setPairsLoading]=useState(true);
 const [pairsError,setPairsError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  getSpotMarketPairs(controller.signal).then(setSpotPairs).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setPairsError(reason instanceof Error?reason.message:"Spot-market catalogue is unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setPairsLoading(false);});
  return ()=>controller.abort();
 },[]);
 return <PageFrame eyebrow="BTCBOX / TRADE" title="Choose your trading mode" description="Choose a BTCBOX trading service. Supported markets and product availability are returned by the backend.">
  <div className="grid gap-4 sm:grid-cols-2">
   <Card className="border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><ChartNoAxesCombined className="h-5 w-5"/></div><CardTitle>{t("Spot")}</CardTitle><CardDescription>{t("Buy and sell supported digital assets at market or limit prices.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{t("Enabled")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/markets">{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><ArrowLeftRight className="h-5 w-5"/></div><CardTitle>{t("Seconds")}</CardTitle><CardDescription>{t("Place policy-driven positions with independent timers and server-side settlement.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{t("Policy-driven order entry")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/seconds">{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><Sprout className="h-5 w-5"/></div><CardTitle>{t("Earn")}</CardTitle><CardDescription>{t("Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{t("Live product catalog")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/earn">{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="border-dashed border-brand-border bg-transparent"><CardHeader><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-border text-brand-text-muted"><LockKeyhole className="h-5 w-5"/></div><CardTitle>{t("Futures")}</CardTitle><CardDescription>{t("Coming soon — no supported futures service is registered in the current backend.")}</CardDescription></CardHeader><CardContent><Badge variant="secondary">{t("Unavailable")}</Badge></CardContent></Card>
  </div>
  <section className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="type-section-title">{t("Spot markets")}</h2>{!pairsLoading&&!pairsError?<span className="text-xs text-brand-text-muted">{spotPairs.length} {t("pairs")}</span>:null}</div>
   {pairsLoading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading configured spot markets…")}</CardContent></Card>:null}
   {!pairsLoading&&!pairsError&&!spotPairs.length?<Card className="border-dashed border-brand-border bg-transparent"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No spot markets are currently enabled. Please check again later.")}</CardContent></Card>:null}
   {pairsError?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="p-5 text-sm text-rose-300" role="alert">{pairsError}</CardContent></Card>:null}
   {spotPairs.length?<div className="grid gap-3 sm:grid-cols-2">{spotPairs.map(pair=><Card key={pair.base_asset+"/"+pair.quote_asset} className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{pair.base_asset}/{pair.quote_asset}</CardTitle><CardDescription>{t("Place supported limit orders against the BTCBOX spot matching service.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{t("Enabled")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to={"/trade/"+pair.base_asset+pair.quote_asset}>{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>)}</div>:null}
  </section>
 </PageFrame>;
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
   :orders.length===0?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-border bg-brand-surface-2"><Clock3 className="h-5 w-5 text-brand-text-muted"/></div><p className="font-semibold">{t("No orders returned")}</p><p className="mt-2 max-w-md text-sm text-brand-text-muted">{t("No orders are available for this account yet.")}</p><Button asChild variant="secondary" className="mt-5"><Link to="/trade-hub">{t("Explore trading")}</Link></Button></CardContent></Card>
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

export function SpotTradingPage(){
 const {symbol:routeSymbol}=useParams();
 const symbol=(routeSymbol||"BTCUSDT").toUpperCase();
 const {t}=useI18n();
 const [ticker,setTicker]=useState<MarketTicker|null>(null);
 const [spotPairEnabled,setSpotPairEnabled]=useState(false);
 const [candles,setCandles]=useState<MarketCandle[]>([]);
 const [book,setBook]=useState<OrderBookSnapshot|null>(null);
 const [orders,setOrders]=useState<OrderRecord[]>([]);
 const [tradingStatus,setTradingStatus]=useState<TradingStatus|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [side,setSide]=useState<"buy"|"sell">("buy");
 const [price,setPrice]=useState("");
 const [quantity,setQuantity]=useState("");
 const [accountUid,setAccountUid]=useState("");
 const [pendingIntent,setPendingIntent]=useState<Parameters<typeof submitSpotOrder>[0]|null>(null);
 const [pendingIntentInvalid,setPendingIntentInvalid]=useState(false);
 const [cancelRequestIds,setCancelRequestIds]=useState<Record<string,string>>({});
 const [reload,setReload]=useState(0);
 const [marketUpdatedAt,setMarketUpdatedAt]=useState<number|null>(null);
 const [marketFeedWarning,setMarketFeedWarning]=useState("");
 const [chartFeedWarning,setChartFeedWarning]=useState("");
 const [mobilePanel,setMobilePanel]=useState<"chart"|"orderbook"|null>(null);
 const chartContainer=useRef<HTMLDivElement|null>(null);
 const base=symbol.endsWith("USDT")?symbol.slice(0,-4):"BTC";
 const pendingStorageKey=accountUid?"btcbox.spot.pending.v1."+accountUid+"."+symbol:"";

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");setSpotPairEnabled(false);setTradingStatus(null);
  Promise.allSettled([getSpotMarketPairs(controller.signal),getMarkets(controller.signal),getKlines(symbol,"1h",controller.signal),getOrderBook(symbol,controller.signal),getTradingStatus(controller.signal),getOrders(controller.signal),getAccount(controller.signal)]).then(results=>{
   if(controller.signal.aborted)return;
   const [pairResult,marketResult,candleResult,bookResult,statusResult,ordersResult,accountResult]=results;
   if(pairResult.status==="fulfilled"){
    const enabled=pairResult.value.some(pair=>pair.base_asset===base&&pair.quote_asset==="USDT");
    setSpotPairEnabled(enabled);
    if(!enabled)setError("This spot market is not enabled by BTCBOX operators.");
   }else{
    setSpotPairEnabled(false);
    setError(pairResult.reason instanceof Error?pairResult.reason.message:"Spot-market catalogue is unavailable.");
   }
   if(accountResult.status==="fulfilled")setAccountUid(accountResult.value.uid);
   else if(!(accountResult.reason instanceof ApiError&&accountResult.reason.code==="AUTH_REQUIRED"))
    setError(accountResult.reason instanceof Error?accountResult.reason.message:"Account identity is unavailable.");
   if(marketResult.status==="fulfilled"){
    const marketBase=symbol.endsWith("USDT")?symbol.slice(0,-4):symbol;
    const selected=marketResult.value.find(item=>item.sym.toUpperCase()===marketBase)||null;
    if(selected){
     setTicker(selected);
     setMarketUpdatedAt(selected.snapshotTs?selected.snapshotTs*1000:null);
     setMarketFeedWarning("");
     setPrice(current=>current||String(selected.price));
    }else setMarketFeedWarning("Market snapshot is missing for this pair; showing the last confirmed data.");
   }else setError(marketResult.reason instanceof Error?marketResult.reason.message:"Live market data is unavailable.");
   if(candleResult.status==="fulfilled"){setCandles(candleResult.value);setChartFeedWarning("");}
   else setChartFeedWarning("Chart refresh is unavailable; showing the last confirmed candles.");
   if(bookResult.status==="fulfilled")setBook(bookResult.value);
   if(statusResult.status==="fulfilled")setTradingStatus(statusResult.value);
   else setTradingStatus(null);
   if(ordersResult.status==="fulfilled")setOrders(ordersResult.value);
   else if(ordersResult.reason instanceof ApiError && ordersResult.reason.code!=="AUTH_REQUIRED")setError(ordersResult.reason.message);
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[symbol,reload]);

 // The initial route load above also fetches account/order state. Keep the
 // public ticker and order book fresh independently without reloading the form
 // or overwriting a price the customer is currently editing.
 useEffect(()=>{
  const controller=new AbortController();
  let refreshing=false;
  const refreshMarketData=()=>{
   if(refreshing||controller.signal.aborted)return;
   refreshing=true;
   Promise.allSettled([getMarkets(controller.signal),getOrderBook(symbol,controller.signal)]).then(([marketResult,bookResult])=>{
    if(controller.signal.aborted)return;
    let failed=false;
    if(marketResult.status==="fulfilled"){
     const marketBase=symbol.endsWith("USDT")?symbol.slice(0,-4):symbol;
     const selected=marketResult.value.find(item=>item.sym.toUpperCase()===marketBase)||null;
     if(selected){
      setTicker(selected);
      setMarketUpdatedAt(selected.snapshotTs?selected.snapshotTs*1000:null);
     }else failed=true;
    }else failed=true;
    if(bookResult.status==="fulfilled")setBook(bookResult.value);
    else failed=true;
    setMarketFeedWarning(failed?"Live market refresh is temporarily unavailable; showing the last confirmed data.":"");
   }).finally(()=>{refreshing=false;});
  };
  const refreshId=window.setInterval(refreshMarketData,15000);
  const candleId=window.setInterval(()=>{
   getKlines(symbol,"1h",controller.signal).then(rows=>{
    if(!controller.signal.aborted){setCandles(rows);setChartFeedWarning("");}
   }).catch(reason=>{
    if(reason instanceof Error&&reason.name==="AbortError")return;
    if(!controller.signal.aborted)setChartFeedWarning("Chart refresh is unavailable; showing the last confirmed candles.");
   });
  },60000);
  return ()=>{window.clearInterval(refreshId);window.clearInterval(candleId);controller.abort();};
 },[symbol]);

 useEffect(()=>{
  setPendingIntent(null);setPendingIntentInvalid(false);
  if(!accountUid||!pendingStorageKey)return;
  try{
   const raw=window.localStorage.getItem(pendingStorageKey);
   if(!raw)return;
   const saved=JSON.parse(raw) as Parameters<typeof submitSpotOrder>[0];
   if(saved&&saved.symbol===symbol&&saved.type==="limit"&&(saved.side==="buy"||saved.side==="sell")&&typeof saved.qty==="string"&&typeof saved.price==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(saved.client_order_id)){
    setPendingIntent(saved);setSide(saved.side);setQuantity(saved.qty);setPrice(saved.price);
   }else{setPendingIntentInvalid(true);setError("A saved spot order request is invalid. Check order history before allowing another order.");}
  }catch{setPendingIntentInvalid(true);setError("A saved spot order request could not be read. No new order will be sent until it is reviewed.");}
 },[accountUid,symbol,pendingStorageKey]);

 useEffect(()=>{
  if(!accountUid)return;
  const restored:Record<string,string>={};
  for(const order of orders){
   const orderId=String(order.order_id??order.id??"");
   if(!orderId)continue;
   const key="btcbox.spot.cancel.v1."+accountUid+"."+orderId;
   try{
    const requestId=window.localStorage.getItem(key);
    const status=String(order.status||"").toLowerCase();
    if(["cancelled","canceled","rejected","filled","completed"].includes(status)){window.localStorage.removeItem(key);continue;}
    if(requestId&&/^[A-Za-z0-9_-]{16,100}$/.test(requestId))restored[orderId]=requestId;
   }catch{restored[orderId]="storage_unavailable";}
  }
  setCancelRequestIds(restored);
 },[accountUid,orders]);

 useEffect(()=>{
  const node=chartContainer.current;
  if(!node||!candles.length||node.clientWidth<=0)return;
  const chart=createChart(node,{width:node.clientWidth,height:320,layout:{background:{type:ColorType.Solid,color:"#111820"},textColor:"#9aa8b7"},grid:{vertLines:{color:"#26313d"},horzLines:{color:"#26313d"}},rightPriceScale:{borderColor:"#26313d"},timeScale:{borderColor:"#26313d",timeVisible:true,secondsVisible:false}});
  const series=chart.addSeries(CandlestickSeries,{upColor:"#0ecb81",downColor:"#f6465d",borderVisible:false,wickUpColor:"#0ecb81",wickDownColor:"#f6465d"});
  series.setData(candles.map(item=>({time:Math.floor(item.time/1000) as UTCTimestamp,open:item.open,high:item.high,low:item.low,close:item.close})).sort((a,b)=>Number(a.time)-Number(b.time)));
  chart.timeScale().fitContent();
  const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width)chart.applyOptions({width:Math.floor(width)});});
  observer.observe(node);
  return ()=>{observer.disconnect();chart.remove();};
 },[candles,mobilePanel]);

 const submitOrder=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(pendingIntentInvalid){setError("A saved spot order request must be reconciled before another order can be placed.");return;}
  if(!spotPairEnabled&&!pendingIntent){setError("This spot pair is not enabled by BTCBOX operators. No order was sent.");return;}
  if(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent){setError("Spot order execution is currently disabled by server policy. No order was placed.");return;}
  let intent=pendingIntent;
  if(!intent){
   if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)||Number(quantity)<=0||!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)||Number(price)<=0){setError("Enter a valid limit price and quantity.");return;}
   intent={symbol,side,type:"limit",qty:quantity.trim(),price:price.trim(),client_order_id:window.crypto.randomUUID()};
   if(!pendingStorageKey){setError("Account identity is unavailable. No order was sent.");return;}
   try{window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent));}
   catch{setError("This browser cannot safely save the order request. No order was sent.");return;}
   setPendingIntent(intent);
  }
  setBusy(true);setError("");setNotice("");
  let orderAccepted=false;
  try{
   const result=await submitSpotOrder(intent);
   orderAccepted=true;
   const latest=await getOrders();
   setOrders(latest);
   const confirmed=latest.some(item=>String(item.order_id??item.id??"")===result.order_id);
   if(!confirmed){setError("The order response arrived, but order history has not confirmed it. Do not create another order; retry this same request.");return;}
   try{window.localStorage.removeItem(pendingStorageKey);}catch{}
   setPendingIntent(null);setPendingIntentInvalid(false);setQuantity("");
   setNotice(result.duplicate?"This order request was already recorded and confirmed.":"Limit order accepted and confirmed in order history.");
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Order result is unconfirmed. Keep the same request ID and check orders before retrying.");
   if(!orderAccepted&&reason instanceof ApiError&&(reason.status===400||reason.status===401||reason.status===403||reason.code==="MATCHING_ENGINE_UNAVAILABLE")){
    try{window.localStorage.removeItem(pendingStorageKey);}catch{}
    setPendingIntent(null);setPendingIntentInvalid(false);
   }
  }finally{setBusy(false);}
 };
 const cancelOrder=async(order:OrderRecord)=>{
  const orderId=String(order.order_id??order.id??"");if(!orderId)return;
  if(!accountUid){setError("Account identity is unavailable. Cancellation was not sent.");return;}
  const storageKey="btcbox.spot.cancel.v1."+accountUid+"."+orderId;
  let requestId=cancelRequestIds[orderId];
  if(requestId==="storage_unavailable"){setError("This browser cannot safely restore the cancellation request. Refresh order history before retrying.");return;}
  if(!requestId){
   requestId=window.crypto.randomUUID();
   try{window.localStorage.setItem(storageKey,requestId);}
   catch{setError("This browser cannot safely save the cancellation request. No cancellation was sent.");return;}
   setCancelRequestIds(current=>({...current,[orderId]:requestId!}));
  }
  setBusy(true);setError("");setNotice("");
  let cancelAccepted=false;
  try{
   const result=await cancelSpotOrder({order_id:orderId,client_cancel_id:requestId});
   cancelAccepted=true;
   const latest=await getOrders();
   setOrders(latest);
   const updated=latest.find(item=>String(item.order_id??item.id??"")===orderId);
   const status=String(updated?.status||"").toLowerCase();
   if(!["cancelled","canceled","rejected"].includes(status)){setError("The cancellation response arrived, but order history has not confirmed the final status. Retry only with the same request ID.");return;}
   try{window.localStorage.removeItem(storageKey);}catch{}
   setCancelRequestIds(current=>{const next={...current};delete next[orderId];return next;});
   setNotice(result.duplicate?"This cancellation was already recorded and confirmed.":"Order cancellation confirmed in order history.");
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Cancellation result is unconfirmed. Refresh order history and retry only with the same request ID.");
   if(!cancelAccepted&&reason instanceof ApiError&&reason.status>=400&&reason.status<500&&reason.status!==409){
    try{window.localStorage.removeItem(storageKey);}catch{}
    setCancelRequestIds(current=>{const next={...current};delete next[orderId];return next;});
   }
  }finally{setBusy(false);}
 };
 const amountText=(value:unknown)=>value===null||value===undefined||value===""?"—":Number.isFinite(Number(value))?Number(value).toLocaleString(undefined,{maximumFractionDigits:8}):String(value);
 const openOrders=orders.filter(item=>["open","partially_filled","partially-filled","pending"].includes(String(item.status||"").toLowerCase()));
 const asks=(book?.asks||[]).slice(0,8).slice().reverse();const bids=(book?.bids||[]).slice(0,8);
 return <PageFrame eyebrow="BTCBOX / SPOT" title={symbol} description="Live market data and server-validated limit-order entry.">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Badge variant="outline">{t("Spot market")}</Badge><span className="text-xs text-brand-text-muted">{t("Ticker")}: {ticker?.source||"—"} · {t("Order book")}: {book?.source||"—"} · {t("Chart")}: {candles[0]?.source||"—"}</span><span className="text-xs text-brand-text-muted">{marketUpdatedAt? (ticker?.providerTs?t("Provider update")+": "+new Date(ticker.providerTs*1000).toLocaleTimeString()+" · ":"")+t("Snapshot checked")+": "+new Date(marketUpdatedAt).toLocaleTimeString():t("Waiting for live data")}</span></div><Button size="sm" variant="outline" disabled={loading||busy} onClick={()=>setReload(value=>value+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {error?<div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">{error}</div>:null}{marketFeedWarning?<div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">{marketFeedWarning}</div>:null}{chartFeedWarning?<div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">{chartFeedWarning}</div>:null}{notice?<div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">{notice}</div>:null}
      <Card className="border-brand-border bg-brand-surface"><CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4"><div><p className="text-xs text-brand-text-muted">{t("Last price")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{ticker?amountText(ticker.price):"—"} <span className="text-xs text-brand-text-muted">USDT</span></p></div><div><p className="text-xs text-brand-text-muted">{t("24h change")}</p><p className={"mt-1 font-semibold tabular-nums "+(Number(ticker?.chg||0)>=0?"text-profit":"text-loss")}>{ticker?Number(ticker.chg).toFixed(2)+"%":"—"}</p></div><div><p className="text-xs text-brand-text-muted">{t("24h high")}</p><p className="mt-1 font-medium tabular-nums">{ticker?amountText(ticker.high):"—"}</p></div><div><p className="text-xs text-brand-text-muted">{t("24h low")}</p><p className="mt-1 font-medium tabular-nums">{ticker?amountText(ticker.low):"—"}</p></div></CardContent></Card>
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
   <div className="min-w-0 order-2 space-y-4 xl:order-1">

    <Card className={"border-brand-border bg-brand-surface "+(mobilePanel==="chart"?"fixed inset-x-0 bottom-0 z-40 max-h-[72dvh] overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-2xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-xl xl:pb-0 xl:shadow-none":"hidden xl:block")}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{t("Price chart")}</CardTitle><CardDescription>{t("1-hour candles returned by the live market data provider.")}</CardDescription></div><Button type="button" size="sm" variant="outline" className="xl:hidden" onClick={()=>setMobilePanel(null)}>{t("Close")}</Button></CardHeader><CardContent><div ref={chartContainer} className="min-h-[320px] w-full">{!candles.length&&!loading?<p className="p-5 text-sm text-brand-text-muted">{t("No verified candle data is available for this market.")}</p>:null}</div></CardContent></Card>
    <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Open orders")}</CardTitle><CardDescription>{t("Only authenticated order records are shown. Cancellation is sent to the matching service.")}</CardDescription></CardHeader><CardContent className="space-y-2">{openOrders.length?openOrders.map((item,index)=>{const id=String(item.order_id??item.id??index);return <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-border p-3"><div><p className="font-semibold">{item.symbol||symbol} · {item.side||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Price")} {amountText(item.price)} · {t("Remaining")} {amountText(item.remaining_quantity??item.quantity)}</p><Badge variant="outline">{item.status}</Badge></div><Button size="sm" variant="outline" disabled={busy||!tradingStatus?.spot_cancel_enabled} onClick={()=>void cancelOrder(item)}>{cancelRequestIds[id]?t("Retry cancel"):t("Cancel")}</Button></div>;}):<p className="rounded-lg border border-dashed border-brand-border p-4 text-sm text-brand-text-muted">{t("No open spot orders were returned.")}</p>}</CardContent></Card>
   </div>
   <div className="order-1 space-y-4 xl:order-2">
    <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Limit order")}</CardTitle><CardDescription>{t("Only limit orders are supported by the current matching contract.")}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><Button variant={side==="buy"?"default":"outline"} onClick={()=>setSide("buy")} disabled={busy||!!pendingIntent||pendingIntentInvalid}>{t("Buy")}</Button><Button variant={side==="sell"?"destructive":"outline"} onClick={()=>setSide("sell")} disabled={busy||!!pendingIntent}>{t("Sell")}</Button></div><form className="space-y-3" onSubmit={event=>void submitOrder(event)}><label className="block space-y-1 text-sm"><span>{t("Limit price (USDT)")}</span><input value={price} onChange={event=>setPrice(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text" required/></label><label className="block space-y-1 text-sm"><span>{t("Quantity") } · {base}</span><input value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text" required/></label><p className="text-xs text-brand-text-muted">{t("Estimated total")}: {price&&quantity&&Number(price)>0&&Number(quantity)>0?amountText(Number(price)*Number(quantity))+" USDT":"—"}</p>{!tradingStatus?.spot_order_entry_enabled?<div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200">{t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled.")}</div>:null}{pendingIntent?<p className="break-all text-xs text-amber-300">{t("Unconfirmed request ID. Keep the form unchanged and retry with the same ID.")} · {pendingIntent.client_order_id}</p>:null}<Button block type="submit" disabled={busy||pendingIntentInvalid||(!spotPairEnabled&&!pendingIntent)||(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent)||!price||!quantity}>{busy?t("Submitting…"):pendingIntent?t("Retry same order"):side==="buy"?t("Place buy limit order"):t("Place sell limit order")}</Button></form></CardContent></Card>
    <div className="grid grid-cols-2 gap-2 xl:hidden"><Button type="button" size="sm" variant={mobilePanel==="orderbook"?"default":"outline"} aria-pressed={mobilePanel==="orderbook"} onClick={()=>setMobilePanel(current=>current==="orderbook"?null:"orderbook")}>{t("Order book")}</Button><Button type="button" size="sm" variant={mobilePanel==="chart"?"default":"outline"} aria-pressed={mobilePanel==="chart"} onClick={()=>setMobilePanel(current=>current==="chart"?null:"chart")}>{t("Chart")}</Button></div>
    <Card className={"border-brand-border bg-brand-surface "+(mobilePanel==="orderbook"?"fixed inset-x-0 bottom-0 z-40 max-h-[72dvh] overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-2xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-xl xl:pb-0 xl:shadow-none":"hidden xl:block")}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{t("Order book")}</CardTitle><CardDescription>{book?.source||t("Live market depth")}</CardDescription></div><Button type="button" size="sm" variant="outline" className="xl:hidden" onClick={()=>setMobilePanel(null)}>{t("Close")}</Button></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><p className="mb-2 text-xs font-semibold text-loss">{t("Asks")}</p>{asks.length?asks.map((row,index)=><div key={index} className="flex justify-between gap-2 py-1 text-xs tabular-nums"><span className="text-loss">{amountText(row[0])}</span><span className="text-brand-text-muted">{amountText(row[1])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div><div><p className="mb-2 text-xs font-semibold text-profit">{t("Bids")}</p>{bids.length?bids.map((row,index)=><div key={index} className="flex justify-between gap-2 py-1 text-xs tabular-nums"><span className="text-profit">{amountText(row[0])}</span><span className="text-brand-text-muted">{amountText(row[1])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div></div></CardContent></Card>
   </div>
  </div>
 </PageFrame>;
}

export function SectionPage({title,description}:{title:string;description:string}){const {t}=useI18n();return <PageFrame eyebrow="BTCBOX / WORKSPACE" title={title} description={description}><Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-start gap-3 p-4 sm:p-5"><Badge variant="outline" className="shrink-0 border-brand-border text-brand-text-muted">{t("Unavailable")}</Badge><p className="type-body-compact min-w-0 flex-1 text-brand-text-muted">{t("This service is not currently available. Please check back later.")}</p></CardContent></Card></PageFrame>}


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
         Number.isSafeInteger(saved.duration_sec)&&saved.duration_sec>0&&typeof saved.amount==="string"){
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

async function prepareKycDocumentImage(file: File): Promise<{
 document_content_type: "image/jpeg";
 document_image_base64: string;
}> {
 if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
  throw new Error("Choose a JPEG, PNG, or WebP identity document image.");
 }
 if (!file.size || file.size > 8 * 1024 * 1024) {
  throw new Error("The selected image must be smaller than 8 MB before compression.");
 }
 const bitmap = await createImageBitmap(file);
 try {
  let width = bitmap.width, height = bitmap.height;
  const scale = Math.min(1, 1600 / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
   const canvas = document.createElement("canvas");
   canvas.width = width; canvas.height = height;
   const context = canvas.getContext("2d");
   if (!context) throw new Error("This browser cannot prepare the document image.");
   context.fillStyle = "#ffffff";
   context.fillRect(0, 0, width, height);
   context.drawImage(bitmap, 0, 0, width, height);
   blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", [0.84, 0.78, 0.7, 0.62, 0.54][attempt]));
   if (blob && blob.size <= 512 * 1024) break;
   // Shrink both dimensions by the same factor to preserve the document's aspect ratio.
   width = Math.max(1, Math.round(width * 0.82));
   height = Math.max(1, Math.round(height * 0.82));
  }
  if (!blob || blob.size > 512 * 1024) throw new Error("The image could not be compressed below 512 KB. Choose a clearer, smaller photo.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
   const reader = new FileReader();
   reader.onerror = () => reject(new Error("The document image could not be read."));
   reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The document image could not be read."));
   reader.readAsDataURL(blob as Blob);
  });
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("The document image could not be prepared.");
  return { document_content_type: "image/jpeg", document_image_base64: encoded };
 } finally {
  bitmap.close();
 }
}

export function KycPage(){
 const {t}=useI18n();
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [name,setName]=useState("");
 const [idType,setIdType]=useState<"passport"|"id_card"|"driver_license">("id_card");
 const [idNumber,setIdNumber]=useState("");
 const [documentFile,setDocumentFile]=useState<File|null>(null);
 const [loading,setLoading]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState("");
 const [submitError,setSubmitError]=useState("");
 const [notice,setNotice]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError("");
  getAccount(controller.signal).then(data=>{setAccount(data);setName(current=>current||data.kyc?.name||"");setIdType(current=>data.kyc?.id_type==="passport"||data.kyc?.id_type==="driver_license"?data.kyc.id_type:current);}).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setError(reason instanceof Error?reason.message:"Verification status is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const status=String(account?.kyc?.status||"not_submitted").toLowerCase();
 const label=status.replace(/[_-]+/g," ");
 const submitted=["pending","processing","under_review","approved","verified","rejected","failed"].includes(status);
 const canSubmit=!["pending","processing","under_review","approved","verified"].includes(status);
 const tone=["approved","verified"].includes(status)?"border-emerald-500/30 text-emerald-400":["rejected","failed"].includes(status)?"border-rose-500/30 text-rose-300":"border-amber-500/30 text-amber-300";
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const cleanName=name.trim(),cleanId=idNumber.trim();
  if(cleanName.length<2||cleanName.length>100||cleanId.length<4||cleanId.length>64){setSubmitError(t("Enter your full name and a valid document number."));return;}
  if(!documentFile){setSubmitError(t("Upload a clear photo of your identity document."));return;}
  setSubmitting(true);setSubmitError("");setNotice("");
  try{
   const image=await prepareKycDocumentImage(documentFile);
   await submitKyc({name:cleanName,id_type:idType,id_number:cleanId,...image});
   setDocumentFile(null);
   setNotice(t("Verification details and document image submitted securely for staff review."));
   setReload(value=>value+1);
  }
  catch(reason){setSubmitError(reason instanceof Error?reason.message:t("Verification submission could not be confirmed. Refresh your status before retrying."));}
  finally{setSubmitting(false);}
 };
 return <PageFrame eyebrow="BTCBOX / ACCOUNT" title="Identity verification" description="Submit your identity details and a clear document image, then track the review result returned by your authenticated BTCBOX account.">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading verification status…")}</CardContent></Card>
  :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<div className="space-y-4"><Card className="border-brand-border bg-brand-surface"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
   <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-brand-text-muted">{t("Current status")}</p><p className="mt-1 text-lg font-semibold capitalize">{t(label)}</p></div><Badge variant="outline" className={tone}>{t(label)}</Badge></div>
   <div><p className="text-xs text-brand-text-muted">{t("Applicant name")}</p><p className="mt-1 font-medium">{account.kyc?.name||"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Document type")}</p><p className="mt-1 font-medium">{account.kyc?.id_type||"—"}</p></div>
   <div className="sm:col-span-2"><p className="text-xs text-brand-text-muted">{t("Document number")}</p><p className="mt-1 break-all font-mono text-sm">{account.kyc?.id_number?"••••"+account.kyc.id_number.slice(-4):"—"}</p></div>
   {account.kyc?.reject_reason?<div className="sm:col-span-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3"><p className="text-xs font-semibold text-rose-300">{t("Review note")}</p><p className="mt-1 text-sm text-brand-text-secondary">{account.kyc.reject_reason}</p></div>:null}
   <div className="sm:col-span-2 border-t border-brand-border pt-3"><p className="text-sm text-brand-text-muted">{submitted&&!canSubmit?t("Your verification is on file. You can check the status again after staff review."):t("Submit your details and a clear photo of your identity document. BTCBOX staff will review the information and update your verification status.")}</p></div>
  </CardContent></Card>
  {canSubmit?<Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{status==="rejected"?t("Resubmit verification"):t("Submit identity details")}</CardTitle><CardDescription>{t("Use the same name and document details shown on your identity document. Do not send passwords or two-factor codes. Images are compressed before secure upload.")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submit}>
   <label className="block space-y-1 text-sm"><span>{t("Full legal name")}</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={100} autoComplete="name" required disabled={submitting} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text"/></label>
   <label className="block space-y-1 text-sm"><span>{t("Identity document type")}</span><select value={idType} onChange={event=>setIdType(event.target.value as "passport"|"id_card"|"driver_license")} disabled={submitting} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text"><option value="id_card">{t("National ID card")}</option><option value="passport">{t("Passport")}</option><option value="driver_license">{t("Driver license")}</option></select></label>
   <label className="block space-y-1 text-sm"><span>{t("Document number")}</span><input value={idNumber} onChange={event=>setIdNumber(event.target.value)} maxLength={64} autoComplete="off" required disabled={submitting} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 font-mono text-brand-text"/></label>
   <label className="block space-y-1 text-sm"><span>{t("Identity document image")}</span><input type="file" accept="image/jpeg,image/png,image/webp" required disabled={submitting} onChange={event=>{setDocumentFile(event.target.files?.[0]||null);setSubmitError("");}} className="block w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text file:mr-3 file:rounded-md file:border-0 file:bg-brand-surface file:px-3 file:py-2 file:text-brand-text"/></label>
   <p className="text-xs text-brand-text-muted">{t("JPEG, PNG or WebP. Maximum original size 8 MB; securely compressed to 512 KB. Upload a clear, readable image.")}{documentFile?<span className="block mt-1">{t("Selected")}: {documentFile.name}</span>:null}</p>
   <Button type="submit" block disabled={submitting||!name.trim()||!idNumber.trim()||!documentFile}>{submitting?t("Submitting…"):t("Submit for review")}</Button>
   {submitError?<p role="alert" className="text-sm text-rose-300">{submitError}</p>:null}{notice?<p role="status" className="text-sm text-emerald-300">{notice}</p>:null}
  </form></CardContent></Card>:null}
  <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/support">{t("Contact support")}</Link></Button><Button size="sm" variant="ghost" onClick={()=>setReload(n=>n+1)}>{t("Refresh status")}</Button></div></div>:null}
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
 const [pendingRequestId,setPendingRequestId]=useState<string>("");
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
  const requestId=pendingRequestId||("MSG"+crypto.randomUUID().replace(/-/g,"")).slice(0,64);
  if(!pendingRequestId)setPendingRequestId(requestId);
  setSending(true);setSendError("");
  try{
   await sendSupportMessage(message,requestId);
   setDraft("");
   setPendingRequestId("");
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
 const [depositHistory,setDepositHistory]=useState<DepositRecord[]>([]);
 const [historyLoading,setHistoryLoading]=useState(true);
 const [historyError,setHistoryError]=useState("");
 const [historyReload,setHistoryReload]=useState(0);
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
 useEffect(()=>{
  const controller=new AbortController();
  setHistoryLoading(true);setHistoryError("");
  getAccount(controller.signal).then(snapshot=>{
   if(!controller.signal.aborted)setDepositHistory(Array.isArray(snapshot.deposits)?snapshot.deposits:[]);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted)setHistoryError(reason instanceof Error?reason.message:"Deposit history is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setHistoryLoading(false);});
  return ()=>controller.abort();
 },[historyReload]);
 const changeCoin=(next:string)=>{setCoin(next);setNetwork(depositNetworks[next][0]);};
 return <PageFrame eyebrow="BTCBOX / WALLET" title="Deposit" description="View the deposit address configured by BTCBOX for the selected asset and network. BTCBOX staff verify incoming transfers and manually credit the account.">
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Deposit address")}</CardTitle><CardDescription>{t("Always verify the asset and network before sending funds.")}</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Asset")}</span><select value={coin} onChange={e=>changeCoin(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{Object.keys(depositNetworks).map(x=><option key={x}>{x}</option>)}</select></label><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Network")}</span><select value={network} onChange={e=>setNetwork(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{depositNetworks[coin].map(x=><option key={x}>{x}</option>)}</select></label></div>
   {loading?<p className="rounded-xl border border-brand-border p-4 text-sm text-brand-text-muted" role="status">{t("Loading configured deposit address…")}</p>
   :error?<div className="rounded-xl border border-amber-400/30 p-4"><p className="text-sm text-amber-200" role="alert">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>
   :<div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">{coin} · {network}</p><div className="break-all rounded-xl border border-brand-border bg-brand-surface-2 p-4 font-mono text-sm">{address}</div><Button variant="outline" size="sm" onClick={()=>navigator.clipboard?.writeText(address)}>{t("Copy address")}</Button></div>}
   <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-brand-text-secondary"><p className="font-semibold text-amber-200">{t("Important")}</p><p className="mt-1">{t("Send only the selected asset on the selected network. Sending unsupported assets or using another network may result in permanent loss. After the transfer, BTCBOX staff verify receipt and manually credit the account. This page does not create a deposit order or automatically credit funds.")}</p></div>
  </CardContent></Card>
  <Card className="border-brand-border bg-brand-surface"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{t("Deposit history")}</CardTitle><CardDescription>{t("Track deposits verified and credited by BTCBOX staff.")}</CardDescription></div><Button size="sm" variant="outline" disabled={historyLoading} onClick={()=>setHistoryReload(value=>value+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(historyLoading?"animate-spin":"")}/>{t("Refresh")}</Button></div></CardHeader><CardContent className="space-y-2">
   {historyLoading?<p className="text-sm text-brand-text-muted" role="status">{t("Loading deposit history…")}</p>
   :historyError?<p className="text-sm text-rose-300" role="alert">{historyError}</p>
   :depositHistory.length?depositHistory.map((item,index)=><div key={item.id||`${item.time||"deposit"}-${item.coin}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border p-3"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||"—"}</p>{item.reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">{t("Reference")}: {item.reference||item.txid}</p>:null}</div><Badge variant="outline" className={item.status==="confirmed"?"border-emerald-500/30 text-emerald-400":item.status==="rejected"?"border-rose-500/30 text-rose-300":"border-amber-500/30 text-amber-300"}>{item.status}</Badge></div>)
   :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No deposit records have been returned for this account.")}</p>}
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
 const [pendingIntent,setPendingIntent]=useState<{version:1;request_id:string;address_id:string;coin:string;network:string;amount:string;address:string;created_at:number}|null>(null);
 const [pendingIntentInvalid,setPendingIntentInvalid]=useState(false);
 const [reload,setReload]=useState(0);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  Promise.all([getAccount(controller.signal),getSavedCryptoAddresses(controller.signal),getWithdrawalConfig(controller.signal)])
   .then(([snapshot,book,withdrawalConfig])=>{
    if(controller.signal.aborted)return;
    setAccount(snapshot);setAddresses(book);setConfig(withdrawalConfig);
    const usable=book.filter(item=>!item.blocked&&!item.unbound);
    const storageKey="btcbox.withdraw.pending.v1."+snapshot.uid;
    try{
     const raw=window.localStorage.getItem(storageKey);
     if(raw){
      const saved=JSON.parse(raw);
      const savedAddress=book.find(item=>item.id===saved?.address_id);
      if(saved&&saved.version===1&&typeof saved.request_id==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(saved.request_id)&&typeof saved.amount==="string"&&typeof saved.address==="string"&&savedAddress&&!savedAddress.blocked&&!savedAddress.unbound&&savedAddress.coin===saved.coin&&savedAddress.network===saved.network){
       setPendingIntent(saved);setSelectedId(saved.address_id);setAmount(saved.amount);
      }else{setPendingIntentInvalid(true);setError("A saved withdrawal request cannot be matched to its original destination. Contact support before creating another withdrawal.");}
     }else{setPendingIntent(null);setPendingIntentInvalid(false);setSelectedId(current=>usable.some(item=>item.id===current)?current:(usable[0]?.id||""));}
    }catch{setPendingIntentInvalid(true);setError("A saved withdrawal request could not be read. Do not submit another withdrawal until its status is checked.");}
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
 const pendingStorageKey=account?.uid?"btcbox.withdraw.pending.v1."+account.uid:"";
 const clearPending=()=>{if(pendingStorageKey){try{window.localStorage.removeItem(pendingStorageKey);}catch{}}setPendingIntent(null);setPendingIntentInvalid(false);};
 const canSubmit=!!config?.actions_enabled&&!pendingIntentInvalid&&!!selectedAddress&&Number.isFinite(parsedAmount)&&parsedAmount>0&&parsedAmount<=available&&!!fundPassword.trim()&&(!account?.twofa_enabled||/^\d{6}$/.test(twofaCode))&&!submitting&&!loading;

 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!canSubmit||!selectedAddress)return;
  let intent=pendingIntent;
  if(!intent){
   intent={version:1,request_id:window.crypto.randomUUID(),address_id:selectedId,coin:selectedAddress.coin,network:selectedAddress.network,amount:amount.trim(),address:selectedAddress.address,created_at:Date.now()};
   if(!pendingStorageKey){setError("Account identity is unavailable. No withdrawal was sent.");return;}
   try{window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent));}
   catch{setError("This browser cannot safely save the withdrawal request. No withdrawal was sent.");return;}
   setPendingIntent(intent);
  }
  if(intent.address_id!==selectedId||intent.address!==selectedAddress.address||intent.coin!==selectedAddress.coin||intent.network!==selectedAddress.network){setError("The saved withdrawal destination no longer matches. Contact support before retrying.");setPendingIntentInvalid(true);return;}
  setSubmitting(true);setError("");setActionMessage("");
  let requestAccepted=false;
  try{
   const result=await submitWithdrawal({
    request_id:intent.request_id,coin:intent.coin,network:intent.network,
    amount:intent.amount,address:intent.address,fund_password:fundPassword,
    expected_fee:String(config?.fees[intent.coin] ?? ""),
    ...(account?.twofa_enabled?{twofa_code:twofaCode}:{})
   });
   requestAccepted=true;
   const latest=await getAccount();
   setAccount(latest);
   const confirmed=(latest.withdrawals||[]).some(item=>item.id===result.withdrawal_id);
   if(!confirmed){setError("The withdrawal response arrived, but account history has not confirmed it. Keep this request and retry only with the same ID.");return;}
   clearPending();setAmount("");setFundPassword("");setTwofaCode("");
   setActionMessage(result.duplicate?t("This withdrawal request was already received and confirmed."):result.require_admin_review?t("Withdrawal submitted for staff review."):t("Withdrawal submitted and is awaiting staff processing."));
   setReload(value=>value+1);
  }catch(reason){
   setError(reason instanceof Error?reason.message:"Withdrawal result is unconfirmed. Keep this request unchanged and retry with the same request ID.");
   if(!requestAccepted&&reason instanceof ApiError&&reason.code==="WITHDRAWAL_FEE_CHANGED"){
    clearPending();
    try{setConfig(await getWithdrawalConfig());}catch{}
    setError("The withdrawal fee changed. The latest fee has been refreshed. Review the request and submit again.");
   }else if(!requestAccepted&&reason instanceof ApiError&&reason.status>=400&&reason.status<500&&reason.status!==409)clearPending();
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
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Saved withdrawal address")}</span><select value={selectedId} disabled={!!pendingIntent||pendingIntentInvalid||submitting} onChange={event=>{setSelectedId(event.target.value);setError("");}} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{usableAddresses.map(item=><option key={item.id} value={item.id}>{item.coin} · {item.network} · {item.address}</option>)}</select></label>
     {selectedAddress?<div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-xs text-brand-text-muted"><p>{t("Selected destination")}: {selectedAddress.coin} · {selectedAddress.network}</p><p className="mt-1 break-all font-mono">{selectedAddress.address.length>18?selectedAddress.address.slice(0,8)+"…"+selectedAddress.address.slice(-8):selectedAddress.address}</p></div>:<p className="text-xs text-brand-text-muted">{t("Loading selected address…")}</p>}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} {selectedAddress ? "(" + selectedAddress.coin + ")" : ""}</span><input inputMode="decimal" value={amount} disabled={!!pendingIntent||pendingIntentInvalid||submitting} onChange={event=>setAmount(event.target.value)} placeholder="0.00" className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text"/></label>
     {selectedAddress?<div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-border p-3 text-sm"><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 tabular-nums">{available.toLocaleString(undefined,{maximumFractionDigits:10})} {selectedAddress.coin}</p></div><div><p className="text-xs text-brand-text-muted">{t("Withdrawal fee")}</p><p className="mt-1 tabular-nums">{Number.isFinite(fee)?fee:"—"} {selectedAddress.coin}</p></div></div>:null}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Fund password")}</span><input type="password" autoComplete="current-password" value={fundPassword} disabled={submitting} onChange={event=>setFundPassword(event.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" required/></label>
     {account?.twofa_enabled?<label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Two-factor code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twofaCode} disabled={submitting} onChange={event=>setTwofaCode(event.target.value.replace(/\D/g,"").slice(0,6))} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" required/></label>:null}
     {config&&!config.actions_enabled?<div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-brand-text-secondary"><Badge variant="outline" className="border-amber-400/30 text-amber-200">{t("Withdrawals temporarily unavailable")}</Badge><p className="mt-2">{t("The financial ledger cutover has not been enabled. You can review your wallet, but no withdrawal request can be submitted yet.")}</p></div>:null}
     {error?<p role="alert" className="text-sm text-rose-300">{error}</p>:null}
     {actionMessage?<p role="status" className="text-sm text-emerald-300">{actionMessage}</p>:null}
     <Button type="submit" disabled={!canSubmit}>{submitting?t("Submitting…"):pendingIntent?t("Retry same request"):t("Submit for staff review")}</Button>
     {pendingIntent?<p className="break-all text-xs text-amber-300">{t("Request result is not yet confirmed. Re-enter your fund password and 2FA code, then retry with the same request ID.")} · {pendingIntent.request_id}</p>:null}
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