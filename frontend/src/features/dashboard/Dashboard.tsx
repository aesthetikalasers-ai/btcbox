import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { localeTags, useI18n } from "../../lib/i18n";
import { useDashboardStore } from "./dashboard.data";


const LIQUIDITY_INTERVALS: Record<string, string> = { "1h": "1m", "6h": "5m", "24h": "5m", "7d": "1h", "30d": "1d" };
const VOLUME_INTERVALS: Record<string, string> = { "1d": "5m", "7d": "1h", "30d": "1d" };

export function Dashboard() {
  const { t, language } = useI18n();
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
  const marketSnapshotStale = markets.some((item) => (item.snapshotTs || 0) > 0 && Date.now() / 1000 - (item.snapshotTs || 0) > 90);
  const btcMarket = !error && !marketSnapshotStale ? markets.find((item) => item.sym === "BTC") : undefined;
  const marketFeedStatus = loading ? "Connecting" : error || !markets.length || marketSnapshotStale ? "Feed unavailable" : "Live market feed";

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
      }).catch(() => {
        if (cancelled) return;
        // Never show upstream provider diagnostics or stale prices to customers.
        setMarkets([]);
        setError("Market data is temporarily unavailable. Please try again shortly.");
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
    if (!isMarketsPage) return;
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
      }).catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) setVolumeCandles([]);
      }).finally(() => { refreshing = false; });
    };
    setVolumeCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [volumeInterval, isMarketsPage]);

  return <div className="tone-market mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3 py-1 sm:py-3">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold tracking-widest text-brand-accent">BTCBOX / {t(isMarketsPage ? "Markets" : "Home")}</p>
        <h1 className="type-page-title">{t("Market overview")}</h1>
        <p className="mt-2 text-sm text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p>
      </div>
      <Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-brand-text-secondary">
        {t(marketFeedStatus)}
      </Badge>
    </header>
    {(btcMarket || loading) && <section aria-label={t("Bitcoin market summary")} className="grid gap-3 sm:grid-cols-3">
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-brand-cyan/25 bg-gradient-to-br from-brand-cyan/[0.075] via-brand-surface to-brand-surface p-4 ring-1 ring-brand-cyan/[0.06] sm:p-5">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-cyan"/>
        <div className="flex items-center justify-between gap-2 pl-1"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{t("BTC/USDT last price")}</p><span className="h-2 w-2 rounded-full bg-brand-cyan shadow-[0_0_12px_var(--color-brand-cyan)]"/></div>
        <p className="mt-3 truncate text-xl font-semibold tracking-tight tabular-nums text-brand-text sm:text-2xl">{loading ? "—" : btcMarket ? btcMarket.price.toLocaleString(localeTags[language],{maximumFractionDigits:8}) : "—"}</p>
        
      </div>
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-brand-teal/25 bg-gradient-to-br from-brand-teal/[0.075] via-brand-surface to-brand-surface p-4 ring-1 ring-brand-teal/[0.06] sm:p-5">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-teal"/>
        <div className="flex items-center justify-between gap-2 pl-1"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{t("BTC 24h change")}</p><span className={"h-2 w-2 rounded-full "+(btcMarket ? btcMarket.chg >= 0 ? "bg-profit" : "bg-loss" : "bg-brand-text-muted")}/></div>
        <p className={"mt-3 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl "+(btcMarket ? btcMarket.chg >= 0 ? "text-profit" : "text-loss" : "text-brand-text")}>{loading || !btcMarket ? "—" : (btcMarket.chg > 0 ? "+" : "") + btcMarket.chg.toFixed(2) + "%"}</p>
        
      </div>
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-brand-violet/25 bg-gradient-to-br from-brand-violet/[0.075] via-brand-surface to-brand-surface p-4 ring-1 ring-brand-violet/[0.06] sm:p-5">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-violet"/>
        <div className="flex items-center justify-between gap-2 pl-1"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{t("BTC 24h volume")}</p><span className="h-2 w-2 rounded-full bg-brand-violet shadow-[0_0_12px_var(--color-brand-violet)]"/></div>
        <p className="mt-3 truncate text-xl font-semibold tracking-tight tabular-nums text-brand-text sm:text-2xl">{loading || !btcMarket || !Number.isFinite(Number(btcMarket.vol)) ? "—" : new Intl.NumberFormat(localeTags[language],{notation:"compact",maximumFractionDigits:2}).format(Number(btcMarket.vol)) + " USDT"}</p>
        
      </div>
    </section>}
    <div className="anim-fade-up anim-delay-4 min-w-0">
      <LiveMarketsTable markets={markets} loading={loading} error={error} />
    </div>
    {isMarketsPage && <>
    <div id="market-analysis" className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3 px-1 pt-1">
      <div>
        <h2 className="type-section-title text-brand-text">{t("Market analytics")}</h2>
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
    {!isMarketsPage && <nav aria-label={t("Manage")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[{to:"/markets",label:"Markets"},{to:"/trade-hub",label:"Trade"},{to:"/assets",label:"Assets"},{to:"/support",label:"Support"}].map(item => <Button key={item.to} asChild variant="outline"><Link to={item.to}>{t(item.label)} <ArrowUpRight className="ml-auto h-4 w-4" /></Link></Button>)}
    </nav>}
    {isMarketsPage && <footer className="px-1 pb-2 text-[11px] leading-5 text-brand-text-muted">
      TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc.{" "}
      <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-brand-text-secondary">https://www.tradingview.com/</a>
    </footer>}
  </div>;
}
