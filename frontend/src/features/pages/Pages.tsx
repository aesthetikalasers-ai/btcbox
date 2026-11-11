import * as Dialog from "@radix-ui/react-dialog";
import { AuthRestoreState } from "../../components/AuthRestoreState";
import { multiplyDecimalStrings, compareDecimalStrings } from "../../lib/decimal";
import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldAlert, Send, MessageCircle } from "lucide-react";
import { ApiError, getAccount, getOrders, getMarkets, getSpotMarketPairs, getKlines, getOrderBook, getTradingStatus, submitSpotOrder, cancelSpotOrder, getSecondsPositions, getSecondsPolicy, submitSecondsOrder, settleSecondsPosition, getSupportMessages, sendSupportMessage, getDepositAddress, getSavedCryptoAddresses, getSelectedCryptoAddress, getWithdrawalConfig, submitWithdrawal, getEarnCatalog, submitEarnAction, type EarnProduct, type EarnPosition, type SavedCryptoAddress, type AccountBalance, type AccountSnapshot, type DepositRecord, type OrderRecord, type MarketTicker, type MarketCandle, type OrderBookSnapshot, type SpotMarketPair, type TradingStatus, type SecondsPositionsSnapshot, type SecondsOrderInput, type SecondsPolicyResponse, type SupportMessage, type SelectedCryptoAddress, type WithdrawalConfig, type WithdrawalRecord, submitKyc } from "../../lib/api";
import { useAuth } from "../../lib/auth";

import type { ReactNode } from "react";
import { ArrowUpRight, LockKeyhole, Wallet, ChartNoAxesCombined, ArrowLeftRight, Sprout, BadgeCheck, ShieldCheck, Headset } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { formatDecimalAmount, localeTags, useI18n } from "../../lib/i18n";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

function PageFrame({eyebrow,title,description,children,className=""}:{eyebrow:string;title:string;description?:string;children:ReactNode;className?:string}){
 const {t}=useI18n();
 const tone = eyebrow.includes("/ TRADE") || eyebrow.includes("/ SPOT") || title === "Seconds" || title === "Spot" ? "trading" : eyebrow.includes("/ WEALTH") || title === "Earn" ? "earn" : eyebrow.includes("/ WALLET") ? "assets" : eyebrow.includes("/ HELP") ? "support" : eyebrow.includes("/ ACCOUNT") ? (title === "Orders" ? "orders" : "account") : "market";
 return <div className={`${className} tone-${tone} mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8`}><div><p className="page-accent mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t(eyebrow)}</p><h1 className="type-page-title text-brand-text">{t(title)}</h1>{description?<p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t(description)}</p>:null}</div>{children}</div>;
}
export function TradeHubPage(){
 const {t}=useI18n();
 const {status}=useAuth();
 const [spotPairs,setSpotPairs]=useState<SpotMarketPair[]>([]);
 const [pairsLoading,setPairsLoading]=useState(true);
 const [pairsError,setPairsError]=useState("");
 const [tradingStatus,setTradingStatus]=useState<TradingStatus|null>(null);
 const [tradingStatusError,setTradingStatusError]=useState("");
 const [secondsAvailability,setSecondsAvailability]=useState<"loading"|"sign-in"|"enabled"|"read-only"|"unavailable">("loading");
 const [earnAvailability,setEarnAvailability]=useState<"loading"|"sign-in"|"enabled"|"read-only"|"empty"|"unavailable">("loading");
 useEffect(()=>{
  const controller=new AbortController();
  getSpotMarketPairs(controller.signal).then(setSpotPairs).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   setPairsError(reason instanceof Error?reason.message:"Spot-market catalogue is unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setPairsLoading(false);});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  setTradingStatus(null);setTradingStatusError("");
  getTradingStatus(controller.signal).then(snapshot=>{
   if(!controller.signal.aborted)setTradingStatus(snapshot);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted)setTradingStatusError(reason instanceof Error?reason.message:"Spot execution status is unavailable.");
  });
  if(status==="loading"){
   setSecondsAvailability("loading");setEarnAvailability("loading");
  }else if(status!=="authenticated"){
   setSecondsAvailability("sign-in");setEarnAvailability("sign-in");
  }else{
   setSecondsAvailability("loading");setEarnAvailability("loading");
   Promise.allSettled([getSecondsPolicy(controller.signal),getEarnCatalog(controller.signal)]).then(([seconds,earn])=>{
    if(controller.signal.aborted)return;
    setSecondsAvailability(seconds.status==="fulfilled"?(seconds.value.actions_enabled?"enabled":"read-only"):"unavailable");
    setEarnAvailability(earn.status==="rejected"?"unavailable":earn.value.products.length===0?"empty":earn.value.actions_enabled?"enabled":"read-only");
   });
  }
  return ()=>controller.abort();
 },[status]);
 const spotExecutionEnabled=tradingStatus?.spot_order_entry_enabled===true;
 const spotBadge=pairsLoading?"Checking markets":pairsError?"Markets unavailable":!spotPairs.length?"Unavailable":tradingStatusError?"Execution unavailable":tradingStatus===null?"Checking execution":spotExecutionEnabled?"Order entry enabled":"Read-only";
 const spotDescription=pairsLoading?t("Checking backend-enabled spot markets."):pairsError?t("Spot availability cannot be confirmed. Order entry remains unavailable."):!spotPairs.length?t("No spot markets are currently enabled. Spot order entry remains unavailable."):tradingStatusError?t("Markets are listed, but execution status cannot be confirmed. Order entry remains unavailable."):tradingStatus===null?t("Checking server-side order execution status."):spotExecutionEnabled?t("Place server-validated limit orders on configured spot pairs."):t("Configured markets are visible, but spot order execution is disabled by server policy.");
 const secondsDescription=secondsAvailability==="sign-in"?t("Sign in to check the active Seconds policy and availability."):secondsAvailability==="loading"?t("Checking the active backend Seconds policy."):secondsAvailability==="unavailable"?t("Seconds policy is unavailable. New positions remain disabled."):secondsAvailability==="read-only"?t("The policy is configured, but new positions are disabled by backend financial controls."):t("Place policy-driven positions with independent timers and server-side settlement.");
 const secondsBadge=secondsAvailability==="sign-in"?t("Sign in required"):secondsAvailability==="loading"?t("Checking policy"):secondsAvailability==="unavailable"?t("Policy unavailable"):secondsAvailability==="read-only"?t("Actions disabled"):t("Order entry enabled");
 const earnDescription=earnAvailability==="sign-in"?t("Sign in to view the Earn catalog and your positions."):earnAvailability==="loading"?t("Checking the backend Earn catalog."):earnAvailability==="unavailable"?t("Earn catalog is unavailable. No product availability is assumed."):earnAvailability==="empty"?t("No Earn products are currently available."):earnAvailability==="read-only"?t("Earn products are listed, but subscribe and redeem actions are disabled by backend financial controls."):t("Review available Earn products and manage positions.");
 const earnBadge=earnAvailability==="sign-in"?t("Sign in required"):earnAvailability==="loading"?t("Checking catalog"):earnAvailability==="unavailable"?t("Catalog unavailable"):earnAvailability==="empty"?t("No products"):earnAvailability==="read-only"?t("Read-only"):t("Products available");
 return <PageFrame eyebrow={t("BTCBOX / TRADE")} title={t("Choose your trading mode")} description={t("Choose a BTCBOX trading service. Supported markets and product availability are returned by the backend.")}>
  <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
   <Card className="flex h-full min-w-0 flex-col border-brand-border bg-brand-surface"><CardHeader className="flex-1"><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><ChartNoAxesCombined className="h-5 w-5"/></div><CardTitle>{t("Spot")}</CardTitle><CardDescription>{spotDescription}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge data-testid="spot-availability" variant={spotExecutionEnabled?"outline":"secondary"}>{t(spotBadge)}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/markets">{t("View markets")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="flex h-full min-w-0 flex-col border-brand-border bg-brand-surface"><CardHeader className="flex-1"><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><ArrowLeftRight className="h-5 w-5"/></div><CardTitle>{t("Seconds")}</CardTitle><CardDescription>{secondsDescription}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant={secondsAvailability==="enabled"?"outline":"secondary"}>{secondsBadge}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/seconds">{status==="authenticated"?t("Open"):t("Sign in to view")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="flex h-full min-w-0 flex-col border-brand-border bg-brand-surface"><CardHeader className="flex-1"><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><Sprout className="h-5 w-5"/></div><CardTitle>{t("Earn")}</CardTitle><CardDescription>{earnDescription}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant={earnAvailability==="enabled"?"outline":"secondary"}>{earnBadge}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/earn">{status==="authenticated"?t("Open"):t("Sign in to view")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="flex h-full min-w-0 flex-col border-dashed border-brand-border bg-transparent"><CardHeader className="flex-1"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-border text-brand-text-muted"><LockKeyhole className="h-5 w-5"/></div><CardTitle>{t("Futures")}</CardTitle><CardDescription>{t("Futures trading is currently unavailable.")}</CardDescription></CardHeader><CardContent><Badge variant="secondary">{t("Unavailable")}</Badge></CardContent></Card>
  </div>
  <section className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="type-section-title">{t("Spot markets")}</h2>{!pairsLoading&&!pairsError?<span className="text-xs text-brand-text-muted">{spotPairs.length} {t("pairs")}</span>:null}</div>
   {pairsLoading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading configured spot markets…")}</CardContent></Card>:null}
   {!pairsLoading&&!pairsError&&!spotPairs.length?<Card className="border-dashed border-brand-border bg-transparent"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No spot markets are currently enabled. Please check again later.")}</CardContent></Card>:null}
   {pairsError?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="p-5 text-sm text-rose-300" role="alert">{pairsError}</CardContent></Card>:null}
   {spotPairs.length?<div className="grid gap-3 sm:grid-cols-2">{spotPairs.map(pair=><Card key={pair.base_asset+"/"+pair.quote_asset} className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{pair.base_asset}/{pair.quote_asset}</CardTitle><CardDescription>{t("This pair is configured. Order entry availability is shown above.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{t("Enabled")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to={"/trade/"+pair.base_asset+pair.quote_asset}>{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>)}</div>:null}
  </section>
 </PageFrame>;
}
export function AssetsPage(){
 const {t,language}=useI18n();
 const numberLocale=localeTags[language];
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
 const amount=(raw:number|string|undefined)=>formatDecimalAmount(raw,numberLocale,10);
 const balances: Array<[string, AccountBalance]> = account ? Object.entries(account.balances) as Array<[string, AccountBalance]> : [];
 return <PageFrame eyebrow="BTCBOX / WALLET" title="Assets" description="Your balances are loaded from the authenticated BTCBOX account service.">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline" className="border-brand-border">{t("Live account data")}</Badge>{account&&!loading?<span className="text-xs text-brand-text-muted">{balances.length} {t("assets")}</span>:null}</div><Button size="sm" variant="outline" disabled={loading} onClick={()=>setReload((n)=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account balances…")}</CardContent></Card>
   :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
   :account?<>
    <section aria-label={t("Wallet overview")} className="grid gap-3 sm:grid-cols-3">
     <Card className="relative overflow-hidden border-brand-teal/25 bg-brand-surface ring-1 ring-brand-teal/[0.05]"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-teal"/><CardContent className="p-4 sm:p-5"><p className="type-meta pl-1 font-semibold uppercase tracking-wide text-brand-text-muted">{t("Estimated account value")}</p><p className="mt-2 break-all text-xl font-semibold tabular-nums text-brand-text sm:text-2xl">{account.valuation_complete?amount(account.totalUsdt)+" USDT":"—"}</p><p className="mt-2 pl-1 text-xs leading-5 text-brand-text-muted">{account.valuation_complete?t("All listed assets have a returned valuation."):t("Complete valuation is unavailable; no partial total is presented as a complete balance.")}</p>{account.unpriced_assets.length?<p className="mt-2 break-words text-xs text-amber-300">{t("Unpriced assets")}: {account.unpriced_assets.join(", ")}</p>:null}</CardContent></Card>
     <Card className="relative overflow-hidden border-brand-cyan/25 bg-brand-surface ring-1 ring-brand-cyan/[0.05]"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-cyan"/><CardContent className="p-4 sm:p-5"><p className="type-meta pl-1 font-semibold uppercase tracking-wide text-brand-text-muted">{t("Assets held")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-text">{balances.length}</p><p className="mt-2 pl-1 text-xs leading-5 text-brand-text-muted">{t("Assets returned by your account")}</p></CardContent></Card>
     <Card className="relative overflow-hidden border-brand-violet/25 bg-brand-surface ring-1 ring-brand-violet/[0.05]"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-violet"/><CardContent className="p-4 sm:p-5"><p className="type-meta pl-1 font-semibold uppercase tracking-wide text-brand-text-muted">{t("Valuation status")}</p><p className="mt-2 text-lg font-semibold text-brand-text">{account.valuation_complete?t("Complete"):t("Partial / unavailable")}</p><p className="mt-2 pl-1 text-xs leading-5 text-brand-text-muted">{account.valuation_complete?t("All listed assets have a returned valuation."):t("Unpriced assets are excluded from complete valuation.")}</p></CardContent></Card>
    </section>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="type-section-title">{t("Your assets")}</h2><span className="text-xs text-brand-text-muted">{balances.length}</span></div>
     {balances.length?balances.map(([asset,balance],index)=><Card key={asset} className={"relative overflow-hidden border-brand-border bg-brand-surface transition-colors hover:border-brand-teal/20 "+(index%3===0?"border-l-2 border-l-brand-teal":index%3===1?"border-l-2 border-l-brand-cyan":"border-l-2 border-l-brand-violet")}><CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><TokenIcon symbol={asset} className="h-9 w-9 shrink-0"/><div className="min-w-0"><p className="text-xs text-brand-text-muted">{t("Asset")}</p><p className="mt-1 truncate font-semibold">{asset}</p></div></div><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 break-all font-medium tabular-nums">{amount(balance.free)}</p></div><div><p className="text-xs text-brand-text-muted">{t("In orders")}</p><p className="mt-1 break-all font-medium tabular-nums">{amount(balance.frozen)}</p></div><div><p className="text-xs text-brand-text-muted">{t("USDT value")}</p><p className="mt-1 break-all font-medium tabular-nums">{balance.usdt===undefined?"—":amount(balance.usdt)}</p></div></CardContent></Card>)
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
  setLoading(true);setAccount(null);setError("");
  getAccount(controller.signal).then(snapshot=>{
   if(!controller.signal.aborted)setAccount(snapshot);
  }).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){
    setAccount(null);
    setError(reason instanceof Error?reason.message:"Account profile is temporarily unavailable.");
   }
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[status,reload]);
 const links=[
  {title:"Verification",to:"/kyc",icon:BadgeCheck,surface:"border-brand-cyan/25 bg-brand-surface",iconTone:"bg-brand-cyan/10 text-brand-cyan",hoverTone:"hover:border-brand-cyan/45"},
  {title:"Orders",to:"/orders",icon:ChartNoAxesCombined,surface:"border-brand-info/25 bg-brand-surface",iconTone:"bg-brand-info/10 text-brand-info",hoverTone:"hover:border-brand-info/45"},
  {title:"Support",description:"Contact the BTCBOX support team.",to:"/support",icon:Headset,surface:"border-brand-violet/25 bg-brand-surface",iconTone:"bg-brand-violet/10 text-brand-violet",hoverTone:"hover:border-brand-violet/45"},
  {title:"Settings",description:"Manage sign-in methods and account security.",to:"/settings",icon:ShieldCheck,surface:"border-brand-teal/25 bg-brand-surface",iconTone:"bg-brand-teal/10 text-brand-teal",hoverTone:"hover:border-brand-teal/45"},
 ];
 return <PageFrame eyebrow="BTCBOX / ACCOUNT" title="My account">
  {status==="loading"?<AuthRestoreState label="Loading account profile…"/>
  :status!=="authenticated"?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-start gap-3 p-6"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><LockKeyhole className="h-5 w-5"/></div><div><p className="type-card-title">{t("Sign in to continue")}</p><p className="type-body-compact mt-1 text-brand-text-muted">{t("Sign in to view your BTCBOX account profile.")}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><Button asChild className="min-w-[112px] flex-1 sm:flex-none"><Link to="/login">{t("Sign in")}</Link></Button><Button asChild variant="outline" className="min-w-[112px] flex-1 sm:flex-none"><Link to="/register">{t("Create account")}</Link></Button></div></CardContent></Card>
  :loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account profile…")}</CardContent></Card>
  :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<div className="space-y-4">
   <section aria-label={t("Account overview")} className="account-status grid grid-cols-3 gap-2">
    <Card className="border-brand-border bg-brand-surface "><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-cyan"><BadgeCheck className="h-5 w-5"/></span><div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Verification")}</p><p className="mt-1 truncate text-base font-semibold capitalize text-brand-text">{t((account.kyc?.status||"not_submitted").replace(/_/g," ").toLowerCase())}</p></div></CardContent></Card>
    <Card className="border-brand-border bg-brand-surface "><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal"><ShieldCheck className="h-5 w-5"/></span><div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Two-factor authentication")}</p><p className="mt-1 text-base font-semibold text-brand-text">{account.twofa_enabled?t("Enabled"):t("Not enabled")}</p></div></CardContent></Card>
    <Card className="border-brand-border bg-brand-surface "><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/10 text-brand-violet"><Wallet className="h-5 w-5"/></span><div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Linked sign-in methods")}</p><p className="mt-1 text-base font-semibold tabular-nums text-brand-text">{(account.auth_providers||[]).length}</p></div></CardContent></Card>
   </section>
   <Card className="overflow-hidden border-brand-border bg-brand-surface ">
    <CardHeader className="border-b border-brand-border bg-brand-surface-2/70 px-5 py-4 sm:px-6"><CardTitle>{t("Account profile")}</CardTitle></CardHeader>
    <CardContent className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
     <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Username")}</p><p className="mt-1 break-all font-semibold text-brand-text">{account.username||"—"}</p></div>
     <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Email")}</p><p className="mt-1 break-all font-semibold text-brand-text">{account.email||"—"}</p></div>
     <div className="min-w-0 sm:col-span-2"><p className="type-meta text-brand-text-muted">{t("Linked sign-in methods")}</p><div className="mt-2 flex flex-wrap gap-2">{(account.auth_providers||[]).length?(account.auth_providers||[]).map(provider=><Badge key={provider} variant="outline" className="border-brand-border capitalize">{provider}</Badge>):<span className="text-sm text-brand-text-muted">—</span>}</div></div>
     <div className="border-t border-brand-border pt-4 sm:col-span-2"><p className="type-meta text-brand-text-muted">{t("BTCBOX account ID")}</p><p className="mt-1 break-all font-mono text-xs text-brand-text-secondary">{account.uid?account.uid.slice(0,8)+"…"+account.uid.slice(-4):"—"}</p></div>
    </CardContent>
   </Card>
  </div>:null}
  <div className="account-actions">{links.map(({title,description,to,icon:Icon})=><Link key={to} to={to} className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-text">{t(title)}</span>{description?<span className="mt-1 block text-xs leading-5 text-brand-text-muted">{t(description)}</span>:null}</span><ArrowUpRight className="h-4 w-4 shrink-0 text-brand-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-text"/></Link>)}</div>
 </PageFrame>;
}


export function OrdersPage(){
 const {t,language}=useI18n();
 const [orders,setOrders]=useState<OrderRecord[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setOrders([]);setError("");
  getOrders(controller.signal).then(setOrders).catch((reason:unknown)=>{
   if(reason instanceof Error && reason.name==="AbortError")return;
   if(!controller.signal.aborted)setOrders([]);
   setError(reason instanceof Error?reason.message:"Order history is temporarily unavailable.");
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const value=(raw:unknown)=>raw===null||raw===undefined||raw===""?"—":String(raw);
 const date=(raw?:string)=>{if(!raw)return "—";const parsed=new Date(raw);return Number.isNaN(parsed.getTime())?raw:parsed.toLocaleString(localeTags[language]);};
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
 const {t,language}=useI18n();
 const [ticker,setTicker]=useState<MarketTicker|null>(null);
 const [spotPairEnabled,setSpotPairEnabled]=useState(false);
 const [chartInterval,setChartInterval]=useState("1h");
 const [compactTrade,setCompactTrade]=useState(()=>window.matchMedia("(max-width: 1279px)").matches);
 const [chartOpen,setChartOpen]=useState(false);
 const [pairSymbols,setPairSymbols]=useState<string[]>([]);
 useEffect(()=>{
  const media=window.matchMedia("(max-width: 1279px)");
  const update=()=>{setCompactTrade(media.matches);setChartOpen(false);};
  media.addEventListener("change",update);
  return ()=>media.removeEventListener("change",update);
 },[]);
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
 const [availableBalances,setAvailableBalances]=useState<Record<string,{free:number|string}>>({});
 // Hide the account snapshot during mutations; manual refresh obtains verified balances again.
 useEffect(()=>{if(busy)setAvailableBalances({});},[busy]);
 const [pendingIntent,setPendingIntent]=useState<Parameters<typeof submitSpotOrder>[0]|null>(null);
 const [pendingIntentInvalid,setPendingIntentInvalid]=useState(false);
 const [cancelRequestIds,setCancelRequestIds]=useState<Record<string,string>>({});
 const [reload,setReload]=useState(0);
 const [marketUpdatedAt,setMarketUpdatedAt]=useState<number|null>(null);
 const [marketClockNow,setMarketClockNow]=useState(Date.now());
 const [marketFeedWarning,setMarketFeedWarning]=useState("");
 const [chartFeedWarning,setChartFeedWarning]=useState("");

 const [chartNode,setChartNode]=useState<HTMLDivElement|null>(null);
 const chartTrigger=useRef<HTMLButtonElement|null>(null);
 const base=symbol.endsWith("USDT")?symbol.slice(0,-4):"BTC";
 const pendingStorageKey=accountUid?"btcbox.spot.pending.v1."+accountUid+"."+symbol:"";
 const marketSnapshotStale=!!ticker&&(!marketUpdatedAt||marketClockNow-marketUpdatedAt>90_000);
 const displayTicker=marketSnapshotStale?null:ticker;
 const orderBookSnapshotStale=!!book&&(!book.snapshotTs||marketClockNow-book.snapshotTs*1000>90_000);
 const displayBook=orderBookSnapshotStale?null:book;
 const effectiveMarketFeedWarning=marketFeedWarning||(marketSnapshotStale?t("Market snapshot is older than 90 seconds. Quotes and new order entry are disabled until fresh data arrives."):orderBookSnapshotStale?t("Order book snapshot is older than 90 seconds. Depth levels are hidden until fresh data arrives."):"");

 useEffect(()=>{
  if(!ticker||marketSnapshotStale){
   if(!ticker||price===String(ticker.price))setPrice("");
  }
 },[ticker,marketSnapshotStale,price]);

 useEffect(()=>{
  const timer=window.setInterval(()=>setMarketClockNow(Date.now()),5000);
  return ()=>window.clearInterval(timer);
 },[]);

 useEffect(()=>{
  if(!mobilePanel)return;
  const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setMobilePanel(null);};
  window.addEventListener("keydown",closeOnEscape);
  return ()=>window.removeEventListener("keydown",closeOnEscape);
 },[mobilePanel]);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");setSpotPairEnabled(false);setTradingStatus(null);
  setTicker(null);setCandles([]);setBook(null);setMarketUpdatedAt(null);setMarketFeedWarning("");setChartFeedWarning("");setPrice("");
  Promise.allSettled([getSpotMarketPairs(controller.signal),getMarkets(controller.signal),getKlines(symbol,"1h",controller.signal),getOrderBook(symbol,controller.signal),getTradingStatus(controller.signal),getOrders(controller.signal),getAccount(controller.signal)]).then(results=>{
   if(controller.signal.aborted)return;
   const [pairResult,marketResult,bookResult,statusResult,ordersResult,accountResult]=results;
   if(pairResult.status==="fulfilled"){
    setPairSymbols(pairResult.value.filter(pair=>pair.quote_asset==="USDT").map(pair=>pair.base_asset+"USDT"));
    const enabled=pairResult.value.some(pair=>pair.base_asset===base&&pair.quote_asset==="USDT");
    setSpotPairEnabled(enabled);
    if(!enabled)setError("This spot market is not enabled by BTCBOX operators.");
   }else{
    setSpotPairEnabled(false);
    setError(pairResult.reason instanceof Error?pairResult.reason.message:"Spot-market catalogue is unavailable.");
   }
   if(accountResult.status==="fulfilled"){setAccountUid(accountResult.value.uid);setAvailableBalances(accountResult.value.balances);}
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
    }else{setTicker(null);setMarketUpdatedAt(null);setPrice("");setMarketFeedWarning("Market data is temporarily unavailable for this pair.");}
   }else{setTicker(null);setMarketUpdatedAt(null);setPrice("");setError(marketResult.reason instanceof Error?marketResult.reason.message:"Live market data is unavailable.");}
   if(candleResult.status==="fulfilled"){setCandles(candleResult.value);setChartFeedWarning("");}
   else{setCandles([]);setChartFeedWarning("Chart data is temporarily unavailable.");}
   if(bookResult.status==="fulfilled")setBook(bookResult.value);
   else setBook(null);
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
  // Per-request AbortController + timeout: a hung fetch must never leave
  // `refreshing` stuck true (which froze the ticker/order book permanently).
  let cancelled=false;
  let refreshing=false;
  const refreshMarketData=()=>{
   if(refreshing||cancelled)return;
   refreshing=true;
   const controller=new AbortController();
   const timeoutId=window.setTimeout(()=>controller.abort(),10000);
   Promise.allSettled([getMarkets(controller.signal),getOrderBook(symbol,controller.signal)]).then(([marketResult,bookResult])=>{
    if(cancelled)return;
    let failed=false;
    if(marketResult.status==="fulfilled"){
     const marketBase=symbol.endsWith("USDT")?symbol.slice(0,-4):symbol;
     const selected=marketResult.value.find(item=>item.sym.toUpperCase()===marketBase)||null;
     if(selected){
      setTicker(selected);
      setMarketUpdatedAt(selected.snapshotTs?selected.snapshotTs*1000:null);
     }else{setTicker(null);setMarketUpdatedAt(null);failed=true;}
    }else{setTicker(null);setMarketUpdatedAt(null);failed=true;}
    if(bookResult.status==="fulfilled")setBook(bookResult.value);
    else{setBook(null);failed=true;}
    setMarketFeedWarning(failed?"Live market data is temporarily unavailable.":"");
   }).finally(()=>{refreshing=false;});
  };
  const refreshId=window.setInterval(refreshMarketData,5000);
  return ()=>{cancelled=true;window.clearInterval(refreshId);};
 },[symbol]);

 // Chart interval changes never reset an edited order or a pending idempotent request.
 useEffect(()=>{
  let cancelled=false;
  let refreshing=false;
  let pending:AbortController|undefined;
  const load=()=>{
   if(cancelled||refreshing)return;
   refreshing=true;
   const controller=new AbortController();pending=controller;
   const timeout=window.setTimeout(()=>controller.abort(),15000);
   getKlines(symbol,chartInterval,controller.signal).then(rows=>{
    if(!cancelled){setCandles(rows);setChartFeedWarning("");}
   }).catch(()=>{
    if(!cancelled){setCandles([]);setChartFeedWarning("Chart data is temporarily unavailable.");}
   }).finally(()=>{window.clearTimeout(timeout);refreshing=false;});
  };
  setCandles([]);load();
  const timer=window.setInterval(load,60000);
  return ()=>{cancelled=true;pending?.abort();window.clearInterval(timer);};
 },[symbol,chartInterval,reload]);

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
  const node=chartNode;
  if(!node||!candles.length||node.clientWidth<=0||(compactTrade&&!chartOpen))return;
  const chart=createChart(node,{width:node.clientWidth,height:node.clientHeight||320,handleScroll:{vertTouchDrag:false,horzTouchDrag:true},handleScale:{pinch:true},layout:{background:{type:ColorType.Solid,color:"#0e1c30"},textColor:"#9aa8b7"},grid:{vertLines:{color:"#26313d"},horzLines:{color:"#26313d"}},rightPriceScale:{borderColor:"#26313d"},timeScale:{borderColor:"#26313d",timeVisible:true,secondsVisible:false}});
  const series=chart.addSeries(CandlestickSeries,{upColor:"#0ecb81",downColor:"#f6465d",borderVisible:false,wickUpColor:"#0ecb81",wickDownColor:"#f6465d"});
  series.setData(candles.map(item=>({time:Math.floor(item.time/1000) as UTCTimestamp,open:item.open,high:item.high,low:item.low,close:item.close})).sort((a,b)=>Number(a.time)-Number(b.time)));
  chart.timeScale().fitContent();
  const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width)chart.applyOptions({width:Math.floor(width),height:Math.floor(entries[0].contentRect.height)||320});});
  observer.observe(node);
  return ()=>{observer.disconnect();chart.remove();};
 },[candles,compactTrade,chartOpen,chartNode]);

 const orderInputsValid=/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)&&/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)&&compareDecimalStrings(price,"0")===1&&compareDecimalStrings(quantity,"0")===1;
 const requiredBalance=side==="buy"?multiplyDecimalStrings(price,quantity):quantity;
 const availableBalance=availableBalances[side==="buy"?"USDT":base]?.free;
 const balanceComparison=requiredBalance&&availableBalance!==undefined?compareDecimalStrings(String(availableBalance),requiredBalance):undefined;
 const insufficientBalance=balanceComparison!==undefined&&balanceComparison<0;
 const balanceUnavailable=balanceComparison===undefined;
 const submitOrder=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const retryingStoredIntent=!!pendingIntent;
  if(pendingIntentInvalid){setError("A saved spot order request must be reconciled before another order can be placed.");return;}
  if((!ticker||marketSnapshotStale)&&!pendingIntent){setError("A fresh timestamped market snapshot is required before placing a new order. No order was sent.");return;}
  if(!spotPairEnabled&&!pendingIntent){setError("This spot pair is not enabled by BTCBOX operators. No order was sent.");return;}
  if(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent){setError("Spot order execution is currently disabled by server policy. No order was placed.");return;}
  if(!pendingIntent&&(!orderInputsValid||balanceUnavailable||insufficientBalance)){setError(insufficientBalance?"Insufficient available balance":"Account identity is unavailable. No order was sent.");return;}
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
   if(retryingStoredIntent&&reason instanceof ApiError&&reason.code==="MATCHING_ENGINE_UNAVAILABLE"){
    setError("Matching engine is unavailable. This retry was not processed; the earlier order result remains unconfirmed. Keep the same request ID and do not create a new order. Retry this same request after service recovery.");
   }else{
    setError(reason instanceof Error?reason.message:"Order result is unconfirmed. Keep the same request ID and check orders before retrying.");
   }
   // Only discard a first-attempt intent after a definitive pre-RPC rejection.
   // A retry of a stored intent may refer to an order committed by an earlier
   // ambiguous attempt, so retain its idempotency key until order history confirms it.
   if(!retryingStoredIntent&&!orderAccepted&&reason instanceof ApiError&&(reason.status===400||reason.status===401||reason.status===403||reason.code==="MATCHING_ENGINE_UNAVAILABLE")){
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
 const amountText=(value:unknown)=>value===null||value===undefined||value===""?"—":Number.isFinite(Number(value))?Number(value).toLocaleString(localeTags[language],{maximumFractionDigits:8}):String(value);
 const openOrders=orders.filter(item=>["open","partially_filled","partially-filled","pending"].includes(String(item.status||"").toLowerCase()));
 const asks=(displayBook?.asks||[]).slice(0,8).slice().reverse();const bids=(displayBook?.bids||[]).slice(0,8);
 return <PageFrame eyebrow="BTCBOX / SPOT" title={symbol} description="Live market data and server-validated limit-order entry.">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Badge variant="outline">{t("Spot market")}</Badge><span className="text-xs text-brand-text-muted">{t("Ticker")}: {displayTicker?.source||"—"} · {t("Order book")}: {displayBook?.source||"—"} · {t("Chart")}: {candles[0]?.source||"—"}</span><span className="text-xs text-brand-text-muted">{marketUpdatedAt? (displayTicker?.providerTs?t("Provider update")+": "+new Date(displayTicker.providerTs*1000).toLocaleTimeString()+" · ":"")+t("Snapshot checked")+": "+new Date(marketUpdatedAt).toLocaleTimeString():t("Waiting for live data")}</span></div><Button size="sm" variant="outline" disabled={loading||busy} onClick={()=>setReload(value=>value+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {error?<div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">{error}</div>:null}{effectiveMarketFeedWarning?<div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">{effectiveMarketFeedWarning}</div>:null}{chartFeedWarning?<div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200">{chartFeedWarning}</div>:null}{notice?<div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">{notice}</div>:null}
      <Card className="border-brand-border bg-brand-surface"><CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4"><div><p className="text-xs text-brand-text-muted">{t("Last price")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{displayTicker?amountText(displayTicker.price):"—"} <span className="text-xs text-brand-text-muted">USDT</span></p></div><div><p className="text-xs text-brand-text-muted">{t("24h change")}</p><p className={"mt-1 font-semibold tabular-nums "+(Number(ticker?.chg||0)>=0?"text-profit":"text-loss")}>{displayTicker?Number(displayTicker.chg).toFixed(2)+"%":"—"}</p></div><div><p className="text-xs text-brand-text-muted">{t("24h high")}</p><p className="mt-1 font-medium tabular-nums">{displayTicker?amountText(displayTicker.high):"—"}</p></div><div><p className="text-xs text-brand-text-muted">{t("24h low")}</p><p className="mt-1 font-medium tabular-nums">{displayTicker?amountText(displayTicker.low):"—"}</p></div></CardContent></Card>
  {mobilePanel?<button type="button" aria-label={t("Close market panel")} className="fixed inset-0 z-30 bg-black/60 xl:hidden" onClick={()=>setMobilePanel(null)}/>:null}
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
   <div className="min-w-0 order-2 space-y-4 xl:order-1">

    <Card role={mobilePanel==="chart"?"dialog":undefined} aria-modal={mobilePanel==="chart"?"true":undefined} aria-label={t("Price chart")} className={"border-brand-border bg-brand-surface "+(mobilePanel==="chart"?"fixed inset-x-0 bottom-0 z-40 max-h-[72dvh] overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-2xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-xl xl:pb-0 xl:shadow-none":"hidden xl:block")}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{t("Price chart")}</CardTitle><CardDescription>{t("1-hour candles returned by the live market data provider.")}</CardDescription></div><Button type="button" size="sm" variant="outline" className="xl:hidden" onClick={()=>setMobilePanel(null)}>{t("Close")}</Button></CardHeader><CardContent><div ref={chartContainer} className="min-h-[320px] w-full">{!candles.length&&!loading?<p className="p-5 text-sm text-brand-text-muted">{t("No verified candle data is available for this market.")}</p>:null}</div></CardContent></Card>
    <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Open orders")}</CardTitle><CardDescription>{t("Only authenticated order records are shown. Cancellation is sent to the matching service.")}</CardDescription></CardHeader><CardContent className="space-y-2">{openOrders.length?openOrders.map((item,index)=>{const id=String(item.order_id??item.id??index);return <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-border p-3"><div><p className="font-semibold">{item.symbol||symbol} · {item.side||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Price")} {amountText(item.price)} · {t("Remaining")} {amountText(item.remaining_quantity??item.quantity)}</p><Badge variant="outline">{item.status}</Badge></div><Button size="sm" variant="outline" disabled={busy||!tradingStatus?.spot_cancel_enabled} onClick={()=>void cancelOrder(item)}>{cancelRequestIds[id]?t("Retry cancel"):t("Cancel")}</Button></div>;}):<p className="rounded-lg border border-dashed border-brand-border p-4 text-sm text-brand-text-muted">{t("No open spot orders were returned.")}</p>}</CardContent></Card>
   </div>
   <div className="order-1 space-y-4 xl:order-2">
    <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Limit order")}</CardTitle><CardDescription>{t("Only limit orders are supported by the current matching contract.")}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><Button variant={side==="buy"?"default":"outline"} onClick={()=>setSide("buy")} disabled={busy||!!pendingIntent||pendingIntentInvalid}>{t("Buy")}</Button><Button variant={side==="sell"?"destructive":"outline"} onClick={()=>setSide("sell")} disabled={busy||!!pendingIntent}>{t("Sell")}</Button></div><form className="space-y-3" onSubmit={event=>void submitOrder(event)}><label className="block space-y-1 text-sm"><span>{t("Limit price (USDT)")}</span><input value={price} onChange={event=>setPrice(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text" required/></label><label className="block space-y-1 text-sm"><span>{t("Quantity") } · {base}</span><input value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text" required/></label><p className="text-xs text-brand-text-muted">{t("Estimated total")}: {price&&quantity&&Number(price)>0&&Number(quantity)>0?amountText(Number(price)*Number(quantity))+" USDT":"—"}</p>{!tradingStatus?.spot_order_entry_enabled?<div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200">{t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled.")}</div>:null}{pendingIntent?<p className="break-all text-xs text-amber-300">{t("Unconfirmed request ID. Keep the form unchanged and retry with the same ID.")} · {pendingIntent.client_order_id}</p>:null}<Button block type="submit" disabled={busy||pendingIntentInvalid||(!ticker||marketSnapshotStale)&&!pendingIntent||(!spotPairEnabled&&!pendingIntent)||(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent)||!price||!quantity}>{busy?t("Submitting…"):pendingIntent?t("Retry same order"):side==="buy"?t("Place buy limit order"):t("Place sell limit order")}</Button></form></CardContent></Card>
    <div className="grid grid-cols-2 gap-2 xl:hidden"><Button type="button" size="sm" variant={mobilePanel==="orderbook"?"default":"outline"} aria-pressed={mobilePanel==="orderbook"} onClick={()=>setMobilePanel(current=>current==="orderbook"?null:"orderbook")}>{t("Order book")}</Button><Button type="button" size="sm" variant={mobilePanel==="chart"?"default":"outline"} aria-pressed={mobilePanel==="chart"} onClick={()=>setMobilePanel(current=>current==="chart"?null:"chart")}>{t("Chart")}</Button></div>
    <Card role={mobilePanel==="orderbook"?"dialog":undefined} aria-modal={mobilePanel==="orderbook"?"true":undefined} aria-label={t("Order book")} className={"border-brand-border bg-brand-surface "+(mobilePanel==="orderbook"?"fixed inset-x-0 bottom-0 z-40 max-h-[72dvh] overflow-y-auto rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-2xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-xl xl:pb-0 xl:shadow-none":"hidden xl:block")}><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>{t("Order book")}</CardTitle><CardDescription>{displayBook?.source||(orderBookSnapshotStale?t("Order book snapshot unavailable"):t("Live market depth"))}</CardDescription></div><Button type="button" size="sm" variant="outline" className="xl:hidden" onClick={()=>setMobilePanel(null)}>{t("Close")}</Button></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><p className="mb-2 text-xs font-semibold text-loss">{t("Asks")}</p>{asks.length?asks.map((row,index)=><div key={index} className="flex justify-between gap-2 py-1 text-xs tabular-nums"><span className="text-loss">{amountText(row[0])}</span><span className="text-brand-text-muted">{amountText(row[1])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div><div><p className="mb-2 text-xs font-semibold text-profit">{t("Bids")}</p>{bids.length?bids.map((row,index)=><div key={index} className="flex justify-between gap-2 py-1 text-xs tabular-nums"><span className="text-profit">{amountText(row[0])}</span><span className="text-brand-text-muted">{amountText(row[1])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div></div></CardContent></Card>
   </div>
  </div>
 </PageFrame></Dialog.Root>;
}

export function SectionPage({title,description}:{title:string;description:string}){const {t}=useI18n();return <PageFrame eyebrow="BTCBOX / WORKSPACE" title={title} description={description}><Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-start gap-3 p-4 sm:p-5"><Badge variant="outline" className="shrink-0 border-brand-border text-brand-text-muted">{t("Unavailable")}</Badge><p className="type-body-compact min-w-0 flex-1 text-brand-text-muted">{t("This service is not currently available. Please check back later.")}</p></CardContent></Card></PageFrame>}


export function SecondsPage(){
 const {t,language}=useI18n();
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

 const money=(value:number|string)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed.toLocaleString(localeTags[language],{maximumFractionDigits:8}):"—";};
 const date=(seconds:number)=>new Date(seconds*1000).toLocaleString(localeTags[language]);
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
  <Card className="flex h-full min-w-0 flex-col border-brand-border bg-brand-surface"><CardHeader className="flex-1"><CardTitle>{t("Active contract policy")}</CardTitle><CardDescription>{activePolicy?t("Policy version")+" "+activePolicy.policy_version:t("The active backend policy has not been loaded.")}</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <div><p className="text-xs text-brand-text-muted">{t("Winning profit rate")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?(activePolicy.payout_bps/100).toFixed(2)+"%": "—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Minimum amount")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?money(activePolicy.min_stake)+" USDT":"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Maximum amount")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?money(activePolicy.max_stake)+" USDT":"—"}</p></div>
   <div><p className="text-xs text-brand-text-muted">{t("Open exposure limit")}</p><p className="mt-1 font-semibold text-brand-text">{activePolicy?.per_user_open_exposure==null?t("No aggregate cap configured"):money(activePolicy.per_user_open_exposure)+" USDT"}</p></div>
  </CardContent></Card>
  {policyError?<Card className="border-amber-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-amber-200" role="alert">{policyError}</CardContent></Card>:null}
  {policy&&!policy.actions_enabled?<Card className="border-amber-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-amber-200" role="status">{t("Order entry is currently disabled by the backend financial cutover switch. No funds can be reserved until the required services are enabled.")}</CardContent></Card>:null}
  {error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-rose-300" role="alert">{error}</CardContent></Card>:null}
  {notice?<Card className="border-emerald-500/30 bg-brand-surface"><CardContent className="p-4 text-sm text-emerald-300" role="status">{notice}</CardContent></Card>:null}
  <Card className="flex h-full min-w-0 flex-col border-brand-border bg-brand-surface"><CardHeader className="flex-1"><CardTitle>{t("New position")}</CardTitle><CardDescription>{t("The backend validates every order against the active policy and reserves funds atomically.")}</CardDescription></CardHeader><CardContent>
   <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Market")}</span><select value={symbol} onChange={event=>setSymbol(event.target.value)} disabled={!activePolicy||!!pendingIntent} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{(activePolicy?.symbols||[]).map(item=><option key={item} value={item}>{item}/USDT</option>)}</select></label>
    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Duration")}</span><select value={duration} onChange={event=>setDuration(Number(event.target.value))} disabled={!activePolicy||!!pendingIntent} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{(activePolicy?.durations_sec||[]).map(item=><option key={item} value={item}>{item}s</option>)}</select></label>
    <label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount (USDT)")}</span><input inputMode="decimal" type="number" min={activePolicy?String(activePolicy.min_stake):undefined} max={activePolicy?String(activePolicy.max_stake):undefined} step="any" value={pendingIntent?.amount??amount} onChange={event=>setAmount(event.target.value)} disabled={!activePolicy||!!pendingIntent} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" placeholder={activePolicy?String(activePolicy.min_stake):"—"}/></label>
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
  const controller=new AbortController();setLoading(true);setAccount(null);setError("");
  getAccount(controller.signal).then(data=>{setAccount(data);setName(current=>current||data.kyc?.name||"");setIdType(current=>data.kyc?.id_type==="passport"||data.kyc?.id_type==="driver_license"?data.kyc.id_type:current);}).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){setAccount(null);setError(reason instanceof Error?reason.message:"Verification status is temporarily unavailable.");}
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
  :account?<div className="space-y-4">
  <Card className="overflow-hidden border-brand-border bg-brand-surface ">
   <CardContent className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6">
    <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><ShieldCheck className="h-6 w-6"/></span><div className="min-w-0"><p className="type-meta font-semibold uppercase tracking-[.14em] text-brand-text-muted">{t("Current status")}</p><p className="mt-1 text-xl font-semibold capitalize tracking-tight text-brand-text">{t(label)}</p><p className="mt-1 max-w-xl text-sm leading-6 text-brand-text-muted">{submitted&&!canSubmit?t("Your verification is on file. You can check the status again after staff review."):t("Submit your details and a clear photo of your identity document. BTCBOX staff will review the information and update your verification status.")}</p></div></div>
    <Badge variant="outline" className={`h-fit w-fit rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${tone}`}>{t(label)}</Badge>
   </CardContent>
   <div className="grid gap-4 border-t border-brand-border bg-brand-surface-2/50 p-5 sm:grid-cols-3 sm:px-6">
    <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Applicant name")}</p><p className="mt-1 truncate text-sm font-semibold text-brand-text">{account.kyc?.name||"—"}</p></div>
    <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Document type")}</p><p className="mt-1 text-sm font-semibold capitalize text-brand-text">{account.kyc?.id_type||"—"}</p></div>
    <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Document number")}</p><p className="mt-1 break-all font-mono text-sm text-brand-text-secondary">{account.kyc?.id_number?"••••"+account.kyc.id_number.slice(-4):"—"}</p></div>
   </div>
   {account.kyc?.reject_reason?<div className="border-t border-rose-500/20 bg-rose-500/[.04] p-4 sm:px-6"><p className="text-xs font-semibold text-rose-300">{t("Review note")}</p><p className="mt-1 text-sm leading-6 text-brand-text-secondary">{account.kyc.reject_reason}</p></div>:null}
  </Card>
  {canSubmit?<Card className="border-brand-border bg-brand-surface "><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><CardTitle>{status==="rejected"?t("Resubmit verification"):t("Submit identity details")}</CardTitle><CardDescription>{t("Use the same name and document details shown on your identity document. Do not send passwords or two-factor codes. Images are compressed before secure upload.")}</CardDescription></CardHeader><CardContent className="p-5 sm:p-6"><form className="space-y-4" onSubmit={submit}>
   <label className="block space-y-1 text-sm"><span>{t("Full legal name")}</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={100} autoComplete="name" required disabled={submitting} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text"/></label>
   <label className="block space-y-1 text-sm"><span>{t("Identity document type")}</span><select value={idType} onChange={event=>setIdType(event.target.value as "passport"|"id_card"|"driver_license")} disabled={submitting} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text"><option value="id_card">{t("National ID card")}</option><option value="passport">{t("Passport")}</option><option value="driver_license">{t("Driver license")}</option></select></label>
   <label className="block space-y-1 text-sm"><span>{t("Document number")}</span><input value={idNumber} onChange={event=>setIdNumber(event.target.value)} maxLength={64} autoComplete="off" required disabled={submitting} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 font-mono text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"/></label>
   <label className="block space-y-1 text-sm"><span>{t("Identity document image")}</span><input type="file" accept="image/jpeg,image/png,image/webp" required disabled={submitting} onChange={event=>{setDocumentFile(event.target.files?.[0]||null);setSubmitError("");}} className="block w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text file:mr-3 file:rounded-lg file:border-0 file:bg-brand-surface file:px-3 file:py-2 file:text-brand-text"/></label>
   <p className="text-xs text-brand-text-muted">{t("JPEG, PNG or WebP. Maximum original size 8 MB; securely compressed to 512 KB. Upload a clear, readable image.")}{documentFile?<span className="block mt-1">{t("Selected")}: {documentFile.name}</span>:null}</p>
   <Button type="submit" block disabled={submitting||!name.trim()||!idNumber.trim()||!documentFile}>{submitting?t("Submitting…"):t("Submit for review")}</Button>
   {submitError?<p role="alert" className="text-sm text-rose-300">{submitError}</p>:null}{notice?<p role="status" className="text-sm text-emerald-300">{notice}</p>:null}
  </form></CardContent></Card>:null}
  <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/support">{t("Contact support")}</Link></Button><Button size="sm" variant="ghost" onClick={()=>setReload(n=>n+1)}>{t("Refresh status")}</Button></div></div>:null}
 </PageFrame>;
}



export function SupportPage(){
 const {t,language}=useI18n();
 const [messages,setMessages]=useState<SupportMessage[]>([]);
 const [draft,setDraft]=useState("");
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState("");
 const [sendError,setSendError]=useState("");
 const [reload,setReload]=useState(0);
 const [pendingRequestId,setPendingRequestId]=useState<string>("");
 const {status}=useAuth();
 useEffect(()=>{
  if(status!=="authenticated"){setMessages([]);setLoading(false);return;}
  const controller=new AbortController();
  setLoading(true);setMessages([]);setError("");
  getSupportMessages(controller.signal).then(setMessages).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){setMessages([]);setError(reason instanceof Error?reason.message:"Support conversation is temporarily unavailable.");}
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload,status]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const message=draft.trim();
  if(status!=="authenticated"||!message||sending)return;
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
 if(status!=="authenticated")return <PageFrame eyebrow="BTCBOX / HELP CENTER" title="Customer support" description="Find help and contact BTCBOX support.">
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>BTCBOX Help Center</CardTitle><CardDescription>Public support information is available without signing in.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-brand-text-secondary"><p>For account-specific questions, deposit or withdrawal reviews, and private conversation history, sign in to your BTCBOX account first.</p><Button asChild><Link to="/login">Sign in to contact support</Link></Button></CardContent></Card>
 </PageFrame>;
 return <PageFrame eyebrow="BTCBOX / HELP CENTER" title="Customer support" description="Send a message to the BTCBOX support team and review replies in your account conversation.">
  <div className="flex items-center justify-between gap-3"><Badge variant="outline" className="border-brand-border"><MessageCircle className="mr-1.5 h-3.5 w-3.5"/>{t("Private account conversation")}</Badge><Button size="sm" variant="outline" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading support conversation…")}</CardContent></Card>
  :error?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :<Card className="overflow-hidden border-brand-indigo/20 bg-brand-surface ring-1 ring-brand-indigo/[0.035]"><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo"><MessageCircle className="h-4 w-4"/></span><div><CardTitle>{t("Conversation")}</CardTitle><CardDescription>{messages.length} {t("messages · newest 50 available")}</CardDescription></div></div></CardHeader><CardContent className="space-y-3">
   {messages.length?messages.map(message=><div key={message.id} className={"flex "+(message.from==="user"?"justify-end":"justify-start")}><div className={"max-w-[92%] rounded-xl border p-4 shadow-[0_6px_20px_rgba(0,0,0,.12)] sm:max-w-[80%] "+(message.from==="user"?"border-brand-indigo/25 bg-brand-indigo/[.09]":"border-brand-border bg-brand-surface-2/80")}><div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-text-muted"><span className="font-semibold uppercase">{message.from==="user"?t("You"):t("BTCBOX support")}</span><span>{date(message.time)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{message.content}</p></div></div>)
   :<div className="rounded-xl border border-dashed border-brand-border px-4 py-10 text-center"><MessageCircle className="mx-auto mb-3 h-6 w-6 text-brand-text-muted"/><p className="font-semibold">{t("No messages yet")}</p><p className="mt-1 text-sm text-brand-text-muted">{t("Send a message below to start a conversation with support.")}</p></div>}
  </CardContent></Card>}
  <Card className="overflow-hidden border-brand-cyan/20 bg-brand-surface ring-1 ring-brand-cyan/[0.035]"><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Send className="h-4 w-4"/></span><div><CardTitle>{t("Send a message")}</CardTitle><CardDescription>{t("Do not send passwords, two-factor codes, or wallet recovery phrases.")}</CardDescription></div></div></CardHeader><CardContent className="p-5 sm:p-6"><form className="space-y-4" onSubmit={submit}>
   <textarea value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} rows={4} placeholder={t("Describe how we can help…")} aria-label={t("Support message")} className="min-h-36 w-full resize-y rounded-xl border border-brand-border bg-brand-surface-2 p-4 text-sm leading-6 text-brand-text outline-none placeholder:text-brand-text-muted transition-colors focus:border-brand-cyan/60 focus:ring-2 focus:ring-brand-cyan/15" disabled={sending}/>
   <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-brand-text-muted">{draft.length}/2000</span><Button type="submit" className="min-h-11 w-full bg-brand-cyan text-brand-bg hover:bg-brand-cyan/90 sm:w-auto" disabled={sending||!draft.trim()||draft.trim().length>2000}><Send className="mr-2 h-4 w-4"/>{sending?t("Sending…"):t("Send message")}</Button></div>
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
 const [copyMessage,setCopyMessage]=useState("");
 const copyAddress=async()=>{
  if(!address)return;
  try{
   if(!navigator.clipboard?.writeText)throw new Error("Clipboard access is unavailable.");
   await navigator.clipboard.writeText(address);
   setCopyMessage("Deposit address copied.");
  }catch{
   setCopyMessage("Could not copy the address. Select and copy it manually.");
  }
 };
 useEffect(()=>{
  const controller=new AbortController();
  setAddress("");setError("");setCopyMessage("");setLoading(true);
  getDepositAddress(coin,network,controller.signal).then(value=>{
   if(!controller.signal.aborted)setAddress(value);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){setAddress("");setError(reason instanceof Error?reason.message:"Deposit address is unavailable.");}
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[coin,network,reload]);
 useEffect(()=>{
  const controller=new AbortController();
  setHistoryLoading(true);setDepositHistory([]);setHistoryError("");
  getAccount(controller.signal).then(snapshot=>{
   if(!controller.signal.aborted)setDepositHistory(Array.isArray(snapshot.deposits)?snapshot.deposits:[]);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){setDepositHistory([]);setHistoryError(reason instanceof Error?reason.message:"Deposit history is temporarily unavailable.");}
  }).finally(()=>{if(!controller.signal.aborted)setHistoryLoading(false);});
  return ()=>controller.abort();
 },[historyReload]);
 const changeCoin=(next:string)=>{setAddress("");setError("");setCopyMessage("");setCoin(next);setNetwork(depositNetworks[next][0]);};
 const changeNetwork=(next:string)=>{setAddress("");setError("");setCopyMessage("");setNetwork(next);};
 return <PageFrame eyebrow="BTCBOX / WALLET" title="Deposit" description="View the deposit address configured by BTCBOX for the selected asset and network. BTCBOX staff verify incoming transfers and manually credit the account.">
  <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>{t("Deposit address")}</CardTitle><CardDescription>{t("Always verify the asset and network before sending funds.")}</CardDescription></CardHeader><CardContent className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Asset")}</span><select value={coin} onChange={e=>changeCoin(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{Object.keys(depositNetworks).map(x=><option key={x}>{x}</option>)}</select></label><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Network")}</span><select value={network} onChange={e=>changeNetwork(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{depositNetworks[coin].map(x=><option key={x}>{x}</option>)}</select></label></div>
   {loading?<p className="rounded-xl border border-brand-border p-4 text-sm text-brand-text-muted" role="status">{t("Loading configured deposit address…")}</p>
   :error?<div className="rounded-xl border border-amber-400/30 p-4"><p className="text-sm text-amber-200" role="alert">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>
   :<div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">{coin} · {network}</p><div className="break-all rounded-xl border border-brand-border bg-brand-surface-2 p-4 font-mono text-sm">{address}</div><Button variant="outline" size="sm" disabled={!address} onClick={copyAddress}>{t("Copy address")}</Button>{copyMessage?<p className="text-xs text-brand-text-muted" role="status" aria-live="polite">{t(copyMessage)}</p>:null}</div>}
   <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-brand-text-secondary"><p className="font-semibold text-amber-200">{t("Important")}</p><p className="mt-1">{t("Send only the selected asset on the selected network. Sending unsupported assets or using another network may result in permanent loss. After the transfer, BTCBOX staff verify receipt and manually credit the account. This page does not create a deposit order or automatically credit funds.")}</p></div>
  </CardContent></Card>
  <Card className="overflow-hidden border-brand-border bg-brand-surface "><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Clock3 className="h-4 w-4"/></span><div><CardTitle>{t("Deposit history")}</CardTitle><CardDescription>{t("Track deposits verified and credited by BTCBOX staff.")}</CardDescription></div></div><Button size="sm" variant="outline" disabled={historyLoading} onClick={()=>setHistoryReload(value=>value+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(historyLoading?"animate-spin":"")}/>{t("Refresh")}</Button></div></CardHeader><CardContent className="space-y-3 p-5 sm:p-6">
   {historyLoading?<p className="text-sm text-brand-text-muted" role="status">{t("Loading deposit history…")}</p>
   :historyError?<p className="text-sm text-rose-300" role="alert">{historyError}</p>
   :depositHistory.length?depositHistory.map((item,index)=><div key={item.id||`${item.time||"deposit"}-${item.coin}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-2/40 p-4 transition-colors hover:bg-brand-surface-2/70"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||"—"}</p>{item.reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">{t("Reference")}: {item.reference||item.txid}</p>:null}</div><Badge variant="outline" className={item.status==="confirmed"?"border-emerald-500/30 text-emerald-400":item.status==="rejected"?"border-rose-500/30 text-rose-300":"border-amber-500/30 text-amber-300"}>{item.status}</Badge></div>)
   :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No deposit records have been returned for this account.")}</p>}
  </CardContent></Card>
 </PageFrame>;
}


export function EarnPage(){
 const {t,language}=useI18n();
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
 const number=(value:number|string|undefined)=>{const n=Number(value);return Number.isFinite(n)?n.toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—";};
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
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-success/10 text-brand-success"><Sprout className="h-4 w-4"/></span><div><p className="text-sm font-semibold text-brand-text">{t("BTCBOX Earn")}</p><p className="text-xs text-brand-text-muted">{t("Live catalog · account-backed positions")}</p></div><Badge variant="outline" className="border-brand-success/25 text-brand-success">{t("Live product catalog")}</Badge></div><Button size="sm" variant="outline" disabled={loading||busy} onClick={()=>setReload(n=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="space-y-3 p-5" role="status"><div className="h-4 w-1/3 animate-pulse rounded bg-brand-surface-2"/><div className="grid gap-3 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/></div><p className="text-sm text-brand-text-muted">{t("Loading Earn products and positions…")}</p></CardContent></Card>
  :<>
   {error?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 p-3"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>:null}
   {actionMessage?<p className="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-300" role="status">{actionMessage}</p>:null}
   <div className="grid gap-3 sm:grid-cols-3"><Card className="overflow-hidden border-brand-success/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Available products")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-success">{products.length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Live catalog entries")}</p></CardContent></Card><Card className="overflow-hidden border-brand-cyan/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("My Earn positions")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-cyan">{positions.length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Returned account records")}</p></CardContent></Card><Card className="overflow-hidden border-brand-violet/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Active positions")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-violet">{positions.filter(position=>position.status==="持有中"||position.status==="active").length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Currently held")}</p></CardContent></Card></div>
   {!actionsEnabled?<Card className="border-brand-orange/25 bg-brand-surface"><CardContent className="p-4"><Badge variant="outline" className="border-brand-orange/30 text-brand-orange">{t("Operations not enabled")}</Badge><p className="mt-2 text-sm text-brand-text-secondary">{t("You can review the live product catalog and your positions. Subscribe and redeem will become available after the financial ledger and database controls are verified and enabled. No funds can be moved now.")}</p></CardContent></Card>:null}
   <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="type-section-title">{t("Available products")}</h2><p className="type-meta mt-1 text-brand-text-muted">{t("Rates and terms returned by the BTCBOX product catalog.")}</p></div><Badge variant="outline" className="border-brand-border">{products.length} {t("products")}</Badge></div>
    {products.length?<div className="grid gap-3 md:grid-cols-2">{products.map(product=><Card key={product.product_id} className="group relative overflow-hidden border-brand-success/20 bg-brand-surface ring-1 ring-brand-success/[0.025] transition-all hover:-translate-y-0.5 hover:border-brand-success/35 hover:shadow-lg hover:shadow-brand-success/[0.04]"><CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-success/10 text-brand-success"><Sprout className="h-5 w-5"/></span><div className="min-w-0"><p className="font-semibold text-brand-text">{product.asset}</p><p className="type-meta mt-0.5 text-brand-text-muted">{product.product_type==="demand"?t("Flexible"):t("Fixed term")}</p></div></div><Badge variant="outline" className="shrink-0">{product.product_type==="demand"?t("Flexible"):t("Fixed")}</Badge></div><div className="rounded-xl border border-brand-success/20 bg-brand-surface p-4"><p className="type-meta font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Annual rate")}</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-brand-success">{number(product.apy_percent)}%</p></div><div className="flex flex-wrap items-center justify-between gap-2"><p className="type-meta text-brand-text-muted">{product.term_days===0?t("Withdraw according to flexible-product rules"):`${product.term_days} ${t("days")}`} · {t("Early redemption fee")}: {number(product.early_fee_percent)}%</p><Button size="sm" variant={selectedProduct===product.product_id?"default":"outline"} onClick={()=>setSelectedProduct(product.product_id)}>{selectedProduct===product.product_id?t("Selected"):t("Select")}</Button></div></CardContent></Card>)}</div>
    :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No active Earn products are currently returned by the backend.")}</CardContent></Card>}
   </section>
   {products.length?<Card className="relative overflow-hidden border-brand-violet/25 bg-brand-surface ring-1 ring-brand-violet/[0.04]"><div className="h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-violet/10 text-brand-violet"><ArrowUpRight className="h-4 w-4"/></span><div><CardTitle>{t("Subscribe")}</CardTitle><CardDescription>{t("Your available balance and product limits are validated by the financial database.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-6"><form className="space-y-4" onSubmit={operate}><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Product")}</span><select value={selectedProduct} disabled={busy} onChange={e=>setSelectedProduct(e.target.value)} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15">{products.map(product=><option key={product.product_id} value={product.product_id}>{product.asset} · {product.product_type==="demand"?t("Flexible"):`${product.term_days} ${t("days fixed")}`}</option>)}</select></label><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} ({selected?.asset||""})</span><input inputMode="decimal" value={amount} disabled={busy||!actionsEnabled} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" /></label><Button type="submit" className="min-h-12 w-full bg-brand-violet text-white hover:bg-brand-violet/90 sm:w-auto" disabled={!actionsEnabled||busy||!selected}>{busy?t("Processing…"):t("Subscribe")}</Button></form></CardContent></Card>:null}
   <section className="space-y-3"><h2 className="type-section-title">{t("My Earn positions")}</h2>
    {positions.length?positions.map(position=><Card key={position.id} className="overflow-hidden border-brand-border bg-brand-surface  transition-colors hover:border-brand-cyan/25"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{position.product||position.product_id}</p><p className="text-xs text-brand-text-muted">{position.type==="flexible"?t("Flexible"):t("Fixed")} · {number(position.apy)}% {t("APY")}</p></div><Badge variant={position.status==="持有中"||position.status==="active"?"outline":"secondary"}>{position.status}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Principal")}</p><p className="mt-1 break-all font-semibold tabular-nums">{number(position.amount)}</p></div><div className="rounded-lg bg-brand-success/[0.055] p-3"><p className="text-xs text-brand-text-muted">{t("Estimated interest")}</p><p className="mt-1 break-all font-semibold tabular-nums text-brand-success">{number(position.expected_interest)}</p></div><div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("End / maturity")}</p><p className="mt-1 break-all font-semibold">{position.end||"—"}</p></div></div>{position.status==="持有中"||position.status==="active"?<Button size="sm" variant="outline" className="min-h-10 border-brand-violet/30 text-brand-violet hover:bg-brand-violet/[0.06]" disabled={!actionsEnabled||busy} onClick={()=>redeem(position)}>{t("Redeem")}</Button>:null}</CardContent></Card>)
    :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No Earn positions were returned for this account.")}</CardContent></Card>}
   </section>
  </>}
 </PageFrame>;
}


export function WithdrawPage(){
 const {t,language}=useI18n();
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
 const submitLockRef=useRef(false);
 const [reload,setReload]=useState(0);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setAccount(null);setAddresses([]);setConfig(null);setSelectedAddress(null);setError("");
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
    if(!controller.signal.aborted){
    setAccount(null);setAddresses([]);setConfig(null);setSelectedAddress(null);
    setError(reason instanceof Error?reason.message:"Wallet data is temporarily unavailable.");
   }
   })
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);

 useEffect(()=>{
  const refreshWhenVisible=()=>{if(document.visibilityState==="visible")setReload(value=>value+1);};
  document.addEventListener("visibilitychange",refreshWhenVisible);
  return ()=>document.removeEventListener("visibilitychange",refreshWhenVisible);
 },[]);

 useEffect(()=>{
  if(!selectedId){setSelectedAddress(null);return;}
  const controller=new AbortController();
  setSelectedAddress(null);
  getSelectedCryptoAddress(selectedId,controller.signal).then(value=>{
   if(!controller.signal.aborted)setSelectedAddress(value);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){setSelectedAddress(null);setError(reason instanceof Error?reason.message:"Selected withdrawal address is unavailable.");}
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
  if(!canSubmit||!selectedAddress||submitLockRef.current)return;
  submitLockRef.current=true;
  let intent=pendingIntent;
  if(!intent){
   let requestId:string;
   try{requestId=window.crypto.randomUUID();}
   catch{setError("Secure withdrawal request IDs are unavailable in this browser. No withdrawal was sent.");submitLockRef.current=false;return;}
   intent={version:1,request_id:requestId,address_id:selectedId,coin:selectedAddress.coin,network:selectedAddress.network,amount:amount.trim(),address:selectedAddress.address,created_at:Date.now()};
   if(!pendingStorageKey){setError("Account identity is unavailable. No withdrawal was sent.");submitLockRef.current=false;return;}
   try{window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent));}
   catch{setError("This browser cannot safely save the withdrawal request. No withdrawal was sent.");submitLockRef.current=false;return;}
   setPendingIntent(intent);
  }
  if(intent.address_id!==selectedId||intent.address!==selectedAddress.address||intent.coin!==selectedAddress.coin||intent.network!==selectedAddress.network){setError("The saved withdrawal destination no longer matches. Contact support before retrying.");setPendingIntentInvalid(true);submitLockRef.current=false;return;}
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
  }finally{submitLockRef.current=false;setSubmitting(false);}
 };
 return <PageFrame eyebrow="BTCBOX / WALLET" title="Withdraw" description="Choose a saved address and submit a withdrawal request. BTCBOX staff review requests and manually transfer approved withdrawals.">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading wallet and saved addresses…")}</CardContent></Card>
  :error&&!account?<Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :<>
   <Card className="overflow-hidden border-brand-cyan/20 bg-brand-surface ring-1 ring-brand-cyan/[0.04]"><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Wallet className="h-4 w-4"/></span><div><CardTitle>{t("Available balances")}</CardTitle><CardDescription>{account?.valuation_complete?t("Estimated total value"):t("Some asset prices are unavailable; total valuation is incomplete.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-5">
    {Object.keys(account?.balances||{}).length===0?<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No asset balances are currently available.")}</p>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {(Object.entries(account?.balances||{}) as Array<[string,AccountBalance]>).map(([asset,row],index)=><div key={asset} className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface-2/60 p-4"><div className={"absolute inset-y-0 left-0 w-1 "+(index%3===0?"bg-brand-cyan":index%3===1?"bg-brand-violet":"bg-brand-teal")}/><div className="flex items-center gap-3"><TokenIcon symbol={asset} className="h-9 w-9"/><div className="min-w-0"><p className="font-semibold text-brand-text">{asset}</p><p className="type-meta text-brand-text-muted">{t("Wallet balance")}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-brand-bg/70 p-3"><p className="type-meta text-brand-text-muted">{t("Available")}</p><p className="mt-1 break-all text-sm font-semibold tabular-nums text-brand-text">{String(row.free??"0")}</p></div><div className="rounded-lg bg-brand-bg/70 p-3"><p className="type-meta text-brand-text-muted">{t("Frozen")}</p><p className="mt-1 break-all text-sm font-semibold tabular-nums text-brand-text-secondary">{String(row.frozen??"0")}</p></div></div></div>)}
    </div>}
   </CardContent></Card>

   <Card className="relative overflow-hidden border-brand-violet/25 bg-brand-surface ring-1 ring-brand-violet/[0.045]"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-violet/10 text-brand-violet"><ArrowUpRight className="h-5 w-5"/></span><div><CardTitle>{t("Submit withdrawal")}</CardTitle><CardDescription>{t("Select a saved address. Asset and network are taken from that address; staff review and manually pay approved requests.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-6">
    {usableAddresses.length===0?<div className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No eligible saved withdrawal addresses are available. Add an address to your address book or contact support.")}</div>
    :<form className="space-y-4" onSubmit={submit}>
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Saved withdrawal address")}</span><select value={selectedId} disabled={!!pendingIntent||pendingIntentInvalid||submitting} onChange={event=>{setSelectedId(event.target.value);setError("");}} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{usableAddresses.map(item=><option key={item.id} value={item.id}>{item.coin} · {item.network} · {item.address}</option>)}</select></label>
     {selectedAddress?<div className="rounded-xl border border-brand-border bg-brand-surface-2/70 p-4 text-xs leading-5 text-brand-text-muted"><p>{t("Selected destination")}: {selectedAddress.coin} · {selectedAddress.network}</p><p className="mt-1 break-all font-mono">{selectedAddress.address.length>18?selectedAddress.address.slice(0,8)+"…"+selectedAddress.address.slice(-8):selectedAddress.address}</p></div>:<p className="text-xs text-brand-text-muted">{t("Loading selected address…")}</p>}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} {selectedAddress ? "(" + selectedAddress.coin + ")" : ""}</span><input inputMode="decimal" value={amount} disabled={!!pendingIntent||pendingIntentInvalid||submitting} onChange={event=>setAmount(event.target.value)} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15"/></label>
     {selectedAddress?<div className="grid grid-cols-2 gap-3 rounded-xl border border-brand-border bg-brand-surface-2/50 p-4 text-sm"><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 tabular-nums">{available.toLocaleString(localeTags[language],{maximumFractionDigits:10})} {selectedAddress.coin}</p></div><div><p className="text-xs text-brand-text-muted">{t("Withdrawal fee")}</p><p className="mt-1 tabular-nums">{Number.isFinite(fee)?fee.toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—"} {selectedAddress.coin}</p></div></div>:null}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Fund password")}</span><input type="password" autoComplete="current-password" value={fundPassword} disabled={submitting} onChange={event=>setFundPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" required/></label>
     {account?.twofa_enabled?<label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Two-factor code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twofaCode} disabled={submitting} onChange={event=>setTwofaCode(event.target.value.replace(/\D/g,"").slice(0,6))} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" required/></label>:null}
     {config&&!config.actions_enabled?<div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-brand-text-secondary"><Badge variant="outline" className="border-amber-400/30 text-amber-200">{t("Withdrawals temporarily unavailable")}</Badge><p className="mt-2">{t("The financial ledger cutover has not been enabled. You can review your wallet, but no withdrawal request can be submitted yet.")}</p></div>:null}
     {error?<p role="alert" className="text-sm text-rose-300">{error}</p>:null}
     {actionMessage?<p role="status" className="text-sm text-emerald-300">{actionMessage}</p>:null}
     <Button type="submit" className="min-h-12 w-full bg-brand-violet text-white hover:bg-brand-violet/90 sm:w-auto" disabled={!canSubmit}>{submitting?t("Submitting…"):pendingIntent?t("Retry same request"):t("Submit for staff review")}</Button>
     {pendingIntent?<p className="break-all text-xs text-amber-300">{t("Request result is not yet confirmed. Re-enter your fund password and 2FA code, then retry with the same request ID.")} · {pendingIntent.request_id}</p>:null}
    </form>}
   </CardContent></Card>

   <Card className="overflow-hidden border-brand-border bg-brand-surface "><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><CardTitle>{t("Withdrawal history")}</CardTitle><CardDescription>{t("Track staff review and manual payout completion. Approval does not mean the transfer has been sent.")}</CardDescription></CardHeader><CardContent className="space-y-2">
    {account?.withdrawals?.length?account.withdrawals.slice().reverse().map((item:WithdrawalRecord)=> <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-2/40 p-4 transition-colors hover:bg-brand-surface-2/70"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 break-all text-xs text-brand-text-muted">{item.address||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||item.paid_at||"—"}</p>{item.payout_reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">TxID / reference: {item.payout_reference||item.txid}</p>:null}</div><Badge variant={item.status==="completed"?"outline":item.status==="rejected"?"destructive":"secondary"}>{item.status}</Badge></div>)
    :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No withdrawal requests have been returned for this account.")}</p>}
   </CardContent></Card>

   <Card className="overflow-hidden border-brand-border bg-brand-surface "><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><CardTitle>{t("Saved crypto addresses")}</CardTitle><CardDescription>{t("Full addresses are only retrieved for the address selected for withdrawal.")}</CardDescription></CardHeader><CardContent className="space-y-2">
    {addresses.length?addresses.map(item=><div key={item.id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{item.coin} · {item.network}</span><Badge variant={item.blocked||item.unbound?"destructive":"outline"}>{item.blocked?"Blocked":item.unbound?"Unbound":"Saved"}</Badge></div><p className="mt-2 break-all font-mono text-sm text-brand-text-muted">{item.address}</p>{item.note?<p className="mt-1 text-xs text-brand-text-muted">{item.note}</p>:null}</div>)
    :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No saved crypto withdrawal addresses were found.")}</p>}
   </CardContent></Card>
  </>}
 </PageFrame>;
}
