import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ArrowLeftRight, ChartNoAxesCombined, Headset, Wallet } from "lucide-react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { useDashboardStore } from "./dashboard.data";

const LIQUIDITY_INTERVALS: Record<string, string> = { "1h": "1m", "6h": "5m", "24h": "5m", "7d": "1h", "30d": "1d" };
const VOLUME_INTERVALS: Record<string, string> = { "1d": "5m", "7d": "1h", "30d": "1d" };
const pairSymbol = (symbol: string) => symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
const formatPrice = (value: number, locale: string) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: value >= 1 ? 4 : 8 }).format(value);
const formatCompact = (value: string, locale: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(parsed) : "—";
};

function MiniTrend({ candles, loading, error, locale, t }: { candles: MarketCandle[]; loading: boolean; error: string; locale: string; t: (value: string) => string }) {
  const points = useMemo(() => {
    const closes = candles.slice(-48).map((candle) => candle.close).filter((value) => Number.isFinite(value) && value > 0);
    if (closes.length < 2) return "";
    const min = Math.min(...closes), max = Math.max(...closes), span = max - min || Math.max(max * 0.001, 1);
    return closes.map((close, index) => `${(4 + index / (closes.length - 1) * 312).toFixed(1)},${(84 - (close - min) / span * 70).toFixed(1)}`).join(" ");
  }, [candles]);
  const latest = candles[candles.length - 1];
  const change = candles[0] && latest ? ((latest.close - candles[0].open) / candles[0].open) * 100 : null;
  return <div className="min-w-0">
    {loading ? <p className="py-8 text-sm text-brand-text-muted" role="status">{t("Loading…")}</p>
      : error ? <p className="py-8 text-sm text-brand-danger" role="alert">{t("Chart data is temporarily unavailable.")}</p>
        : points ? <><div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-lg font-semibold tabular-nums text-brand-text">{formatPrice(latest.close, locale)}</span>{change !== null && <span className={`text-xs font-semibold tabular-nums ${change >= 0 ? "text-profit" : "text-loss"}`}>{change > 0 ? "+" : ""}{change.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>}</div>
          <svg className="mt-3 block h-24 w-full" viewBox="0 0 320 96" preserveAspectRatio="none" role="img" aria-label={`${t("BTC/USDT price history")} · ${t("1-hour candles returned by the live market data provider.")}`}><defs><linearGradient id="home-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><polygon points={`4,94 ${points} 316,94`} fill="url(#home-trend-fill)" className={change !== null && change < 0 ? "text-loss" : "text-brand-accent"}/><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className={change !== null && change < 0 ? "text-loss" : "text-brand-accent"}/></svg>
          </>
        : <p className="py-8 text-sm text-brand-text-muted">{t("Historical chart data is currently unavailable.")}</p>}
  </div>;
}

export function Dashboard() {
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const isMarketsPage = window.location.pathname === "/markets";
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [homeCandles, setHomeCandles] = useState<MarketCandle[]>([]);
  const [homeChartLoading, setHomeChartLoading] = useState(false);
  const [homeChartError, setHomeChartError] = useState("");
  const [liquidityCandles, setLiquidityCandles] = useState<MarketCandle[]>([]);
  const [volumeCandles, setVolumeCandles] = useState<MarketCandle[]>([]);
  const liquidityRange = useDashboardStore((state) => state.liquidityRange);
  const volumeRange = useDashboardStore((state) => state.volumeRange);
  const liquidityInterval = LIQUIDITY_INTERVALS[liquidityRange] || "5m";
  const volumeInterval = VOLUME_INTERVALS[volumeRange] || "1h";
  const [clock, setClock] = useState(Date.now());
  const snapshot = markets.reduce((latest, item) => Math.max(latest, item.snapshotTs || 0), 0);
  const stale = markets.some((item) => (item.snapshotTs || 0) > 0 && clock / 1000 - (item.snapshotTs || 0) > 90);
  const displayMarkets = error || stale ? [] : markets;
  const feedStatus = loading ? "Connecting" : error ? "Feed unavailable" : !markets.length ? "No markets enabled" : stale ? "Snapshot stale" : snapshot <= 0 ? "Snapshot time unavailable" : "Live market feed";
  const featured = useMemo(() => displayMarkets.slice().sort((a, b) => Number(b.vol) - Number(a.vol)).slice(0, 4), [displayMarkets]);
  const selected = displayMarkets.find((item) => item.sym.toUpperCase() === selectedSymbol.toUpperCase()) || featured[0];
  const btc = displayMarkets.find((item) => item.sym.toUpperCase() === "BTC");

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    let pending: AbortController | undefined;
    const load = () => {
      if (cancelled || refreshing) return;
      refreshing = true;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      getMarkets(controller.signal).then((rows) => { if (!cancelled) { setMarkets(rows); setError(""); } }).catch((reason: unknown) => {
        if (cancelled) return;
        setMarkets([]);
        setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Market data is temporarily unavailable. Please try again shortly.");
      }).finally(() => { window.clearTimeout(timeout); refreshing = false; if (!cancelled) setLoading(false); });
    };
    load();
    const poll = window.setInterval(load, 5000);
    return () => { cancelled = true; window.clearInterval(poll); pending?.abort(); };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 5000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (isMarketsPage || !selected) { setHomeCandles([]); setHomeChartError(""); setHomeChartLoading(false); return; }
    const controller = new AbortController();
    setHomeCandles([]); setHomeChartLoading(true); setHomeChartError("");
    getKlines(pairSymbol(selected.sym), "1h", controller.signal).then((rows) => { if (!controller.signal.aborted) setHomeCandles(rows); }).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (!controller.signal.aborted) { setHomeCandles([]); setHomeChartError(reason instanceof Error ? reason.message : "Chart data is temporarily unavailable."); }
    }).finally(() => { if (!controller.signal.aborted) setHomeChartLoading(false); });
    return () => controller.abort();
  }, [isMarketsPage, selected?.sym]);

  useEffect(() => {
    if (!isMarketsPage) return;
    const controller = new AbortController(); let refreshing = false;
    const load = () => { if (refreshing || controller.signal.aborted) return; refreshing = true; void getKlines("BTCUSDT", liquidityInterval, controller.signal).then(setLiquidityCandles).catch(() => setLiquidityCandles([])).finally(() => { refreshing = false; }); };
    setLiquidityCandles([]); load(); const poll = window.setInterval(load, 60000);
    return () => { window.clearInterval(poll); controller.abort(); };
  }, [liquidityInterval, isMarketsPage]);
  useEffect(() => {
    if (!isMarketsPage) return;
    const controller = new AbortController(); let refreshing = false;
    const load = () => { if (refreshing || controller.signal.aborted) return; refreshing = true; void getKlines("BTCUSDT", volumeInterval, controller.signal).then(setVolumeCandles).catch(() => setVolumeCandles([])).finally(() => { refreshing = false; }); };
    setVolumeCandles([]); load(); const poll = window.setInterval(load, 60000);
    return () => { window.clearInterval(poll); controller.abort(); };
  }, [volumeInterval, isMarketsPage]);

  if (!isMarketsPage) {
    const actions = [
      { to: "/trade-hub", label: "Trade", detail: "Spot trading", icon: ArrowLeftRight },
      { to: "/assets", label: "Assets", detail: "Balances from your authenticated BTCBOX account.", icon: Wallet },
      { to: "/support", label: "Support", detail: "Contact the BTCBOX support team.", icon: Headset },
    ];
    const errorMessage = error || (stale ? t("The market service snapshot is older than 90 seconds. Quotes are hidden until a fresh snapshot arrives.") : "");
    return <div className="tone-market mx-auto flex w-full max-w-[1500px] min-w-0 flex-col gap-5 overflow-x-clip p-3 sm:gap-6 sm:p-5 lg:p-8">
      <header className="grid min-w-0 gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6 lg:p-7">
        <div className="min-w-0"><p className="mb-1 text-[11px] font-semibold tracking-[.16em] text-brand-accent">BTCBOX / {t("Home")}</p><h1 className="type-page-title text-brand-text">{t(signedIn ? "Welcome back to your market." : "Explore the market. Trade with confidence.")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-brand-text-secondary"><span className="hidden sm:inline">{t("Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.")}</span><span className="sm:hidden">{t("Live market data supplied by BTCBOX")}</span></p></div>
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">{status === "loading" ? <Badge variant="outline" role="status">{t("Checking your BTCBOX account…")}</Badge> : signedIn ? <><Button asChild size="sm"><Link to="/trade-hub">{t("Start trading")} <ArrowUpRight className="h-4 w-4"/></Link></Button><Button asChild size="sm" variant="outline"><Link to="/assets">{t("Assets")} <Wallet className="h-4 w-4"/></Link></Button></> : <><Button asChild size="sm"><Link to="/login">{t("Sign in")}</Link></Button><Button asChild size="sm" variant="outline"><Link to="/register">{t("Create account")}</Link></Button></>}</div>
      </header>

      <section className="grid min-w-0 gap-3 sm:grid-cols-3" aria-label={t("Bitcoin market summary")}>
        {[{ label: "BTC/USDT last price", value: btc ? `${formatPrice(btc.price, locale)} USDT` : "—", tone: "text-brand-text" }, { label: "BTC 24h change", value: btc ? `${btc.chg > 0 ? "+" : ""}${btc.chg.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—", tone: btc && btc.chg < 0 ? "text-loss" : "text-profit" }, { label: "BTC 24h volume", value: btc ? `${formatCompact(btc.vol, locale)} USDT` : "—", tone: "text-brand-text" }].map((metric) => <Card key={metric.label}><CardContent className="p-4"><p className="type-meta text-brand-text-muted">{t(metric.label)}</p><p className={`mt-2 break-all type-price ${metric.tone}`}>{loading && !btc ? "—" : metric.value}</p><p className="mt-1 hidden text-[11px] text-brand-text-muted sm:block">{t(metric.label === "BTC/USDT last price" ? "Latest price returned by BTCBOX" : metric.label === "BTC 24h change" ? "24-hour change from the live market feed" : "Reported 24-hour trading volume")}</p></CardContent></Card>)}
      </section>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.8fr)] lg:gap-5">
        <section className="min-w-0 space-y-3" aria-label={t("Top token market data")}>
          <div className="flex flex-wrap items-end justify-between gap-2 px-1"><div><h2 className="type-section-title text-brand-text">{t("Top tokens")}</h2><p className="mt-1 hidden text-xs text-brand-text-muted sm:block">{t("Live market data supplied by BTCBOX")}</p></div><Link to="/markets" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-accent">{t("Explore markets")} <ArrowRight className="h-4 w-4"/></Link></div>
          <Card className="overflow-hidden p-0">{errorMessage ? <CardContent className="py-5 text-sm text-brand-danger" role="alert">{t(errorMessage)}</CardContent> : loading && !featured.length ? <CardContent className="space-y-3 py-5" role="status" aria-label={t("Loading markets")}>{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-brand-surface-2"/>)}<p className="text-xs text-brand-text-muted">{t("Loading…")}</p></CardContent> : featured.length ? <div className="divide-y divide-brand-border-subtle">{featured.map((market) => <div key={market.sym} className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(130px,.7fr)_minmax(90px,.5fr)] ${selected?.sym === market.sym ? "bg-brand-accent/[.035]" : ""}`}>
            <button type="button" onClick={() => setSelectedSymbol(market.sym)} aria-pressed={selected?.sym === market.sym} className="flex min-w-0 items-center gap-3 text-left"><TokenIcon symbol={market.sym} className="h-9 w-9"/><span className="min-w-0"><span className="block truncate text-sm font-semibold">{market.sym}/USDT</span><span className="type-meta block text-brand-text-muted">USDT</span></span></button>
            <span className="text-right text-sm font-semibold tabular-nums">{formatPrice(market.price, locale)}</span><span className={`col-start-2 row-start-1 text-right text-xs font-semibold tabular-nums sm:col-start-3 ${market.chg >= 0 ? "text-profit" : "text-loss"}`}>{market.chg > 0 ? "+" : ""}{market.chg.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
          </div>)}</div> : <CardContent className="py-6 text-sm text-brand-text-muted">{t("No market pairs are currently available.")}</CardContent>}</Card>
          <Card className="min-w-0 overflow-hidden"><CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0"><div className="min-w-0"><CardTitle>{selected ? `${selected.sym}/USDT` : t("Market analytics")}</CardTitle><p className="mt-1 text-xs text-brand-text-muted">{t("1-hour candles returned by the live market data provider.")}</p></div>{selected && <Button asChild size="sm" variant="outline"><Link to={`/trade/${pairSymbol(selected.sym)}`}>{t("Spot trading")} <ArrowUpRight className="h-4 w-4"/></Link></Button>}</CardHeader><CardContent className="min-w-0"><MiniTrend candles={homeCandles} loading={homeChartLoading} error={homeChartError} locale={locale} t={t}/></CardContent></Card>
        </section>
        <aside className="min-w-0 space-y-3"><div className="px-1"><h2 className="type-section-title text-brand-text">{t("Manage")}</h2><p className="mt-1 text-xs text-brand-text-muted">{t("Manage your profile, verification, security and support.")}</p></div><Card className="overflow-hidden p-0"><nav aria-label={t("Manage")} className="divide-y divide-brand-border-subtle">{actions.map(({ to, label, detail, icon: Icon }) => { const needsAuth = label === "Assets"; const target = needsAuth && !signedIn ? "/login" : to; return <Link key={to} to={target} className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-brand-surface-hover"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t(label)}</span><span className="mt-1 hidden break-words text-xs leading-5 text-brand-text-muted sm:block">{t(needsAuth && !signedIn ? "Sign in to view your assets." : detail)}</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>; })}</nav></Card><Card className="hidden sm:block"><CardContent className="flex items-start gap-3 p-4"><ChartNoAxesCombined className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent"/><div><p className="text-sm font-semibold">{t("Public market access")}</p><p className="mt-1 text-xs leading-5 text-brand-text-muted">{t("View market prices and historical movement before you sign in.")}</p></div></CardContent></Card></aside>
      </div>
      <Card><CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-warning"/><div><p className="text-sm font-semibold">{t("Important")}</p><p className="mt-1 text-xs leading-5 text-brand-text-muted">{t("I understand digital asset trading involves significant risk.")}</p></div></CardContent></Card>
    </div>;
  }

  return <div className="tone-market mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3 py-1 sm:py-3"><div className="min-w-0"><p className="mb-2 text-xs font-semibold tracking-widest text-brand-accent">BTCBOX / {t("Markets")}</p><h1 className="type-page-title text-brand-text">{t("Market overview")}</h1><p className="mt-2 text-sm text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p></div><Badge variant="outline">{t(feedStatus)}</Badge></header>
    {(btc || loading) && <section aria-label={t("Bitcoin market summary")} className="exchange-summary">{[{ label: "BTC/USDT last price", value: btc ? formatPrice(btc.price, locale) : "—" }, { label: "BTC 24h change", value: btc ? `${btc.chg > 0 ? "+" : ""}${btc.chg.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—" }, { label: "BTC 24h volume", value: btc ? formatCompact(btc.vol, locale) : "—" }].map((metric) => <div key={metric.label}><p className="text-xs text-brand-text-muted">{t(metric.label)}</p><p className="mt-2 text-xl font-semibold tabular-nums">{metric.value}</p></div>)}</section>}
    <div className="anim-fade-up anim-delay-4 min-w-0"><LiveMarketsTable markets={markets} loading={loading} error={error}/></div>
    <div id="market-analysis" className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3 px-1 pt-1"><div><h2 className="type-section-title text-brand-text">{t("Market analytics")}</h2><p className="type-body-compact mt-1 text-brand-text-muted">{t("Historical BTC/USDT candles from market providers.")}</p></div><Badge variant="outline" className="shrink-0 border-brand-border bg-brand-surface">{liquidityCandles.length ? `BTC/USDT · ${liquidityRange}` : t("No chart data")}</Badge></div>
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5"><LiquidityChart candles={liquidityCandles}/><VolumeChart candles={volumeCandles}/></div>
    <footer className="px-1 pb-2 text-[11px] leading-5 text-brand-text-muted">TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-brand-text-secondary">https://www.tradingview.com/</a></footer>
  </div>;
}
