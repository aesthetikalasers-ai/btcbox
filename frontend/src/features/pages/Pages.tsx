import * as Dialog from "@radix-ui/react-dialog";
import { AuthRestoreState } from "../../components/AuthRestoreState";
import { multiplyDecimalStrings, multiplyDecimalStringsCeil, addDecimalStrings, divideDecimalStrings, compareDecimalStrings, isDecimalMultipleOfStep, addDecimalStep, floorDecimalToStep, roundDecimalToStep } from "../../lib/decimal";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldAlert, ArrowLeft, ChevronRight, ChevronDown, ChevronsLeft, ChevronsRight, KeyRound, Copy, Check, Plus, Minus, History, WifiOff, Search } from "lucide-react";
import { ApiError, getAccount, getOrders, getMarkets, getSpotMarketPairs, getKlines, getOrderBook, getUsdtUsdRate, getTradingStatus, submitSpotOrder, cancelSpotOrder, getDepositAddress, getSavedCryptoAddresses, getWithdrawalConfig, getWithdrawalHistoryPage, submitWithdrawal, getInternalConversionQuote, submitInternalConversion, getEarnCatalog, submitEarnAction, getSupportUnread, type EarnProduct, type EarnPosition, type SavedCryptoAddress, type AccountBalance, type AccountSnapshot, type DepositRecord, type OrderRecord, type MarketTicker, type SpotMarketPair, type MarketCandle, type OrderBookSnapshot, type TradingStatus, type WithdrawalConfig, type WithdrawalRecord, submitKyc } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { DEV_ACCOUNT_PLACEHOLDER, DEV_OPEN_ACCOUNT_PAGES } from "../../lib/devAccess";
import { useAuthDialog } from "../../lib/auth-dialog";
import { ChartDrawer } from "../trade/ChartDrawer";

import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownToLine, ArrowUpFromLine, LockKeyhole, Wallet, ChartNoAxesCombined, ArrowLeftRight, Sprout, BadgeCheck, ShieldCheck, Headset, Columns2, Gift, Rocket } from "lucide-react";
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
import { BottomOrderPanel } from "../trade/BottomOrderPanel";

type PageFrameTone = "trading"|"earn"|"assets"|"support"|"account"|"orders"|"market";
/** Handles to the live K-line chart, so ticks update the price line in place. */
type ChartHandle = { chart: IChartApi; series: ISeriesApi<"Candlestick">; priceLine: IPriceLine };
/**
 * The local market gateway answers account-scoped reads with English operator
 * copy (for example "The Earn catalogue is not served by the local market
 * gateway."). That text must never reach a localized screen verbatim, so the
 * known replies are mapped onto keys that already ship with every dictionary.
 * Unknown server messages are replaced with a page-specific safe fallback.
 */
const GATEWAY_FAILURE_KEYS: Array<[RegExp, string]> = [
  [/EARN_DATA_UNAVAILABLE|earn catalog(ue)? is not served/i, "Unable to load Earn products. Please try again."],
  [/AUTH_CLIENT_CONFIG_UNAVAILABLE|authentication is not configured for the local market gateway/i, "Unable to complete sign-in. Please try again."],
];
function localizedFailure(reason: unknown, fallbackKey: string) {
  const code = reason instanceof ApiError && reason.code ? reason.code : "";
  const message = reason instanceof Error ? reason.message : "";
  const gateway = GATEWAY_FAILURE_KEYS.find(([pattern]) => pattern.test(code + " " + message));
  if (gateway) return gateway[1];
  return fallbackKey;
}
export function PageFrame({eyebrow,title,description,children,className="",tone,backTo,action,onBack}:{eyebrow?:string;title:string;description?:string;children:ReactNode;className?:string;tone:PageFrameTone;backTo?:string;action?:ReactNode;onBack?:()=>void}){
 const {t}=useI18n();
 return <div className={`${className} tone-${tone} mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8`}><div className={`flex min-w-0 items-center gap-3 ${className.includes("funds-flow-page")?"mx-auto w-full max-w-3xl justify-start":"justify-start"}`}>{onBack?<button type="button" onClick={onBack} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-text" aria-label={t("Back")}><ArrowLeft className="h-4 w-4"/></button>:backTo?<Link to={backTo} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-text" aria-label={t("Back")}><ArrowLeft className="h-4 w-4"/></Link>:null}<h1 className="type-page-title min-w-0 truncate text-brand-text">{t(title)}</h1>{action ? <div className="ml-auto shrink-0">{action}</div> : null}</div>{children}</div>;
}
/**
 * Displays the TradeHub service directory and its available product entry points.
 * Keeps each service routed to its existing dedicated workflow.
 */
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
  // Local development: render the account profile layout without a session so
  // the page can be edited. The placeholder carries only empty fields, and the
  // API still refuses every account read, so nothing is invented or unlocked.
  if(status!=="authenticated"){setAccount(DEV_OPEN_ACCOUNT_PAGES?({...DEV_ACCOUNT_PLACEHOLDER} as unknown as AccountSnapshot):null);setLoading(false);setError("");return;}
  const controller=new AbortController();
  setLoading(true);setAccount(null);setError("");
  getAccount(controller.signal).then(snapshot=>{
   if(!controller.signal.aborted)setAccount(snapshot);
  }).catch((reason:unknown)=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){
    setAccount(null);
    setError(localizedFailure(reason,"Account profile is temporarily unavailable."));
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
  {title:"Support",to:"/support",icon:Headset,surface:"border-brand-violet/25 bg-brand-surface",iconTone:"bg-brand-violet/10 text-brand-violet",hoverTone:"hover:border-brand-violet/45"},
  {title:"Settings",to:"/settings",icon:ShieldCheck,surface:"border-brand-teal/25 bg-brand-surface",iconTone:"bg-brand-teal/10 text-brand-teal",hoverTone:"hover:border-brand-teal/45"},
  {title:"Trust centre",to:"/trust",icon:ShieldCheck,surface:"border-brand-border bg-brand-surface",iconTone:"bg-brand-surface-2 text-brand-text-muted",hoverTone:"hover:border-brand-border-strong"},
 ];
 return <PageFrame title="My account" tone="account">
  {status==="loading"?<AuthRestoreState label="Loading account profile…"/>
  :status!=="authenticated"&&!DEV_OPEN_ACCOUNT_PAGES?<div className="space-y-4">
   <Card className="border-brand-border bg-brand-surface overflow-hidden"><CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
    <div className="flex items-center gap-3.5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent"><LockKeyhole className="h-5 w-5"/></div><div><p className="font-bold text-base text-brand-text">{t("Sign in to your account")}</p><p className="text-xs text-brand-text-muted mt-0.5">{t("Sign in to view balances, orders, and security settings.")}</p></div></div>
    <div className="flex items-center gap-2 shrink-0"><Button type="button" size="sm" className="min-w-[88px]" onClick={()=>openAuthDialog("login")}>{t("Sign in")}</Button><Button type="button" size="sm" variant="outline" className="min-w-[88px]" onClick={()=>openAuthDialog("register")}>{t("Create account")}</Button></div>
   </CardContent></Card>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Estimated account value")}</p><p className="mt-2 text-xl font-bold font-mono tracking-tight tabular-nums text-brand-text">•••••• <span className="text-xs font-normal text-brand-text-muted">USDT</span></p><div className="mt-2.5 flex items-center gap-2"><Link to="/login" className="text-xs text-brand-accent font-semibold hover:underline">{t("Sign in to view")}</Link></div></div>
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Security tier")}</p><p className="mt-2 text-base font-bold text-brand-text">—</p><span className="mt-2.5 text-xs text-brand-text-muted font-medium flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5"/>{t("Sign in to view")}</span></div>
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Fee tier")}</p><p className="mt-2 text-base font-bold text-brand-text">—</p><span className="mt-2.5 text-xs text-brand-text-muted font-medium">{t("Sign in to view")}</span></div>
    <div className="flex flex-col rounded-xl border border-white/[0.08] bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-200"><p className="text-xs text-brand-text-muted font-medium">{t("Affiliate Program")}</p><p className="mt-2 text-base font-bold text-brand-text">—</p><Link to="/register" className="mt-2.5 text-xs text-brand-accent font-semibold hover:underline">{t("Join affiliate")}</Link></div>
   </div>
  </div>
  :loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">{t("Loading account profile…")}</CardContent></Card>
  :error?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload((n)=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :account?<div className="space-y-4">
   <Card className="border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardContent className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-accent/30 to-brand-cyan/20 text-xl font-bold text-brand-accent">{status==="authenticated"?(account.username||account.email||"—").charAt(0).toUpperCase():<LockKeyhole className="h-6 w-6"/>}</div>
    <div className="min-w-0 flex-1">
     <p className="truncate text-lg font-bold text-brand-text">{status==="authenticated"?(account.username||account.email||"—"):t("Not signed in")}</p>
     <p className="mt-0.5 truncate text-sm text-brand-text-secondary">{status==="authenticated"?(account.email?maskEmail(account.email):"—"):t("Sign in to view your BTCBOX account profile.")}</p>
     {status==="authenticated"?<div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-brand-text-muted">{t("UID")}</span>
      <span className="font-mono text-xs tabular-nums text-brand-text-secondary">{account.uid||"—"}</span>
      <button type="button" onClick={()=>void copyUid()} className="inline-flex items-center gap-1 rounded-md border border-brand-border px-2 py-0.5 text-xs text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-text">{uidCopied?<><Check className="h-3 w-3 text-brand-success"/>{t("Copied")}</>:<><Copy className="h-3 w-3"/>{t("Copy")}</>}</button>
     </div>:<Button type="button" size="sm" variant="outline" className="mt-3" onClick={()=>openAuthDialog("login")}>{t("Sign in")}</Button>}
    </div>
   </CardContent></Card>
   <div className="divide-y divide-brand-border-subtle overflow-hidden rounded-xl border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
    <Link to="/address-book" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Wallet className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Address book")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/fund-password" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal"><KeyRound className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Fund password")}</span><span className="shrink-0 text-xs text-brand-text-muted">{t("Set or change")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/kyc" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><BadgeCheck className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Verification")}</span><span className={`shrink-0 text-sm font-semibold ${normalizeKycStatus(account.kyc?.status)==="verified"?"text-brand-success":normalizeKycStatus(account.kyc?.status)==="rejected"?"text-brand-danger":"text-brand-text-muted"}`}>{kycStatusLabel(normalizeKycStatus(account.kyc?.status),t)}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/settings" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal"><ShieldCheck className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Two-factor authentication")}</span><span className={`shrink-0 text-sm font-semibold ${account.twofa_enabled?"text-brand-success":"text-brand-text-muted"}`}>{account.twofa_enabled?t("Enabled"):t("Not enabled")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
    <Link to="/settings" className="flex min-h-[52px] items-center gap-3 px-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-violet/10 text-brand-violet"><KeyRound className="h-4 w-4"/></span><span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{t("Linked sign-in methods")}</span><span className="shrink-0 text-sm font-semibold text-brand-text-secondary">{(account.auth_providers||[]).length?(account.auth_providers||[]).length:t("Not linked")}</span><ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>
   </div>
  </div>:null}
  <div className="account-actions">{links.map(({title,to,icon:Icon})=>{
   // The support row carries a live unread badge so a reply is never missed.
   const unread=to==="/support"?supportUnread:0;
   return <Link key={to} to={to} state={to === "/rewards" ? { from: "/me" } : undefined} className="group flex min-w-0 items-center gap-3 p-4 transition-all duration-200 hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/60"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-text">{t(title)}</span></span>{unread>0?<span className="shrink-0 rounded-full bg-brand-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums" aria-label={t("Unread support replies")}>{unread>99?"99+":unread}</span>:null}<ChevronRight className="h-4 w-4 shrink-0 text-brand-text-muted transition-colors group-hover:text-brand-text"/></Link>;
  })}</div>
  {status==="authenticated"?<Button variant="outline" className="w-full border-brand-danger/30 text-brand-danger hover:bg-brand-danger/5 hover:text-brand-danger" onClick={()=>void handleSignOut()}>{t("Sign out")}</Button>:null}
 </PageFrame>;
}


export function SpotTradingPage(){
 const {symbol:routeSymbol}=useParams();
 const requestedSymbol=(routeSymbol||"BTCUSDT").toUpperCase();
 const symbol=requestedSymbol.endsWith("USDT")?requestedSymbol:requestedSymbol+"USDT";
 const {t,language}=useI18n();
 const {openAuthDialog}=useAuthDialog();
 const navigate=useNavigate();
 const [ticker,setTicker]=useState<MarketTicker|null>(null);
 const [spotPairEnabled,setSpotPairEnabled]=useState(false);
 const [spotCatalogDegraded,setSpotCatalogDegraded]=useState(false);
 const [spotPairRules,setSpotPairRules]=useState<SpotMarketPair|null>(null);
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
 const [pairRailOpen,setPairRailOpen]=useState(()=>window.matchMedia("(min-width: 1536px)").matches);
 // The compact H5 workspace (<=1023px) keeps order entry and order book side by side;
 // the K-line stays in the bottom drawer rather than taking workspace width.
 const [isPhone,setIsPhone]=useState(()=>window.matchMedia("(max-width: 1023px)").matches);

 useEffect(()=>{
  const media=window.matchMedia(DESKTOP_TRADE_QUERY);
  const compactViewport=window.matchMedia("(max-width: 1023px)");
  const update=()=>{setCompactTrade(media.matches);setChartOpen(false);setIsPhone(compactViewport.matches);};
  media.addEventListener("change",update);
  compactViewport.addEventListener("change",update);
  return ()=>{media.removeEventListener("change",update);compactViewport.removeEventListener("change",update);};
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
 const isPriceManualRef=useRef(false);
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
  // Freshness is based on the server snapshot timestamp, not the provider's
 // last-trade timestamp (which can legitimately be older in a quiet market).
 // Provider time remains separate for freshness/provenance checks and is not customer-facing.
 const serverSnapshotTimestampMs=ticker?.snapshotTs?ticker.snapshotTs*1000:null;
 const marketSnapshotStale=!!ticker&&(!serverSnapshotTimestampMs||!Number.isFinite(serverSnapshotTimestampMs)||serverSnapshotTimestampMs<=0||marketClockNow-serverSnapshotTimestampMs>90_000||serverSnapshotTimestampMs-marketClockNow>30_000);
 const tickerIsFallback=!ticker?.source||ticker.source==="demo-preview"||ticker.source==="sample-data";
 const displayTicker=tickerIsFallback||marketSnapshotStale?null:ticker;
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
  * cadence because the peg moves in basis points. If the FX endpoint is unavailable,
  * the conversion stays unavailable instead of substituting a guessed rate.
  */
 const [usdtUsd,setUsdtUsd]=useState<number | null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  let cancelled=false;
  const load=()=>{getUsdtUsdRate(controller.signal).then(r=>{if(!cancelled)setUsdtUsd(r.rate);}).catch(()=>{});};
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
 // Prefer SSE depth while its last frame is fresh. If the stream stalls,
 // fall back to the newest polled provider snapshot instead of pinning an old frame.
 const streamDepthFresh=liveDepth.updatedAt!==null&&Date.now()-liveDepth.updatedAt<=90_000;
 const displayBook=streamDepthFresh?liveDepth.data:(orderBookSnapshotStale?null:book);
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
 const effectiveMarketFeedWarning=marketFeedWarning||(ticker&&tickerIsFallback?t("Market data is temporarily unavailable."):marketSnapshotStale?t("Market data is temporarily unavailable."):"");




 // A failed `/api/market` leaves `ticker` null. Without a real quote there is no
 // price, no 24h stats and no basis for pricing an order, so the terminal shows
 // an explicit degraded state with a retry instead of blank fields that read as
 // zero. No sample value is ever substituted.
 const marketUnavailable=!displayTicker||marketSnapshotStale;

 useEffect(()=>{
  if(!displayTicker||marketSnapshotStale){
   if(!displayTicker||price===String(ticker?.price))setPrice("");
  }
 },[ticker,marketSnapshotStale,price]);

 useEffect(()=>{
  const timer=window.setInterval(()=>setMarketClockNow(Date.now()),5000);
  return ()=>window.clearInterval(timer);
 },[]);


 useEffect(()=>{
  const controller=new AbortController();
  isPriceManualRef.current=false;
  setLoading(true);setError("");setSpotPairEnabled(false);setSpotCatalogDegraded(false);setSpotPairRules(null);setTradingStatus(null);setPairSymbols([]);setAvailableBalances({});setOrderType("limit");
  setTicker(null);setCandles([]);setBook(null);setMarketFeedWarning("");setChartFeedWarning("");setPrice("");
  Promise.allSettled([getSpotMarketPairs(controller.signal),getMarkets(controller.signal),getOrderBook(symbol,controller.signal),getTradingStatus(controller.signal),getOrders(controller.signal),getAccount(controller.signal)]).then(results=>{
   if(controller.signal.aborted)return;
   const [pairResult,marketResult,bookResult,statusResult,ordersResult,accountResult]=results;
   if(pairResult.status==="fulfilled"){
    setPairSymbols(pairResult.value.filter(pair=>pair.quote_asset==="USDT").map(pair=>pair.base_asset+pair.quote_asset));
    const catalogDegraded=pairResult.value.some(pair=>pair.trading_enabled===false);
    setSpotCatalogDegraded(catalogDegraded);
    const selectedPair=pairResult.value.find(pair=>pair.base_asset===base&&pair.quote_asset==="USDT"&&pair.enabled===true&&pair.trading_enabled!==false)||null;
    setSpotPairRules(selectedPair);
    const enabled=!!selectedPair;
    setSpotPairEnabled(enabled);
    if(!enabled)setError(t("Trading is temporarily unavailable."));
   }else{
    setSpotPairEnabled(false);
    setError(t("Unable to load spot markets. Please try again."));
   }
   if(accountResult.status==="fulfilled"){setAccountUid(accountResult.value.uid);setAvailableBalances(accountResult.value.balances);}
   else if(accountResult.reason instanceof ApiError && accountResult.reason.code==="AUTH_REQUIRED"){setAccountUid("");setAvailableBalances({});}
   // Missing account data is represented by unavailable balances and disabled order entry;
   // keep it out of the prominent market-status banner to preserve the trading viewport.
   if(marketResult.status==="fulfilled"){
    const marketBase=symbol.endsWith("USDT")?symbol.slice(0,-4):symbol;
    // Keep the whole snapshot so the rail can list every tradable pair.
    setMarketList(marketResult.value);
    const selected=marketResult.value.find(item=>{
     const marketSymbol=item.sym.toUpperCase();
     return marketSymbol===marketBase||marketSymbol===symbol;
    })||null;
    if(selected){
     setTicker(selected);
     setMarketFeedWarning("");
     if(!isPriceManualRef.current && selected.source && selected.source!=="demo-preview" && selected.source!=="sample-data"){ setPrice(String(selected.price)); }
    }else{setTicker(null);setPrice("");setMarketFeedWarning(t("Market data is temporarily unavailable."));}
   }else{setTicker(null);setPrice("");setError(t("Market data is temporarily unavailable."));}
   // initial load: a null book means the depth feed is unavailable, and the
   // panel renders its own empty state.
   setBook(bookResult.status==="fulfilled"?bookResult.value:null);
   if(statusResult.status==="fulfilled")setTradingStatus(statusResult.value);
   else setTradingStatus(null);
   if(ordersResult.status==="fulfilled")setOrders(ordersResult.value);
   else if(ordersResult.reason instanceof ApiError && ordersResult.reason.code!=="AUTH_REQUIRED")setError(t("Account data is temporarily unavailable."));
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
     const selected=marketResult.value.find(item=>{
     const marketSymbol=item.sym.toUpperCase();
     return marketSymbol===marketBase||marketSymbol===symbol;
    })||null;
     if(selected){
      setTicker(selected);
      if(!isPriceManualRef.current && selected.price && selected.source && selected.source!=="demo-preview" && selected.source!=="sample-data"){ setPrice(String(selected.price)); }
     }else{setTicker(null);failed=true;}
    }else{setTicker(null);failed=true;}
    if(bookResult.status==="fulfilled"){setBook(bookResult.value);if(!bookResult.value)failed=true;}
    else{setBook(null);failed=true;}
    setMarketFeedWarning(failed?t("Market data is temporarily unavailable."):"");
   }).finally(()=>{window.clearTimeout(timeoutId);refreshing=false;});
  };
// The ticker and order book poll every 5 s; the gateway cache window absorbs
// shared load, while the local 90 s staleness guard disables entry on a gap.
  const refreshId=window.setInterval(refreshMarketData,5000);
  return ()=>{cancelled=true;window.clearInterval(refreshId);};
 },[symbol]);

 // Chart interval changes never reset an edited order or a pending idempotent request.
 useEffect(()=>{
  if(isPhone){setCandles([]);setChartFeedWarning("");return;}
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
    if(!cancelled){setCandles([]);setChartFeedWarning(t("Chart data is temporarily unavailable."));}
   }).finally(()=>{window.clearTimeout(timeout);refreshing=false;});
  };
  setCandles([]);load();
  const timer=window.setInterval(load,30000);
  return ()=>{cancelled=true;pending?.abort();window.clearInterval(timer);};
 },[symbol,chartInterval,reload,isPhone]);

 useEffect(()=>{
  setPendingIntent(null);setPendingIntentInvalid(false);
  if(!accountUid||!pendingStorageKey)return;
  try{
   const raw=window.localStorage.getItem(pendingStorageKey);
   if(!raw)return;
   const saved=JSON.parse(raw) as Parameters<typeof submitSpotOrder>[0];
   if(saved&&saved.symbol===symbol&&saved.type==="limit"&&(saved.side==="buy"||saved.side==="sell")&&typeof saved.qty==="string"&&typeof saved.price==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(saved.client_order_id)){
    setPendingIntent(saved);setSide(saved.side);setQuantity(saved.qty);setPrice(saved.price);
   }else{setPendingIntentInvalid(true);setError("We couldn't verify your pending order. Check order history before placing another order.");}
  }catch{setPendingIntentInvalid(true);setError("We couldn't verify your pending order. Check order history before placing another order.");}
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
  const chart=createChart(node,{width:node.clientWidth,height:node.clientHeight||320,handleScroll:{vertTouchDrag:false,horzTouchDrag:true},handleScale:{pinch:true},layout:{attributionLogo:false,background:{type:ColorType.Solid,color:CHART_THEME.background},textColor:CHART_THEME.text},grid:{vertLines:{color:CHART_THEME.grid},horzLines:{color:CHART_THEME.grid}},rightPriceScale:{borderColor:CHART_THEME.border},timeScale:{borderColor:CHART_THEME.border,timeVisible:true,secondsVisible:false,rightOffset:6,minBarSpacing:5}});
  const series=chart.addSeries(CandlestickSeries,{upColor:CHART_THEME.up,downColor:CHART_THEME.down,borderVisible:false,wickUpColor:CHART_THEME.up,wickDownColor:CHART_THEME.down});
  series.setData(candles.map(item=>({time:Math.floor(item.time) as UTCTimestamp,open:item.open,high:item.high,low:item.low,close:item.close})).sort((a,b)=>Number(a.time)-Number(b.time)));
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

 const priceFormatValid=/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)&&compareDecimalStrings(price,"0")===1;
 const quantityFormatValid=/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)&&compareDecimalStrings(quantity,"0")===1;
 const estimatedNotional=priceFormatValid&&quantityFormatValid?multiplyDecimalStrings(price,quantity):undefined;
 const priceStepValid=!!spotPairRules&&isDecimalMultipleOfStep(price,spotPairRules.price_tick);
 const quantityStepValid=!!spotPairRules&&isDecimalMultipleOfStep(quantity,spotPairRules.quantity_step);
 const minimumQuantityValid=!!spotPairRules&&(compareDecimalStrings(quantity,spotPairRules.min_quantity)??-1)>=0;
 const minimumNotionalValid=!!spotPairRules&&!!estimatedNotional&&(compareDecimalStrings(estimatedNotional,spotPairRules.min_notional)??-1)>=0;
 const minimumPriceValid=!!spotPairRules&&(!spotPairRules.min_limit_price||(compareDecimalStrings(price,String(spotPairRules.min_limit_price))??-1)>=0);
 const maximumPriceValid=!!spotPairRules&&(!spotPairRules.max_limit_price||(compareDecimalStrings(price,String(spotPairRules.max_limit_price))??1)<=0);
 const orderInputsValid=priceFormatValid&&quantityFormatValid&&priceStepValid&&quantityStepValid&&minimumQuantityValid&&minimumNotionalValid&&minimumPriceValid&&maximumPriceValid;
 const orderRuleError=!spotPairRules?"Market trading rules are unavailable. Order entry is disabled.":price&&quantity&&!orderInputsValid?"Price must follow the market tick; quantity must follow the step and minimum order rules.":"";
 const requiredBalance=side==="buy"?estimatedNotional:quantity;
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
  if(tickerIsFallback&&!pendingIntent){setError("Live market data is unavailable. No order was sent.");return;}
   if((!ticker||marketSnapshotStale)&&!pendingIntent){setError("A fresh timestamped market snapshot is required before placing a new order. No order was sent.");return;}
  if(spotCatalogDegraded&&!pendingIntent){setError("Market data is read-only while exchange configuration is unavailable. No order was sent.");return;}
  if(!spotPairEnabled&&!pendingIntent){setError("This spot pair is not enabled by BTCBOX operators. No order was sent.");return;}
  if(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent){setError("Spot order execution is currently disabled by server policy. No order was placed.");return;}
  if(!pendingIntent&&!orderInputsValid){setError(orderRuleError||"Enter a valid limit price and quantity.");return;}
 if(!pendingIntent&&(balanceUnavailable||insufficientBalance||tickerIsFallback)){setError(insufficientBalance?"Insufficient available balance":"Account identity is unavailable. No order was sent.");return;}
  // A retained pending intent is already mid-flight from a previous attempt and
  // must be retried as-is; it never goes through the confirmation dialog again.
  if(pendingIntent){await sendOrder(pendingIntent, false);return;}

  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)||Number(quantity)<=0||!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(price)||Number(price)<=0){setError("Enter a valid limit price and quantity.");return;}
  if(!pendingStorageKey){setError(t("Sign in to continue"));return;}

  // Decide whether this order warrants an explicit confirmation.
  const notional=Number(price)*Number(quantity);
  const marketPrice=displayTicker?Number(displayTicker.price):null;
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
   if(!pendingStorageKey){setError(t("Sign in to continue"));return;}
   try{window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent));}
   catch{setError("This browser cannot safely save the order request. No order was sent.");return;}
   setPendingIntent(intent);
  }
  // Orders are executed and confirmed only by the exchange API. The browser
  // must never create a local fill or mutate a paper ledger in the live terminal.
  setBusy(true);setError("");setNotice("");
  let orderAccepted=false;
  try{
   const result=await submitSpotOrder(intent);
   orderAccepted=true;
   const latest=await getOrders();
   setOrders(latest);
   const confirmed=latest.some(item=>String(item.order_id??item.id??"")===result.order_id);
   if(!confirmed){setError("Your order status is not yet confirmed. Check order history before trying again.");return;}
   try{window.localStorage.removeItem(pendingStorageKey);}catch{}
   setPendingIntent(null);setPendingIntentInvalid(false);setQuantity("");
   setNotice(result.duplicate?"This order request was already recorded and confirmed.":"Limit order accepted and confirmed in order history.");
  }catch(reason){
   setError(t("Order result is unconfirmed. Keep the same request ID and check order history before retrying."));
   if(!orderAccepted&&reason instanceof ApiError&&(reason.status===400||reason.status===401||reason.status===403||reason.code==="MATCHING_ENGINE_UNAVAILABLE")){
    try{window.localStorage.removeItem(pendingStorageKey);}catch{}
    setPendingIntent(null);setPendingIntentInvalid(false);
   }
  }finally{setBusy(false);}
 };
 const confirmOrderPreview = () => {
  const preview = orderPreview;
  if (!preview || busy) return;
  setOrderPreview(null);
  void sendOrder({
   symbol,
   side: preview.side,
   type: "limit",
   qty: preview.quantity,
   price: preview.price,
   client_order_id: window.crypto.randomUUID(),
  }, true);
 };
 const orderConfirmation = <OrderConfirmDialog
  open={!!orderPreview}
  preview={orderPreview}
  busy={busy}
  onCancel={() => setOrderPreview(null)}
  onConfirm={confirmOrderPreview}
 />;
 const cancelOrder=async(order:OrderRecord)=>{
  const orderId=String(order.order_id??order.id??"");if(!orderId)return;
  if(!accountUid){setError(t("Sign in to continue"));return;}
  const storageKey="btcbox.spot.cancel.v1."+accountUid+"."+orderId;
  let requestId=cancelRequestIds[orderId];
  if(requestId==="storage_unavailable"){setError(t("Account data is temporarily unavailable."));return;}
  if(!requestId){
   requestId=window.crypto.randomUUID();
   try{window.localStorage.setItem(storageKey,requestId);}
   catch{setError(t("Account data is temporarily unavailable."));return;}
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
   if(!["cancelled","canceled","rejected"].includes(status)){setError("Your cancellation status is not yet confirmed. Refresh order history before trying again.");return;}
   try{window.localStorage.removeItem(storageKey);}catch{}
   setCancelRequestIds(current=>{const next={...current};delete next[orderId];return next;});
   setNotice(result.duplicate?"This cancellation was already recorded and confirmed.":"Order cancellation confirmed in order history.");
  }catch(reason){
   setError(t("Order result is unconfirmed. Keep the same request ID and check order history before retrying."));
   if(!cancelAccepted&&reason instanceof ApiError&&reason.status>=400&&reason.status<500&&reason.status!==409){
    try{window.localStorage.removeItem(storageKey);}catch{}
    setCancelRequestIds(current=>{const next={...current};delete next[orderId];return next;});
   }
  }finally{setBusy(false);}
 };
 const amountText=(value:unknown)=>value===null||value===undefined||value===""?"—":Number.isFinite(Number(value))?Number(value).toLocaleString(localeTags[language],{maximumFractionDigits:8}):String(value);
 const adjustPrice=(direction:number)=>{
  const step=spotPairRules?.price_tick;
  if(!step)return;
  const raw=price||String(displayTicker?.price??"");
  const next=addDecimalStep(raw,step,direction===1?1:-1);
  if(next)setPrice(next);
 };
 // Quantity stepper (spec §27). It only nudges the displayed string by one unit
 // of the value's own precision — the authoritative precision and minimum-order
 // limits are still enforced by the existing submit validation.
 const adjustQuantity=(direction:number)=>{
  const step=spotPairRules?.quantity_step;
  if(!step)return;
  const next=addDecimalStep(quantity||"0",step,direction===1?1:-1);
  setQuantity(next==="0"?"":next);
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
 //   middle 20% full-height order book
 //   right  22% order form (buy/sell, limit/market, balance, slider)
 // Below this breakpoint the existing mobile/compact flow is untouched.
 // ---------------------------------------------------------------------------
 const isAuthenticated=authStatus==="authenticated";
 const tradingInactive=!!tradingStatus&&tradingStatus.spot_order_entry_enabled!==true;
 const staleSnapshot=!!ticker&&marketSnapshotStale;
 const bannerKey=[effectiveMarketFeedWarning,chartFeedWarning,spotCatalogDegraded?"catalog-read-only":"",tradingInactive?"engine":"",staleSnapshot?"stale":""].join("|");
 const bannerVisible=(effectiveMarketFeedWarning||chartFeedWarning||spotCatalogDegraded||tradingInactive||staleSnapshot)&&!dismissedBanners.includes(bannerKey);
 const bannerText=[effectiveMarketFeedWarning,chartFeedWarning,(spotCatalogDegraded||staleSnapshot||tradingInactive)?t("Trading is temporarily unavailable."):""].filter(Boolean).join(" · ");
 const bannerDismissed=!bannerVisible&&dismissedBanners.includes(bannerKey);
 const orderHistory=orders.filter(item=>!["open","partially_filled","partially-filled","pending"].includes(String(item.status||"").toLowerCase()));
 // Executed orders only. Derived from the same authenticated `/api/orders`
 // payload — the fills tab never invents a trade or a fee.
 const filledOrders=orderHistory.filter(item=>["filled","completed","partially_filled","partially-filled"].includes(String(item.status||"").toLowerCase()));
 const entryDisabledReason=!tradingStatus?t("Spot execution status is unavailable. Order entry is disabled."):spotCatalogDegraded?t("Trading is temporarily unavailable."):tradingInactive?t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled."):staleSnapshot?t("Market snapshot is older than 90 seconds. Quotes and new order entry are disabled until fresh data arrives."):!spotPairEnabled?t("This spot market is not enabled by BTCBOX operators."):!spotPairRules?t("Market trading rules are unavailable. Order entry is disabled."):orderRuleError?t(orderRuleError):"";
 const pickBookPrice=(nextPrice:string, bookSide?:"ask"|"bid")=>{
    // Match the selected level and side to the same order-entry state on desktop
    // and mobile: asks populate a buy, bids populate a sell.
    const decimals = DECIMALS_BY_PRECISION[effectiveDepthPrecision];
    setPrice(spotPairRules ? roundDecimalToStep(nextPrice, spotPairRules.price_tick) : Number(nextPrice).toFixed(decimals));
    if(bookSide)setSide(bookSide==="ask"?"buy":"sell");
    isPriceManualRef.current=true;
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
    <span className="term-top-price font-mono tabular-nums"><span key={displayTicker?amountText(displayTicker.price):"—"} className={"inline-block anim-price-tick "+(displayTicker?.chg===undefined||displayTicker?.chg===null?"text-brand-text":displayTicker.chg>=0?"text-profit":"text-loss")}>{displayTicker?amountText(displayTicker.price):"—"}</span></span>
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
    <span className="min-w-0 flex-1">{t(effectiveMarketFeedWarning || "行情连接已断开，暂时无法获取最新价格。请稍后重试。")}</span>
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
   {error?<div role="alert" aria-live="assertive" className="term-banner">{t(error)}</div>:null}
   {notice?<div role="status" aria-live="polite" className="term-banner">{t(notice)}</div>:null}
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
      changePercent={displayTicker?.chg??null}
      precision={effectiveDepthPrecision}
      onPrecisionChange={value=>setDepthPrecision(value)}
      view={bookView as BookView}
      onViewChange={value=>setBookView(value)}
      onPickPrice={pickBookPrice}
      usdtUsd={usdtUsd}
      rows={6}
     />
    </section>
    <aside id="trade-entry" className="term-col term-col--entry" aria-label={t("Order form")}>
     <TerminalOrderForm
      base={base}
      side={side}
      onSideChange={setSide}
      orderType={orderType as OrderType}
      onOrderTypeChange={value=>setOrderType(value)}
      price={price}
      onPriceChange={value=>{setPrice(value);isPriceManualRef.current=true;}}
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
      quoteVolume:ticker?.vol??null,
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
    <span className={"spot-quote-price font-mono tabular-nums "+(displayTicker?.chg===undefined||displayTicker?.chg===null?"text-brand-text":displayTicker.chg>=0?"text-profit":"text-loss")}>{displayTicker?amountText(displayTicker.price):"—"}</span>
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
  {/* Shared trading workspace: phones show order entry and order book side by side;
      the chart is moved to the drawer and open orders span the row below. */}
  <div className="exchange-workspace" id="trade-workspace">
    {/* Desktop inline chart (spec §3): the central column owns the candles.
        Phones never mount it inline — they use the safe-area drawer instead, so
        only one `setChartNode` target exists at a time. */}
    {!compactTrade&&!isPhone?!chartOpen&&chartPanel:null}
    <Card aria-label={t("Order book")} id="trade-depth" className="exchange-depth scroll-mt-16 border-brand-border bg-brand-surface"><CardContent className="spot-depth-content space-y-1.5"><div className="spot-book-toolbar spot-book-toolbar--top"><label><span className="sr-only">{t("Depth precision")}</span><select aria-label={t("Depth precision")} value={effectiveDepthPrecision} onChange={event=>setDepthPrecision(event.target.value as DepthPrecision)}>{pairPrecisionOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></label><div className="spot-book-view" role="group" aria-label={t("Order book")}><button type="button" aria-label={t("Both sides")} aria-pressed={bookView==="both"} onClick={()=>setBookView("both")}><Columns2 className="h-3.5 w-3.5"/></button><button type="button" aria-label={t("Bids only")} aria-pressed={bookView==="bids"} onClick={()=>setBookView("bids")}><TrendingUp className="h-3.5 w-3.5"/></button><button type="button" aria-label={t("Asks only")} aria-pressed={bookView==="asks"} onClick={()=>setBookView("asks")}><TrendingDown className="h-3.5 w-3.5"/></button></div></div>{displayBook?<><div className="spot-book-columns"><span>{t("Price")}</span><span>{t("Quantity")}</span><span className="spot-book-cum"></span></div><div className="exchange-book-levels"><div className={bookView==="bids"?"hidden":""}>{asks.length?asks.map((row,index)=><div key={index} className="spot-book-row spot-book-row--click font-mono tabular-nums cursor-pointer" data-side="ask" style={{backgroundSize:askDepth[index]+"% 100%"}} onClick={()=>{setPrice(String(row[0]));setSide("buy");isPriceManualRef.current=true;}}><span title={String(row[0])} className="text-right text-loss">{amountText(row[0])}</span><span title={String(row[1])} className="text-right text-brand-text-muted">{amountText(row[1])}</span><span className="spot-book-cum text-right text-brand-text-muted">{amountText(askCumulative[index])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div><p className="spot-mid-price font-mono tabular-nums"><span className={"inline-flex items-center gap-1 "+(Number(ticker?.chg||0)>=0?"text-profit":"text-loss")}>{Number(ticker?.chg||0)>=0?<TrendingUp className="h-4 w-4"/>:<TrendingDown className="h-4 w-4"/>}<span key={displayTicker?amountText(displayTicker.price):"—"} className="inline-block anim-price-tick font-bold">{displayTicker?amountText(displayTicker.price):"—"}</span></span></p><div className={bookView==="asks"?"hidden":""}>{bids.length?bids.map((row,index)=><div key={index} className="spot-book-row spot-book-row--click font-mono tabular-nums cursor-pointer" data-side="bid" style={{backgroundSize:bidDepth[index]+"% 100%"}} onClick={()=>{setPrice(String(row[0]));setSide("sell");isPriceManualRef.current=true;}}><span title={String(row[0])} className="text-right text-profit">{amountText(row[0])}</span><span title={String(row[1])} className="text-right text-brand-text-muted">{amountText(row[1])}</span><span className="spot-book-cum text-right text-brand-text-muted">{amountText(bidCumulative[index])}</span></div>):<p className="text-xs text-brand-text-muted">—</p>}</div></div></>:<div className="space-y-1.5 py-2" role="status" aria-label={t("Loading order book")}>{[0,1,2,3,4,5,6,7].map(i=><div key={i} className="h-5 animate-pulse rounded bg-brand-surface-2"/>)}</div>}</CardContent></Card>
    <Card id="trade-entry" className="exchange-entry scroll-mt-16 border-brand-border bg-brand-surface"><CardHeader className="spot-entry-head"><div className="spot-side grid grid-cols-2 gap-1.5"><Button aria-pressed={side==="buy"} variant={side==="buy"?"default":"outline"} onClick={()=>setSide("buy")} disabled={busy||!!pendingIntent||pendingIntentInvalid}>{t("Buy")}</Button><Button aria-pressed={side==="sell"} variant={side==="sell"?"destructive":"outline"} onClick={()=>setSide("sell")} disabled={busy||!!pendingIntent}>{t("Sell")}</Button></div></CardHeader><CardContent className="space-y-2"><label className="spot-order-type"><span className="sr-only">{t("Order type")}</span><select aria-label={t("Order type")} value={orderType} disabled={busy||!!pendingIntent} onChange={event=>setOrderType(event.target.value as "limit"|"market")}><option value="limit">{t("Limit order")}</option><option value="market">{t("Market order")}</option></select></label>{orderType==="market"?<div className="spot-policy">{t("Market orders are unavailable under the current trading contract. Switch to limit order to continue.")}</div>:null}<p className="spot-available"><span>{t("Available balance")}</span><strong>{availableBalances[side==="buy"?"USDT":base]?.free!==undefined?formatDecimalAmount(availableBalances[side==="buy"?"USDT":base].free,localeTags[language]):"—"} {side==="buy"?"USDT":base}</strong></p><form className="space-y-2" onSubmit={event=>void submitOrder(event)}><label className="block space-y-1 text-sm"><span>{t("Limit price (USDT)")}</span><div className="spot-price-control"><button type="button" aria-label={t("Decrease price")} disabled={busy||!!pendingIntent} onClick={()=>adjustPrice(-1)}><Minus className="h-3.5 w-3.5"/></button><input aria-label={t("Limit price (USDT)")} value={price} onChange={event=>{setPrice(event.target.value);isPriceManualRef.current=true;}} disabled={busy||!!pendingIntent} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" required/><button type="button" aria-label={t("Increase price")} disabled={busy||!!pendingIntent} onClick={()=>adjustPrice(1)}><Plus className="h-3.5 w-3.5"/></button></div></label><div className="spot-quick-prices grid grid-cols-5 gap-1">{[-1,-0.5,0,0.5,1].map(pct=>{const priceFactor=pct===-1?"0.99":pct===-0.5?"0.995":pct===0?"1":pct===0.5?"1.005":"1.01";const calculated=displayTicker?multiplyDecimalStrings(String(displayTicker.price),priceFactor):undefined;const snapped=spotPairRules&&calculated?roundDecimalToStep(calculated,spotPairRules.price_tick):"";return <button key={pct} type="button" disabled={busy||!!pendingIntent||!displayTicker?.price||!spotPairRules} onClick={()=>{setPrice(snapped);isPriceManualRef.current=true;}} className="min-h-9 rounded-md border border-brand-border bg-brand-surface-2 text-[10px] font-semibold tabular-nums text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-50">{pct===0?t("Latest"):(pct>0?"+":"")+pct+"%"}</button>;})}</div><label className="block space-y-1 text-sm"><span>{t("Quantity")} · {base}</span><div className="spot-qty-control"><button type="button" aria-label={t("Decrease quantity")} disabled={busy||!!pendingIntent} onClick={()=>adjustQuantity(-1)}><Minus className="h-3.5 w-3.5"/></button><input aria-label={t("Quantity")+" · "+base} value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy||!!pendingIntent} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" required/><button type="button" aria-label={t("Increase quantity")} disabled={busy||!!pendingIntent} onClick={()=>adjustQuantity(1)}><Plus className="h-3.5 w-3.5"/></button></div></label><div className="spot-percent-steps grid grid-cols-4 gap-1">{[25,50,75,100].map(pct=><button key={pct} type="button" disabled={busy||!!pendingIntent} onClick={()=>{const free=String(availableBalances[side==="buy"?"USDT":base]?.free??"0");const fraction=String(pct/100);const allocation=multiplyDecimalStrings(free,fraction);const desired=side==="buy"&&allocation?divideDecimalStrings(allocation,price):side==="sell"?allocation:undefined;setQuantity(spotPairRules&&desired?floorDecimalToStep(desired,spotPairRules.quantity_step):"");}} className="min-h-9 rounded-md border border-brand-border bg-brand-surface-2 text-xs font-semibold tabular-nums text-brand-text-muted transition-colors hover:border-brand-accent/40 hover:text-brand-accent disabled:opacity-50">{pct}%</button>)}</div><p className="spot-total hidden">{t("Estimated total")}: {price&&quantity&&Number(price)>0&&Number(quantity)>0?amountText(multiplyDecimalStrings(price,quantity))+" USDT":"—"}</p>{orderRuleError?<p className="text-xs text-brand-danger" role="status">{t(orderRuleError)}</p>:null}{pendingIntent?<p className="break-all text-xs text-brand-warning">{t("Unconfirmed request ID. Keep the form unchanged and retry with the same ID.")} · {pendingIntent.client_order_id}</p>:null}<Button className={"w-full spot-submit spot-submit--"+side} type="submit" disabled={busy||pendingIntentInvalid||(!pendingIntent&&(!orderInputsValid||balanceUnavailable||insufficientBalance||tickerIsFallback))||(!ticker||marketSnapshotStale)&&!pendingIntent||(!spotPairEnabled&&!pendingIntent)||(!tradingStatus?.spot_order_entry_enabled&&!pendingIntent)||!price||!quantity||orderType!=="limit"}>{busy?t("Submitting…"):pendingIntent?t("Retry same order"):insufficientBalance?t("Insufficient available balance"):side==="buy"?t("Buy")+" "+base:t("Sell")+" "+base}</Button>{!tradingStatus?.spot_order_entry_enabled?<div className="spot-policy hidden">{t("Spot order execution is disabled by server policy. No order can be placed until the matching engine is approved and enabled.")}</div>:null}</form></CardContent></Card>
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

 </PageFrame>;
 const terminalBody=compactTrade||isPhone?<>{compactTerminal}{orderConfirmation}</>:<>{proTerminal}{orderConfirmation}</>;
 // Compact viewports below 1024px use the same bottom-anchored K-line drawer
 // as the perpetual page. The desktop inline chart remains at 1280px and above.
 if (isPhone) {
  return <><ChartDrawer symbol={symbol} marketType="spot" open={chartOpen} onOpenChange={setChartOpen} />{terminalBody}</>;
 }
 return <Dialog.Root open={chartOpen} onOpenChange={setChartOpen}>{terminalBody}<Dialog.Portal><Dialog.Overlay className="spot-chart-overlay"/><Dialog.Content className="spot-chart-drawer" aria-label={t("Price chart")} onCloseAutoFocus={event=>{event.preventDefault();chartTrigger.current?.focus();}}><button type="button" className="spot-chart-close" aria-label="Close chart" onClick={()=>setChartOpen(false)}>×</button>{chartPanel}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function SectionPage({title,description}:{title:string;description:string}){const {t}=useI18n();return <PageFrame title={title} tone="market"><Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-start gap-3 p-4 sm:p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface-2 text-brand-text-muted"><LockKeyhole className="h-5 w-5"/></span><Badge variant="outline" className="shrink-0 border-brand-border text-brand-text-muted">{t("Unavailable")}</Badge><p className="type-body-compact min-w-0 flex-1 text-brand-text-muted">{t("This service is not currently available. Please check back later.")}</p></CardContent></Card></PageFrame>}


async function prepareKycDocumentImage(file: File): Promise<{
 document_content_type: "image/jpeg";
 document_image_base64: string;
}> {
 const fileType = String(file.type || "").toLowerCase();
 const supportedExtension = /\.(?:jpe?g|png|webp|heic|heif)$/i.test(file.name || "");
 if (!fileType.startsWith("image/") && !supportedExtension) {
  throw new Error("Choose an image file such as JPEG, PNG, WebP, or HEIC.");
 }
 // Bound the original file before decoding it. The upload itself is capped at 2 MiB.
 if (!file.size || file.size > 5 * 1024 * 1024) {
  throw new Error("The selected image must be 5 MB or smaller before compression.");
 }

 const objectUrl = URL.createObjectURL(file);
 let bitmap: ImageBitmap | null = null;
 let imageSource: CanvasImageSource | null = null;
 let fallbackImage: HTMLImageElement | null = null;
 let canvas: HTMLCanvasElement | null = null;
 try {
  // Prefer createImageBitmap, but keep the native Image fallback for mobile codecs.
  if (typeof createImageBitmap === "function") {
   try { bitmap = await createImageBitmap(file, { resizeWidth: 1600, resizeQuality: "high" }); } catch { bitmap = null; }
  }
  if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
   imageSource = bitmap;
  } else {
   bitmap?.close();
   bitmap = null;
   fallbackImage = new Image();
   fallbackImage.decoding = "async";
   await new Promise<void>((resolve, reject) => {
    fallbackImage!.onload = () => resolve();
    fallbackImage!.onerror = () => reject(new Error("This browser cannot read this photo format. Choose a JPEG or PNG image."));
    fallbackImage!.src = objectUrl;
   });
   imageSource = fallbackImage;
  }

  const sourceWidth = bitmap?.width || fallbackImage?.naturalWidth || 0;
  const sourceHeight = bitmap?.height || fallbackImage?.naturalHeight || 0;
  if (!imageSource || !sourceWidth || !sourceHeight) {
   throw new Error("The selected image could not be decoded. Choose a clear JPEG or PNG photo.");
  }

  // Keep canvas allocations bounded and reuse one canvas across compression attempts.
  const scale = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.round(sourceWidth * scale));
  let height = Math.max(1, Math.round(sourceHeight * scale));
  canvas = document.createElement("canvas");
  let blob: Blob | null = null;
  const qualitySteps = [0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44];
  for (let attempt = 0; attempt < qualitySteps.length; attempt++) {
   canvas.width = width;
   canvas.height = height;
   const context = canvas.getContext("2d");
   if (!context) throw new Error("This browser cannot prepare the document image.");
   context.fillStyle = "#ffffff";
   context.fillRect(0, 0, width, height);
   context.drawImage(imageSource, 0, 0, width, height);
   blob = await new Promise<Blob | null>(resolve => canvas!.toBlob(resolve, "image/jpeg", qualitySteps[attempt]));
   if (blob && blob.size <= 2 * 1024 * 1024) break;
   width = Math.max(1, Math.round(width * 0.88));
   height = Math.max(1, Math.round(height * 0.88));
  }
  if (!blob || blob.size > 2 * 1024 * 1024) {
   throw new Error("The image could not be compressed below 2 MB. Choose a smaller or clearer photo.");
  }

  // Convert the compressed Blob directly; avoid a second full-size data URL copy.
  let bytes = new Uint8Array(await blob.arrayBuffer());
  const binaryChunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
   binaryChunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  const encoded = btoa(binaryChunks.join(""));
  binaryChunks.length = 0;
  bytes = new Uint8Array(0);
  if (!encoded) throw new Error("The document image could not be prepared.");
  return { document_content_type: "image/jpeg", document_image_base64: encoded };
 } finally {
  if (canvas) { canvas.width = 0; canvas.height = 0; }
  bitmap?.close();
  imageSource = null;
  fallbackImage = null;
  URL.revokeObjectURL(objectUrl);
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
   // Local development renders the form without a session; a 401 is expected
   // there and must not replace the page with an error card.
   const authRequired=reason instanceof ApiError&&(reason.status===401||reason.code==="AUTH_REQUIRED");
   if(authRequired&&DEV_OPEN_ACCOUNT_PAGES){if(!controller.signal.aborted){setAccount({...DEV_ACCOUNT_PLACEHOLDER} as unknown as AccountSnapshot);setError("");}return;}
   if(!controller.signal.aborted){setAccount(null);setError(t("Account data is temporarily unavailable."));}
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
  catch(reason){setSubmitError(t("Verification submission could not be confirmed. Refresh your status before retrying."));}
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
   <div className="block space-y-2 text-sm"><span>{t("Identity document image")}</span><label className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${documentFile?"border-brand-accent/50 bg-brand-accent/[.04]":"border-brand-border bg-brand-surface-2 hover:border-brand-accent/40"} ${submitting?"pointer-events-none opacity-60":""}`}><input type="file" accept="image/*" disabled={submitting} onChange={event=>{setDocumentFile(event.target.files?.[0]||null);setSubmitError("");}} className="sr-only"/>{documentFile?<><span className="text-sm font-semibold text-brand-accent">{documentFile.name}</span><span className="text-xs text-brand-text-muted">{t("Tap to upload")}</span></>:<><span className="text-sm font-semibold text-brand-text">{t("Tap to upload")}</span><span className="text-xs text-brand-text-muted">{t("JPEG, PNG or WebP. Maximum original size 5 MB; securely compressed to 2 MB. Upload a clear, readable image.")}</span></>}</label></div>
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
 const location=useLocation();
 const requestedBack=(location.state as {from?:string}|null)?.from;
 const supportBackTo=requestedBack==="/home"||requestedBack==="/me"?requestedBack:"/me";
 const {status}=useAuth();
 // The conversation itself lives in features/support/SupportChat so the support
 // module owns its own state, retry contract and API calls.
 return <PageFrame title="Customer support" tone="support" onBack={()=>navigate(supportBackTo, { replace: true })}>
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

/**
 * Second-level funds directory. Keeps deposit and withdrawal as separate
 * third-level workflows instead of sending users directly from Assets.
 */
export function FundsPage(){
 const {t}=useI18n();
 const services=[
  {title:"Deposit",description:"Deposit address",to:"/deposit",icon:ArrowDownToLine},
  {title:"Withdraw",description:"Submit withdrawal",to:"/withdraw",icon:ArrowUpFromLine},
 ];
 return <PageFrame title="Funds" tone="assets" backTo="/assets" className="funds-flow-page">
  <div className="mx-auto grid w-full max-w-3xl min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
   {services.map(({title,description,to,icon:Icon})=><Link key={to} to={to} className="group flex min-w-0 items-center gap-4 rounded-xl border border-white/[0.08] bg-brand-surface p-5 transition-colors hover:border-brand-accent/40 hover:bg-brand-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:p-6">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5"/></span>
    <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-brand-text">{t(title)}</span><span className="mt-1 block text-sm text-brand-text-muted">{t(description)}</span></span>
    <ChevronRight className="h-5 w-5 shrink-0 text-brand-text-muted transition-transform group-hover:translate-x-0.5"/>
   </Link>)}
  </div>
 </PageFrame>;
}

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
   if(!navigator.clipboard?.writeText)throw new Error(t("Unable to copy. Please try again."));
   await navigator.clipboard.writeText(address);
   setCopyMessage("Deposit address copied.");
  }catch{
   setCopyMessage(t("Unable to copy. Please try again."));
  }
 };
 useEffect(()=>{
  const controller=new AbortController();
  setAddress("");setError("");setCopyMessage("");setLoading(true);
  getDepositAddress(coin,network,controller.signal).then(value=>{
   if(!controller.signal.aborted)setAddress(value);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted){setAddress("");setError(t("Account data is temporarily unavailable."));}
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
   if(!controller.signal.aborted){setDepositHistory([]);setHistoryError(t("Account data is temporarily unavailable."));}
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
 return <PageFrame title="Deposit" tone="assets" backTo="/assets" className="funds-flow-page">
  <div className="mx-auto w-full max-w-3xl space-y-5">
  <Card className="relative overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Wallet className="h-5 w-5"/></span><div><CardTitle>{t("Deposit address")}</CardTitle></div></div></CardHeader><CardContent className="space-y-5 p-4 sm:p-6">
   <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Asset")}</span><select value={coin} onChange={e=>changeCoin(e.target.value)} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{Object.keys(depositNetworks).map(x=><option key={x}>{x}</option>)}</select></label><label className="space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Network")}</span><select value={network} onChange={e=>changeNetwork(e.target.value)} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">{depositNetworks[coin].map(x=><option key={x}>{x}</option>)}</select></label></div>
   {loading?<p className="rounded-xl border border-brand-border p-4 text-sm text-brand-text-muted" role="status">{t("Loading configured deposit address…")}</p>
    :error?<div className="rounded-xl border border-brand-danger/30 bg-brand-danger/[.04] p-4"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>
   :<div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-brand-text-muted">{coin} · {network}</p><div className="rounded-xl border border-brand-accent/20 bg-brand-surface p-4 ring-1 ring-brand-accent/[0.04]"><div className="break-all font-mono text-sm leading-6 text-brand-text">{address}</div></div><Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" disabled={!address} onClick={copyAddress}>{t("Copy address")}</Button>{copyMessage?<p className="text-xs text-brand-text-muted" role="status" aria-live="polite">{t(copyMessage)}</p>:null}</div>}
   <div className="rounded-xl border border-brand-border bg-brand-surface-2/60 p-4 text-sm text-brand-text-secondary"><p>{t("Only send the selected asset on the selected network. Incorrect deposits may be lost. BTCBOX verifies deposits and credits them manually.")}</p></div>
  </CardContent></Card>
  <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><CardHeader className="border-b border-brand-border bg-brand-surface-2/60"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Clock3 className="h-4 w-4"/></span><CardTitle>{t("Deposit history")}</CardTitle></div></div></CardHeader><CardContent className="space-y-3 p-5 sm:p-6">
   {historyLoading?<p className="text-sm text-brand-text-muted" role="status">{t("Loading deposit history…")}</p>
   :historyError?<p className="text-sm text-brand-danger" role="alert">{t(historyError)}</p>
   :depositHistory.length?depositHistory.map((item,index)=><div key={item.id||`${item.time||"deposit"}-${item.coin}-${index}`} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-2/40 p-4 transition-colors hover:bg-brand-surface-2/70"><div className="min-w-0"><p className="font-semibold">{item.amount} {item.coin} · {item.network||"—"}</p><p className="mt-1 text-xs text-brand-text-muted">{item.time||"—"}</p>{item.reference||item.txid?<p className="mt-1 break-all text-xs text-brand-text-muted">{t("Reference")}: {item.reference||item.txid}</p>:null}</div><Badge variant={depositStatusBadgeVariant(normalizeDepositStatus(item.status))}>{depositStatusLabel(normalizeDepositStatus(item.status), t)}</Badge></div>)
   :<p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No deposit history yet.")}</p>}
  </CardContent></Card>
  </div>
 </PageFrame>;
}


/**
 * Converts assets using a short-lived server-signed market quote and the
 * PostgreSQL atomic double-entry ledger. No client-side balance mutation.
 */
export function InternalConversionPage(){
 const {t,language}=useI18n();
 const [account,setAccount]=useState<AccountSnapshot|null>(null);
 const [fromAsset,setFromAsset]=useState("USDT");
 const [toAsset,setToAsset]=useState("BTC");
 const [amount,setAmount]=useState("");
 const [quote,setQuote]=useState<Awaited<ReturnType<typeof getInternalConversionQuote>>|null>(null);
 const [loading,setLoading]=useState(true);
 const [quoting,setQuoting]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [requestId,setRequestId]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  getAccount(controller.signal).then(snapshot=>{
   if(controller.signal.aborted)return;
   setAccount(snapshot);
   const assets=Object.keys(snapshot.balances||{}).sort();
   const nextFrom=assets.includes(fromAsset)?fromAsset:(assets.includes("USDT")?"USDT":assets[0]||"");
   const nextTo=assets.includes(toAsset)&&toAsset!==nextFrom?toAsset:(assets.find(asset=>asset!==nextFrom)||"");
   setFromAsset(nextFrom);setToAsset(nextTo);
  }).catch(reason=>{
   if(reason instanceof Error&&reason.name==="AbortError")return;
   if(!controller.signal.aborted)setError(localizedFailure(reason,"Account data is temporarily unavailable."));
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const assets=Object.keys(account?.balances||{}).sort();
 const fromBalance=account?.balances?.[fromAsset]?.free??"0";
 const toBalance=account?.balances?.[toAsset]?.free??"0";
 const resetQuote=()=>{setQuote(null);setRequestId("");setError("");setMessage("");};
 const getQuote=async()=>{
  if(!amount.trim()||!fromAsset||!toAsset||fromAsset===toAsset)return;
  setQuoting(true);setError("");setMessage("");setQuote(null);setRequestId("");
  try{
   const next=await getInternalConversionQuote(fromAsset,toAsset,amount.trim());
   setQuote(next);
   setRequestId(window.crypto.randomUUID());
  }catch(reason){setError(localizedFailure(reason,"Live conversion prices are temporarily unavailable."));}
  finally{setQuoting(false);}
 };
 const swapAssets=()=>{const previous=fromAsset;setFromAsset(toAsset);setToAsset(previous);resetQuote();};
 const confirm=async()=>{
  if(!quote||!requestId||submitting)return;
  setSubmitting(true);setError("");setMessage("");
  try{
   const result=await submitInternalConversion({request_id:requestId,quote_token:quote.quote_token});
   setMessage(result.duplicate?"This conversion was already processed.":"Conversion completed.");
   setQuote(null);setRequestId("");setAmount("");
   setReload(value=>value+1);
  }catch(reason){
   if(reason instanceof ApiError&&(reason.code==="CONVERSION_QUOTE_EXPIRED"||reason.code==="CONVERSION_QUOTE_USED")){setQuote(null);setRequestId("");setError(reason.code==="CONVERSION_QUOTE_EXPIRED"?"The conversion quote has expired. Request a new quote.":"This conversion quote has already been used. Request a new quote.");}
   else setError(localizedFailure(reason,"Conversion result is unconfirmed. Refresh your balances and check operation history before retrying."));
  }
  finally{setSubmitting(false);}
 };
 return <PageFrame title="Convert" tone="assets" backTo="/assets" className="funds-flow-page">
  <div className="mx-auto w-full max-w-2xl space-y-5">
   {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading wallet balances…")}</CardContent></Card>
   :!account?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("Account data is temporarily unavailable.")}</CardContent></Card>
   :<Card className="border border-white/[0.08] bg-brand-surface">
    <CardHeader className="border-b border-brand-border"><CardTitle>{t("Convert assets")}</CardTitle><CardDescription>{t("Convert between supported assets at a live market rate.")}</CardDescription></CardHeader>
    <CardContent className="space-y-4 p-4 sm:p-6">
     <div className="space-y-2 rounded-xl border border-brand-border bg-brand-surface-2/50 p-4">
      <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("From")}</span><select value={fromAsset} onChange={event=>{const next=event.target.value;setFromAsset(next);if(next===toAsset)setToAsset(assets.find(asset=>asset!==next)||"");resetQuote();}} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text">{assets.map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label>
      <div className="flex items-center justify-between text-xs text-brand-text-muted"><span>{t("Available balance")}</span><span className="font-mono tabular-nums">{formatDecimalAmount(fromBalance,localeTags[language])} {fromAsset}</span></div>
      <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")}</span><input inputMode="decimal" value={amount} onChange={event=>{setAmount(event.target.value);resetQuote();}} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent/60" /></label>
     </div>
     <div className="flex justify-center"><Button type="button" variant="outline" size="icon" aria-label={t("Swap assets")} onClick={swapAssets} disabled={submitting}><ArrowLeftRight className="h-4 w-4"/></Button></div>
     <div className="space-y-2 rounded-xl border border-brand-border bg-brand-surface-2/50 p-4">
      <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("To")}</span><select value={toAsset} onChange={event=>{setToAsset(event.target.value);resetQuote();}} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text">{assets.filter(asset=>asset!==fromAsset).map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label>
      <div className="flex items-center justify-between text-xs text-brand-text-muted"><span>{t("Current balance")}</span><span className="font-mono tabular-nums">{formatDecimalAmount(toBalance,localeTags[language])} {toAsset}</span></div>
     </div>
     {quote?<div className="space-y-2 rounded-xl border border-brand-accent/25 bg-brand-accent/[0.04] p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm"><span className="text-brand-text-muted">{t("Exchange rate")}</span><span className="font-mono tabular-nums">1 {fromAsset} = {quote.rate} {toAsset}</span></div>
      <div className="flex items-center justify-between gap-3 text-sm"><span className="text-brand-text-muted">{t("You will receive")}</span><strong className="font-mono tabular-nums">{formatDecimalAmount(quote.to_amount,localeTags[language])} {toAsset}</strong></div>
      <div className="flex items-center justify-between gap-3 text-sm"><span className="text-brand-text-muted">{t("Conversion fee")}</span><span className="font-mono tabular-nums">0 {fromAsset}</span></div>
      <p className="text-xs text-brand-text-muted">{t("Quote valid for 30 seconds. The rate is locked until expiry.")}</p>
     </div>:null}
     {error?<p className="text-sm text-brand-danger" role="alert">{t(error)}</p>:null}
     {message?<p className="text-sm text-brand-success" role="status">{t(message)}</p>:null}
     {!quote?<Button type="button" block className="min-h-12" disabled={quoting||submitting||assets.length<2||!amount.trim()||!fromAsset||!toAsset||fromAsset===toAsset||compareDecimalStrings(amount,"0")!==1||compareDecimalStrings(amount,String(fromBalance))===1} onClick={getQuote}>{quoting?t("Loading…"):t("Get quote")}</Button>
      :<Button type="button" block className="min-h-12" disabled={submitting||quoting} onClick={confirm}>{submitting?t("Processing…"):t("Confirm conversion")}</Button>}
     <p className="text-xs leading-5 text-brand-text-muted">{t("Conversions are final once confirmed. Check the assets and amount before proceeding.")}</p>
    </CardContent>
   </Card>}
  </div>
 </PageFrame>;
}

/**
 * Displays Earn products and the user's positions with their available actions.
 * Leaves subscription and redemption rules to the existing financial services.
 */
export function EarnPage(){
 const {t,language}=useI18n();
 const location=useLocation();
 const earnFrom=(location.state as {from?:string}|null)?.from;
 const earnBackTo=typeof earnFrom==="string" && /^\/(home|assets|me|markets|trade-hub|seconds|contract|trade\/[^/]+)$/.test(earnFrom) ? earnFrom : "/seconds";
 const {status}=useAuth();
 const {openAuthDialog}=useAuthDialog();
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
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  Promise.allSettled([getAccount(controller.signal),getEarnCatalog(controller.signal)]).then(([accountResult,catalogResult])=>{
   const issues:string[]=[];
   // A missing session is answered with AUTH_REQUIRED; that is already explained
   // by the single sign-in card, so it must not become a second error banner.
   const authRequired=(reason:unknown)=>reason instanceof ApiError&&(reason.status===401||reason.code==="AUTH_REQUIRED");
   if(accountResult.status==="fulfilled")setPositions(Array.isArray(accountResult.value.earn_records)?accountResult.value.earn_records:[]);
   else if(!authRequired(accountResult.reason))issues.push(localizedFailure(accountResult.reason,"Account data is temporarily unavailable."));
   if(catalogResult.status==="fulfilled"){
    setProducts(catalogResult.value.products);
    setActionsEnabled(catalogResult.value.actions_enabled);
    setSelectedProduct(current=>catalogResult.value.products.some(p=>p.product_id===current)?current:(catalogResult.value.products[0]?.product_id||""));
   }else{
    setProducts([]);setActionsEnabled(false);
    if(!authRequired(catalogResult.reason))issues.push(localizedFailure(catalogResult.reason,"Earn products are temporarily unavailable. Please try again."));
   }
   setError(Array.from(new Set(issues)).join("\n"));
  }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[reload]);
 const selected=products.find(item=>item.product_id===selectedProduct);
 const activePositions=positions.filter(position=>normalizeEarnStatus(position.status)==="active").length;
 // Signed-out and empty states share one compact notice instead of repeated cards.
 const hasEarnData=products.length>0||positions.length>0;
 const requestIdFor=(key:string)=>requestIds[key]||crypto.randomUUID();
 const number=(value:number|string|null|undefined)=>{if(value===null||value===undefined||value==="")return "—";const n=Number(value);return Number.isFinite(n)?n.toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—";};
 const operate=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!selected||!actionsEnabled||busy)return;
  const parsed=Number(amount);
  const decimals=amount.includes(".")?amount.split(".")[1].length:0;
  if(!Number.isFinite(parsed)||parsed<=0){setError("Enter an amount greater than zero.");return;}
  if(decimals>selected.amount_scale){setError(`The amount has too many decimal places.`);return;}
  const requestKey=`subscribe:${selected.product_id}:${amount.trim()}`;
  const requestId=requestIdFor(requestKey);
  setRequestIds(current=>({...current,[requestKey]:requestId}));
  setBusy(true);setError("");setActionMessage("");
  try{
   const result=await submitEarnAction("subscribe",{request_id:requestId,product_id:selected.product_id,amount:amount.trim()});
   setActionMessage(result.duplicate?"This Earn request was already processed.":"Earn subscription confirmed.");
   setRequestIds(current=>{const next={...current};delete next[requestKey];return next;});
   setAmount("");
   setReload(n=>n+1);
  }catch(reason){
   setError(localizedFailure(reason,"Unable to confirm the Earn operation. Check Earn history before retrying."));
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
   setActionMessage(result.duplicate?"This Earn request was already processed.":"Earn redemption confirmed.");
   setRequestIds(current=>{const next={...current};delete next[requestKey];return next;});
   setReload(n=>n+1);
  }catch(reason){
   setError(localizedFailure(reason,"Unable to confirm the Earn operation. Check Earn history before retrying."));
  }finally{setBusy(false);}
 };
 return <PageFrame title="Earn" tone="earn" backTo={earnBackTo}>
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-success/10 text-brand-success"><Sprout className="h-4 w-4"/></span><div><p className="text-sm font-semibold text-brand-text">{t("BTCBOX Earn")}</p></div></div></div>
  {loading?<Card aria-busy={loading} className="border-brand-border bg-brand-surface"><CardContent className="space-y-3 p-5" role="status"><div className="h-4 w-1/3 animate-pulse rounded bg-brand-surface-2"/><div className="grid gap-3 sm:grid-cols-3"><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/><div className="h-20 animate-pulse rounded-xl bg-brand-surface-2"/></div><p className="text-sm text-brand-text-muted">{t("Loading Earn products and positions…")}</p></CardContent></Card>
  :<>
   {signedOut?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent"><LockKeyhole className="h-5 w-5"/></span><div className="min-w-0"><p className="text-sm font-semibold text-brand-text">{t("Sign in to view the Earn catalog and your positions.")}</p><p className="mt-0.5 text-xs text-brand-text-muted">{t("Please sign in to view your account data")}</p></div></div><div className="flex shrink-0 items-center gap-2"><Button type="button" size="sm" className="h-10" onClick={()=>openAuthDialog("login")}>{t("Sign in")}</Button><Button type="button" size="sm" variant="outline" className="h-10" onClick={()=>openAuthDialog("register")}>{t("Create account")}</Button></div></div>
   :error?<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-danger/30 bg-brand-surface p-3"><div className="min-w-0 space-y-1" role="alert">{error.split("\n").filter(Boolean).map((line,index)=><p key={`${index}-${line}`} className="text-sm text-brand-danger">{t(line)}</p>)}</div><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></div>
   :null}
   {actionMessage?<p className="rounded-xl border border-brand-success/30 p-3 text-sm text-brand-success" role="status">{t(actionMessage)}</p>:null}
   {!signedOut&&hasEarnData?<div className="grid gap-3 sm:grid-cols-3">{products.length>0?<Card className="overflow-hidden border-brand-success/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Available products")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-success">{products.length}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Live catalog entries")}</p></CardContent></Card>:null}{positions.length>0?<Card className="overflow-hidden border-brand-cyan/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("My Earn positions")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-cyan">{positions.length}</p></CardContent></Card>:null}{activePositions>0?<Card className="overflow-hidden border-brand-violet/20 bg-brand-surface"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Active positions")}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-brand-violet">{activePositions}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Currently held")}</p></CardContent></Card>:null}</div>:null}
      {products.length?<section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="type-section-title">{t("Available products")}</h2><p className="type-meta mt-1 text-brand-text-muted">{t("Rates and terms returned by the BTCBOX product catalog.")}</p></div><Badge variant="outline" className="border-brand-border">{products.length} {t("products")}</Badge></div>
    <div className="grid gap-3 sm:grid-cols-2">{products.map(product=><Card key={product.product_id} className="group relative overflow-hidden border-brand-success/20 bg-brand-surface ring-1 ring-brand-success/[0.025] transition-all hover:-translate-y-0.5 hover:border-brand-success/35 hover:shadow-lg hover:shadow-brand-success/[0.04]"><CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-success/10 text-brand-success"><Sprout className="h-5 w-5"/></span><div className="min-w-0"><p className="font-semibold text-brand-text">{product.asset}</p><p className="type-meta mt-0.5 text-brand-text-muted">{product.product_type==="demand"?t("Flexible"):t("Fixed term")}</p></div></div><Badge variant="outline" className="shrink-0">{product.product_type==="demand"?t("Flexible"):t("Fixed")}</Badge></div><div className="rounded-xl border border-brand-success/20 bg-brand-surface p-4"><p className="type-meta font-semibold uppercase tracking-[.12em] text-brand-text-muted">{t("Annual rate")}</p><p className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-brand-success">{number(product.apy_percent)}%<span className="ml-1.5 text-xs font-bold uppercase tracking-wider text-brand-text-muted">{t("APY")}</span></p></div><div className="flex flex-wrap items-center justify-between gap-2"><p className="type-meta text-brand-text-muted">{product.term_days===0?t("Withdraw according to flexible-product rules"):`${product.term_days} ${t("days")}`} · {t("Early redemption fee")}: {number(product.early_fee_percent)}%</p><Button size="sm" variant={selectedProduct===product.product_id?"default":"outline"} onClick={()=>setSelectedProduct(product.product_id)}>{selectedProduct===product.product_id?t("Selected"):t("Select")}</Button></div></CardContent></Card>)}</div>
   </section>:null}
   {products.length&&actionsEnabled?<Card className="relative overflow-hidden border-brand-accent/25 bg-brand-surface ring-1 ring-brand-accent/[0.04]"><div className="h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><ArrowUpRight className="h-4 w-4"/></span><div><CardTitle>{t("Subscribe")}</CardTitle><CardDescription>{t("Your available balance and product limits are validated by the financial database.")}</CardDescription></div></div></CardHeader><CardContent className="p-4 sm:p-6"><form aria-busy={busy} className="space-y-4" onSubmit={operate}><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Product")}</span><select value={selectedProduct} disabled={busy} onChange={e=>setSelectedProduct(e.target.value)} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15">{products.map(product=><option key={product.product_id} value={product.product_id}>{product.asset} · {product.product_type==="demand"?t("Flexible"):`${product.term_days} ${t("days fixed")}`}</option>)}</select></label><label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} ({selected?.asset||""})</span><input inputMode="decimal" value={amount} disabled={busy||!actionsEnabled} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" /></label><Button type="submit" className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" disabled={!actionsEnabled||busy||!selected}>{busy?t("Processing…"):t("Subscribe")}</Button></form></CardContent></Card>:null}
   {positions.length?<section className="space-y-3"><h2 className="type-section-title">{t("My Earn positions")}</h2>
    {positions.map(position=><Card key={position.id} className="overflow-hidden border-brand-border bg-brand-surface  transition-colors hover:border-brand-cyan/25"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{position.product||position.product_id}</p><p className="text-xs text-brand-text-muted">{position.type==="flexible"?t("Flexible"):t("Fixed")} · <span className="font-mono text-sm font-bold text-brand-success">{number(position.apy)}%</span> <span className="font-semibold text-brand-text-secondary">{t("APY")}</span></p></div><Badge variant={earnStatusBadgeVariant(normalizeEarnStatus(position.status))}>{earnStatusLabel(normalizeEarnStatus(position.status), t)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Principal")}</p><p className="mt-1 break-all font-semibold tabular-nums">{number(position.amount)}</p></div><div className="rounded-lg bg-brand-success/[0.055] p-3"><p className="text-xs text-brand-text-muted">{t("Estimated interest")}</p><p className="mt-1 break-all font-semibold tabular-nums text-brand-success">{number(position.expected_interest)}</p></div><div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("End / maturity")}</p><p className="mt-1 break-all font-semibold">{position.end||"—"}</p></div></div>{normalizeEarnStatus(position.status)==="active"&&actionsEnabled?<Button size="sm" variant="outline" className="min-h-10 border-brand-accent/30 text-brand-accent hover:bg-brand-accent/[0.06]" disabled={busy} onClick={()=>redeem(position)}>{t("Redeem")}</Button>:null}</CardContent></Card>)}
   </section>:null}
     </>}
 </PageFrame>;
}


function withdrawalNetAmount(amount: string | number, fee: string | number): string | null {
 const parse=(value:string|number)=>{const raw=String(value).trim();if(!/^\d+(?:\.\d{1,18})?$/.test(raw))return null;const [whole,fraction=""]=raw.split(".");return {whole:whole.replace(/^0+(?=\d)/,""),fraction};};
 const a=parse(amount),b=parse(fee);if(!a||!b)return null;
 const scale=Math.max(a.fraction.length,b.fraction.length);
 const left=(a.whole+a.fraction.padEnd(scale,"0")).replace(/^0+(?=\d)/,"");
 const right=(b.whole+b.fraction.padEnd(scale,"0")).replace(/^0+(?=\d)/,"");
 if(left.length<right.length||(left.length===right.length&&left<right))return null;
 let borrow=0,result="";
 for(let i=0;i<left.length;i++){let digit=Number(left[left.length-1-i])-borrow-(i<right.length?Number(right[right.length-1-i]):0);borrow=digit<0?1:0;if(digit<0)digit+=10;result=String(digit)+result;}
 result=result.replace(/^0+(?=\d)/,"");if(!scale)return result;
 const padded=result.padStart(scale+1,"0"),whole=padded.slice(0,-scale)||"0",fraction=padded.slice(-scale).replace(/0+$/,"");
 return fraction?whole+"."+fraction:whole;
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
 const [selectedCoin,setSelectedCoin]=useState("USDT");
 const [addressPickerOpen,setAddressPickerOpen]=useState(false);
 const [amount,setAmount]=useState("");
 const [fundPassword,setFundPassword]=useState("");
 const [twofaCode,setTwofaCode]=useState("");
 const [loading,setLoading]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState("");
 const [actionMessage,setActionMessage]=useState("");
 const [pendingIntent,setPendingIntent]=useState<{version:1;request_id:string;address_id:string;coin:string;network:string;amount:string;address:string;expected_fee:string;created_at:number}|null>(null);
 const [pendingIntentInvalid,setPendingIntentInvalid]=useState(false);
 const [needsSignIn,setNeedsSignIn]=useState(false);
 const submitLockRef=useRef(false);
 const [reload,setReload]=useState(0);
 const [historyFilter,setHistoryFilter]=useState<"all"|"pending"|"review"|"processing"|"approved"|"rejected"|"completed"|"failed">("all");
 const [historyRecords,setHistoryRecords]=useState<WithdrawalRecord[]>([]);
 const [historyCursor,setHistoryCursor]=useState<string|null>(null);
 const [historyHasMore,setHistoryHasMore]=useState(false);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyError,setHistoryError]=useState("");

 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setHistoryLoading(true);setHistoryRecords([]);setHistoryCursor(null);setHistoryHasMore(false);setHistoryError("");setAccount(null);setAddresses([]);setConfig(null);setError("");setNeedsSignIn(false);
  Promise.all([getAccount(controller.signal),getSavedCryptoAddresses(controller.signal),getWithdrawalConfig(controller.signal),getWithdrawalHistoryPage(null,controller.signal).catch(()=>null)])
   .then(([snapshot,book,withdrawalConfig,historyPage])=>{
    if(controller.signal.aborted)return;
    setAccount(snapshot);setAddresses(book.filter((item):item is SavedCryptoAddress=>item.type==="crypto"));setConfig(withdrawalConfig);if(historyPage){setHistoryRecords(historyPage.withdrawals);setHistoryCursor(historyPage.next_cursor);setHistoryHasMore(historyPage.has_more&&!!historyPage.next_cursor);}else{setHistoryError("Withdrawal history is temporarily unavailable.");}
    const usable=book.filter((item):item is SavedCryptoAddress=>item.type==="crypto"&&!item.blocked&&!item.unbound);
    const storageKey="btcbox.withdraw.pending.v1."+snapshot.uid;
    try{
     const raw=window.localStorage.getItem(storageKey);
     if(raw){
      const saved=JSON.parse(raw);
      const savedAddress=usable.find(item=>item.id===saved?.address_id);
      if(saved&&saved.version===1&&typeof saved.request_id==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(saved.request_id)&&typeof saved.amount==="string"&&typeof saved.address==="string"&&savedAddress&&!savedAddress.blocked&&!savedAddress.unbound&&savedAddress.coin===saved.coin&&savedAddress.network===saved.network){
       setPendingIntent({...saved,expected_fee:typeof saved.expected_fee==="string"?saved.expected_fee:String(withdrawalConfig.fees[saved.coin]??"")});setSelectedId(saved.address_id);setSelectedCoin(saved.coin);setAmount(saved.amount);
      }else{setPendingIntentInvalid(true);setError("We couldn't verify the saved withdrawal destination. Contact support before trying again.");}
     }else{
      const coinOptions=Object.keys(withdrawalConfig.fees).filter(coin=>!!withdrawalConfig.allowed_networks[coin]?.length);
      const preferredCoin=coinOptions.includes("USDT")?"USDT":(coinOptions[0]||"USDT");
      const eligible=usable.filter(item=>item.coin===preferredCoin);
      setPendingIntent(null);setPendingIntentInvalid(false);setSelectedCoin(preferredCoin);setSelectedId(eligible[0]?.id||"");
     }
    }catch{setPendingIntentInvalid(true);setError("We couldn't verify your saved withdrawal request. Check withdrawal history before trying again.");}
   })
   .catch(reason=>{
    if(reason instanceof Error&&reason.name==="AbortError")return;
    if(!controller.signal.aborted){
    setAccount(null);setAddresses([]);setConfig(null);
    // A signed-out visitor is not an error: show the same localized sign-in
    // prompt as every other account page instead of a red alert carrying the
    // server's raw English message plus a retry that can never succeed.
    const signedOut=reason instanceof ApiError&&(reason.status===401||reason.code==="AUTH_REQUIRED");
    setNeedsSignIn(signedOut);
    setError(signedOut?"":t("Account data is temporarily unavailable."));
   }
   })
   .finally(()=>{if(!controller.signal.aborted){setLoading(false);setHistoryLoading(false);}});
  return ()=>controller.abort();
 },[reload]);

 useEffect(()=>{
  const refreshWhenVisible=()=>{if(document.visibilityState==="visible")setReload(value=>value+1);};
  document.addEventListener("visibilitychange",refreshWhenVisible);
  return ()=>document.removeEventListener("visibilitychange",refreshWhenVisible);
 },[]);

 const usableAddresses=addresses.filter(item=>{
  if(item.blocked||item.unbound||!config)return false;
  return config.fees[item.coin]!==undefined&&config.allowed_networks[item.coin]?.includes(item.network)===true;
 });
 const withdrawalCoins=Object.keys(config?.fees??{}).filter(coin=>!!config?.allowed_networks[coin]?.length);
 const selectedAddress=usableAddresses.find(item=>item.id===selectedId&&item.coin===selectedCoin)??usableAddresses.find(item=>item.coin===selectedCoin)??null;
 const selectedCoinAddresses=usableAddresses.filter(item=>item.coin===selectedCoin);
 const settlementCoin=selectedCoin==="USDC"?"USDT":selectedCoin;
 const balance=settlementCoin&&account?.balances?(account.balances[settlementCoin]??{free:"0",frozen:"0"}):undefined;
 const feeValue=config?config.fees?.[selectedCoin]:undefined;
 const fee=feeValue==null?null:Number(feeValue);
 const available=balance?.free==null?null:Number(balance.free);
 const feeVerified=fee!==null&&Number.isFinite(fee)&&fee>=0;
 const estimatedNetAmount=amount.trim()&&feeVerified&&feeValue!=null?withdrawalNetAmount(amount.trim(),String(feeValue)):null;
 const balanceVerified=available!==null&&Number.isFinite(available)&&available>=0;
 const conversionRate=selectedCoin==="USDC"?String(config?.usdc_usdt_rate??""):"1";
 const conversionVerified=selectedCoin!=="USDC"||compareDecimalStrings(conversionRate,"0")===1;
 const amountWithFee=amount.trim()&&feeVerified?addDecimalStrings(amount.trim(),String(feeValue)) : undefined;
 const estimatedSettlement=amountWithFee&&conversionVerified?multiplyDecimalStringsCeil(amountWithFee,conversionRate,18)??null:null;
 const availableRaw=balance?.free==null?null:String(balance.free);
 const settlementWithinBalance=estimatedSettlement!==null&&availableRaw!==null&&compareDecimalStrings(estimatedSettlement,availableRaw)!==undefined&&compareDecimalStrings(estimatedSettlement,availableRaw)!==1;
 const pendingStorageKey=account?.uid?"btcbox.withdraw.pending.v1."+account.uid:"";
 const clearPending=()=>{if(pendingStorageKey){try{window.localStorage.removeItem(pendingStorageKey);}catch{}}setPendingIntent(null);setPendingIntentInvalid(false);};
 const canSubmit=!!config?.actions_enabled&&!pendingIntentInvalid&&!!selectedAddress&&(!!pendingIntent||(available!==null&&Number.isFinite(available)&&available>=0&&feeVerified))&&(conversionVerified||!!pendingIntent)&&(!!pendingIntent||(estimatedSettlement!==null&&settlementWithinBalance))&&!!fundPassword.trim()&&(!account?.twofa_enabled||/^\d{6}$/.test(twofaCode))&&!submitting&&!loading;

 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  if(!canSubmit||!selectedAddress||submitLockRef.current)return;
  submitLockRef.current=true;
  let intent=pendingIntent;
  if(!intent){
   let requestId:string;
   try{requestId=window.crypto.randomUUID();}
   catch{setError(t("Account data is temporarily unavailable."));submitLockRef.current=false;return;}
   intent={version:1,request_id:requestId,address_id:selectedId,coin:selectedAddress.coin,network:selectedAddress.network,amount:amount.trim(),address:selectedAddress.address,expected_fee:String(config?.fees[selectedAddress.coin]??""),created_at:Date.now()};
   if(!pendingStorageKey){setError(t("Sign in to continue"));submitLockRef.current=false;return;}
   try{window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent));}
   catch{setError(t("Account data is temporarily unavailable."));submitLockRef.current=false;return;}
   setPendingIntent(intent);
  }
  if(intent.address_id!==selectedId||intent.address!==selectedAddress.address||intent.coin!==selectedAddress.coin||intent.network!==selectedAddress.network){setError("The saved withdrawal destination has changed. Contact support before trying again.");setPendingIntentInvalid(true);submitLockRef.current=false;return;}
  setSubmitting(true);setError("");setActionMessage("");
  let requestAccepted=false;
  try{
   const result=await submitWithdrawal({
    request_id:intent.request_id,coin:intent.coin,network:intent.network,
    amount:intent.amount,address:intent.address,fund_password:fundPassword,
    expected_fee:intent.expected_fee,
    ...(account?.twofa_enabled?{twofa_code:twofaCode}:{})
   });
   requestAccepted=true;
   const latest=await getAccount();
   setAccount(latest);
   const confirmed=(latest.withdrawals||[]).some(item=>item.id===result.withdrawal_id);
   if(!confirmed){setError("Your withdrawal status is not yet confirmed. Check withdrawal history before trying again.");return;}
   clearPending();setAmount("");setFundPassword("");setTwofaCode("");
   setActionMessage(result.duplicate?t("This withdrawal request was already received and confirmed."):t("Withdrawal request submitted. You can track its progress in withdrawal history."));
   setReload(value=>value+1);
  }catch(reason){
   setError(t("Withdrawal result is unconfirmed. Keep the same request ID and check withdrawal history before retrying."));
   if(!requestAccepted&&reason instanceof ApiError&&reason.code==="WITHDRAWAL_FEE_CHANGED"){
    clearPending();
    try{setConfig(await getWithdrawalConfig());}catch{}
    setError("The withdrawal fee has changed. Review the updated fee and submit again.");
   }else if(!requestAccepted&&reason instanceof ApiError&&reason.status>=400&&reason.status<500&&reason.status!==409)clearPending();
  }finally{submitLockRef.current=false;setSubmitting(false);}
 };
 const loadMoreHistory=async()=>{
  if(!historyHasMore||!historyCursor||historyLoading)return;
  setHistoryLoading(true);setHistoryError("");
  try{
   const page=await getWithdrawalHistoryPage(historyCursor);
   setHistoryRecords(current=>{const seen=new Set(current.map(item=>item.id));return [...current,...page.withdrawals.filter(item=>!seen.has(item.id))];});
   setHistoryCursor(page.next_cursor);setHistoryHasMore(page.has_more&&!!page.next_cursor);
  }catch{setHistoryError("Withdrawal history is temporarily unavailable.");}
  finally{setHistoryLoading(false);}
 };
 return <PageFrame title="Withdraw" tone="assets" backTo="/assets" className="funds-flow-page">
  <div className="mx-auto w-full max-w-3xl space-y-5">
  {loading?<Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted" role="status">{t("Loading wallet and saved addresses…")}</CardContent></Card>
  :needsSignIn&&!DEV_OPEN_ACCOUNT_PAGES?<Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-xs text-brand-text-muted">{t("Please sign in to view your account data")}</p><Button asChild size="sm" className="h-10"><Link to="/login">{t("Go to sign in")}</Link></Button></CardContent></Card>
  :error&&!account?<Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-danger" role="alert">{t(error)}</p><Button size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>{t("Try again")}</Button></CardContent></Card>
  :<>
   {!config?.actions_enabled ? <div className="rounded-xl border border-brand-border bg-brand-surface p-4 text-sm text-brand-text-muted" role="status">{t("Withdrawals are currently unavailable.")}</div> : null}
   {config?.actions_enabled ? (
<Card aria-busy={submitting} className="relative overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"><span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-surface"/><CardHeader className="border-b border-brand-border bg-brand-surface"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><ArrowUpRight className="h-5 w-5"/></span><div className="min-w-0"><CardTitle>{t("Submit withdrawal")}</CardTitle><Link to="/address-book" className="mt-2 inline-flex min-h-9 items-center text-sm font-medium text-brand-accent hover:underline">{t("Saved crypto addresses")}</Link></div></div></CardHeader><CardContent className="p-4 sm:p-6">
    {withdrawalCoins.length===0?<div className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No available withdrawal asset. Please contact support.")}</div>
    :<form aria-busy={submitting} className="space-y-4" onSubmit={submit}>
     <label className="block space-y-1.5 text-sm">
      <span className="text-brand-text-muted">{t("Asset")}</span>
      <select aria-label={t("Asset")} value={selectedCoin} disabled={!!pendingIntent||pendingIntentInvalid||submitting||withdrawalCoins.length===0} onChange={event=>{const next=event.target.value;const first=usableAddresses.find(item=>item.coin===next);setAmount("");setSelectedCoin(next);setSelectedId(first?.id||"");setAddressPickerOpen(false);setError("");}} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15 disabled:opacity-60">
       {withdrawalCoins.map(coin=><option key={coin} value={coin}>{coin}</option>)}
      </select>
     </label>
     <div className="space-y-1.5 text-sm">
      <span className="text-brand-text-muted">{t("Withdrawal address")} · {selectedCoin}</span>
      <button type="button" disabled={!!pendingIntent||pendingIntentInvalid||submitting||selectedCoinAddresses.length===0} aria-expanded={addressPickerOpen} aria-controls="withdraw-address-options" onClick={()=>setAddressPickerOpen(value=>!value)} className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-left text-sm text-brand-text outline-none transition-colors hover:border-brand-accent/50 focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15 disabled:cursor-not-allowed disabled:opacity-60">
       <span className="min-w-0">{selectedAddress?<><span className="block font-medium">{selectedAddress.coin} · {selectedAddress.network}</span><span className="mt-0.5 block truncate font-mono text-xs text-brand-text-muted">{selectedAddress.address}</span></>:<span className="text-brand-text-muted">{t("No address saved for this asset")}</span>}</span>
       <ChevronDown className={`h-4 w-4 shrink-0 text-brand-text-muted transition-transform ${addressPickerOpen?"rotate-180":""}`} aria-hidden="true"/>
      </button>
      {addressPickerOpen?<div id="withdraw-address-options" role="group" aria-label={t("Withdrawal address")} className="max-h-64 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-brand-border bg-brand-surface p-2 shadow-lg">
       {selectedCoinAddresses.map(item=><button key={item.id} type="button" aria-pressed={item.id===selectedId} onClick={()=>{if(item.id!==selectedId)setAmount("");setSelectedId(item.id);setAddressPickerOpen(false);setError("");}} className={`flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-brand-surface-2 focus:bg-brand-surface-2 focus:outline-none ${item.id===selectedId?"bg-brand-accent/10 ring-1 ring-brand-accent/30":""}`}>
        <span className="min-w-0"><span className="block font-medium text-brand-text">{item.coin} · {item.network}</span><span className="mt-0.5 block truncate font-mono text-xs text-brand-text-muted">{item.address}</span></span>
        {item.id===selectedId?<Check className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true"/>:null}
       </button>)}
      </div>:null}
     </div>
     {selectedCoinAddresses.length===0?<div className="rounded-xl border border-dashed border-brand-border p-4 text-sm text-brand-text-muted"><p>{t("No saved withdrawal address for this asset.")}</p><Link to="/address-book" className="mt-2 inline-flex min-h-10 items-center font-medium text-brand-accent hover:underline">{t("Add withdrawal address")}</Link></div>:null}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-muted">{t("Amount")} ({selectedCoin})</span><input inputMode="decimal" value={amount} disabled={!!pendingIntent||pendingIntentInvalid||submitting||!selectedAddress||!balanceVerified||!feeVerified} onChange={event=>setAmount(event.target.value)} placeholder="0.00" className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15"/></label>
      {selectedAddress?<div className="grid grid-cols-1 gap-3 rounded-xl border border-brand-border bg-brand-surface-2/50 p-4 text-sm min-[420px]:grid-cols-2"><div><p className="text-xs text-brand-text-muted">{t("Available")}</p><p className="mt-1 tabular-nums">{balanceVerified&&available!==null?available.toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—"} {settlementCoin}</p></div><div><p className="text-xs text-brand-text-muted">{t("Withdrawal fee")}</p><p className="mt-1 tabular-nums">{feeVerified&&fee!==null?fee.toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—"} {selectedCoin}</p></div><div><p className="text-xs text-brand-text-muted">{t("Net amount")}</p><p className="mt-1 font-semibold tabular-nums">{estimatedNetAmount!==null?estimatedNetAmount:"—"} {selectedCoin}</p></div>{selectedCoin==="USDC"?<div className="min-[420px]:col-span-2 border-t border-brand-border pt-3"><p className="text-xs text-brand-text-muted">{t("Estimated USDT deduction")}</p><p className="mt-1 font-semibold tabular-nums">{estimatedSettlement!==null?Number(estimatedSettlement).toLocaleString(localeTags[language],{maximumFractionDigits:10}):"—"} USDT</p><p className="mt-1 text-xs text-brand-text-muted">{config?.usdc_usdt_rate?"1 USDC ≈ "+config.usdc_usdt_rate+" USDT · "+t("Final rate is locked when you submit."):t("USDC/USDT conversion is temporarily unavailable.")}</p></div>:null}</div>:null}
     <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Fund password")}</span><input type="password" autoComplete="current-password" value={fundPassword} disabled={submitting} onChange={event=>setFundPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" required/></label>
     {account?.twofa_enabled?<label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Two-factor code")}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={twofaCode} disabled={submitting} onChange={event=>setTwofaCode(event.target.value.replace(/\D/g,"").slice(0,6))} className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-brand-text outline-none transition-colors focus:border-brand-violet/60 focus:ring-2 focus:ring-brand-violet/15" required/></label>:null}
     {error?<p role="alert" className="text-sm text-brand-danger">{error}</p>:null}
     {actionMessage?<p role="status" className="text-sm text-brand-success">{actionMessage}</p>:null}
     <Button type="submit" className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto" disabled={!canSubmit}>{submitting?t("Submitting…"):pendingIntent?t("Retry same request"):t("Submit withdrawal")}</Button>
     {pendingIntent?<p className="break-all text-xs text-brand-text-muted">{t("Withdrawal status is being confirmed. Re-enter your fund password and, if enabled, your 2FA code, then retry.")}</p>:null}
    </form>}
   </CardContent></Card>
) : null}

   <Card className="overflow-hidden border border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
    <CardHeader className="gap-3 border-b border-brand-border bg-brand-surface-2/60 sm:flex-row sm:items-center sm:justify-between">
     <div className="min-w-0"><CardTitle>{t("Withdrawal history")}</CardTitle></div>
     <select aria-label={t("Withdrawal history")} value={historyFilter} onChange={event=>setHistoryFilter(event.target.value as typeof historyFilter)} className="min-h-10 w-full rounded-lg border border-brand-border bg-brand-surface px-3 text-sm text-brand-text sm:w-auto">
      <option value="all">{t("All")}</option><option value="pending">{t("Pending")}</option><option value="review">{t("Under review")}</option><option value="processing">{t("Processing")}</option><option value="approved">{t("Approved")}</option><option value="rejected">{t("Rejected")}</option><option value="completed">{t("Completed")}</option><option value="failed">{t("Failed")}</option>
     </select>
    </CardHeader>
    <CardContent className="space-y-3 p-3 sm:p-4">
     {historyRecords.length ? historyRecords.filter(item=>historyFilter==="all"||normalizeWithdrawalStatus(item.status)===historyFilter).map((item:WithdrawalRecord)=>{
      const normalized=normalizeWithdrawalStatus(item.status),net=withdrawalNetAmount(item.amount,item.fee??"0"),destination=item.address||"—";
      return <article key={item.id} className="min-w-0 rounded-lg border border-brand-border bg-brand-surface-2/35 p-3 sm:p-4">
       <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold text-brand-text">{item.coin} <span className="text-brand-text-muted">· {item.network||"—"}</span></p><p className="mt-1 text-xs text-brand-text-muted">{t("Submitted")}: {item.time||"—"}</p></div>
        <div className="flex shrink-0 flex-col items-end gap-1"><p className="font-semibold tabular-nums text-brand-text">{item.amount} {item.coin}</p><Badge variant={withdrawalStatusBadgeVariant(normalized)}>{withdrawalStatusLabel(normalized,t)}</Badge></div>
       </div>
       <details className="mt-3 border-t border-brand-border pt-2">
        <summary className="min-h-9 cursor-pointer text-xs font-medium text-brand-accent">{t("Details")}</summary>
        <div className="mt-2 space-y-3 rounded-lg bg-brand-surface p-3 text-xs">
         <div className="grid grid-cols-2 gap-3">
          <div><p className="text-brand-text-muted">{t("Withdrawal fee")}</p><p className="mt-1 break-all tabular-nums text-brand-text">{item.fee??"—"} {item.coin}</p></div>
          <div><p className="text-brand-text-muted">{t("Net amount")}</p><p className="mt-1 break-all font-semibold tabular-nums text-brand-text">{net===null?"—":net+" "+item.coin}</p></div>
          {item.settlement_asset&&item.settlement_asset!==item.coin?<div className="min-w-0 rounded-md bg-brand-surface-2 p-2"><p className="text-brand-text-muted">{t("Balance debit")}</p><p className="mt-1 break-all font-semibold tabular-nums text-brand-text">{item.settlement_amount} {item.settlement_asset}</p><p className="mt-1 text-brand-text-muted">Rate {item.conversion_rate}</p></div>:null}
         </div>
         <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="text-brand-text-muted">{t("Application ID")}</p><p className="mt-1 break-all font-mono text-brand-text">{item.id}</p></div><button type="button" className="min-h-8 shrink-0 text-brand-accent" onClick={()=>void navigator.clipboard?.writeText(item.id)}>{t("Copy")}</button></div>
         <div><p className="text-brand-text-muted">{t("Address")}</p><p className="mt-1 break-all font-mono text-brand-text">{destination}</p><button type="button" className="mt-1 min-h-8 text-brand-accent" onClick={()=>{if(destination!=="—")void navigator.clipboard?.writeText(destination);}}>{t("Copy")}</button></div>
         {item.reviewed_at?<div><p className="text-brand-text-muted">{t("Reviewed")}</p><p className="mt-1 break-all text-brand-text">{item.reviewed_at}</p></div>:null}
         {item.rejection_reason?<div><p className="text-brand-text-muted">{t("Rejection reason")}</p><p className="mt-1 break-words text-brand-text">{item.rejection_reason}</p></div>:null}
        </div>
       </details>
      </article>;
     }) : <p className="rounded-xl border border-dashed border-brand-border p-5 text-sm text-brand-text-muted">{t("No withdrawal history yet.")}</p>}
     {historyRecords.length>0 && !historyRecords.some(item=>historyFilter==="all"||normalizeWithdrawalStatus(item.status)===historyFilter)?<p className="rounded-lg border border-dashed border-brand-border p-5 text-center text-sm text-brand-text-muted">{t("No withdrawal history yet.")}</p>:null}
      {historyError?<p role="alert" className="text-sm text-brand-danger">{t(historyError)}</p>:null}
      {historyHasMore?<Button type="button" variant="outline" className="w-full" disabled={historyLoading} onClick={()=>void loadMoreHistory()}>{historyLoading?t("Loading…"):t("Load more")}</Button>:null}
    </CardContent>
   </Card>

   
  </>}
  </div>
 </PageFrame>;
}
