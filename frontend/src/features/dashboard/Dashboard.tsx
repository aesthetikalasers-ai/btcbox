import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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

const numberFormat = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: value >= 1 ? 4 : 8,
}).format(value);
const compactFormat = (value: string, locale: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(parsed)
    : "—";
};
const pairSymbol = (symbol: string) => symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;

function MiniTrend({ candles, loading, error, locale, t }: {
  candles: MarketCandle[];
  loading: boolean;
  error: string;
  locale: string;
  t: (value: string) => string;
}) {
  const points = useMemo(() => {
    const closes = candles.slice(-48).map((candle) => candle.close).filter((value) => Number.isFinite(value) && value > 0);
    if (closes.length < 2) return "";
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || Math.max(max * 0.001, 1);
    return closes.map((close, index) => {
      const x = 4 + index / (closes.length - 1) * 312;
      const y = 84 - (close - min) / span * 70;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [candles]);
  const latest = candles[candles.length - 1];
  const first = candles[0];
  const change = first && latest ? ((latest.close - first.open) / first.open) * 100 : null;

  return <div className="min-w-0">
    {loading ? <p className="py-8 text-sm text-brand-text-muted" role="status">{t("Loading…")}</p>
      : error ? <p className="py-8 text-sm text-rose-300" role="alert">{t("Chart data is temporarily unavailable.")}</p>
      : points ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-lg font-semibold tabular-nums text-brand-text">{numberFormat(latest.close, locale)}</span>
          {change !== null && <span className={`text-xs font-semibold tabular-nums ${change >= 0 ? "text-profit" : "text-loss"}`}>{change > 0 ? "+" : ""}{change.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>}
        </div>
        <svg className="mt-3 block h-24 w-full overflow-visible" viewBox="0 0 320 96" preserveAspectRatio="none" role="img" aria-label={`${t("BTC/USDT price history")} · ${t("1-hour candles returned by the live market data provider.")}`}>
          <defs><linearGradient id="home-trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
          <polygon points={`4,94 ${points} 316,94`} fill="url(#home-trend-fill)" className={change !== null && change < 0 ? "text-loss" : "text-brand-accent"}/>
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className={change !== null && change < 0 ? "text-loss" : "text-brand-accent"}/>
        </svg>
        <p className="mt-2 text-[11px] text-brand-text-muted">{t("1-hour candles returned by the live market data provider.")}</p>
      </> : <p className="py-8 text-sm text-brand-text-muted">{t("Historical chart data is currently unavailable.")}</p>}
  </div>;
}

export function Dashboard() {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language];
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === "authenticated";
  const isMarketsPage = useLocation().pathname === "/markets";
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
  const latestSnapshotTs = markets.reduce((latest, item) => Math.max(latest, item.snapshotTs || 0), 0);
  const marketSnapshotStale = markets.some((item) => (item.snapshotTs || 0) > 0 && Date.now() / 1000 - (item.snapshotTs || 0) > 90);
  const displayMarkets = error || marketSnapshotStale ? [] : markets;
  const btcMarket = displayMarkets.find((item) => item.sym.toUpperCase() === "BTC");
  const marketFeedStatus = loading ? "Connecting" : error ? "Feed unavailable" : !markets.length ? "No markets enabled" : marketSnapshotStale ? "Snapshot stale" : latestSnapshotTs <= 0 ? "Snapshot time unavailable" : "Live market feed";
  const featuredMarkets = useMemo(() => displayMarkets.slice().sort((a, b) => Number(b.vol) - Number(a.vol)).slice(0, 4), [displayMarkets]);
  const movers = useMemo(() => displayMarkets.slice().sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 3), [displayMarkets]);
  const selectedMarket = displayMarkets.find((item) => item.sym.toUpperCase() === selectedSymbol.toUpperCase()) || featuredMarkets[0];

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    let pendingController: AbortController | undefined;
    const loadMarkets = () => {
      if (refreshing || cancelled) return;
      refreshing = true;
      const controller = new AbortController();
      pendingController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);
      getMarkets(controller.signal).then((rows) => {
        if (cancelled) return;
        setMarkets(rows);
        setError("");
      }).catch((reason: unknown) => {
        if (cancelled) return;
        setMarkets([]);
        setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Market data is temporarily unavailable. Please try again shortly.");
      }).finally(() => {
        window.clearTimeout(timeoutId);
        refreshing = false;
        if (!cancelled) setLoading(false);
      });
    };
    loadMarkets();
    const refreshId = window.setInterval(loadMarkets, 5000);
    return () => { cancelled = true; window.clearInterval(refreshId); pendingController?.abort(); };
  }, []);

  useEffect(() => {
    if (isMarketsPage || !selectedMarket) {
      setHomeCandles([]);
      setHomeChartError("");
      setHomeChartLoading(false);
      return;
    }
    const controller = new AbortController();
    setHomeCandles([]);
    setHomeChartLoading(true);
    setHomeChartError("");
    getKlines(pairSymbol(selectedMarket.sym), "1h", controller.signal).then((rows) => {
      if (!controller.signal.aborted) setHomeCandles(rows);
    }).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setHomeCandles([]);
        setHomeChartError(reason instanceof Error ? reason.message : "Chart data is temporarily unavailable.");
      }
    }).finally(() => { if (!controller.signal.aborted) setHomeChartLoading(false); });
    return () => controller.abort();
  }, [isMarketsPage, selectedMarket?.sym]);

  useEffect(() => {
    if (!isMarketsPage) return;
    const controller = new AbortController();
    let refreshing = false;
    const load = () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      void getKlines("BTCUSDT", liquidityInterval, controller.signal).then((rows) => {
        if (!controller.signal.aborted) setLiquidityCandles(rows);
      }).catch(() => {
        if (!controller.signal.aborted) setLiquidityCandles([]);
      }).finally(() => { refreshing = false; });
    };
    setLiquidityCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [liquidityInterval, isMarketsPage]);

  useEffect(() => {
    if (!isMarketsPage) return;
    const controller = new AbortController();
    let refreshing = false;
    const load = () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      void getKlines("BTCUSDT", volumeInterval, controller.signal).then((rows) => {
        if (!controller.signal.aborted) setVolumeCandles(rows);
      }).catch(() => {
        if (!controller.signal.aborted) setVolumeCandles([]);
      }).finally(() => { refreshing = false; });
    };
    setVolumeCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [volumeInterval, isMarketsPage]);

  if (!isMarketsPage) {
    const actions = [
      { to: "/trade-hub", label: "Trade", detail: "Spot trading", icon: ArrowLeftRight },
      { to: "/assets", label: "Assets", detail: "Balances from your authenticated BTCBOX account.", icon: Wallet },
      { to: "/support", label: "Support", detail: "Contact the BTCBOX support team.", icon: Headset },
    ];
    return <div className="tone-market mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-5 overflow-x-clip p-3 sm:gap-6 sm:p-5 lg:p-8">
      <header className="grid min-w-0 gap-4 rounded-2xl border border-brand-border bg-[radial-gradient(ellipse_at_top_right,rgba(14,203,129,.10),transparent_42%),linear-gradient(135deg,var(--color-brand-surface),var(--color-brand-bg))] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-9">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-[.18em] text-brand-accent">{t("BTCBOX / OPEN MARKET")}</p>
          <h1 className="type-page-title text-brand-text">{t(signedIn ? "Welcome back to your market." : "Explore the market. Trade with confidence.")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-text-secondary">{t("Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {authStatus === "loading" ? <Badge variant="outline" role="status">{t("Loading…")}</Badge> : signedIn
              ? <><Button asChild size="lg"><Link to="/trade-hub">{t("Start trading")} <ArrowUpRight className="h-4 w-4"/></Link></Button><Button asChild variant="outline" size="lg"><Link to="/assets">{t("Assets")} <Wallet className="h-4 w-4"/></Link></Button></>
              : <><Button asChild size="lg"><Link to="/register">{t("Create account")} <ArrowUpRight className="h-4 w-4"/></Link></Button><Button asChild variant="outline" size="lg"><Link to="/login">{t("Sign in")}</Link></Button></>}
            <Button asChild variant="ghost" size="lg"><Link to="/markets">{t("Explore markets")} <ArrowRight className="h-4 w-4"/></Link></Button>
          </div>
          {authStatus === "loading" && <p className="mt-2 text-xs text-brand-text-muted">{t("Checking your BTCBOX account…")}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 lg:max-w-[250px] lg:justify-end">
          <Badge variant="outline" className="max-w-full break-words">{t(marketFeedStatus)}</Badge>
          <Badge variant="outline" className="max-w-full break-words">{t("Public market access")}</Badge>
        </div>
      </header>

      <section aria-label={t("Top token market data")} className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div><h2 className="type-section-title text-brand-text">{t("Top tokens")}</h2><p className="mt-1 text-xs text-brand-text-muted">{t("Live market data supplied by BTCBOX")}</p></div>
          <Link to="/markets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-accent">{t("Explore markets")} <ArrowRight className="h-4 w-4"/></Link>
        </div>
        {loading && !displayMarkets.length ? <Card><CardContent className="space-y-3 py-5" role="status" aria-label={t("Loading markets")}>{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-brand-surface-2"/>)}<p className="text-xs text-brand-text-muted">{t("Loading…")}</p></CardContent></Card>
          : error || marketSnapshotStale ? <Card><CardContent className="py-6 text-sm text-rose-300" role="alert"><p className="font-semibold">{t("Market feed unavailable")}</p><p className="mt-1 break-words">{t(marketSnapshotStale ? "The market service snapshot is older than 90 seconds. Quotes are hidden until a fresh snapshot arrives." : error)}</p></CardContent></Card>
          : !featuredMarkets.length ? <Card><CardContent className="py-6 text-sm text-brand-text-muted">{t("No market pairs are currently available.")}</CardContent></Card>
          : <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{featuredMarkets.map((market) => <Link key={market.sym} to={`/trade/${pairSymbol(market.sym)}`} className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-3 transition-colors hover:border-brand-accent/35 sm:p-4">
            <div className="flex min-w-0 items-center gap-3"><TokenIcon symbol={market.sym} className="h-9 w-9"/><div className="min-w-0"><p className="truncate text-sm font-semibold">{market.sym}/USDT</p><p className="text-xs text-brand-text-muted">USDT</p></div></div>
            <div className="min-w-0 text-right"><p className="truncate text-sm font-semibold tabular-nums">{numberFormat(market.price, numberLocale)}</p><p className={`mt-1 text-xs font-semibold tabular-nums ${market.chg >= 0 ? "text-profit" : "text-loss"}`}>{market.chg > 0 ? "+" : ""}{market.chg.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p></div>
          </Link>)}</div>}
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)] lg:gap-5">
        <section className="min-w-0 space-y-3" aria-label={t("Bitcoin market summary")}>
          <div className="flex flex-wrap items-end justify-between gap-2 px-1"><div><h2 className="type-section-title text-brand-text">{t("Market overview")}</h2><p className="mt-1 text-xs text-brand-text-muted">{selectedMarket ? `${selectedMarket.sym}/USDT` : t("Top token market data")}</p></div><Badge variant="outline">{t(marketFeedStatus)}</Badge></div>
          <Card className="overflow-hidden"><CardContent className="grid min-w-0 gap-4 p-4 sm:p-5 md:grid-cols-[minmax(150px,.65fr)_minmax(0,1.35fr)]">
            <div className="min-w-0"><div className="flex flex-wrap gap-2" role="group" aria-label={t("Top tokens")}>
              {featuredMarkets.map((market) => <button key={market.sym} type="button" aria-pressed={selectedMarket?.sym === market.sym} onClick={() => setSelectedSymbol(market.sym)} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold transition-colors ${selectedMarket?.sym === market.sym ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent" : "border-brand-border bg-brand-surface-2 text-brand-text-secondary hover:text-brand-text"}`}>{market.sym}</button>)}
            </div>
            {selectedMarket && <div className="mt-5 min-w-0"><div className="flex min-w-0 items-center gap-2"><TokenIcon symbol={selectedMarket.sym} className="h-8 w-8"/><span className="truncate font-semibold">{selectedMarket.sym}/USDT</span></div><p className="mt-3 break-all text-2xl font-semibold tabular-nums sm:text-3xl">{numberFormat(selectedMarket.price, numberLocale)} <span className="text-xs font-medium text-brand-text-muted">USDT</span></p><p className={`mt-2 text-sm font-semibold tabular-nums ${selectedMarket.chg >= 0 ? "text-profit" : "text-loss"}`}>{selectedMarket.chg > 0 ? "+" : ""}{selectedMarket.chg.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% · {t("24h change")}</p>
              <Button asChild variant="secondary" size="sm" className="mt-4"><Link to={`/trade/${pairSymbol(selectedMarket.sym)}`}>{t("Spot trading")} <ArrowUpRight className="h-4 w-4"/></Link></Button></div>}
            {!selectedMarket && <p className="mt-5 text-sm text-brand-text-muted">{error || (loading ? t("Loading…") : t("No live market data is available."))}</p>}
            </div>
            <div className="min-w-0 border-t border-brand-border pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0"><MiniTrend candles={homeCandles} loading={homeChartLoading} error={homeChartError} locale={numberLocale} t={t}/></div>
          </CardContent></Card>
        </section>

        <aside className="min-w-0 space-y-3">
          <div className="px-1"><h2 className="type-section-title text-brand-text">{t("Manage")}</h2><p className="mt-1 text-xs text-brand-text-muted">{signedIn ? t("Manage your profile, verification, security and support.") : t("Explore market information before signing in.")}</p></div>
          <Card className="overflow-hidden"><nav aria-label={t("Manage")} className="divide-y divide-brand-border/70">
            {actions.map(({ to, label, detail, icon: Icon }) => {
              const needsAuth = label === "Assets";
              const target = needsAuth && !signedIn ? "/login" : to;
              return <Link key={to} to={target} className="group flex min-w-0 items-center gap-3 p-4 transition-colors hover:bg-brand-surface-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t(label)}</span><span className="mt-1 block break-words text-xs leading-5 text-brand-text-muted">{t(needsAuth && !signedIn ? "Sign in to view your assets." : detail)}</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-brand-text-muted"/></Link>;
            })}
          </nav></Card>
        </aside>
      </div>

      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1"><div><h2 className="type-section-title text-brand-text">{t("Market overview")}</h2><p className="mt-1 text-xs text-brand-text-muted">{t("24h change")}</p></div><Link to="/markets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-accent">{t("Explore markets")} <ArrowRight className="h-4 w-4"/></Link></div>
        {error || marketSnapshotStale ? <Card><CardContent className="py-5 text-sm text-brand-text-muted">{t("No live market data is available.")}</CardContent></Card>
          : loading && !movers.length ? <Card><CardContent className="py-5 text-sm text-brand-text-muted" role="status">{t("Loading…")}</CardContent></Card>
          : movers.length ? <Card className="overflow-hidden"><div className="divide-y divide-brand-border/70">{movers.map((market) => <Link key={market.sym} to={`/trade/${pairSymbol(market.sym)}`} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-brand-surface-2 sm:px-5"><div className="flex min-w-0 items-center gap-3"><TokenIcon symbol={market.sym} className="h-8 w-8"/><div className="min-w-0"><p className="truncate text-sm font-semibold">{market.sym}/USDT</p><p className="text-xs text-brand-text-muted">{t("24h volume")} · {compactFormat(market.vol, numberLocale)}</p></div></div><div className="text-right"><p className="text-sm font-semibold tabular-nums">{numberFormat(market.price, numberLocale)}</p><p className={`mt-1 text-xs font-semibold tabular-nums ${market.chg >= 0 ? "text-profit" : "text-loss"}`}>{market.chg > 0 ? "+" : ""}{market.chg.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p></div></Link>)}</div></Card>
          : <Card><CardContent className="py-5 text-sm text-brand-text-muted">{t("No market pairs are currently available.")}</CardContent></Card>}
      </section>

      <section className="grid min-w-0 gap-3 rounded-xl border border-brand-border bg-brand-surface p-4 sm:grid-cols-2 sm:p-5">
        <div className="flex min-w-0 items-start gap-3"><ShieldCheckIcon/><div className="min-w-0"><h2 className="text-sm font-semibold">{t("Public market access")}</h2><p className="mt-1 break-words text-xs leading-5 text-brand-text-muted">{t("View market prices and historical movement before you sign in.")}</p></div></div>
        <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-warning"/><div className="min-w-0"><h2 className="text-sm font-semibold">{t("Important")}</h2><p className="mt-1 break-words text-xs leading-5 text-brand-text-muted">{t("I understand digital asset trading involves significant risk.")}</p></div></div>
      </section>
    </div>;
  }

  return <div className="tone-market mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3 py-1 sm:py-3">
      <div className="min-w-0"><p className="mb-2 text-xs font-semibold tracking-widest text-brand-accent">BTCBOX / {t("Markets")}</p><h1 className="type-page-title">{t("Market overview")}</h1><p className="mt-2 text-sm text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p></div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{t(marketFeedStatus)}</Badge><Button asChild variant="outline" size="sm"><a href="#market-analysis">{t("Chart")} <ArrowRight className="h-4 w-4"/></a></Button></div>
    </header>
    {(btcMarket || loading) && <section aria-label={t("Bitcoin market summary")} className="exchange-summary">
      <div><p className="text-xs text-brand-text-muted">{t("BTC/USDT last price")}</p><p className="mt-2 type-price">{btcMarket ? numberFormat(btcMarket.price, numberLocale) : "—"}</p><p className="mt-1 text-xs text-brand-text-muted">{btcMarket ? t("Latest price returned by BTCBOX") : t("Live BTC quote unavailable")}</p></div>
      <div><p className="text-xs text-brand-text-muted">{t("BTC 24h change")}</p><p className={`mt-2 text-xl font-semibold tabular-nums ${btcMarket && btcMarket.chg < 0 ? "text-loss" : "text-profit"}`}>{btcMarket ? `${btcMarket.chg > 0 ? "+" : ""}${btcMarket.chg.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—"}</p><p className="mt-1 text-xs text-brand-text-muted">{t("24-hour change from the live market feed")}</p></div>
      <div><p className="text-xs text-brand-text-muted">{t("BTC 24h volume")}</p><p className="mt-2 text-xl font-semibold tabular-nums">{btcMarket ? compactFormat(btcMarket.vol, numberLocale) : "—"}</p><p className="mt-1 text-xs text-brand-text-muted">{t("Reported 24-hour trading volume")}</p></div>
    </section>}
    <div className="anim-fade-up anim-delay-4 min-w-0"><LiveMarketsTable markets={markets} loading={loading} error={error}/></div>
    <div id="market-analysis" className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3 px-1 pt-1"><div><h2 className="type-section-title text-brand-text">{t("Market analytics")}</h2><p className="type-body-compact mt-1 text-brand-text-muted">{t("Historical BTC/USDT candles from market providers.")}</p></div><Badge variant="outline" className="shrink-0 border-brand-border bg-brand-surface">{liquidityCandles.length ? `BTC/USDT · ${liquidityRange}` : t("No chart data")}</Badge></div>
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5"><LiquidityChart candles={liquidityCandles}/><VolumeChart candles={volumeCandles}/></div>
    <footer className="px-1 pb-2 text-[11px] leading-5 text-brand-text-muted">TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-brand-text-secondary">https://www.tradingview.com/</a></footer>
  </div>;
}

function ShieldCheckIcon() {
  return <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><ChartNoAxesCombined className="h-4 w-4"/></span>;
}
