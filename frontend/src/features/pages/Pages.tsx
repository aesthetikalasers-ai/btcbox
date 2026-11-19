import * as Dialog from "@radix-ui/react-dialog";
import { AuthRestoreState } from "../../components/AuthRestoreState";
import { multiplyDecimalStrings, compareDecimalStrings } from "../../lib/decimal";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldAlert, ArrowLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight, KeyRound, Copy, Check, LineChart, Plus, Minus, History, Layers, CandlestickChart, WifiOff, Search } from "lucide-react";
import { ApiError, getAccount, getOrders, getMarkets, getSpotMarketPairs, getKlines, getOrderBook, getUsdtUsdRate, getTradingStatus, submitSpotOrder, cancelSpotOrder, getSecondsPositions, getSecondsPolicy, submitSecondsOrder, settleSecondsPosition, getDepositAddress, getSavedCryptoAddresses, getSelectedCryptoAddress, getWithdrawalConfig, submitWithdrawal, getEarnCatalog, submitEarnAction, getPerpMarkets, getSupportUnread, type PerpMarket, type EarnProduct, type EarnPosition, type SavedCryptoAddress, type AccountBalance, type AccountSnapshot, type DepositRecord, type OrderRecord, type MarketTicker, type MarketCandle, type OrderBookSnapshot, type SpotMarketPair, type TradingStatus, type SecondsPositionsSnapshot, type SecondsOrderInput, type SecondsPolicyResponse, type SelectedCryptoAddress, type WithdrawalConfig, type WithdrawalRecord, submitKyc } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAuthDialog } from "../../lib/auth-dialog";
import { ChartDrawer } from "../trade/ChartDrawer";
import { useTrading } from "../../lib/trading";

import type { ReactNode } from "react";
import { ArrowUpRight, LockKeyhole, Wallet, ChartNoAxesCombined, ArrowLeftRight, Sprout, BadgeCheck, ShieldCheck, Headset, Columns2, Gift, Rocket } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { formatDecimalAmount, localeTags, useI18n } from "../../lib/i18n";
import { CHART_THEME } from "../../lib/chartTheme";
import { normalizeEarnStatus, earnStatusLabel, earnStatusBadgeVariant, normalizeDepositStatus, depositStatusLabel, depositStatusBadgeVariant, normalizeWithdrawalStatus, withdrawalStatusLabel, withdrawalStatusBadgeVariant, normalizeKycStatus, kycStatusLabel, normalizeKycDocumentType, kycDocumentTypeLabel } from "../../lib/status-mapping";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { PriceBadge } from "../../components/ui/PriceBadge";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp, type IChartApi, type IPriceLine, type ISeriesApi } from "lightweight-charts";
import { TradeProductNav } from "../trade/TradeProductNav";
import { MarketPickerDialog } from "../trade/MarketPickerDialog";
import { OrderConfirmDialog, type OrderPreview } from "../trade/OrderConfirmDialog";
import { priceDeviationPct, shouldConfirmOrder } from "../trade/orderConfirmPolicy";
import { useMarketStreamEvent } from "../../lib/useMarketStreamEvent";
import { SupportFaq } from "../support/SupportFaq";
import { SupportChat } from "../support/SupportChat";
import { TerminalOrderBook, aggregateLevels, precisionOptionsFor, DECIMALS_BY_PRECISION, type DepthPrecision, type BookView } from "../trade/TerminalOrderBook";
import { TerminalOrderForm, type OrderType } from "../trade/TerminalOrderForm";
import { TradesPanel } from "../trade/TradesPanel";
import { BottomOrderPanel } from "../trade/BottomOrderPanel";

type PageFrameTone = "trading"|"earn"|"assets"|"support"|"account"|"orders"|"market";
/** Handles to the live K-line chart, so ticks update the price line in place. */
type ChartHandle = { chart: IChartApi; series: ISeriesApi<"Candlestick">; priceLine: IPriceLine };
export function PageFrame({eyebrow,title,description,children,className="",tone,backTo,action,onBack}:{eyebrow?:string;title:string;description?:string;children:ReactNode;className?:string;tone:PageFrameTone;backTo?:string;action?:ReactNode;onBack?:()=>void}){
 const {t}=useI18n();
 return <div className={`${className} tone-${tone} mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8`}><div className="flex min-w-0 items-center justify-between gap-3">{onBack?<button type="button" onClick={onBack} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-text" aria-label={t("Back")}><ArrowLeft className="h-4 w-4"/></button>:backTo?<Link to={backTo} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-text" aria-label={t("Back")}><ArrowLeft className="h-4 w-4"/></Link>:null}<h1 className="type-page-title min-w-0 truncate text-brand-text">{t(title)}</h1>{action}</div>{children}</div>;
}
/**
 * Displays the TradeHub service directory and its available product entry points.
 * Keeps each service routed to its existing dedicated workflow.
 */
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
 const [perpAvailability,setPerpAvailability]=useState<"loading"|"sign-in"|"enabled"|"read-only"|"unavailable">("loading");
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
   setSecondsAvailability("loading");setEarnAvailability("loading");setPerpAvailability("loading");
  }else if(status!=="authenticated"){
   setSecondsAvailability("sign-in");setEarnAvailability("sign-in");setPerpAvailability("sign-in");
  }else{
   setSecondsAvailability("loading");setEarnAvailability("loading");setPerpAvailability("loading");
   Promise.allSettled([getSecondsPolicy(controller.signal),getEarnCatalog(controller.signal),getPerpMarkets(controller.signal)]).then(([seconds,earn,perp])=>{
    if(controller.signal.aborted)return;
    setSecondsAvailability(seconds.status==="fulfilled"?(seconds.value.actions_enabled?"enabled":"read-only"):"unavailable");
    setEarnAvailability(earn.status==="rejected"?"unavailable":earn.value.products.length===0?"empty":earn.value.actions_enabled?"enabled":"read-only");
    setPerpAvailability(perp.status==="fulfilled"?(perp.value.length>0?"enabled":"read-only"):"unavailable");
   });
  }
  return ()=>controller.abort();
 },[status]);
 const spotExecutionEnabled=tradingStatus?.spot_order_entry_enabled===true;


  const spotBadge = pairsLoading
    ? t("Checking markets")
    : pairsError
    ? t("Markets unavailable")
    : !spotPairs.length
    ? t("Unavailable")
    : tradingStatusError
    ? t("Execution unavailable")
    : tradingStatus === null
    ? t("Checking execution")
    : spotExecutionEnabled
    ? t("Order entry enabled")
    : t("Unavailable");

 const spotBadgeVariant=pairsLoading?"info" as const:pairsError?"destructive" as const:!spotPairs.length?"warning" as const:tradingStatusError?"destructive" as const:tradingStatus===null?"info" as const:spotExecutionEnabled?"success" as const:"warning" as const;
 const spotDescription=pairsLoading?t("Checking backend-enabled spot markets."):pairsError?t("Spot availability cannot be confirmed. Order entry remains unavailable."):!spotPairs.length?t("No spot markets are currently enabled. Spot order entry remains unavailable."):tradingStatusError?t("Markets are listed, but execution status cannot be confirmed. Order entry remains unavailable."):tradingStatus===null?t("Checking server-side order execution status."):spotExecutionEnabled?t("Place server-validated limit orders on configured spot pairs."):t("Configured markets are visible, but spot order execution is disabled by server policy.");
 const secondsDescription=secondsAvailability==="sign-in"?t("Sign in to check the active Seconds policy and availability."):secondsAvailability==="loading"?t("Checking the active backend Seconds policy."):secondsAvailability==="unavailable"?t("Seconds policy is unavailable. New positions remain disabled."):secondsAvailability==="read-only"?t("The policy is configured, but new positions are disabled by backend financial controls."):t("Place policy-driven positions with independent timers and server-side settlement.");
 const secondsBadge=secondsAvailability==="sign-in"?t("Sign in required"):secondsAvailability==="loading"?t("Checking policy"):secondsAvailability==="unavailable"?t("Policy unavailable"):secondsAvailability==="read-only"?t("Actions disabled"):t("Order entry enabled");
 const earnDescription=earnAvailability==="sign-in"?t("Sign in to view the Earn catalog and your positions."):earnAvailability==="loading"?t("Checking the backend Earn catalog."):earnAvailability==="unavailable"?t("Earn catalog is unavailable. No product availability is assumed."):earnAvailability==="empty"?t("No Earn products are currently available."):earnAvailability==="read-only"?t("Earn products are listed, but subscribe and redeem actions are disabled by backend financial controls."):t("Review available Earn products and manage positions.");
 const earnBadge=earnAvailability==="sign-in"?t("Sign in required"):earnAvailability==="loading"?t("Checking catalog"):earnAvailability==="unavailable"?t("Catalog unavailable"):earnAvailability==="empty"?t("No products"):earnAvailability==="read-only"?t("Read-only"):t("Products available");
 return <PageFrame title="Choose your trading mode" tone="trading">
  <div className="grid gap-4 sm:grid-cols-2">
   <Card className="card-lift border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><ChartNoAxesCombined className="h-5 w-5"/></div><CardTitle>{t("Spot")}</CardTitle><CardDescription>{spotDescription}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge data-testid="spot-availability" variant={spotExecutionEnabled?"outline":"secondary"}>{t(spotBadge)}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/markets">{t("View markets")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="card-lift border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><ArrowLeftRight className="h-5 w-5"/></div><CardTitle>{t("Seconds")}</CardTitle><CardDescription>{secondsDescription}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant={secondsAvailability==="enabled"?"outline":"secondary"}>{secondsBadge}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/seconds">{status==="authenticated"?t("Open"):t("Sign in to view")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="card-lift border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-text-secondary"><Sprout className="h-5 w-5"/></div><CardTitle>{t("Earn")}</CardTitle><CardDescription>{earnDescription}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant={earnAvailability==="enabled"?"outline":"secondary"}>{earnBadge}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/earn">{status==="authenticated"?t("Open"):t("Sign in to view")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
   <Card className="card-lift border-brand-border bg-brand-surface"><CardHeader><div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-violet/20 bg-brand-violet/10 text-brand-violet"><TrendingUp className="h-5 w-5"/></div><CardTitle>{t("Perpetual")}</CardTitle><CardDescription>{perpAvailability==="sign-in"?t("Sign in to view perpetual contracts and open positions."):perpAvailability==="loading"?t("Checking perpetual contracts availability."):perpAvailability==="unavailable"?t("Perpetual contract trading is currently unavailable."):perpAvailability==="read-only"?t("Perpetual contract market is available in read-only mode."):t("Trade USDT-margined perpetual contracts with up to 100x leverage.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant={perpAvailability==="enabled"?"outline":"secondary"}>{perpAvailability==="sign-in"?t("Sign in required"):perpAvailability==="loading"?t("Checking"):perpAvailability==="unavailable"?t("Unavailable"):perpAvailability==="read-only"?t("Read-only"):t("Live trading")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to="/contract">{t("Trade")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>
  </div>
  <section className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="type-section-title">{t("Spot markets")}</h2>{!pairsLoading&&!pairsError?<span className="text-xs text-brand-text-muted">{spotPairs.length} {t("pairs")}</span>:null}</div>
   {pairsLoading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading configured spot markets…")}</CardContent></Card>:null}
   {!pairsLoading&&!pairsError&&!spotPairs.length?<Card className="border-dashed border-brand-border bg-transparent"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No spot markets are currently enabled. Please check again later.")}</CardContent></Card>:null}
   {pairsError?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="p-5 text-sm text-brand-danger" role="alert">{t(pairsError)}</CardContent></Card>:null}
   {spotPairs.length?<div className="grid gap-3 sm:grid-cols-2">{spotPairs.map(pair=><Card key={pair.base_asset+"/"+pair.quote_asset} className="card-lift min-w-0 border-brand-border bg-brand-surface"><CardHeader><CardTitle>{pair.base_asset}/{pair.quote_asset}</CardTitle><CardDescription>{t("This pair is configured. Order entry availability is shown above.")}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline">{t("Enabled")}</Badge><Button asChild size="sm" variant="secondary" className="shrink-0"><Link to={"/trade/"+pair.base_asset+pair.quote_asset}>{t("Open")} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>)}</div>:null}
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
 return <PageFrame title="Assets" tone="assets">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="outline" className="border-brand-border">{t("Live account data")}</Badge>{account&&!loading?<span className="text-xs text-brand-text-muted">{balances.length} {t("assets")}</span>:null}</div></div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account balances…")}</CardContent></Card>
   :error?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
   :account?<>
    <section aria-label={t("Wallet overview")} className="grid gap-3">
     <Card className="relative overflow-hidden border-brand-teal/25 bg-brand-surface ring-1 ring-brand-teal/[0.05]"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-teal"/><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5"><div className="min-w-0"><p className="type-meta pl-1 font-semibold uppercase tracking-wide text-brand-text-muted">{t("Estimated account value")}</p><p className="mt-2 break-all text-2xl font-bold tabular-nums text-brand-text sm:text-3xl">{account.valuation_complete?amount(account.totalUsdt)+" USDT":"—"}</p></div><div className="flex flex-wrap gap-2"><Button asChild className="min-h-11"><Link to="/deposit">{t("Deposit")}</Link></Button><Button asChild variant="outline" className="min-h-11"><Link to="/withdraw">{t("Withdraw")}</Link></Button></div></CardContent></Card>
    </section>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="type-section-title">{t("Your assets")}</h2><span className="text-xs text-brand-text-muted">{balances.length}</span></div>
     {balances.length?balances.map(([asset,balance],index)=><Card key={asset} className={"relative -mx-3 overflow-hidden rounded-none border-brand-border bg-brand-surface transition-colors hover:border-brand-teal/20 sm:-mx-4 md:mx-0 md:rounded-xl "+(index%3===0?"border-l-2 border-l-brand-teal":index%3===1?"border-l-2 border-l-brand-cyan":"border-l-2 border-l-brand-violet")}><CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5"><div className="flex min-w-0 items-center gap-3"><TokenIcon symbol={asset} className="h-9 w-9 shrink-0"/><div className="min-w-0"><p className="text-xs text-brand-text-muted">{t("Asset")}</p><p className="mt-1 truncate font-semibold">{asset}</p></div></div><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 break-all font-medium tabular-nums">{amount(balance.free)}</p></div><div><p className="text-xs text-brand-text-muted">{t("In orders")}</p><p className="mt-1 break-all font-medium tabular-nums">{amount(balance.frozen)}</p></div><div><p className="text-xs text-brand-text-muted">{t("USDT value")}</p><p className="mt-1 break-all font-medium tabular-nums">{balance.usdt===undefined?"—":amount(balance.usdt)}</p></div></CardContent></Card>)
      :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No asset balances were returned by the account service.")}</CardContent></Card>}
    </section>
   </>:null}
  <div className="grid gap-4 sm:grid-cols-3">{[{title:"Deposit",to:"/deposit",label:"Open deposit"},{title:"Withdraw",to:"/withdraw",label:"Open withdrawal"},{title:"Earn",to:"/earn",label:"Explore Earn"}].map(x=><Card key={x.to} className="border-brand-border bg-brand-surface"><CardContent className="p-5"><p className="type-label text-brand-text-secondary">{t(x.title)}</p><Button asChild variant="link" className="mt-2 min-h-0 h-auto px-0 py-0 text-left text-brand-text-secondary"><Link to={x.to}>{t(x.label)} <ArrowUpRight className="h-4 w-4"/></Link></Button></CardContent></Card>)}</div>
 </PageFrame>;
}
export function MyPage(){
 const {t}=useI18n();
 const {status,signOut}=useAuth();
 const {openAuthDialog}=useAuthDialog();
 const navigate=useNavigate();
 const [supportUnread,setSupportUnread]=useState(0);
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [loading,setLoading]=useState(status==="loading");
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 const [uidCopied,setUidCopied]=useState(false);
 const maskEmail=(email:string)=>{const at=email.indexOf("@");if(at<=2)return email;const head=email.slice(0,2);const tail=email.slice(Math.max(2,at-2),at);return head+"***"+tail+email.slice(at);};
 const copyUid=async()=>{if(!account?.uid)return;try{await navigator.clipboard.writeText(account.uid);setUidCopied(true);window.setTimeout(()=>setUidCopied(false),1800);}catch{}};
 const handleSignOut=async()=>{try{await signOut();}catch{}navigate("/home");};
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
 // Authoritative unread support reply count (GET /api/chat/unread).
 // Loaded independently so a badge failure never blocks the account profile.
 useEffect(()=>{
  if(status!=="authenticated"){setSupportUnread(0);return;}
  const controller=new AbortController();
  getSupportUnread(controller.signal).then((count)=>{if(!controller.signal.aborted)setSupportUnread(count);}).catch(()=>{});
  return ()=>controller.abort();
 },[status,reload]);
 const links=[
  {title:"Orders",to:"/orders",icon:ChartNoAxesCombined,surface:"border-brand-info/25 bg-brand-surface",iconTone:"bg-brand-info/10 text-brand-info",hoverTone:"hover:border-brand-info/45"},
  {title:"Referral & Rewards",to:"/rewards",icon:Gift,surface:"border-brand-accent/25 bg-brand-surface",iconTone:"bg-brand-accent/10 text-brand-accent",hoverTone:"hover:border-brand-accent/45"},
  {title:"New listings",to:"/new-listings",icon:Rocket,surface:"border-brand-warning/25 bg-brand-surface",iconTone:"bg-brand-warning/10 text-brand-warning",hoverTone:"hover:border-brand-warning/45"},
  {title:"Support",to:"/support",icon:Headset,surface:"border-brand-violet/25 bg-brand-surface",iconTone:"bg-brand-violet/10 text-brand-violet",hoverTone:"hover:border-brand-violet/45"},
  {title:"Settings",to:"/settings",icon:ShieldCheck,surface:"border-brand-teal/25 bg-brand-surface",iconTone:"bg-brand-teal/10 text-brand-teal",hoverTone:"hover:border-brand-teal/45"},
  {title:"Trust centre",to:"/trust",icon:ShieldCheck,surface:"border-brand-border bg-brand-surface",iconTone:"bg-brand-surface-2 text-brand-text-muted",hoverTone:"hover:border-brand-border-strong"},
 ];
 return <PageFrame title="My account" tone="account">
  {status==="loading"?<AuthRestoreState label="Loading account profile…"/>
  :status!=="authenticated"?<div className="space-y-4">
   <Card className="border-brand-border bg-brand-surface overflow-hidden"><CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
    <div className="flex items-center gap-3.5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent"><LockKeyhole className="h-5 w-5"/></div><div><p className="font-bold text-base text-brand-text">{t("Sign in to your account")}</p><p className="text-xs text-brand-text-muted mt-0.5">{t("Sign in to view balances, orders, and security settings.")}</p></div></div>
    <div className="flex items-center gap-2 shrink-0"><Button type="button" size="sm" className="min-w-[88px]" onClick={()=>openAuthDialog("login")}>{t("Sign in")}</Button><Button type="button" size="sm" variant="outline" className="min-w-[88px]" onClick={()=>openAuthDialog("register")}>{t("Create account")}</Button></div>
   </CardContent></Card>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Estimated account value")}</p><p className="mt-2 text-xl font-bold font-mono tracking-tight tabular-nums text-brand-text">•••••• <span className="text-xs font-normal text-brand-text-muted">USDT</span></p><div className="mt-2.5 flex items-center gap-2"><Link to="/login" className="text-xs text-brand-accent font-semibold hover:underline">{t("Sign in to view")}</Link></div></div>
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Security tier")}</p><p className="mt-2 text-base font-bold text-brand-text">Level 2</p><span className="mt-2.5 text-xs text-brand-success font-medium flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5"/> 2FA / Passkey</span></div>
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Fee tier")}</p><p className="mt-2 text-base font-bold text-brand-text">VIP 0</p><span className="mt-2.5 text-xs text-brand-text-secondary">{t("Maker 0.1% / Taker 0.1%")}</span></div>
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Affiliate Program")}</p><p className="mt-2 text-base font-bold text-brand-text">Up to 40%</p><Link to="/register" className="mt-2.5 text-xs text-brand-accent font-semibold hover:underline">{t("Join affiliate")}</Link></div>
   </div>
  </div>
  :loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account profile…")}</CardContent></Card>
  :error?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<div className="space-y-4">
   <Card className="border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardContent className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent/30 to-brand-cyan/20 text-xl font-bold text-brand-accent">{(account.username||account.email||"U").charAt(0).toUpperCase()}</div>
    <div className="min-w-0 flex-1">
     <p className="truncate text-lg font-bold text-brand-text">{account.username||account.email||"U"}</p>
     <p className="mt-0.5 truncate text-sm text-brand-text-secondary">{account.email?maskEmail(account.email):"U"}</p>
     <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-brand-text-muted">{t("UID")}</span>
      <span className="font-mono text-xs tabular-nums text-brand-text-secondary">{account.uid||"U"}</span>
      <button type="button" onClick={()=>void copyUid()} className="inline-flex items-center gap-1 rounded-md border border-brand-border px-2 py-0.5 text-xs text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-text">{uidCopied?<><Check className="h-3 w-3 text-brand-success"/>{t("Copied")}</>:<><Copy className="h-3 w-3"/>{t("Copy")}</>}</button>
     </div>
    </div>
   </CardContent></Card>
   <div className="divide-y divide-brand-border-subtle overflow-hidden rounded-xl border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
    <Link to="/address-book" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Wallet className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Address book")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/kyc" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><BadgeCheck className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Verification")}</span><span className={`shrink-0 text-sm font-semibold ${normalizeKycStatus(account.kyc?.status)==="verified"?"text-brand-success":normalizeKycStatus(account.kyc?.status)==="rejected"?"text-brand-danger":"text-brand-text-muted"}`}>{kycStatusLabel(normalizeKycStatus(account.kyc?.status),t)}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/settings" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal"><ShieldCheck className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Two-factor authentication")}</span><span className={`shrink-0 text-sm font-semibold ${account.twofa_enabled?"text-brand-success":"text-brand-text-muted"}`}>{account.twofa_enabled?t("Enabled"):t("Not enabled")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/settings" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-violet/10 text-brand-violet"><KeyRound className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Linked sign-in methods")}</span><span className="shrink-0 text-sm font-semibold text-brand-text-secondary">{(account.auth_providers||[]).length?(account.auth_providers||[]).length:t("Not linked")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
   </div>
  </div>:null}
  <div className="account-actions">{links.map(({title,to,icon:Icon})=>{
   // The support row carries a live unread badge so a reply is never missed.
   const unread=to==="/support"?supportUnread:0;
   return <Link key={to} to={to} className="group flex min-w-0 items-center gap-3 p-4 transition-all duration-200 hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/60"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-text">{t(title)}</span></span>{unread>0?<span className="shrink-0 rounded-full bg-brand-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums" aria-label={t("Unread support replies")}>{unread>99?"99+":unread}</span>:null}<ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted transition-colors group-hover:text-brand-text"/></Link>;
  })}</div>
  {status==="authenticated"?<Button variant="outline" className="w-full border-brand-danger/30 text-brand-danger hover:bg-brand-danger/5 hover:text-brand-danger" onClick={()=>void handleSignOut()}>{t("Sign out")}</Button>:null}
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
  if(["filled","completed","success","settled"].includes(normalized))return "border-brand-success/30 bg-brand-success/[.07] text-brand-success";
  if(["cancelled","canceled","rejected","failed","expired"].includes(normalized))return "border-brand-danger/30 bg-brand-danger/[.07] text-brand-danger";
  return "border-brand-border bg-brand-surface-2 text-brand-text-muted";
 };
 return <PageFrame title="Orders" tone="orders" backTo="/me">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-2"><Badge variant="outline" className="border-brand-border">{t("Read-only history")}</Badge>{!loading&&!error?<span className="text-xs text-brand-text-muted">{orders.length} {t("records")}</span>:null}</div>
   <Button size="sm" variant="outline" disabled={loading} onClick={()=>setReload((n)=>n+1)}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>{t("Refresh")}</Button>
  </div>
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading orders…")}</CardContent></Card>
   :error?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
   :orders.length===0?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-col items-center px-5 py-12 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-border bg-brand-surface-2"><Clock3 className="h-5 w-5 text-brand-text-muted"/></div><p className="font-semibold">{t("No orders returned")}</p><p className="mt-2 max-w-md text-sm text-brand-text-muted">{t("No orders are available for this account yet.")}</p><Button asChild variant="secondary" className="mt-5"><Link to="/trade-hub">{t("Explore trading")}</Link></Button></CardContent></Card>
   :<div className="space-y-3">{orders.map((order,index)=>{
    const id=value(order.order_id??order.id);
    const side=String(order.side||"").toLowerCase();
    return <Card key={id!=="—"?id:index} className="min-w-0 border-brand-border bg-brand-surface"><CardContent className="grid gap-3 p-4 sm:p-5">
     <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-semibold">{value(order.symbol)}</span><Badge variant="outline" className={side==="buy"?"border-brand-success/30 text-brand-success":side==="sell"?"border-brand-danger/30 text-brand-danger":"border-brand-border"}>{value(order.side)}</Badge><span className="text-xs text-brand-text-muted">{value(order.type)}</span></div><Badge variant="outline" className={statusTone(order.status)}>{value(order.status)}</Badge></div>
     <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><p className="text-xs text-brand-text-muted">{t("Price")}</p><p className="mt-1 font-medium tabular-nums">{value(order.price)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Quantity")}</p><p className="mt-1 font-medium tabular-nums">{value(order.quantity)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Amount")}</p><p className="mt-1 font-medium tabular-nums">{value(order.amount)}</p></div><div><p className="text-xs text-brand-text-muted">{t("Created")}</p><p className="mt-1 font-medium">{date(order.created_at)}</p></div></div>
     <p className="border-t border-brand-border pt-2 text-[11px] text-brand-text-muted">{t("Order ID")}: <span className="break-all font-mono">{id}</span></p>
    </CardContent></Card>;
   })}</div>}
 </PageFrame>;
}

export function SpotTradingPage(){
 const {symbol:routeSymbol}=useParams();
 const requestedSymbol=(routeSymbol||"BTCUSDT").toUpperCase();
 const symbol=requestedSymbol.endsWith("USDT")?requestedSymbol:requestedSymbol+"USDT";
 const {t,language}=useI18n();
 const {placeSpotOrder}=useTrading();
 const {openAuthDialog}=useAuthDialog();
 const navigate=useNavigate();
 const [paperToast,setPaperToast]=useState("");
 const [ticker,setTicker]=useState<MarketTicker|null>(null);
 const [spotPairEnabled,setSpotPairEnabled]=useState(false);
 const [chartInterval,setChartInterval]=useState("1h");
 // `compactTrade` (<=1279px) means "no inline chart": the chart moves into the
 // safe-area drawer and the document-flow dual-column workspace is used. At
 // 1280px and above (xl) the viewport-locked pro terminal owns the chart, matching
 // the `.spot-terminal--pro` CSS that only applies at 1280px and up.
 const DESKTOP_TRADE_QUERY="(max-width: 1279px)";
 const [compactTrade,setCompactTrade]=useState(()=>window.matchMedia(DESKTOP_TRADE_QUERY).matches);
 const [chartOpen,setChartOpen]=useState(false);
 const [pairSymbols,setPairSymbols]=useState<string[]>([]);
 /** Spot pair switcher dialog (desktop terminal header). */
 const [pairPickerOpen,setPairPickerOpen]=useState(false);
 /**
  * Persistent market list for the desktop terminal (Binance-style left rail):
  * every enabled pair with its live price and 24h change. This is the primary
  * way to switch pairs, so switching never hides the chart behind a modal.
  */
 const [marketList,setMarketList]=useState<MarketTicker[]>([]);
 const [marketFilter,setMarketFilter]=useState("");
 const [pairRailOpen,setPairRailOpen]=useState(true);
 // `isPhone` (<=767px) hides the market-list drawer on phones; the order form and
 // order book stay side-by-side (Binance-style dual column) at every width.
 const [isPhone,setIsPhone]=useState(()=>window.matchMedia("(max-width: 767px)").matches);
 // Mobile trade panel: the design board (docs/design/btcbox-mobile-design-board.svg,
 // Trade screen) defines three tabs — Buy | Sell | Order book. The book and the
 // order form therefore never share the phone viewport at the same time.
 const [mobilePanel,setMobilePanel]=useState<"buy"|"sell"|"book">("buy");
 useEffect(()=>{
  const media=window.matchMedia(DESKTOP_TRADE_QUERY);
  const phone=window.matchMedia("(max-width: 767px)");
  const update=()=>{setCompactTrade(media.matches);setChartOpen(false);setIsPhone(phone.matches);};
  media.addEventListener("change",update);
  phone.addEventListener("change",update);
  return ()=>{media.removeEventListener("change",update);phone.removeEventListener("change",update);};
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
 const [isPriceManual,setIsPriceManual]=useState(false);
 const [quantity,setQuantity]=useState("");
 const [accountUid,setAccountUid]=useState("");
 const [availableBalances,setAvailableBalances]=useState<Record<string,{free:number|string}>>({});
 // Hide the account snapshot during mutations; manual refresh obtains verified balances again.
 useEffect(()=>{if(busy)setAvailableBalances({});},[busy]);
 const [pendingIntent,setPendingIntent]=useState<Parameters<typeof submitSpotOrder>[0]|null>(null);
 // Pre-trade confirmation: shown only for orders that are large or priced far
 // from the market. The intent is staged here and sent only after the user
 // confirms, so a mis-click on the submit button cannot place the order.
 const [orderPreview,setOrderPreview]=useState<OrderPreview|null>(null);
 const [pendingIntentInvalid,setPendingIntentInvalid]=useState(false);
 const [cancelRequestIds,setCancelRequestIds]=useState<Record<string,string>>({});
 const [reload,setReload]=useState(0);
 const [marketUpdatedAt,setMarketUpdatedAt]=useState<number|null>(null);
 const [marketClockNow,setMarketClockNow]=useState(Date.now());
 const [marketFeedWarning,setMarketFeedWarning]=useState("");
 const [chartFeedWarning,setChartFeedWarning]=useState("");
 const [depthPrecision,setDepthPrecision]=useState<DepthPrecision>("0.01");
 const [bookView,setBookView]=useState<"both"|"bids"|"asks">("both");
 /** Desktop "expand book": hides the tape so the depth column owns its space. */
 const [bookExpanded,setBookExpanded]=useState(false);
 /**
  * Incremented by the feed-outage retry button. The initial-load effect already
  * keys on `reload`, so bumping this re-runs the market fetch without touching
  * the order form or a pending order intent.
  */
 const [refreshTick,setRefreshTick]=useState(0);
 const [bottomTab,setBottomTab]=useState<"orders"|"history"|"fills"|"assets">("orders");
 const [ordersExpanded,setOrdersExpanded]=useState(true);
 const [orderType,setOrderType]=useState<"limit"|"market">("limit");
 const [activeOrderTab,setActiveOrderTab]=useState<"orders"|"assets">("orders");
 // Desktop terminal presentation state:
 // - `auth.status` decides whether the submit CTA places an order or opens sign-in
 //   (the desktop terminal hides the header user menu, so it reads the same store).
 // - system-level policy warnings collapse into one dismissible banner instead of
 //   competing with the order form for the trading viewport.
 const {status:authStatus}=useAuth();
 const [dismissedBanners,setDismissedBanners]=useState<string[]>([]);
 const [orderSizePercent,setOrderSizePercent]=useState(0);
 const [chartLastPrice,setChartLastPrice]=useState<number|null>(null);
 // Terminal layout interactions (Binance-style 4-column grid):
 // - right market-list drawer collapses to a thin strip
 // - bottom orders panel can be maximized drawer-style over the grid
 const [pairsDrawerOpen,setPairsDrawerOpen]=useState(()=>!window.matchMedia("(max-width: 1279px)").matches);
 const [ordersMaximized,setOrdersMaximized]=useState(false);

 const [chartNode,setChartNode]=useState<HTMLDivElement|null>(null);
 const chartTrigger=useRef<HTMLButtonElement|null>(null);
 // Handles to the created chart so live ticks update the price line instead of
 // tearing the chart down and rebuilding it.
 const chartRef=useRef<ChartHandle|null>(null);
 const base=symbol.endsWith("USDT")?symbol.slice(0,-4):"BTC";
 const pendingStorageKey=accountUid?"btcbox.spot.pending.v1."+accountUid+"."+symbol:"";
  // A quote older than 90s is treated as stale: the submit path refuses new
 // orders instead of trading against a stale price. `marketUpdatedAt` is the
 // exchange snapshot time, never the browser's receipt time.
 const marketSnapshotStale=!!ticker&&(!marketUpdatedAt||marketClockNow-marketUpdatedAt>90_000);
 const displayTicker=ticker;
 /**
  * Depth steps this pair can actually use, derived from its price. A 0.01 bucket
  * would merge ARB's 0.1277 book into one row and print a 0.13 best bid. The
  * user's explicit choice is kept while it is still valid for the pair, so a
  * stale selection can never outlive a symbol change.
  */
 const pairPrecisionOptions=useMemo(()=>precisionOptionsFor(displayTicker?Number(displayTicker.price):null),[displayTicker?.price]);
 const effectiveDepthPrecision:DepthPrecision=pairPrecisionOptions.includes(depthPrecision)?depthPrecision:pairPrecisionOptions[0];
 /**
  * USDT→USD rate behind the "≈ $" hint under the mid price. Polled at a slow
  * cadence because the peg moves in basis points, and falling back to 0.99999
  * keeps the hint readable if the FX endpoint is unavailable.
  */
 const [usdtUsd,setUsdtUsd]=useState(0.99999);
 useEffect(()=>{
  const controller=new AbortController();
  let cancelled=false;
  const load=()=>{getUsdtUsdRate(0.99999,controller.signal).then(r=>{if(!cancelled)setUsdtUsd(r.rate);}).catch(()=>{});};
  load();
  const timer=window.setInterval(load,60000);
  return ()=>{cancelled=true;controller.abort();window.clearInterval(timer);};
 },[]);
 const orderBookSnapshotStale=!!book&&(!book.snapshotTs||marketClockNow-book.snapshotTs*1000>90_000);
 // Live order book, streamed over SSE. The polled `book` remains the fallback
 // so a blocked SSE endpoint degrades to slightly staler data instead of
 // leaving the panel empty.
 const liveDepth=useMarketStreamEvent<OrderBookSnapshot>({
  channel:"depth",
  symbol,
  parse:(payload)=>{
   const b=payload as (OrderBookSnapshot&{ok?:boolean})|null;
   if(!b||b.ok!==true||!Array.isArray(b.bids)||!Array.isArray(b.asks))return null;
   const norm=(rows:unknown[]):Array<[string,string]>=>rows
    .filter((row):row is [string|number,string|number]=>Array.isArray(row)&&row.length>=2&&Number(row[0])>0&&Number(row[1])>0)
    .map(row=>[String(row[0]),String(row[1])]);
   const bids=norm(b.bids);
   const asks=norm(b.asks);
   if(!bids.length||!asks.length)return null;
   return {...b,bids,asks};
  },
 });
 // Streamed data wins; the polled snapshot is a fallback only while the stream
 // has not delivered a frame yet. A stale snapshot is never rendered as live.
 const displayBook=orderBookSnapshotStale?null:(liveDepth.data??book);
 /**
  * Last trade price for the chart price line.
  *
  * Priority: live top-of-book mid (densest, updates every stream frame) →
  * exchange snapshot price. A stale book contributes nothing, and with no
  * timestamped quote at all the value is `null` so the chart keeps the candle
  * close instead of inventing a price.
  */
 const lastTradePrice=(():number|null=>{
  const topAsk=Number(displayBook?.asks?.[0]?.[0]);
  const topBid=Number(displayBook?.bids?.[0]?.[0]);
  if(Number.isFinite(topAsk)&&Number.isFinite(topBid)&&topAsk>0&&topBid>0)return (topAsk+topBid)/2;
  const snapshot=Number(displayTicker?.price);
  if(Number.isFinite(snapshot)&&snapshot>0)return snapshot;
  return null;
 })();
 const effectiveMarketFeedWarning=marketFeedWarning;
 // A failed `/api/market` leaves `ticker` null. Without a real quote there is no
 // price, no 24h stats and no basis for pricing an order, so the terminal shows
 // an explicit degraded state with a retry instead of blank fields that read as
 // zero. No sample value is ever substituted.
 const marketUnavailable=!ticker;

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
  const controller=new AbortController();
  setLoading(true);setError("");setSpotPairEnabled(false);setTradingStatus(null);setPairSymbols([]);setAvailableBalances({});setOrderType("limit");
  setTicker(null);setCandles([]);setBook(null);setMarketUpdatedAt(null);setMarketFeedWarning("");setChartFeedWarning("");setPrice("");
  Promise.allSettled([getSpotMarketPairs(controller.signal),getMarkets(controller.signal),getOrderBook(symbol,controller.signal),getTradingStatus(controller.signal),getOrders(controller.signal),getAccount(controller.signal)]).then(results=>{
   if(controller.signal.aborted)return;
   const [pairResult,marketResult,bookResult,statusResult,ordersResult,accountResult]=results;
   if(pairResult.status==="fulfilled"){
    setPairSymbols(pairResult.value.filter(pair=>pair.quote_asset==="USDT").map(pair=>pair.base_asset+pair.quote_asset));
    const enabled=pairResult.value.some(pair=>pair.base_asset===base&&pair.quote_asset==="USDT");
    setSpotPairEnabled(enabled);
    if(!enabled)setError("This spot market is not enabled by BTCBOX operators.");
   }else{
    setSpotPairEnabled(false);
    setError(pairResult.reason instanceof Error?pairResult.reason.message:"Spot-market catalogue is unavailable.");
   }
   if(accountResult.status==="fulfilled"){setAccountUid(accountResult.value.uid);setAvailableBalances(accountResult.value.balances);}
   else if(accountResult.reason instanceof ApiError && accountResult.reason.code==="AUTH_REQUIRED"){setAccountUid("");setAvailableBalances({});}
   // Missing account data is represented by unavailable balances and disabled order entry;
   // keep it out of the prominent market-status banner to preserve the trading viewport.
   if(marketResult.status==="fulfilled"){
    const marketBase=symbol.endsWith("USDT")?symbol.slice(0,-4):symbol;
    // Keep the whole snapshot so the rail can list every tradable pair.
    setMarketList(marketResult.value);
    const selected=marketResult.value.find(item=>item.sym.toUpperCase()===marketBase)||null;
    if(selected){
     setTicker(selected);
     setMarketUpdatedAt(selected.snapshotTs?selected.snapshotTs*1000:null);
     setMarketFeedWarning("");
     if(!isPriceManual){ setPrice(String(selected.price)); }
    }else{setTicker(null);setMarketUpdatedAt(null);setPrice("");setMarketFeedWarning("Market data is temporarily unavailable for this pair.");}
   }else{setTicker(null);setMarketUpdatedAt(null);setPrice("");setError(marketResult.reason instanceof Error?marketResult.reason.message:"Live market data is unavailable.");}
   // initial load: a null book means the depth feed is unavailable, and the
   // panel renders its own empty state.
   setBook(bookResult.status==="fulfilled"?bookResult.value:null);
   if(statusResult.status==="fulfilled")setTradingStatus(statusResult.value);
   else setTradingStatus(null);
   if(ordersResult.status==="fulfilled")setOrders(ordersResult.value);
   else if(ordersResult.reason instanceof ApiError && ordersResult.reason.code!=="AUTH_REQUIRED")setError(ordersResult.reason.message);
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[symbol,reload,refreshTick]);

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
      if(!isPriceManual && selected.price){ setPrice(String(selected.price)); }
     }else{setTicker(null);setMarketUpdatedAt(null);failed=true;}
    }else{setTicker(null);setMarketUpdatedAt(null);failed=true;}
    if(bookResult.status==="fulfilled"){setBook(bookResult.value);if(!bookResult.value)failed=true;}
    else{setBook(null);failed=true;}
    setMarketFeedWarning(failed?"Live market data is temporarily unavailable.":"");
   }).finally(()=>{window.clearTimeout(timeoutId);refreshing=false;});
  };
// The ticker and order book refresh at 1.5 s: fast enough to read as live, slow
// enough that the gateway's own cache (TICKER_TTL_MS = 1500) absorbs the load so
// providers are hit at most once per tick regardless of how many browsers poll.
const MARKET_POLL_MS = 1500;
  const refreshId=window.setInterval(refreshMarketData,MARKET_POLL_MS);
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
  const timer=window.setInterval(load,30000);
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
  const chart=createChart(node,{width:node.clientWidth,height:node.clientHeight||320,handleScroll:{vertTouchDrag:false,horzTouchDrag:true},handleScale:{pinch:true},layout:{attributionLogo:false,background:{type:ColorType.Solid,color:CHART_THEME.background},textColor:CHART_THEME.text},grid:{vertLines:{color:CHART_THEME.grid},horzLines:{color:CHART_THEME.grid}},rightPriceScale:{borderColor:CHART_THEME.border},timeScale:{borderColor:CHART_THEME.border,timeVisible:true,secondsVisible:false}});
  const series=chart.addSeries(CandlestickSeries,{upColor:CHART_THEME.up,downColor:CHART_THEME.down,borderVisible:false,wickUpColor:CHART_THEME.up,wickDownColor:CHART_THEME.down});
  series.setData(candles.map(item=>({time:Math.floor(item.time/1000) as UTCTimestamp,open:item.open,high:item.high,low:item.low,close:item.close})).sort((a,b)=>Number(a.time)-Number(b.time)));
  chart.timeScale().fitContent();
  // The last-trade price line keeps the price scale aligned with the order book:
  // without it the axis was only as wide as the fetched candles, so a price that
  // moved past the newest close looked clipped at the right edge.
  const priceLine=series.createPriceLine({price: candles[candles.length-1].close, color: CHART_THEME.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: ""});
  chartRef.current={chart,series,priceLine};
  const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width)chart.applyOptions({width:Math.floor(width),height:Math.floor(entries[0].contentRect.height)||320});});
  observer.observe(node);
  return ()=>{observer.disconnect();chartRef.current=null;chart.remove();};
 },[candles,compactTrade,chartOpen,chartNode]);

 // The live last trade drives the synced price line. Applied as an update (never
 // a chart rebuild) and throttled to animation cadence so a fast tape cannot
 // re-render the terminal on every tick.
 useEffect(()=>{
  if(!chartRef.current||lastTradePrice===null)return;
  const frame=window.requestAnimationFrame(()=>{
   try{chartRef.current?.series.applyOptions({priceLineColor:CHART_THEME.text,lastValueVisible:true});chartRef.current?.priceLine.applyOptions({price:lastTradePrice});}catch{}
  });
  return ()=>window.cancelAnimationFrame(frame);
 },[lastTradePrice]);

 const orderInputsValid=/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)&&/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)&&compareDecimalStrings(price,"0")===1&&compareDecimalStrings(quantity,"0")===1;
 const requiredBalance=side==="buy"?multiplyDecimalStrings(price,quantity):quantity;
 const availableBalance=availableBalances[side==="buy"?"USDT":base]?.free;
 const balanceComparison=requiredBalance&&availableBalance!==undefined?compareDecimalStrings(String(availableBalance),requiredBalance):undefined;
 const insufficientBalance=balanceComparison!==undefined&&balanceComparison<0;
 const balanceUnavailable=balanceComparison===undefined;
 /**
  * Pre-trade confirmation policy lives in its own module (see
  * orderConfirmPolicy.ts) so the thresholds are testable in isolation.
  */
 const submitOrder=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(orderType!=="limit"){setError("Market orders are not supported by the current trading contract. No order was sent.");return;}
  if(pendingIntentInvalid){setError("A saved spot order request must be reconciled before another order can be placed.");return;}
  if((!ticker||marketSnapshotStale)&&!pendingIntent){setError("A fresh timestamped market snapshot is required before placing a new order. No order was sent.");return;}
  if(!spotPairEnabled&&!pendingIntent){setError("This spot pair is not enabled by BTCBOX operators. No order was sent.");return;}
  if(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent){setError("Spot order execution is currently disabled by server policy. No order was placed.");return;}
  if(!pendingIntent&&(!orderInputsValid||balanceUnavailable||insufficientBalance)){setError(insufficientBalance?"Insufficient available balance":"Account identity is unavailable. No order was sent.");return;}
  // A retained pending intent is already mid-flight from a previous attempt and
  // must be retried as-is; it never goes through the confirmation dialog again.
  if(pendingIntent){await sendOrder(pendingIntent, false);return;}

  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)||Number(quantity)<=0||!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)||Number(price)<=0){setError("Enter a valid limit price and quantity.");return;}
  if(!pendingStorageKey){setError("Account identity is unavailable. No order was sent.");return;}

  // Decide whether this order warrants an explicit confirmation.
  const notional=Number(price)*Number(quantity);
  const marketPrice=ticker?Number(ticker.price):null;
  const deviationPct=priceDeviationPct(Number(price),marketPrice);
  if(shouldConfirmOrder(notional,deviationPct)){
   setError("");
   setOrderPreview({pair:`${base}/USDT`,side,price:price.trim(),quantity:quantity.trim(),notional,marketPrice,deviationPct});
   return;
  }
  await sendOrder({symbol,side,type:"limit",qty:quantity.trim(),price:price.trim(),client_order_id:window.crypto.randomUUID()},true);
 };
 /**
  * Sends a prepared order. `persistIntent` is true only for a newly built
  * request; a retried pending intent is already persisted and must not be
  * re-staged, otherwise the idempotency key would be rewritten.
  */
 const sendOrder=async(intent:Parameters<typeof submitSpotOrder>[0],persistIntent:boolean)=>{
  if(persistIntent){
   if(!pendingStorageKey){setError("Account identity is unavailable. No order was sent.");return;}
   try{window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent));}
   catch{setError("This browser cannot safely save the order request. No order was sent.");return;}
   setPendingIntent(intent);
  }
  // 纸面交易引擎：客户端即时成交并记录订单（演示账户）
  if(persistIntent){
   const paperPrice=Number(intent.price);
   const paperQty=Number(intent.qty);
   const result=placeSpotOrder({symbol,base,side:intent.side,type:"limit",price:paperPrice,quantity:paperQty});
   if(!result.ok){setPaperToast(result.reason||t("Order not filled"));return;}
   setPaperToast(`${t("Filled")}: ${intent.side==="buy"?t("Buy"):t("Sell")} ${paperQty} ${base} @ ${paperPrice}`);
   setQuantity("");
   window.setTimeout(()=>setPaperToast(""),2600);
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
 const amountText=(value:unknown)=>value===null||value===undefined||value===""?"—":Number.isFinite(Number(value))?Number(value).toLocaleString(localeTags[language],{maximumFractionDigits:8}):String(value);
 const adjustPrice=(direction:number)=>{const raw=price||String(displayTicker?.price??"");const current=Number(raw);if(!Number.isFinite(current)||current<=0)return;const decimals=Math.min(8,Math.max(2,(raw.split(".")[1]||"").length));const step=10**-decimals;setPrice(Math.max(0,current+direction*step).toFixed(decimals));};
 // Quantity stepper (spec §27). It only nudges the displayed string by one unit
 // of the value's own precision — the authoritative precision and minimum-order
 // limits are still enforced by the existing submit validation.
 const adjustQuantity=(direction:number)=>{
  const raw=quantity;
  const decimals=Math.min(8,(raw.split(".")[1]||"").length);
  const current=Number(raw||"0");
  if(!Number.isFinite(current))return;
  const next=Math.max(0,current+direction*10**-decimals);
  setQuantity(next>0?next.toFixed(Math.max(decimals,0)).replace(/\.?0+$/,""):"");
 };
 // Six levels per side in both presentations (phone and desktop), matching the
 // professional exchange layout: 6 asks + mid + 6 bids.
 const aggregateLevelsForBook=(rows:Array<[string|number,string|number]>,bookSide:"ask"|"bid")=>aggregateLevels(rows,bookSide,Number(effectiveDepthPrecision),6);
 const openOrders=orders.filter(item=>["open","partially_filled","partially-filled","pending"].includes(String(item.status||"").toLowerCase()));
 const asks=aggregateLevelsForBook(displayBook?.asks||[],"ask").reverse();const bids=aggregateLevelsForBook(displayBook?.bids||[],"bid");
 const cumulativeOf=(rows:Array<[string,string]>,fromTop:boolean)=>{let acc=0;const out:number[]=new Array(rows.length).fill(0);const order=fromTop?rows.map((_,i)=>i):rows.map((_,i)=>i).reverse();for(const i of order){acc+=Number(rows[i][1])||0;out[i]=acc;}return out;};
 const askCumulative=cumulativeOf(asks,false);const bidCumulative=cumulativeOf(bids,true);
 // Relative cumulative displayed depth only; never used for order sizing or financial validation.
 const depthWidths=(rows:Array<[string|number,string|number]>,fromBottom=false)=>{
  const sizes=rows.map(row=>{const n=Number(row[1]);return Number.isFinite(n)&&n>0?n:0;});
  const max=Math.max(0,...sizes);
  const scaled=sizes.map(n=>max?n/max:0),total=scaled.reduce((sum,n)=>sum+n,0);
  let cumulative=0;const widths=scaled.map(()=>0);
  const indices=scaled.map((_,i)=>i);if(fromBottom)indices.reverse();
  for(const i of indices){cumulative+=scaled[i];widths[i]=total?Math.min(100,cumulative/total*100):0;}
  return widths;
 };
 const askDepth=depthWidths(asks),bidDepth=depthWidths(bids);
 const chartPanel=(<Card aria-label={t("Price chart")} id="trade-chart" className="exchange-chart scroll-mt-16 border-brand-border bg-brand-surface"><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3"><div><CardTitle>{t("Price chart")}</CardTitle><CardDescription>{symbol} · {chartInterval}</CardDescription></div><div className="flex flex-wrap gap-1" aria-label={t("Chart")}>{["1m","5m","1h","1d"].map(interval=><Button key={interval} type="button" size="sm" variant={chartInterval===interval?"secondary":"ghost"} aria-pressed={chartInterval===interval} onClick={()=>setChartInterval(interval)}>{interval}</Button>)}</div></CardHeader><CardContent><div ref={setChartNode} className="trade-candles min-h-[320px] w-full">{!candles.length&&!loading?<p className="p-5 text-sm text-brand-text-muted">{t("No verified candle data is available for this market.")}</p>:null}</div></CardContent></Card>);
 // ---------------------------------------------------------------------------
 // Desktop trading terminal (>=1280px)
 //
 // A strict three-column terminal locked to the viewport height, matching the
 // information density of tier-1 exchanges:
 //   left  58%  ticker bar → K-line → collapsible orders/history/assets panel
 //   middle 20% order book + recent trades
 //   right  22% order form (buy/sell, limit/market, balance, slider)
 // Below this breakpoint the existing mobile/compact flow is untouched.
 // ---------------------------------------------------------------------------
 const isAuthenticated=authStatus==="authenticated";
 const tradingInactive=!!tradingStatus&&tradingStatus.spot_order_entry_enabled!==true;
 const staleSnapshot=!!ticker&&marketSnapshotStale;
 const bannerKey=[effectiveMarketFeedWarning,chartFeedWarning,tradingInactive?"engine":"",staleSnapshot?"stale":""].join("|");
 const bannerVisible=(effectiveMarketFeedWarning||chartFeedWarning||tradingInactive||staleSnapshot)&&!dismissedBanners.includes(bannerKey);
 const bannerText=[effectiveMarketFeedWarning,chartFeedWarning,staleSnapshot?t("Market snapshot is older than 90 seconds. Quotes and new order entry are disabled until fresh data arrives."):"",tradingInactive?t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled."):""].filter(Boolean).join(" · ");
 const bannerDismissed=!bannerVisible&&dismissedBanners.includes(bannerKey);
 const orderHistory=orders.filter(item=>!["open","partially_filled","partially-filled","pending"].includes(String(item.status||"").toLowerCase()));
 // Executed orders only. Derived from the same authenticated `/api/orders`
 // payload — the fills tab never invents a trade or a fee.
 const filledOrders=orderHistory.filter(item=>["filled","completed","partially_filled","partially-filled"].includes(String(item.status||"").toLowerCase()));
 const entryDisabledReason=!tradingStatus?t("Spot execution status is unavailable. Order entry is disabled."):tradingInactive?t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled."):staleSnapshot?t("Market snapshot is older than 90 seconds. Quotes and new order entry are disabled until fresh data arrives."):!spotPairEnabled?t("This spot market is not enabled by BTCBOX operators."):"";
 const pickBookPrice=(nextPrice:string)=>{
    // Format with the SAME precision the book is displaying, so picking a level
    // never changes how many decimals the limit input shows ("62576.01" vs "62572").
    const decimals = DECIMALS_BY_PRECISION[effectiveDepthPrecision];
    setPrice(Number(nextPrice).toFixed(decimals));
    setIsPriceManual(true);
    setOrderSizePercent(0);
  };
 const terminalChart=(
  <section className="term-chart" aria-label={t("Price chart")}>
   <div className="term-panel-head">
    <span className="term-panel-title">{base}/USDT <span className="text-brand-text-muted">· {t("Price chart")}</span></span>
    <div className="term-chart-toolbar" role="group" aria-label={t("Chart")}>
     {["1m","5m","15m","1h","4h","1d"].map(interval=><button key={interval} type="button" aria-pressed={chartInterval===interval} onClick={()=>setChartInterval(interval)}>{interval}</button>)}
    </div>
   </div>
   <div className="term-chart-body">
    <div ref={setChartNode} className="trade-candles h-full w-full">{!candles.length&&!loading?<p className="p-5 text-[12px] text-brand-text-muted">{t("No verified candle data is available for this market.")}</p>:null}</div>
   </div>
  </section>
 );
 const bottomTabs=[
  ["orders",t("Open orders")+" ("+openOrders.length+")"],
  ["history",t("Order history")],
  ["fills",t("Trade history")],
  ["assets",t("Assets")],
 ] as const;
 const renderBottomBody=()=>{
  if(bottomTab==="orders")return <div id="trade-orders-body" className="term-tab-body">{openOrders.length?openOrders.map((item,index)=>{const id=String(item.order_id??item.id??index);return <div key={id} className="spot-order-row"><div className="spot-order-summary"><p className="font-semibold">{item.symbol||symbol} · {item.side==="buy"?t("Buy"):item.side==="sell"?t("Sell"):item.side||"—"} · <span className="tabular-nums">{amountText(item.price)}</span></p><p className="spot-order-values">{t("Remaining")} <span className="font-mono tabular-nums">{amountText(item.remaining_quantity??item.quantity)}</span></p><Badge variant="outline">{item.status}</Badge></div><Button size="sm" variant="outline" disabled={busy||!tradingStatus?.spot_cancel_enabled} onClick={()=>void cancelOrder(item)}>{cancelRequestIds[id]?t("Retry cancel"):t("Cancel")}</Button></div>;}):<p className="spot-orders-empty text-[12px] text-brand-text-muted">{isAuthenticated?t("Open orders will appear here once submitted and before they fill."):t("Sign in to view open orders.")}</p>}</div>;
  if(bottomTab==="history")return <div className="term-tab-body">{orderHistory.length?orderHistory.slice(0,40).map((item,index)=>{const id=String(item.order_id??item.id??index);return <div key={id} className="spot-order-row"><div className="spot-order-summary"><p className="font-semibold">{item.symbol||symbol} · {item.side==="buy"?t("Buy"):item.side==="sell"?t("Sell"):item.side||"—"} · <span className="tabular-nums">{amountText(item.price)}</span></p><p className="spot-order-values">{t("Quantity")} <span className="font-mono tabular-nums">{amountText(item.quantity)}</span></p><Badge variant="outline">{item.status}</Badge></div></div>;}):<p className="spot-orders-empty text-[12px] text-brand-text-muted">{isAuthenticated?t("Filled and cancelled orders will appear here."):t("Sign in to view order history.")}</p>}<div className="pt-2"><Link to="/orders" className="text-[12px] font-semibold text-brand-accent hover:underline">{t("Order history")} →</Link></div></div>;
  if(bottomTab==="fills")return <div className="term-tab-body">{filledOrders.length?filledOrders.slice(0,40).map((item,index)=>{const id=String(item.order_id??item.id??index);const filled=item.quantity!==undefined&&item.remaining_quantity!==undefined?String(Number(item.quantity)-Number(item.remaining_quantity)):item.quantity;return <div key={id} className="spot-order-row"><div className="spot-order-summary"><p className="font-semibold">{item.symbol||symbol} · {item.side==="buy"?t("Buy"):item.side==="sell"?t("Sell"):item.side||"—"} · <span className="tabular-nums">{amountText(item.price)}</span></p><p className="spot-order-values">{t("Filled")} <span className="font-mono tabular-nums">{filled!==undefined&&filled!==null&&Number.isFinite(Number(filled))?amountText(filled):"—"}</span></p><Badge variant="outline">{item.status}</Badge></div></div>;}):<p className="spot-orders-empty text-[12px] text-brand-text-muted">{isAuthenticated?t("Filled trades will appear here once your orders execute."):t("Sign in to view your trade history.")}</p>}<div className="pt-2"><Link to="/orders" className="text-[12px] font-semibold text-brand-accent hover:underline">{t("Trade history")} →</Link></div></div>;
  return <div className="spot-asset-strip term-tab-body"><div><span>{t("Available")} · {base}</span><strong>{availableBalances[base]?.free!==undefined?amountText(availableBalances[base].free):"—"}</strong></div><div><span>{t("Available")} · USDT</span><strong>{availableBalances.USDT?.free!==undefined?amountText(availableBalances.USDT.free):"—"}</strong></div><Link to="/assets">{t("View assets")}</Link></div>;
 };
 const proTerminal=<>
  <div className="spot-terminal spot-terminal--pro tone-trading">
   {/* No product tabs here: the global header already renders Spot / Perpetual /
       Seconds / Earn directly above this terminal, so repeating them consumed a
       full 34px row of viewport-locked trading space. */}
   <header className="term-top">
    <div className="term-top-id">
     {/* Pair switcher. Without it the terminal was pinned to whatever symbol the
        URL contained, with no way to change markets. */}
     <button
      type="button"
      className="term-top-pair term-top-pair--button"
      aria-haspopup="dialog"
      aria-expanded={pairPickerOpen}
      aria-label={t("Select market")}
      onClick={()=>setPairPickerOpen(true)}
      disabled={pairSymbols.length===0}
     >
      {base}/USDT
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true"/>
     </button>
     <PriceBadge className="spot-quote-chg" value={displayTicker?displayTicker.chg:null} unit="percent" decimals={2} ariaLabel={t("24h change")} />
    </div>
    <span className="term-top-price font-mono tabular-nums"><span key={displayTicker?amountText(displayTicker.price):"—"} className={"inline-block anim-price-tick "+(Number(ticker?.chg||0)>=0?"text-profit":"text-loss")}>{displayTicker?amountText(displayTicker.price):"—"}</span></span>
    <div className="term-top-stats">
     <div><span>{t("24h high")}</span><b>{displayTicker?amountText(displayTicker.high):"—"}</b></div>
     <div><span>{t("24h low")}</span><b>{displayTicker?amountText(displayTicker.low):"—"}</b></div>
     <div><span>{t("24h volume")}</span><b>{displayTicker&&displayTicker.vol!==undefined&&displayTicker.vol!==null?amountText(displayTicker.vol):"—"}</b></div>
    </div>
    <div className="term-top-links">
     <Link to="/assets" className="term-top-link"><Wallet className="h-3.5 w-3.5" aria-hidden="true"/>{t("Assets")}</Link>
     <Link to="/orders" className="term-top-link"><History className="h-3.5 w-3.5" aria-hidden="true"/>{t("Order history")}</Link>
     {/* Sign-in / registration deliberately absent: the global header owns those
        actions, and showing them twice put two competing CTAs next to the
        ticker. */}
    </div>
   </header>
   {/* Market-data outage: distinct from the policy banner below. A trader must
       be able to tell "the server refused orders" apart from "the price feed is
       down", so this state gets its own colour, its own retry and no dismissal
       (a stale screen should not be permanently silent). */}
   {marketUnavailable?<div className="term-feeddown" role="alert">
    <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true"/>
    <span className="min-w-0 flex-1">{t("行情连接已断开，暂时无法获取最新价格。请稍后重试。")}</span>
    <button type="button" className="term-feeddown-retry" onClick={()=>setRefreshTick(value=>value+1)}>
     <RefreshCw className="h-3.5 w-3.5" aria-hidden="true"/>{t("Retry")}
    </button>
   </div>:null}
   {bannerVisible?<div className="term-banner" role="status"><ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 flex-1">{bannerText}</span>
    {/* The notice reports a server-side policy, not a per-account permission,
        so the action links to the real explanation instead of implying the
        user can unlock trading themselves. */}
    <Link to="/support" className="term-banner-action">{t("Details")}</Link>
    <button type="button" className="term-banner-close" aria-label={t("Dismiss")} onClick={()=>setDismissedBanners(current=>[...current,bannerKey])}>×</button></div>:null}
   {bannerDismissed?<div className="term-banner-reopen"><ShieldAlert className="h-3.5 w-3.5" aria-hidden="true"/><span>{t("System notices hidden")}</span><button type="button" onClick={()=>setDismissedBanners(current=>current.filter(key=>key!==bannerKey))}>{t("Expand")}</button></div>:null}
   <div className={"term-layout"+(pairRailOpen?"":" is-rail-collapsed")}>
    {/* Binance-style market rail: always visible on wide screens so switching
        pairs is one click, with search for long lists. Collapses to a narrow
        strip to give the chart full width when the trader is focused. */}
    <aside className="term-col term-col--pairs" aria-label={t("Markets")} data-open={pairRailOpen?"true":"false"}>
     <button type="button" className="term-rail-toggle" aria-expanded={pairRailOpen} aria-label={pairRailOpen?t("Collapse market list"):t("Expand market list")} title={pairRailOpen?t("Collapse market list"):t("Expand market list")} onClick={()=>setPairRailOpen(value=>!value)}>
      {pairRailOpen?<ChevronsLeft className="h-3.5 w-3.5"/>:<ChevronsRight className="h-3.5 w-3.5"/>}
     </button>
     {pairRailOpen?<>
      <div className="term-rail-search">
       <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>
       <input type="search" value={marketFilter} onChange={event=>setMarketFilter(event.target.value)} placeholder={t("Search")} aria-label={t("Search BTCBOX")}/>
      </div>
      <div className="term-rail-head"><span>{t("Pair")}</span><span className="text-right">{t("Last price")}</span><span className="text-right">24h</span></div>
      <div className="term-rail-list">
       {(()=>{
        const query=marketFilter.trim().toUpperCase();
        const rows=marketList.filter(item=>!query||item.sym.toUpperCase().includes(query));
        if(!rows.length)return <p className="term-rail-empty">{t("No matching markets.")}</p>;
        return rows.map(item=>{
         const isActive=item.sym.toUpperCase()===base.toUpperCase();
         const up=Number(item.chg)>=0;
         return <button key={item.sym} type="button" className={"term-rail-row"+(isActive?" is-active":"")} aria-current={isActive?"true":undefined} onClick={()=>{if(!isActive)navigate(`/trade/${item.sym}USDT`);}}>
          <span className="term-rail-pair">{item.sym}<span className="term-rail-quote">/USDT</span></span>
          <span className="term-rail-price">{amountText(item.price)}</span>
          <span className={"term-rail-chg "+(up?"text-profit":"text-loss")}>{up?"+":""}{Number(item.chg).toFixed(2)}%</span>
         </button>;
        });
       })()}
      </div>
     </>:null}
    </aside>
    <div className="term-col term-col--main">
     {terminalChart}
     <section id="trade-orders" className="term-bottom" aria-label={t("Trading details")}>
      <BottomOrderPanel
       className="term-bottom-panel"
       ariaLabel={t("Trading details")}
       tabs={bottomTabs.map(([key,label])=>({key,label}))}
       active={bottomTab}
       onActiveChange={(key)=>{setBottomTab(key as typeof bottomTab);setOrdersExpanded(true);}}
       expanded={ordersExpanded}
       onToggle={()=>setOrdersExpanded(value=>!value)}
      >
       {renderBottomBody()}
      </BottomOrderPanel>
     </section>
    </div>
    <section className={"term-col term-col--book"+(bookExpanded?" is-expanded":"")} aria-label={t("Order book")}>
     {/* Desktop-only: gives the depth ladder the whole column when a trader
         wants to read thickness rather than the tape. Pure layout, no data
         change. */}
     <button type="button" className="term-book-expand" aria-pressed={bookExpanded} aria-label={bookExpanded?t("Collapse order book"):t("Expand order book")} title={bookExpanded?t("Collapse order book"):t("Expand order book")} onClick={()=>setBookExpanded(value=>!value)}>
      {bookExpanded?<ChevronsRight className="h-3.5 w-3.5"/>:<ChevronsLeft className="h-3.5 w-3.5"/>}
     </button>
     <TerminalOrderBook
      book={displayBook}
      lastPrice={displayTicker?amountText(displayTicker.price):""}
      changePercent={Number(ticker?.chg||0)}
      precision={effectiveDepthPrecision}
      onPrecisionChange={value=>setDepthPrecision(value)}
      view={bookView as BookView}
      onViewChange={value=>setBookView(value)}
      onPickPrice={pickBookPrice}
      usdtUsd={usdtUsd}
      rows={6}
     />
     <div className="term-rt">
      <TradesPanel symbol={symbol} />
     </div>
    </section>
    <aside id="trade-entry" className="term-col term-col--entry" aria-label={t("Order form")}>
     <TerminalOrderForm
      base={base}
      side={side}
      onSideChange={setSide}
      orderType={orderType as OrderType}
      onOrderTypeChange={value=>setOrderType(value)}
      price={price}
      onPriceChange={value=>{setPrice(value);setIsPriceManual(true);}}
      quantity={quantity}
      onQuantityChange={value=>{setQuantity(value);setOrderSizePercent(0);}}
      availableBalance={availableBalances[side==="buy"?"USDT":base]?.free}
      availableAsset={side==="buy"?"USDT":base}
      isAuthenticated={isAuthenticated}
      orderEntryEnabled={tradingStatus?tradingStatus.spot_order_entry_enabled:null}
      disabledReason={entryDisabledReason}
      busy={busy}
      pendingRequestId={pendingIntent?.client_order_id||""}
      pendingIntentInvalid={pendingIntentInvalid}
      onSubmit={()=>void submitOrder({preventDefault(){}} as FormEvent<HTMLFormElement>)}
      sliderValue={orderSizePercent}
      onSliderChange={setOrderSizePercent}
      onRequestSignIn={()=>openAuthDialog("login")}
     />
    </aside>
   </div>
   {/* Spot pair switcher. Lists only the pairs the backend says are enabled, so
   {/* Spot pair switcher. Lists only the pairs the backend says are enabled, so
       nothing here can route to a market the exchange does not serve. Shares the
       same dialog component as the perpetual page. */}
   <MarketPickerDialog
    open={pairPickerOpen}
    onOpenChange={setPairPickerOpen}
    description={t("Choose a spot trading pair")}
    emptyLabel={pairSymbols.length?t("No matching markets."):t("No spot markets are currently enabled.")}
    activeId={symbol}
    items={pairSymbols.map(pair=>{
     const ticker=marketList.find(item=>`${item.sym}USDT`===pair)||marketList.find(item=>item.sym===pair);
     return {
      id:pair,
      label:`${pair.replace(/USDT$/,"")}/USDT`,
      price:ticker?amountText(ticker.price):null,
      changePct:ticker&&Number.isFinite(Number(ticker.chg))?Number(ticker.chg):null,
     };
    })}
    onSelect={(pair)=>navigate(`/trade/${pair}`)}
   />
  </div>
 </>;
 // Two presentations of the same trading state:
 // - `proTerminal`: the viewport-locked three-column terminal (desktop only).
 // - `compactTerminal`: the document-flow layout used below 1280px, where the
 //   order form, order book and chart drawer stack per the mobile design board.
 // One `<Dialog.Root>` renders either presentation, so the chart drawer, focus
 // return and overlay stay identical across breakpoints.
 const compactTerminal=<PageFrame title={symbol} className="spot-terminal" tone="trading">
  <TradeProductNav />
  {error?<div role="alert" className="rounded-xl border border-brand-danger/30 bg-brand-danger/5 p-3 text-sm text-brand-danger">{t(error)}</div>:null}{effectiveMarketFeedWarning?<div role="status" className="rounded-xl border border-brand-warning/25 bg-brand-warning/5 p-3 text-sm text-brand-warning">{t(effectiveMarketFeedWarning)}</div>:null}{chartFeedWarning?<div role="status" className="rounded-xl border border-brand-warning/25 bg-brand-warning/5 p-3 text-sm text-brand-warning">{t(chartFeedWarning)}</div>:null}{notice?<div role="status" className="rounded-xl border border-brand-success/25 bg-brand-success/5 p-3 text-sm text-brand-success">{t(notice)}</div>:null}
  <div className="spot-quote-strip">
   <div className="spot-quote-main">
    <button type="button" onClick={()=>setPairPickerOpen(true)} aria-haspopup="dialog" aria-expanded={pairPickerOpen} aria-label={t("Select market")}
      className="spot-quote-pair inline-flex items-center gap-1 rounded transition-colors hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40">
      {base}/USDT<ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>
    </button>
    <span className="spot-quote-badge">{t("Spot")}</span>
    <span className={"spot-quote-price font-mono tabular-nums "+(Number(ticker?.chg||0)>=0?"text-profit":"text-loss")}>{displayTicker?amountText(displayTicker.price):"—"}</span>
    {displayTicker ? <PriceBadge className="spot-quote-chg" value={displayTicker.chg} unit="percent" decimals={2} ariaLabel={t("24h change") + " " + Number(displayTicker.chg).toFixed(2) + "%"} /> : null}
   </div>
   <div className="spot-quote-meta font-mono tabular-nums"><span>{t("24h high")} <b>{displayTicker?amountText(displayTicker.high):"—"}</b></span><span>{t("24h low")} <b>{displayTicker?amountText(displayTicker.low):"—"}</b></span><Button id="trade-chart-open" ref={chartTrigger} type="button" size="sm" variant="ghost" aria-label={t("Price chart")} onClick={()=>setChartOpen(true)} className="ml-auto h-7 w-7 shrink-0 p-0 text-brand-text-muted"><ChartNoAxesCombined className="h-4 w-4"/></Button></div>
  </div>
  {/* Pair switcher for the compact (document-flow) terminal. The desktop
      terminal mounts its own copy; both read the same enabled-pair list so a
      phone user can change market without going back to /markets. */}
  <MarketPickerDialog
   open={pairPickerOpen}
   onOpenChange={setPairPickerOpen}
   description={t("Choose a spot trading pair")}
   emptyLabel={pairSymbols.length?t("No matching markets."):t("No spot markets are currently enabled.")}
   activeId={symbol}
   items={pairSymbols.map(pair=>{
    const ticker=marketList.find(item=>`${item.sym}USDT`===pair)||marketList.find(item=>item.sym===pair);
    return {
     id:pair,
     label:`${pair.replace(/USDT$/,"")}/USDT`,
     price:ticker?amountText(ticker.price):null,
     changePct:ticker&&Number.isFinite(Number(ticker.chg))?Number(ticker.chg):null,
    };
   })}
   onSelect={(pair)=>navigate(`/trade/${pair}`)}
  />
  {/* Mobile trade tabs — design board Trade screen: Buy | Sell | Order book.
     Only one panel is mounted at a time on phones; desktop keeps its grid. */}
  <div className="spot-mobile-tabs" role="tablist" aria-label={t("Trading panel")} data-active={mobilePanel}>
   {([
    ["buy",t("Buy")],
    ["sell",t("Sell")],
    ["book",t("Order book")],
   ] as const).map(([key,label])=>
    <button key={key} type="button" role="tab" aria-selected={mobilePanel===key} aria-controls="trade-workspace" className={mobilePanel===key?"is-active":""} onClick={()=>{setMobilePanel(key);if(key!=="book")setSide(key);}}>{label}</button>
   )}
  </div>
  <div className="exchange-workspace" id="trade-workspace" data-mobile-panel={isPhone?mobilePanel:"all"}>
    {/* Desktop inline chart (spec §3): the central column owns the candles.
        Phones never mount it inline — they use the safe-area drawer instead, so
        only one `setChartNode` target exists at a time. */}
    {!compactTrade&&!isPhone?!chartOpen&&chartPanel:null}
    <Card aria-label={t("Order book")} id="trade-depth" className="exchange-depth scroll-mt-16 border-brand-border bg-brand-surface"><CardContent className="spot-depth-content space-y-1.5"><div className="spot-book-toolbar spot-book-toolbar--top"><label><span className="sr-only">{t("Depth precision")}</span><select aria-label={t("Depth precision")} value={effectiveDepthPrecision} onChange={event=>setDepthPrecision(event.target.value as DepthPrecision)}>{pairPrecisionOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></label><div className="spot-book-view" role="group" aria-label={t("Order book")}><button type="button" aria-label={t("Both sides")} aria-pressed={bookView==="both"} onClick={()=>setBookView("both")}><Columns2 className="h-3.5 w-3.5"/></button><button type="button" aria-label={t("Bids only")} aria-pressed={bookView==="bids"} onClick={()=>setBookView("bids")}><TrendingUp className="h-3.5 w-3.5"/></button><button type="button" aria-label={t("Asks only")} aria-pressed={bookView==="asks"} onClick={()=>setBookView("asks")}><TrendingDown className="h-3.5 w-3.5"/></button></div></div>{displayBook?<><div className="spot-book-columns"><span>{t("Price")}</span><span>{t("Quantity")}</span><span className="spot-book-cum"></span></div><div className="exchange-book-levels"><div className={bookView==="bids"?"hidden":""}>{asks.length?asks.map((row,index)=><div key={index} className="spot-book-row spot-book-row--click font-mono tabular-nums cursor-pointer" data-side="ask" style={{backgroundSize:askDepth[index]+"% 100%"}} onClick={()=>{setPrice(String(row[0]));setSide("buy");setIsPriceManual(true);}}><span title={String(row[0])} className="text-right text-loss">{amountText(row[0])}</span><span title={String(row[1])} className="text-right text-brand-text-muted">{amountText(row[1])}</span><span className="spot-book-cum text-right text-brand-text-muted">{amountText(askCumulative[index])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div><p className="spot-mid-price font-mono tabular-nums"><span className={"inline-flex items-center gap-1 "+(Number(ticker?.chg||0)>=0?"text-profit":"text-loss")}>{Number(ticker?.chg||0)>=0?<TrendingUp className="h-4 w-4"/>:<TrendingDown className="h-4 w-4"/>}<span key={displayTicker?amountText(displayTicker.price):"—"} className="inline-block anim-price-tick font-bold">{displayTicker?amountText(displayTicker.price):"—"}</span></span></p><div className={bookView==="asks"?"hidden":""}>{bids.length?bids.map((row,index)=><div key={index} className="spot-book-row spot-book-row--click font-mono tabular-nums cursor-pointer" data-side="bid" style={{backgroundSize:bidDepth[index]+"% 100%"}} onClick={()=>{setPrice(String(row[0]));setSide("sell");setIsPriceManual(true);}}><span title={String(row[0])} className="text-right text-profit">{amountText(row[0])}</span><span title={String(row[1])} className="text-right text-brand-text-muted">{amountText(row[1])}</span><span className="spot-book-cum text-right text-brand-text-muted">{amountText(bidCumulative[index])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div></div></>:<div className="space-y-1.5 py-2" role="status" aria-label={t("Loading order book")}>{[0,1,2,3,4,5,6,7].map(i=><div key={i} className="h-5 animate-pulse rounded bg-brand-surface-2"/>)}</div>}</CardContent></Card>
    <Card id="trade-entry" className="exchange-entry scroll-mt-16 border-brand-border bg-brand-surface"><CardHeader className="spot-entry-head"><div className="spot-side grid grid-cols-2 gap-1.5"><Button aria-pressed={side==="buy"} variant={side==="buy"?"default":"outline"} onClick={()=>setSide("buy")} disabled={busy||!!pendingIntent||pendingIntentInvalid}>{t("Buy")}</Button><Button aria-pressed={side==="sell"} variant={side==="sell"?"destructive":"outline"} onClick={()=>setSide("sell")} disabled={busy||!!pendingIntent}>{t("Sell")}</Button></div></CardHeader><CardContent className="space-y-2"><label className="spot-order-type"><span className="sr-only">{t("Order type")}</span><select aria-label={t("Order type")} value={orderType} disabled={busy||!!pendingIntent} onChange={event=>setOrderType(event.target.value as "limit"|"market")}><option value="limit">{t("Limit order")}</option><option value="market">{t("Market order")}</option></select></label>{orderType==="market"?<div className="spot-policy">{t("Market orders are unavailable under the current trading contract. Switch to limit order to continue.")}</div>:null}<p className="spot-available"><span>{t("Available balance")}</span><strong>{availableBalances[side==="buy"?"USDT":base]?.free!==undefined?formatDecimalAmount(availableBalances[side==="buy"?"USDT":base].free,localeTags[language]):"—"} {side==="buy"?"USDT":base}</strong></p><form className="space-y-2" onSubmit={event=>void submitOrder(event)}><label className="block space-y-1 text-sm"><span>{t("Limit price (USDT)")}</span><div className="spot-price-control"><button type="button" aria-label={t("Decrease price")} disabled={busy||!!pendingIntent} onClick={()=>adjustPrice(-1)}><Minus className="h-3.5 w-3.5"/></button><input aria-label={t("Limit price (USDT)")} value={price} onChange={event=>setPrice(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" required/><button type="button" aria-label={t("Increase price")} disabled={busy||!!pendingIntent} onClick={()=>adjustPrice(1)}><Plus className="h-3.5 w-3.5"/></button></div></label><div className="spot-quick-prices grid grid-cols-5 gap-1">{[-1,-0.5,0,0.5,1].map(pct=>{const basePx=Number(displayTicker?.price||0);const px=basePx*(1+pct/100);const dec=Math.min(8,Math.max(2,(String(displayTicker?.price||"1").split(".")[1]||"").length));return <button key={pct} type="button" disabled={busy||!!pendingIntent||!basePx} onClick={()=>{setPrice(px.toFixed(dec));setIsPriceManual(true);}} className="min-h-7 rounded-md border border-brand-border bg-brand-surface-2 text-[10px] font-semibold tabular-nums text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-50">{pct===0?t("Latest"):(pct>0?"+":"")+pct+"%"}</button>;})}</div><label className="block space-y-1 text-sm"><span>{t("Quantity")} · {base}</span><div className="spot-qty-control"><button type="button" aria-label={t("Decrease quantity")} disabled={busy||!!pendingIntent} onClick={()=>adjustQuantity(-1)}><Minus className="h-3.5 w-3.5"/></button><input aria-label={t("Quantity")+" · "+base} value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" required/><button type="button" aria-label={t("Increase quantity")} disabled={busy||!!pendingIntent} onClick={()=>adjustQuantity(1)}><Plus className="h-3.5 w-3.5"/></button></div></label><div className="grid grid-cols-4 gap-1">{[25,50,75,100].map(pct=><button key={pct} type="button" disabled={busy||!!pendingIntent} onClick={()=>{const free=Number(availableBalances[side==="buy"?"USDT":base]?.free||0);const px=Number(price);if(side==="buy"&&px>0)setQuantity(((free*pct/100)/px).toFixed(6).replace(/\.?0+$/,""));else if(side==="sell")setQuantity((free*pct/100).toFixed(6).replace(/\.?0+$/,""));}} className="min-h-8 rounded-md border border-brand-border bg-brand-surface-2 text-xs font-semibold tabular-nums text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-50">{pct}%</button>)}</div><p className="spot-total hidden">{t("Estimated total")}: {price&&quantity&&Number(price)>0&&Number(quantity)>0?amountText(multiplyDecimalStrings(price,quantity))+" USDT":"—"}</p>{pendingIntent?<p className="break-all text-xs text-brand-warning">{t("Unconfirmed request ID. Keep the form unchanged and retry with the same ID.")} · {pendingIntent.client_order_id}</p>:null}<Button className={"w-full spot-submit spot-submit--"+side} type="submit" disabled={busy||pendingIntentInvalid||(!pendingIntent&&(!orderInputsValid||balanceUnavailable||insufficientBalance))||(!ticker||marketSnapshotStale)&&!pendingIntent||(!spotPairEnabled&&!pendingIntent)||(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent)||!price||!quantity||orderType!=="limit"}>{busy?t("Submitting…"):pendingIntent?t("Retry same order"):insufficientBalance?t("Insufficient available balance"):side==="buy"?t("Buy")+" "+base:t("Sell")+" "+base}</Button>{!tradingStatus?.spot_order_entry_enabled?<div className="spot-policy hidden">{t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled.")}</div>:null}</form></CardContent></Card>
    <BottomOrderPanel
    id="trade-orders"
    className="exchange-orders scroll-mt-16"
    ariaLabel={t("Trading details")}
    tabs={[{key:"orders",label:`${t("Open orders")} (${openOrders.length})`},{key:"assets",label:t("Current assets")}]}
    active={bottomTab}
    onActiveChange={(key)=>{setBottomTab(key as "orders"|"assets");setOrdersExpanded(v=>bottomTab!==key?true:!v);}}
    expanded={ordersExpanded}
    onToggle={()=>setOrdersExpanded(v=>!v)}
    trailing={<Link to="/orders" aria-label={t("Order history")} title={t("Order history")}><History className="h-4 w-4"/></Link>}
   >{ordersExpanded?(bottomTab==="orders"?<div id="trade-orders-body" className="space-y-1">{openOrders.length?openOrders.map((item,index)=>{const id=String(item.order_id??item.id??index);return <div key={id} className="spot-order-row"><div className="spot-order-summary"><p className="font-semibold">{item.symbol||symbol} · {item.side==="buy"?t("Buy"):item.side==="sell"?t("Sell"):item.side||"—"}</p><p className="spot-order-values">{t("Price")} {amountText(item.price)} · {t("Remaining")} {amountText(item.remaining_quantity??item.quantity)}</p><Badge variant="outline">{item.status}</Badge></div><Button size="sm" variant="outline" disabled={busy||!tradingStatus?.spot_cancel_enabled} onClick={()=>void cancelOrder(item)}>{cancelRequestIds[id]?t("Retry cancel"):t("Cancel")}</Button></div>;}):<p className="spot-orders-empty text-sm text-brand-text-muted">{t("No open orders")}</p>}</div>:<div className="spot-asset-strip"><div><span>{t("Available")} · {base}</span><strong>{availableBalances[base]?.free!==undefined?amountText(availableBalances[base].free):"—"}</strong></div><div><span>{t("Available")} · USDT</span><strong>{availableBalances.USDT?.free!==undefined?amountText(availableBalances.USDT.free):"—"}</strong></div><Link to="/assets">{t("View assets")}</Link></div>):null}</BottomOrderPanel>
  </div>
  {/* 最新成交（成交明细）：放在双栏交易网格之后，避免成为网格的一列 */}
  <section aria-label={t("Recent trades")} className="mt-2 min-w-0">
    <TradesPanel symbol={symbol} limit={6} />
  </section>

 </PageFrame>;
 const terminalBody=compactTrade||isPhone?compactTerminal:proTerminal;
 // Phones use the same bottom-anchored K-line drawer as the perpetual page
 // (65dvh-style sheet pinned above the bottom nav). Tablets/desktop keep the
 // inline chart panel inside their workspace grid.
 if (isPhone) {
  return <><ChartDrawer symbol={symbol} marketType="spot" />{terminalBody}</>;
 }
 return <Dialog.Root open={chartOpen} onOpenChange={setChartOpen}>{terminalBody}<Dialog.Portal><Dialog.Overlay className="spot-chart-overlay"/><Dialog.Content className="spot-chart-drawer" aria-label={t("Price chart")} onCloseAutoFocus={event=>{event.preventDefault();chartTrigger.current?.focus();}}><button type="button" className="spot-chart-close" aria-label="Close chart" onClick={()=>setChartOpen(false)}>×</button>{chartPanel}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function SectionPage({title,description}:{title:string;description:string}){const {t}=useI18n();return <PageFrame title={title} tone="market"><Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-start gap-3 p-4 sm:p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface-2 text-brand-text-muted"><LockKeyhole className="h-5 w-5"/></span><Badge variant="outline" className="shrink-0 border-brand-border text-brand-text-muted">{t("Unavailable")}</Badge><p className="type-body-compact min-w-0 flex-1 text-brand-text-muted">{t("This service is not currently available. Please check back later.")}</p></CardContent></Card></PageFrame>}


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
 const [amount,setAmount]=useState("50");
 const [pendingIntent,setPendingIntent]=useState<SecondsOrderInput|null>(null);
 const [submitting,setSubmitting]=useState(false);
 const [clockNow,setClockNow]=useState(Date.now());
 const settling=useRef(new Set<string>());
 const storageKey=uid?"btcbox.seconds.pending.v1."+uid:"";

 const [interval,setIntervalTab]=useState<"line"|"1m"|"5m"|"15m">("line");
 const [chartNode,setChartNode]=useState<HTMLDivElement|null>(null);
 const [candles,setCandles]=useState<MarketCandle[]>([]);
 const [activeTab,setActiveTab]=useState<"open"|"history">("open");
 const [ticker,setTicker]=useState<MarketTicker|null>(null);
 const [availableUSDT,setAvailableUSDT]=useState<string>("0.00");

 const DURATION_OPTIONS = [
  { sec: 30, rate: 85, label: "30s" },
  { sec: 60, rate: 88, label: "60s" },
  { sec: 180, rate: 90, label: "180s" },
  { sec: 300, rate: 92, label: "300s" },
 ];

 const QUICK_AMOUNTS = [10, 50, 100, 500];

 useEffect(()=>{
  const timer=window.setInterval(()=>setClockNow(Date.now()),1000);
  return ()=>window.clearInterval(timer);
 },[]);

 // 轮询当前币种的最新行情与 USDT 余额
 useEffect(()=>{
  let cancelled = false;
  const loadMarket = () => {
   getMarkets().then(mkts => {
    if (cancelled) return;
    const found = mkts.find(m => m.sym.toUpperCase() === symbol.toUpperCase());
    if (found) setTicker(found);
   }).catch(()=>{});
  };
  loadMarket();
  const timer = window.setInterval(loadMarket, 3000);
  return () => { cancelled = true; window.clearInterval(timer); };
 }, [symbol]);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");setPolicyError("");
  Promise.allSettled([getAccount(controller.signal),getSecondsPositions(controller.signal),getSecondsPolicy(controller.signal)]).then(([accountResult,positionsResult,policyResult])=>{
   if(controller.signal.aborted)return;
   let restoredIntent:SecondsOrderInput|null=null;
   if(accountResult.status==="fulfilled"){
    const nextUid=accountResult.value.uid;
    setUid(nextUid);
    const usdtFree = accountResult.value.balances["USDT"]?.free;
    if (usdtFree !== undefined) setAvailableUSDT(String(usdtFree));
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
   }
   setPendingIntent(restoredIntent);
   if(restoredIntent){setSymbol(restoredIntent.symbol);setDirection(restoredIntent.direction);setDuration(restoredIntent.duration_sec);setAmount(restoredIntent.amount);}
   if(positionsResult.status==="fulfilled")setSnapshot(positionsResult.value);
   if(policyResult.status==="fulfilled"){
    setPolicy(policyResult.value);
   }
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);

 // 渲染中间 K 线 / 分时图表
 useEffect(()=>{
  const node = chartNode;
  if (!node) return;
  let cancelled = false;
  const loadKlines = () => {
   const tf = interval === "line" ? "1m" : interval;
   getKlines(symbol + "USDT", tf).then(rows => {
    if (!cancelled) setCandles(rows);
   }).catch(()=>{});
  };
  loadKlines();
  const timer = window.setInterval(loadKlines, 5000);
  return () => { cancelled = true; window.clearInterval(timer); };
 }, [symbol, interval, chartNode]);

 useEffect(()=>{
  const node = chartNode;
  if (!node || !candles.length || node.clientWidth <= 0) return;
  const chart = createChart(node, {
   width: node.clientWidth,
   height: node.clientHeight || 200,
   handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
   handleScale: { pinch: true },
   layout: { attributionLogo: false, background: { type: ColorType.Solid, color: CHART_THEME.background }, textColor: CHART_THEME.text, fontSize: 10 },
   grid: { vertLines: { color: "rgba(38,52,67,0.3)" }, horzLines: { color: "rgba(38,52,67,0.3)" } },
   rightPriceScale: { borderColor: "rgba(38,52,67,0.5)" },
   timeScale: { borderColor: "rgba(38,52,67,0.5)", timeVisible: true, secondsVisible: false }
  });
  const series = chart.addSeries(CandlestickSeries, {
   upColor: CHART_THEME.up,
   downColor: CHART_THEME.down,
   borderVisible: false,
   wickUpColor: CHART_THEME.up,
   wickDownColor: CHART_THEME.down
  });
  series.setData(candles.map(item => ({
   time: Math.floor(item.time / 1000) as UTCTimestamp,
   open: item.open,
   high: item.high,
   low: item.low,
   close: item.close
  })).sort((a, b) => Number(a.time) - Number(b.time)));
  chart.timeScale().fitContent();
  const observer = new ResizeObserver(entries => {
   const width = entries[0]?.contentRect.width;
   if (width) chart.applyOptions({ width: Math.floor(width) });
  });
  observer.observe(node);
  return () => { observer.disconnect(); chart.remove(); };
 }, [candles, chartNode]);

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

 const refresh=()=>setReload(value=>value+1);
 const clearPending=()=>{
  if(storageKey){
   try{window.localStorage.removeItem(storageKey);}
   catch{setError(t("The saved Seconds request could not be cleared. Keep this request and retry only with the same request ID."));return false;}
  }
  setPendingIntent(null);
  return true;
 };
 const sendIntent=async(intent:SecondsOrderInput)=>{
  if(submitting)return;
  setSubmitting(true);setError("");setNotice("");
  try{
   const result=await submitSecondsOrder(intent);
   const latest=await getSecondsPositions();
   setSnapshot(latest);
   const confirmed=latest.open.some(position=>position.position_id===result.position_id);
   if(!confirmed){
    setError(t("The order response arrived, but the positions list has not confirmed it. Do not create another order; retry this same request."));
    return;
   }
   if(!clearPending())return;
   setNotice(result.duplicate?t("This order was already received and has been confirmed."):t("Order confirmed. Funds are reserved and the position has its own settlement time."));
  }catch(reason){
   setError(reason instanceof Error?reason.message:t("Order status is unconfirmed. Keep this request and retry only with the same request ID."));
  }finally{setSubmitting(false);}
 };
 const retryPendingIntent=()=>{if(pendingIntent)void sendIntent(pendingIntent);};

 const submitSeconds=async(dir: "up" | "down")=>{
  if(submitting)return;
  if(policy?.actions_enabled!==true){
   setError(t("Seconds order entry is currently disabled by server policy."));
   return;
  }
  if(pendingIntent){
   setError(t("An earlier Seconds request is still unconfirmed. Retry the same request before placing a new one."));
   return;
  }
  if(!storageKey){
   setError(t("Account identity is unavailable. No order was sent."));
   return;
  }
  const numeric=Number(amount);
  if(!Number.isFinite(numeric)||numeric<=0){
   setError(t("Enter an amount greater than zero."));return;
  }
  const intent:SecondsOrderInput={
   request_id:window.crypto.randomUUID().replace(/-/g,""),
   symbol,
   direction:dir,
   duration_sec:duration,
   amount:amount.trim()
  };
  try{window.localStorage.setItem(storageKey,JSON.stringify(intent));}
  catch{
   setError(t("This browser cannot safely save the order request. No order was sent."));
   return;
  }
  setPendingIntent(intent);
  await sendIntent(intent);
 };

 const currentRate = DURATION_OPTIONS.find(d => d.sec === duration)?.rate || 85;
 const profitExpect = Number(amount) > 0 ? (Number(amount) * (1 + currentRate / 100)).toFixed(2) : "0.00";
 const openCount = snapshot?.open.length || 0;

 return <PageFrame title={t("Seconds")} className="spot-terminal !gap-1.5 !p-1.5 sm:!p-3" tone="trading">
  {/* The global header already carries the product switcher; repeating it here
      pushed the seconds workspace down by a full row. */}

  {/* 1. 交易对切换与行情条 (完全对齐现货风格) */}
  <div className="flex items-center justify-between px-1 py-1 -mt-0.5">
   <div className="flex items-center gap-2">
    <span className="text-base font-bold text-brand-text tracking-tight flex items-center gap-1.5">
     <span className="text-sm text-brand-text-muted">≡</span>
     {symbol}/USDT
    </span>
    <span className={"text-[10px] font-semibold px-1.5 py-0.5 rounded " + (Number(ticker?.chg||0)>=0?"text-profit bg-profit/10":"text-loss bg-loss/10")}>
     {ticker ? (Number(ticker.chg)>=0?"+":"") + Number(ticker.chg).toFixed(2) + "%" : "—"}
    </span>
   </div>
   <div className="flex items-center gap-1">
    {["BTC","ETH","SOL"].map(coin=><button key={coin} type="button" onClick={()=>setSymbol(coin)} className={"px-2 py-0.5 rounded text-[11px] font-bold transition-colors "+(symbol===coin?"bg-brand-accent/20 text-brand-accent":"text-brand-text-muted hover:text-brand-text")}>{coin}</button>)}
   </div>
  </div>

  {/* 行情卡片 */}
  <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-brand-surface/40 border border-brand-border/40">
   <div className="flex items-baseline gap-2">
    <span className="text-xl font-bold font-mono tracking-tight text-brand-text tabular-nums">
     {ticker ? ticker.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : "—"}
    </span>
    <span className={"text-xs font-bold font-mono tabular-nums " + (Number(ticker?.chg||0) >= 0 ? "text-profit" : "text-loss")}>
     {ticker ? (Number(ticker.chg) >= 0 ? "+" : "") + Number(ticker.chg).toFixed(2) + "%" : "—"}
    </span>
   </div>
   <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
    <div className="flex items-center gap-1.5">
     <span className="text-brand-text-muted">{t("High")}</span>
     <span className="text-brand-text font-medium">{ticker ? Number(ticker.high).toLocaleString() : "—"}</span>
    </div>
    <div className="flex items-center gap-1.5">
     <span className="text-brand-text-muted">{t("Low")}</span>
     <span className="text-brand-text font-medium">{ticker ? Number(ticker.low).toLocaleString() : "—"}</span>
    </div>
   </div>
  </div>

  {notice?<div role="status" className="rounded-lg border border-brand-success/25 bg-brand-success/5 p-1.5 text-xs text-brand-success">{notice}</div>:null}
  {error?<div role="alert" className="rounded-lg border border-brand-danger/25 bg-brand-danger/5 p-1.5 text-xs text-brand-danger">{error}</div>:null}
  {pendingIntent?<div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-warning/30 bg-brand-warning/5 p-2 text-xs text-brand-text"><span>{t("An earlier Seconds request is still unconfirmed. Retry the same request before placing a new one.")}</span><Button type="button" size="sm" variant="outline" disabled={submitting} onClick={retryPendingIntent}>{t("Retry same request")}</Button></div>:null}

  <div className="rounded-xl border border-brand-border bg-brand-surface p-2.5 space-y-2.5">
   {/* 周期选择卡片 */}
   <div>
    <div className="flex justify-between items-center mb-1 text-[11px] text-brand-text-muted">
     <span>{t("Settlement period")}</span>
     <span>{t("Expected return rate")}: <strong className="text-brand-accent font-mono font-bold">+{currentRate}%</strong></span>
    </div>
    <div className="grid grid-cols-4 gap-1.5">
     {DURATION_OPTIONS.map(opt => (
      <button key={opt.sec} type="button" onClick={()=>setDuration(opt.sec)} className={"flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all "+(duration===opt.sec?"border-brand-accent bg-brand-accent/15 text-brand-accent shadow-sm":"border-brand-border/60 bg-brand-surface-2 text-brand-text-secondary hover:border-brand-border-strong")}>
       <span className="font-mono text-xs font-bold">{opt.label}</span>
       <span className="text-[10px] opacity-80">{t("Return")} {opt.rate}%</span>
      </button>
     ))}
    </div>
   </div>

   {/* 投资金额 */}
   <div className="space-y-1.5">
    <div className="flex justify-between items-center text-[11px]">
     <span className="text-brand-text-muted">{t("Investment amount")} (USDT)</span>
     <span className="text-brand-text-muted font-mono">{t("Available")}: <strong className="text-brand-text">{Number(availableUSDT).toFixed(2)}</strong> USDT</span>
    </div>
    <div className="flex items-center rounded-lg border border-brand-border bg-brand-surface-2 h-10 px-3 focus-within:border-brand-accent/60">
     <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={t("Enter investment amount")} className="h-full flex-1 bg-transparent font-mono text-xs text-brand-text outline-none placeholder:text-brand-text-muted" />
     <span className="text-xs font-bold text-brand-text-muted">USDT</span>
    </div>
    <div className="flex items-center gap-1.5">
     {QUICK_AMOUNTS.map(val => (
      <button key={val} type="button" onClick={()=>setAmount(String(val))} className={"h-6 flex-1 rounded border border-brand-border/60 bg-brand-surface-2 text-[11px] font-mono font-medium text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-accent active:bg-brand-surface "+(amount===String(val)?"border-brand-accent text-brand-accent":"")}>
       {val}
      </button>
     ))}
     <button type="button" onClick={()=>setAmount(Number(availableUSDT) > 0 ? String(Math.floor(Number(availableUSDT))) : "100")} className="h-6 px-2.5 rounded border border-brand-border/60 bg-brand-surface-2 text-[11px] font-semibold text-brand-text-muted hover:border-brand-accent/50 hover:text-brand-accent">
       {t("All")}
     </button>
    </div>
   </div>

   {/* 预期收益预览 */}
   <div className="flex items-center justify-between text-xs px-1 text-brand-text-muted">
    <span>{t("Expected principal and interest at expiry")}</span>
    <span className="font-mono font-bold text-sm text-brand-text"><strong className="text-profit">{profitExpect}</strong> USDT</span>
   </div>

   {/* 双色买涨/买跌按钮 */}
   <div className="grid grid-cols-2 gap-2 pt-0.5">
    <button type="button" disabled={submitting||!!pendingIntent} onClick={()=>submitSeconds("up")} className="h-10 rounded-lg bg-profit text-[#05201A] font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-profit/90 active:scale-[0.99] transition-transform disabled:opacity-50">
     <TrendingUp className="h-4 w-4 stroke-[2.5]" />
     <span>{t("Buy up")} ({currentRate}%)</span>
    </button>
    <button type="button" disabled={submitting||!!pendingIntent} onClick={()=>submitSeconds("down")} className="h-10 rounded-lg bg-loss text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-loss/90 active:scale-[0.99] transition-transform disabled:opacity-50">
     <TrendingDown className="h-4 w-4 stroke-[2.5]" />
     <span>{t("Buy down")} ({currentRate}%)</span>
    </button>
   </div>
  </div>

  {/* 5. 底部持仓与倒计时栏 (纯文字下划线 Tab 栏) */}
  <div className="border-t border-brand-border/40 pt-1.5 -mt-1">
   <div className="flex items-center justify-between border-b border-brand-border/40 pb-2 px-1">
    <div className="flex items-center gap-6">
     <button type="button" onClick={()=>setActiveTab("open")} className={"relative text-sm font-semibold pb-2 transition-colors "+(activeTab==="open"?"text-brand-text":"text-brand-text-muted hover:text-brand-text-secondary")}>
      {t("Open positions")} ({openCount})
      {activeTab==="open" && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-accent rounded-full" />}
     </button>
     <button type="button" onClick={()=>setActiveTab("history")} className={"relative text-sm font-semibold pb-2 transition-colors "+(activeTab==="history"?"text-brand-text":"text-brand-text-muted hover:text-brand-text-secondary")}>
      {t("Order history")}
      {activeTab==="history" && <span className="absolute bottom-0 inset-x-0 h-0.5 bg-brand-accent rounded-full" />}
     </button>
    </div>
    <button type="button" onClick={refresh} className="text-brand-text-muted hover:text-brand-accent transition-colors" title={t("Refresh")}>
     <RefreshCw className={"h-3.5 w-3.5 "+(loading?"animate-spin":"")} />
    </button>
   </div>

   <div className="pt-2">
    {activeTab === "open" ? (
     snapshot?.open.length ? (
      <div className="space-y-2">
       {snapshot.open.map(item => {
        const directionUp = item.direction === "up";
        const secondsLeft = Math.max(0, Math.ceil((item.settle_at * 1000 - clockNow) / 1000));
        return <div key={item.position_id} className="p-3 rounded-lg bg-brand-surface border border-brand-border/50 flex items-center justify-between text-xs">
         <div>
          <div className="flex items-center gap-1.5 font-bold">
           <span>{item.symbol}/USDT</span>
           <span className={"px-1.5 py-0.2 rounded text-[10px] " + (directionUp ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss")}>
            {directionUp ? t("Up ↑") : t("Down ↓")} {item.duration_sec}s
           </span>
          </div>
          <p className="text-[11px] text-brand-text-muted mt-1 font-mono">
           {t("Principal")}: {item.amount} USDT · {t("Entry")}: {item.open_price}
          </p>
         </div>
         <div className="text-right font-mono">
          <p className="text-brand-accent font-bold text-sm">{secondsLeft > 0 ? secondsLeft + "s" : t("Settling…")}</p>
          <p className="text-[10px] text-brand-text-muted mt-0.5">{t("Time remaining")}</p>
         </div>
        </div>;
       })}
      </div>
     ) : (
      <div className="py-6 text-center text-xs text-brand-text-muted">{t("No active seconds contract positions.")}</div>
     )
    ) : (
     snapshot?.history.length ? (
      <div className="space-y-2">
       {snapshot.history.map(item => {
        const isWin = item.win;
        const isTie = item.tie;
        return <div key={item.position_id} className="p-3 rounded-lg bg-brand-surface border border-brand-border/40 flex items-center justify-between text-xs">
         <div>
          <p className="font-semibold text-brand-text">{item.symbol}/USDT · {item.duration_sec}s</p>
          <p className="text-[11px] text-brand-text-muted font-mono mt-0.5">{t("Stake")} {item.amount} USDT</p>
         </div>
         <div className="text-right font-mono">
          <span className={"font-bold text-sm " + (isWin ? "text-profit" : isTie ? "text-brand-text-secondary" : "text-loss")}>
           {isWin ? "+" + item.pnl : isTie ? "0.00" : item.pnl} USDT
          </span>
          <p className="text-[10px] text-brand-text-muted">{isWin ? t("Win") : isTie ? t("Tie") : t("Loss")}</p>
         </div>
        </div>;
       })}
      </div>
     ) : (
      <div className="py-6 text-center text-xs text-brand-text-muted">{t("No settlement history records.")}</div>
     )
    )}
   </div>
  </div>
 </PageFrame>;
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

/**
 * Renders the identity-verification workflow and its document submission form.
 * Leaves document validation and review decisions to the existing KYC services.
 */
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
 const tone=["approved","verified"].includes(status)?"border-brand-success/30 bg-brand-success/[.07] text-brand-success":["rejected","failed"].includes(status)?"border-brand-danger/30 bg-brand-danger/[.07] text-brand-danger":"border-brand-border bg-brand-surface-2 text-brand-text-muted";
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const cleanName=name.trim(),cleanId=idNumber.trim();
  if(cleanName.length<2||cleanName.length>100||cleanId.length<4||cleanId.length>64){setSubmitError("Enter your full name and a valid document number.");return;}
  if(!documentFile){setSubmitError("Upload a clear photo of your identity document.");return;}
  setSubmitting(true);setSubmitError("");setNotice("");
  try{
   const image=await prepareKycDocumentImage(documentFile);
   await submitKyc({name:cleanName,id_type:idType,id_number:cleanId,...image});
   setDocumentFile(null);
   setNotice(t("Verification details and document image submitted securely for staff review."));
   setReload(value=>value+1);
  }
  catch(reason){setSubmitError(reason instanceof Error?reason.message:"Verification submission could not be confirmed. Refresh your status before retrying.");}
  finally{setSubmitting(false);}
 };
 return <PageFrame title="Identity verification" tone="account" backTo="/me">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading verification status…")}</CardContent></Card>
  :error?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<div className="space-y-4">
  {status==="not_submitted"?<div className="rounded-xl border border-brand-border bg-brand-surface-2 p-4 text-sm leading-6 text-brand-text-muted" role="status">{t("Submit your identity documents to begin verification.")}</div>:<Card className="overflow-hidden border-brand-border bg-brand-surface ">
   <CardContent className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6">
    <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><ShieldCheck className="h-6 w-6"/></span><div className="min-w-0"><p className="type-meta font-semibold uppercase tracking-[.14em] text-brand-text-muted">{t("Current status")}</p><p className="mt-1 text-xl font-semibold capitalize tracking-tight text-brand-text">{t(label)}</p><p className="mt-1 max-w-xl text-sm leading-6 text-brand-text-muted">{submitted&&!canSubmit?t("Your verification is on file. You can check the status again after staff review."):t("Submit your details and a clear photo of your identity document. BTCBOX staff will review the information and update your verification status.")}</p></div></div>
    <Badge variant="outline" className={`h-fit w-fit rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${tone}`}>{t(label)}</Badge>
   </CardContent>
   <div className="grid gap-4 border-t border-brand-border bg-brand-surface-2/50 p-5 sm:grid-cols-3 sm:px-6">
    <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Applicant name")}</p><p className="mt-1 truncate text-sm font-semibold text-brand-text">{account.kyc?.name||"—"}</p></div>
    <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Document type")}</p><p className="mt-1 text-sm font-semibold capitalize text-brand-text">{account.kyc?.id_type?kycDocumentTypeLabel(normalizeKycDocumentType(account.kyc.id_type),t):"—"}</p></div>
    <div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Document number")}</p><p className="mt-1 break-all font-mono text-sm text-brand-text-secondary">{account.kyc?.id_number?"••••"+account.kyc.id_number.slice(-4):"—"}</p></div>
   </div>
   {account.kyc?.reject_reason?<div className="border-t border-brand-danger/20 bg-brand-danger/[.04] p-4 sm:px-6"><p className="text-xs font-semibold text-brand-danger">{t("Review note")}</p><p className="mt-1 text-sm leading-6 text-brand-text-secondary">{account.kyc.reject_reason}</p></div>:null}
  </Card>}
  {canSubmit?<Card className="border-brand-border bg-brand-surface "><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><CardTitle>{status==="rejected"?t("Resubmit verification"):t("Submit identity details")}</CardTitle><CardDescription>{t("Use the same name and document details shown on your identity document. Do not send passwords or two-factor codes. Images are compressed before secure upload.")}</CardDescription></CardHeader><CardContent className="p-5 sm:p-6"><form aria-busy={submitting} className="space-y-4" onSubmit={submit}>
   <label className="block space-y-1 text-sm"><span>{t("Full legal name")}</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={100} autoComplete="name" required disabled={submitting} className="h-12 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"/></label>
   <div className="block space-y-2 text-sm"><span>{t("Identity document type")}</span><div className="flex flex-wrap gap-2">{([["id_card",t("ID card")],["passport",t("Passport")],["driver_license",t("Driver's license")]] as Array<["id_card"|"passport"|"driver_license",string]>).map(([value,label])=><button key={value} type="button" disabled={submitting} onClick={()=>setIdType(value)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${idType===value?"border-brand-accent bg-brand-accent/15 text-brand-accent":"border-brand-border bg-brand-surface-2 text-brand-text-muted hover:border-brand-accent/40 hover:text-brand-text"}`}>{label}</button>)}</div></div>
   <label className="block space-y-1 text-sm"><span>{t("Document number")}</span><input value={idNumber} onChange={event=>setIdNumber(event.target.value)} maxLength={64} autoComplete="off" required disabled={submitting} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 font-mono text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"/></label>
   <div className="block space-y-2 text-sm"><span>{t("Identity document image")}</span><label className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${documentFile?"border-brand-accent/50 bg-brand-accent/[.04]":"border-brand-border bg-brand-surface-2 hover:border-brand-accent/40"} ${submitting?"pointer-events-none opacity-60":""}`}><input type="file" accept="image/jpeg,image/png,image/webp" disabled={submitting} onChange={event=>{setDocumentFile(event.target.files?.[0]||null);setSubmitError("");}} className="sr-only"/>{documentFile?<><span className="text-sm font-semibold text-brand-accent">{documentFile.name}</span><span className="text-xs text-brand-text-muted">{t("Tap to upload")}</span></>:<><span className="text-sm font-semibold text-brand-text">{t("Tap to upload")}</span><span className="text-xs text-brand-text-muted">{t("JPEG, PNG or WebP. Maximum original size 8 MB; securely compressed to 512 KB. Upload a clear, readable image.")}</span></>}</label></div>
   <Button type="submit" block disabled={submitting||!name.trim()||!idNumber.trim()||!documentFile}>{submitting?t("Submitting…"):t("Submit for review")}</Button>
   {submitError?<p role="alert" className="text-sm text-brand-danger">{t(submitError)}</p>:null}{notice?<p role="status" className="text-sm text-brand-success">{notice}</p>:null}
  </form></CardContent></Card>:null}
  </div>:null}
 </PageFrame>;
}



/**
 * Displays support conversations and the message composer.
 * Preserves the existing message submission and retrieval behavior.
 */
export function SupportPage(){
 const {t}=useI18n();
 const navigate=useNavigate();
 const {status}=useAuth();
 // The conversation itself lives in features/support/SupportChat so the support
 // module owns its own state, retry contract and API calls.
 return <PageFrame title="Customer support" tone="support" onBack={()=>navigate(-1)}>
  <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)] lg:gap-5">
   <SupportFaq />
   {status==="authenticated"?<SupportChat />:<Card className="self-start overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] lg:sticky lg:top-6"><CardHeader className="bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Headset className="h-5 w-5"/></span><div><CardTitle>{t("BTCBOX Help Center")}</CardTitle><CardDescription>{t("Public support information is available without signing in.")}</CardDescription></div></div></CardHeader><CardContent className="space-y-3 text-sm text-brand-text-secondary"><p>{t("For account-specific questions, deposit or withdrawal reviews, and private conversation history, sign in to your BTCBOX account first.")}</p><Button asChild><Link to="/login">{t("Sign in to contact support")}</Link></Button></CardContent></Card>}
  </div>
 </PageFrame>;
}

const depositNetworks:Record<string,string[]>={BTC:["BTC"],ETH:["ERC20"],USDT:["TRC20","ERC20","BEP20"],SOL:["SOL"],BNB:["BEP20"],USDC:["ERC20"],ADA:["Cardano"],AVAX:["AVAX-C"],DOT:["Polkadot"],LINK:["ERC20"],LTC:["LTC"],MATIC:["Polygon"],UNI:["ERC20"],TRX:["TRC20"],BCH:["BCH"],ATOM:["Cosmos"],ETC:["ETC"]};
/**
 * Displays deposit instructions, address selection, and deposit history.
 * Uses the configured deposit networks and existing wallet data sources.
 */
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
 useEffect(()=>{
  const refreshWhenVisible=()=>{if(document.visibilityState==="visible")setHistoryReload(value=>value+1);};
  document.addEventListener("visibilitychange",refreshWhenVisible);
  return ()=>document.removeEventListener("visibilitychange",refreshWhenVisible);
 },[]);
 const changeCoin=(next:string)=>{setAddress("");setError("");setCopyMessage("");setCoin(next);setNetwork(depositNetworks[next][0]);};
 const changeNetwork=(next:string)=>{setAddress("");setError("");setCopyMessage("");setNetwork(next);};
 return <PageFrame title="Deposit" tone="assets" backTo="/assets">
  <Card className="relative overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Wallet className="h-5 w-5"/></span><div><CardTitle>{t("Deposit address")}</CardTitle><CardDescription>{t("Always verify the asset and network before sending funds.")}</CardDescription></div></div></CardHeader><CardContent className="space-y-5 p-4 sm:p-6">
   <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Asset")}</span><select value={coin} onChange={e=>changeCoin(e.target.value)} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{Object.keys(depositNetworks).map(x=><option key={x}>{x}</option>)}</select></label><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Network")}</span><select value={network} onChange={e=>changeNetwork(e.target.value)} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{depositNetworks[coin].map(x=><option key={x}>{x}</option>)}</select></label></div>
   {loading?<p className="rounded-xl border border-brand-border p-4 text-sm text-brand-text-muted" role="status">{t("Loading configured deposit address…")}</p>
    :error?<div className="rounded-xl border border-brand-danger/30 bg-brand-danger/[.04] p-4"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>
   :<div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">{coin} · {network}</p><div className="rounded-xl border border-brand-accent/20 bg-brand-surface p-4 ring-1 ring-brand-accent/[0.04]"><p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-brand-text-muted"><ShieldCheck className="h-3.5 w-3.5 text-brand-accent"/>{t("Verified network destination")}</p><div className="break-all font-mono text-sm leading-6 text-brand-text">{address}</div></div><Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" disabled={!address} onClick={copyAddress}>{t("Copy address")}</Button>{copyMessage?<p className="text-xs text-brand-text-muted" role="status" aria-live="polite">{t(copyMessage)}</p>:null}</div>}
   <div className="rounded-xl border border-brand-border bg-brand-surface-2/60 p-4 text-sm text-brand-text-secondary"><p className="flex items-center gap-2 font-semibold text-brand-text"><ShieldAlert className="h-4 w-4 text-brand-text-muted"/>{t("Important")}</p><p className="mt-1">{t("Send only the selected asset on the selected network. Sending unsupported assets or using another network may result in permanent loss. After the transfer, BTCBOX staff verify receipt and manually credit the account. This page does not create a deposit order or automatically credit funds.")}</p></div>
  </CardContent></Card>
  <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Clock3 className="h-4 w-4"/></span><CardTitle>{t("Deposit history")}</CardTitle></div></div></CardHeader><CardContent className="space-y-3 p-5 sm:p-6">
   {historyLoading?<p className="text-sm text-brand-text-muted" role="status">{t("Loading deposit history…")}</p>
   :historyError?<p className="text-sm text-brand-danger" role="alert">{t(historyError)}</p>
   :depositHistory.length?depositHistory.map((item,index)=><div key={item.id||`${item.time||"deposit"}-${item.coin}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-2/40 p-4 transition-colors hover:bg-brand-surface-2/70"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||"—"}</p>{item.reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">{t("Reference")}: {item.reference||item.txid}</p>:null}</div><Badge variant={depositStatusBadgeVariant(normalizeDepositStatus(item.status))}>{depositStatusLabel(normalizeDepositStatus(item.status), t)}</Badge></div>)
   :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No deposit records have been returned for this account.")}</p>}
  </CardContent></Card>
 </PageFrame>;
}


/**
 * Displays Earn products and the user's positions with their available actions.
 * Leaves subscription and redemption rules to the existing financial services.
 */
export function EarnPage(){
 const {t,language}=useI18n();
 const {status}=useAuth();
 const signedOut=status!=="authenticated";
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
 const [featuredToast,setFeaturedToast]=useState("");
 const showFeaturedToast=()=>{
  setFeaturedToast(t("This product will open for subscription soon."));
  window.setTimeout(()=>setFeaturedToast(""),2600);
 };
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
 return <PageFrame title="Earn" tone="earn" backTo="/assets">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-success/10 text-brand-success"><Sprout className="h-4 w-4"/></span><div><p className="text-sm font-semibold text-brand-text">{t("BTCBOX Earn")}</p><p className="text-xs text-brand-text-muted">{t("Live catalog · account-backed positions")}</p></div><Badge variant="outline" className="border-brand-success/25 text-brand-success">{t("Live product catalog")}</Badge></div></div>
  {loading?<Card aria-busy={loading} className="border-brand-border bg-brand-surface"><CardContent className="space-y-3 p-5" role="status"><div className="h-4 w-1/3 animate-pulse rounded bg-brand-surface-2"/><div className="grid gap-3 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/></div><p className="text-sm text-brand-text-muted">{t("Loading Earn products and positions…")}</p></CardContent></Card>
  :<>
   {signedOut?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-3"><p className="text-sm text-brand-text-muted">{t("Please sign in to view your account data")}</p><Button asChild size="sm" className="h-10"><Link to="/login">{t("Go to sign in")}</Link></Button></div>:error?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-danger/30 p-3"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>:null}
   {actionMessage?<p className="rounded-xl border border-brand-success/30 p-3 text-sm text-brand-success" role="status">{actionMessage}</p>:null}
   <div className="grid gap-3 sm:grid-cols-3"><Card className="overflow-hidden border-brand-success/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Available products")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-success">{products.length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Live catalog entries")}</p></CardContent></Card><Card className="overflow-hidden border-brand-cyan/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("My Earn positions")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-cyan">{positions.length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Returned account records")}</p></CardContent></Card><Card className="overflow-hidden border-brand-violet/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Active positions")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-violet">{positions.filter(position=>normalizeEarnStatus(position.status)==="active").length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Currently held")}</p></CardContent></Card></div>
   <section className="space-y-3">
    <div className="flex items-center justify-between"><h2 className="type-section-title">{t("Featured products")}</h2><Badge variant="outline" className="border-brand-success/25 text-brand-success">{t("Coming soon")}</Badge></div>
    <div className="grid gap-3 sm:grid-cols-3">
     {[{name:t("USDT Flexible Savings"),rate:"5.20",term:t("Deposit and withdraw anytime"),asset:"USDT"},{name:t("BTC Steady Fixed Term"),rate:"3.80",term:`30 ${t("days")}`,asset:"BTC"},{name:t("ETH Staking Yield"),rate:"4.50",term:t("Flexible staking"),asset:"ETH"}].map((p)=>(
      <button key={p.asset} type="button" onClick={showFeaturedToast} className="group flex flex-col items-start gap-3 rounded-xl border border-brand-border bg-brand-surface p-4 text-left transition-all duration-150 hover:border-brand-success/40 hover:bg-brand-surface-hover active:scale-[0.98]">
       <div className="flex w-full items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-success/10 text-brand-success">{p.asset}</span><Badge variant="outline" className="border-brand-border text-brand-text-muted">{t("Coming soon")}</Badge></div>
       <div><p className="text-sm font-semibold text-brand-text">{p.name}</p><p className="mt-0.5 text-xs text-brand-text-muted">{t("Term")} {p.term}</p></div>
       <p className="font-mono text-2xl font-bold tabular-nums text-brand-success">{p.rate}%<span className="ml-1 text-xs font-medium text-brand-text-muted">{t("APY")}</span></p>
      </button>
     ))}
    </div>
   </section>
   {featuredToast?<div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-24 z-[70] mx-auto flex max-w-sm items-center justify-center rounded-xl border border-brand-success/30 bg-brand-surface/95 px-4 py-3 text-sm font-medium text-brand-text shadow-overlay backdrop-blur-xl">{featuredToast}</div>:null}
   {!actionsEnabled?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-4"><Badge variant="outline" className="border-brand-border text-brand-text-muted">{t("Coming soon")}</Badge><p className="mt-2 text-sm text-brand-text-secondary">{t("Earn products are undergoing a pre-launch security audit and will open for subscription soon.")}</p></CardContent></Card>:null}
   <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="type-section-title">{t("Available products")}</h2><p className="type-meta mt-1 text-brand-text-muted">{t("Rates and terms returned by the BTCBOX product catalog.")}</p></div><Badge variant="outline" className="border-brand-border">{products.length} {t("products")}</Badge></div>
    {products.length?<div className="grid gap-3 sm:grid-cols-2">{products.map(product=><Card key={product.product_id} className="group relative overflow-hidden border-brand-success/20 bg-brand-surface ring-1 ring-brand-success/[0.025] transition-all hover:-translate-y-0.5 hover:border-brand-success/35 hover:shadow-lg hover:shadow-brand-success/[0.04]"><CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-success/10 text-brand-success"><Sprout className="h-5 w-5"/></span><div className="min-w-0"><p className="font-semibold text-brand-text">{product.asset}</p><p className="type-meta mt-0.5 text-brand-text-muted">{product.product_type==="demand"?t("Flexible"):t("Fixed term")}</p></div></div><Badge variant="outline" className="shrink-0">{product.product_type==="demand"?t("Flexible"):t("Fixed")}</Badge></div><div className="rounded-xl border border-brand-success/20 bg-brand-surface p-4"><p className="type-meta font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Annual rate")}</p><p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-brand-success">{number(product.apy_percent)}%</p></div><div className="flex flex-wrap items-center justify-between gap-2"><p className="type-meta text-brand-text-muted">{product.term_days===0?t("Withdraw according to flexible-product rules"):`${product.term_days} ${t("days")}`} · {t("Early redemption fee")}: {number(product.early_fee_percent)}%</p><Button size="sm" variant={selectedProduct===product.product_id?"default":"outline"} onClick={()=>setSelectedProduct(product.product_id)}>{selectedProduct===product.product_id?t("Selected"):t("Select")}</Button></div></CardContent></Card>)}</div>
    :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No active Earn products are currently returned by the backend.")}</CardContent></Card>}
   </section>
   {products.length?<Card className="relative overflow-hidden border-brand-accent/25 bg-brand-surface ring-1 ring-brand-accent/[0.04]"><div className="h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><ArrowUpRight className="h-4 w-4"/></span><div><CardTitle>{t("Subscribe")}</CardTitle><CardDescription>{t("Your available balance and product limits are validated by the financial database.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-6"><form aria-busy={busy} className="space-y-4" onSubmit={operate}><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Product")}</span><select value={selectedProduct} disabled={busy} onChange={e=>setSelectedProduct(e.target.value)} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15">{products.map(product=><option key={product.product_id} value={product.product_id}>{product.asset} · {product.product_type==="demand"?t("Flexible"):`${product.term_days} ${t("days fixed")}`}</option>)}</select></label><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} ({selected?.asset||""})</span><input inputMode="decimal" value={amount} disabled={busy||!actionsEnabled} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" /></label><Button type="submit" className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" disabled={!actionsEnabled||busy||!selected}>{busy?t("Processing…"):t("Subscribe")}</Button></form></CardContent></Card>:null}
   <section className="space-y-3"><h2 className="type-section-title">{t("My Earn positions")}</h2>
    {positions.length?positions.map(position=><Card key={position.id} className="overflow-hidden border-brand-border bg-brand-surface  transition-colors hover:border-brand-cyan/25"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{position.product||position.product_id}</p><p className="text-xs text-brand-text-muted">{position.type==="flexible"?t("Flexible"):t("Fixed")} · {number(position.apy)}% {t("APY")}</p></div><Badge variant={earnStatusBadgeVariant(normalizeEarnStatus(position.status))}>{earnStatusLabel(normalizeEarnStatus(position.status), t)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Principal")}</p><p className="mt-1 break-all font-semibold tabular-nums">{number(position.amount)}</p></div><div className="rounded-lg bg-brand-success/[0.055] p-3"><p className="text-xs text-brand-text-muted">{t("Estimated interest")}</p><p className="mt-1 break-all font-semibold tabular-nums text-brand-success">{number(position.expected_interest)}</p></div><div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("End / maturity")}</p><p className="mt-1 break-all font-semibold">{position.end||"—"}</p></div></div>{normalizeEarnStatus(position.status)==="active"?<Button size="sm" variant="outline" className="min-h-10 border-brand-accent/30 text-brand-accent hover:bg-brand-accent/[0.06]" disabled={!actionsEnabled||busy} onClick={()=>redeem(position)}>{t("Redeem")}</Button>:null}</CardContent></Card>)
    :<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("No Earn positions were returned for this account.")}</CardContent></Card>}
   </section>
  </>}
 </PageFrame>;
}


/**
 * Renders the withdrawal request workflow and wallet balance context.
 * Preserves saved-address, confirmation, and financial-ledger safeguards.
 */
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
 const [needsSignIn,setNeedsSignIn]=useState(false);
 const submitLockRef=useRef(false);
 const [reload,setReload]=useState(0);

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setAccount(null);setAddresses([]);setConfig(null);setSelectedAddress(null);setError("");setNeedsSignIn(false);
  Promise.all([getAccount(controller.signal),getSavedCryptoAddresses(controller.signal),getWithdrawalConfig(controller.signal)])
   .then(([snapshot,book,withdrawalConfig])=>{
    if(controller.signal.aborted)return;
    setAccount(snapshot);setAddresses(book.filter((item):item is SavedCryptoAddress=>item.type==="crypto"));setConfig(withdrawalConfig);
    const usable=book.filter((item):item is SavedCryptoAddress=>item.type==="crypto"&&!item.blocked&&!item.unbound);
    const storageKey="btcbox.withdraw.pending.v1."+snapshot.uid;
    try{
     const raw=window.localStorage.getItem(storageKey);
     if(raw){
      const saved=JSON.parse(raw);
      const savedAddress=usable.find(item=>item.id===saved?.address_id);
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
    // A signed-out visitor is not an error: show the same localized sign-in
    // prompt as every other account page instead of a red alert carrying the
    // server's raw English message plus a retry that can never succeed.
    const signedOut=reason instanceof ApiError&&(reason.status===401||reason.code==="AUTH_REQUIRED");
    setNeedsSignIn(signedOut);
    setError(signedOut?"":(reason instanceof Error?reason.message:"Wallet data is temporarily unavailable."));
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
 return <PageFrame title="Withdraw" tone="assets" backTo="/assets">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading wallet and saved addresses…")}</CardContent></Card>
  :needsSignIn?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-xs text-brand-text-muted">{t("Please sign in to view your account data")}</p><Button asChild size="sm" className="h-10"><Link to="/login">{t("Go to sign in")}</Link></Button></CardContent></Card>
  :error&&!account?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :<>
   <Card aria-busy={loading} className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Wallet className="h-4 w-4"/></span><div className="min-w-0"><CardTitle>{t("Available balances")}</CardTitle><CardDescription>{account?.valuation_complete?t("Estimated total value"):t("Some asset prices are unavailable; total valuation is incomplete.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-5">
    {Object.keys(account?.balances||{}).length===0?<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No asset balances are currently available.")}</p>:<div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
    {(Object.entries(account?.balances||{}) as Array<[string,AccountBalance]>).map(([asset,row],index)=><div key={asset} className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface-2/60 p-4"><div className={"absolute inset-y-0 left-0 w-1 "+(index%3===0?"bg-brand-cyan":index%3===1?"bg-brand-violet":"bg-brand-teal")}/><div className="flex items-center gap-3"><TokenIcon symbol={asset} className="h-9 w-9"/><div className="min-w-0"><p className="font-semibold text-brand-text">{asset}</p><p className="type-meta text-brand-text-muted">{t("Wallet balance")}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-brand-bg/70 p-3"><p className="type-meta text-brand-text-muted">{t("Available")}</p><p className="mt-1 break-all text-sm font-semibold tabular-nums text-brand-text">{String(row.free??"0")}</p></div><div className="rounded-lg bg-brand-bg/70 p-3"><p className="type-meta text-brand-text-muted">{t("Frozen")}</p><p className="mt-1 break-all text-sm font-semibold tabular-nums text-brand-text-secondary">{String(row.frozen??"0")}</p></div></div></div>)}
    </div>}
   </CardContent></Card>

   <Card aria-busy={submitting} className="relative overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><ArrowUpRight className="h-5 w-5"/></span><div className="min-w-0"><CardTitle>{t("Submit withdrawal")}</CardTitle><CardDescription>{t("Select a saved address. Asset and network are taken from that address; staff review and manually pay approved requests.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-6">
    {usableAddresses.length===0?<div className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No eligible saved withdrawal addresses are available. Add an address to your address book or contact support.")}</div>
    :<form aria-busy={submitting} className="space-y-4" onSubmit={submit}>
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Saved withdrawal address")}</span><select value={selectedId} disabled={!!pendingIntent||pendingIntentInvalid||submitting} onChange={event=>{setSelectedId(event.target.value);setError("");}} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{usableAddresses.map(item=><option key={item.id} value={item.id}>{item.coin} · {item.network} · {item.address}</option>)}</select></label>
     {selectedAddress?<div className="min-w-0 rounded-xl border border-brand-border bg-brand-surface-2/70 p-3 text-xs leading-5 text-brand-text-muted sm:p-4"><p>{t("Selected destination")}: {selectedAddress.coin} · {selectedAddress.network}</p><p className="mt-1 break-all font-mono">{selectedAddress.address.length>18?selectedAddress.address.slice(0,8)+"—"+selectedAddress.address.slice(-8):selectedAddress.address}</p></div>:<p className="text-xs text-brand-text-muted">{t("Loading selected address…")}</p>}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} {selectedAddress ? "(" + selectedAddress.coin + ")" : ""}</span><input inputMode="decimal" value={amount} disabled={!!pendingIntent||pendingIntentInvalid||submitting} onChange={event=>setAmount(event.target.value)} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15"/></label>
     {selectedAddress?<div className="grid grid-cols-1 gap-3 rounded-xl border border-brand-border bg-brand-surface-2/50 p-4 text-sm min-[420px]:grid-cols-2"><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 tabular-nums">{available.toLocaleString(localeTags[language],{maximumFractionDigits:10})} {selectedAddress.coin}</p></div><div><p className="text-xs text-brand-text-muted">{t("Withdrawal fee")}</p><p className="mt-1 tabular-nums">{Number.isFinite(fee)?fee.toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—"} {selectedAddress.coin}</p></div></div>:null}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Fund password")}</span><input type="password" autoComplete="current-password" value={fundPassword} disabled={submitting} onChange={event=>setFundPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" required/></label>
     {account?.twofa_enabled?<label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Two-factor code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twofaCode} disabled={submitting} onChange={event=>setTwofaCode(event.target.value.replace(/\D/g,"").slice(0,6))} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" required/></label>:null}
     {config&&!config.actions_enabled?<div className="rounded-xl border border-brand-border bg-brand-surface-2/60 p-4 text-sm text-brand-text-secondary"><Badge variant="outline" className="border-brand-border text-brand-text-muted">{t("Withdrawals temporarily unavailable")}</Badge><p className="mt-2">{t("The financial ledger cutover has not been enabled. You can review your wallet, but no withdrawal request can be submitted yet.")}</p></div>:null}
     {error?<p role="alert" className="text-sm text-brand-danger">{error}</p>:null}
     {actionMessage?<p role="status" className="text-sm text-brand-success">{actionMessage}</p>:null}
     <Button type="submit" className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" disabled={!canSubmit}>{submitting?t("Submitting…"):pendingIntent?t("Retry same request"):t("Submit for staff review")}</Button>
     {pendingIntent?<p className="break-all text-xs text-brand-text-muted">{t("Request result is not yet confirmed. Re-enter your fund password and 2FA code, then retry with the same request ID.")} · {pendingIntent.request_id}</p>:null}
    </form>}
   </CardContent></Card>

   <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><CardTitle>{t("Withdrawal history")}</CardTitle></CardHeader><CardContent className="space-y-2">
    {account?.withdrawals?.length?account.withdrawals.slice().reverse().map((item:WithdrawalRecord)=> <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-2/40 p-4 transition-colors hover:bg-brand-surface-2/70"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 break-all text-xs text-brand-text-muted">{item.address||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||item.paid_at||"—"}</p>{item.payout_reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">TxID / reference: {item.payout_reference||item.txid}</p>:null}</div><Badge variant={withdrawalStatusBadgeVariant(normalizeWithdrawalStatus(item.status))}>{withdrawalStatusLabel(normalizeWithdrawalStatus(item.status), t)}</Badge></div>)
    :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No withdrawal requests have been returned for this account.")}</p>}
   </CardContent></Card>

   <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><CardTitle>{t("Saved crypto addresses")}</CardTitle><CardDescription>{t("Full addresses are only retrieved for the address selected for withdrawal.")}</CardDescription></CardHeader><CardContent className="space-y-2">
    {addresses.length?addresses.map(item=><div key={item.id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{item.coin} · {item.network}</span><Badge variant={item.blocked||item.unbound?"destructive":"outline"}>{item.blocked?"Blocked":item.unbound?"Unbound":"Saved"}</Badge></div><p className="mt-2 break-all font-mono text-sm text-brand-text-muted">{item.address}</p>{item.note?<p className="mt-1 text-xs text-brand-text-muted">{item.note}</p>:null}</div>)
    :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No saved crypto withdrawal addresses were found.")}</p>}
   </CardContent></Card>
  </>}
 </PageFrame>;
}
