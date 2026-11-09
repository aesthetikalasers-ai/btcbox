import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { useDashboardStore } from "./dashboard.data";
import { BrandLogo } from "../../components/BrandLogo";

const LIQUIDITY_INTERVALS: Record<string, string> = { "1h": "1m", "6h": "5m", "24h": "5m", "7d": "1h", "30d": "1d" };
const VOLUME_INTERVALS: Record<string, string> = { "1d": "5m", "7d": "1h", "30d": "1d" };

export function Dashboard() {
  const { t } = useI18n();
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === "authenticated";
  const isMarketsPage = useLocation().pathname === "/markets";
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liquidityCandles, setLiquidityCandles] = useState<MarketCandle[]>([]);
  const [volumeCandles, setVolumeCandles] = useState<MarketCandle[]>([]);
  const liquidityRange = useDashboardStore((state) => state.liquidityRange);
  const volumeRange = useDashboardStore((state) => state.volumeRange);
  const liquidityInterval = LIQUIDITY_INTERVALS[liquidityRange] || "5m";
  const volumeInterval = VOLUME_INTERVALS[volumeRange] || "1h";
  const hasMarketSnapshotTime = markets.length > 0 && markets.every((item) => Number.isFinite(item.snapshotTs) && (item.snapshotTs || 0) > 0);
  const marketSnapshotStale = markets.some((item) => (item.snapshotTs || 0) > 0 && Date.now() / 1000 - (item.snapshotTs || 0) > 90);
  const btcMarket = !error && !marketSnapshotStale ? markets.find((item) => item.sym === "BTC") : undefined;
  const marketFeedStatus = loading ? "Connecting" : error ? "Feed unavailable" : !markets.length ? "No markets enabled" : marketSnapshotStale ? "Snapshot stale" : !hasMarketSnapshotTime ? "Snapshot time unavailable" : "Live market feed";

  useEffect(() => {
    // A fresh AbortController per poll attempt: a timed-out or unmount-aborted
    // request must never poison later polls. The shared-controller pattern that
    // preceded this could leave `refreshing` stuck true forever if one fetch
    // hung (no client timeout), freezing all prices on screen.
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
        // Do not leave old quotes on screen as if they were current.
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
    const controller = new AbortController();
    let refreshing = false;
    const load = () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      void getKlines("BTCUSDT", liquidityInterval, controller.signal).then((rows) => {
        if (!controller.signal.aborted) setLiquidityCandles(rows);
      }).catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) setLiquidityCandles([]);
      }).finally(() => { refreshing = false; });
    };
    setLiquidityCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [liquidityInterval]);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const load = () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      void getKlines("BTCUSDT", volumeInterval, controller.signal).then((rows) => {
        if (!controller.signal.aborted) setVolumeCandles(rows);
      }).catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) setVolumeCandles([]);
      }).finally(() => { refreshing = false; });
    };
    setVolumeCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [volumeInterval]);

  return <div className="tone-market mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-4 lg:p-6">
    <section className={`${isMarketsPage ? "hidden " : ""}anim-fade-up relative isolate overflow-hidden rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-6 lg:p-7`}>
      <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl" />
      <div className="relative max-w-3xl">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2"><BrandLogo compact className="hidden sm:inline-flex" /><Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 text-brand-text-secondary">Digital asset exchange</Badge></div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-brand-accent">{t("BTCBOX / OPEN MARKET")}</p>
          <h1 className="max-w-[680px] text-2xl font-semibold leading-tight tracking-tight text-brand-text sm:text-3xl lg:text-4xl">{t("Explore the market. Trade with confidence.")}</h1>
          <p className="mt-3 max-w-[620px] text-sm leading-6 text-brand-text-secondary sm:text-base sm:leading-7">{t("Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {signedIn ? (<>
              <Button asChild size="lg"><Link to="/trade-hub">{t("Start trading")} <ArrowUpRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/assets">{t("Assets")}</Link></Button>
            </>) : (<>
              <Button asChild size="lg"><Link to="/register">{t("Create account")} <ArrowUpRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/login">{t("Sign in")}</Link></Button>
              <Button asChild variant="ghost" size="lg"><Link to="/markets">{t("View markets")} <ArrowRight className="h-4 w-4" /></Link></Button>
            </>)}
          </div>
        </div>
      </div>
    </section>

    {isMarketsPage && <div className="anim-fade-up flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-muted">{t("BTCBOX / MARKETS")}</p>
        <h1 className="type-page-title text-brand-text">{t("Market overview")}</h1>
        <p className="type-body mt-1.5 text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p>
      </div>
      <Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-brand-text-secondary">
        {t(marketFeedStatus)}
      </Badge>
    </div>}
    {(btcMarket || loading) && <section aria-label={t("Bitcoin market summary")} className="grid gap-3 sm:grid-cols-3">
      <div className="anim-fade-up anim-delay-1 card-lift relative min-w-0 overflow-hidden rounded-xl border border-brand-border bg-gradient-to-br from-brand-accent/[0.06] via-brand-surface to-brand-surface p-4 sm:p-5">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-accent"/>
        <div className="flex items-center justify-between gap-2 pl-1"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{t("BTC/USDT last price")}</p></div>
        <p className="mt-3 truncate text-xl font-semibold tracking-tight tabular-nums text-brand-text sm:text-2xl">{loading ? "—" : btcMarket ? btcMarket.price.toLocaleString(undefined,{maximumFractionDigits:8}) : "—"}</p>
        
      </div>
      <div className="anim-fade-up anim-delay-2 card-lift relative min-w-0 overflow-hidden rounded-xl border border-brand-border bg-gradient-to-br from-brand-accent/[0.06] via-brand-surface to-brand-surface p-4 sm:p-5">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-accent"/>
        <div className="flex items-center justify-between gap-2 pl-1"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{t("BTC 24h change")}</p><span className={"h-2 w-2 rounded-full "+(btcMarket ? btcMarket.chg >= 0 ? "bg-profit" : "bg-loss" : "bg-brand-text-muted")}/></div>
        <p className={"mt-3 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl "+(btcMarket ? btcMarket.chg >= 0 ? "text-profit" : "text-loss" : "text-brand-text")}>{loading || !btcMarket ? "—" : (btcMarket.chg > 0 ? "+" : "") + btcMarket.chg.toFixed(2) + "%"}</p>
        
      </div>
      <div className="anim-fade-up anim-delay-3 card-lift relative min-w-0 overflow-hidden rounded-xl border border-brand-border bg-gradient-to-br from-brand-accent/[0.06] via-brand-surface to-brand-surface p-4 sm:p-5">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-accent"/>
        <div className="flex items-center justify-between gap-2 pl-1"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{t("BTC 24h volume")}</p></div>
        <p className="mt-3 truncate text-xl font-semibold tracking-tight tabular-nums text-brand-text sm:text-2xl">{loading || !btcMarket ? "—" : Number(btcMarket.vol).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 }) + " USDT"}</p>
        
      </div>
    </section>}
    <div className="anim-fade-up anim-delay-4 min-w-0">
      {!isMarketsPage && marketSnapshotStale && <Badge variant="outline" className="mb-2 border-brand-border bg-brand-surface">{t("Snapshot stale")}</Badge>}
      <LiveMarketsTable markets={markets} loading={loading} error={error} />
    </div>
    {isMarketsPage && <>
    <div className="flex items-center justify-between gap-3 px-1 pt-1">
      <div>
        <h2 className="type-section-title text-brand-text">{t("Market analytics")}</h2>
        <p className="type-body-compact mt-1 text-brand-text-muted">{t("Historical BTC/USDT candles from market providers.")}</p>
      </div>
      <Badge variant="outline" className="shrink-0 border-brand-border bg-brand-surface">
        {liquidityCandles.length ? "BTC/USDT · " + liquidityRange : t("No chart data")}
      </Badge>
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5">
      <LiquidityChart candles={liquidityCandles} />
      <VolumeChart candles={volumeCandles} />
    </div>
    </>}
    <footer className="px-1 pb-2 text-[11px] leading-5 text-brand-text-muted">
      TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc.{" "}
      <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-brand-text-secondary">https://www.tradingview.com/</a>
    </footer>
  </div>;
}
