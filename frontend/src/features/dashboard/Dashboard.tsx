import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ArrowLeftRight, ChartNoAxesCombined, Headset, Wallet } from "lucide-react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { useDashboardStore } from "./dashboard.data";


const LIQUIDITY_INTERVALS: Record<string, string> = { "1h": "1m", "6h": "5m", "24h": "5m", "7d": "1h", "30d": "1d" };
const VOLUME_INTERVALS: Record<string, string> = { "1d": "5m", "7d": "1h", "30d": "1d" };

export function Dashboard() {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language];
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

  return <div className="tone-market mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-3 py-1 sm:py-3">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold tracking-widest text-brand-accent">BTCBOX / {t(isMarketsPage ? "Markets" : "Home")}</p>
        <h1 className="type-page-title">{t("Market overview")}</h1>
        <p className="mt-2 text-sm text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(marketFeedStatus)}</Badge>
        {isMarketsPage ? <Button asChild variant="outline" size="sm"><a href="#market-analysis">{t("Chart")} <ArrowRight className="h-4 w-4" /></a></Button>
          : <Button asChild size="sm"><Link to={signedIn ? "/assets" : "/register"}>{t(signedIn ? "Assets" : "Create account")} <ArrowUpRight className="h-4 w-4" /></Link></Button>}
      </div>
    </header>
    {(btcMarket || loading) && <section aria-label={t("Bitcoin market summary")} className="exchange-summary">
      <div><p className="text-xs text-brand-text-muted">{t("BTC/USDT last price")}</p><p className="mt-2 type-price">{btcMarket ? btcMarket.price.toLocaleString(numberLocale, {maximumFractionDigits:8}) : "—"} <span className="text-xs font-normal text-brand-text-muted">USDT</span></p></div>
      <div><p className="text-xs text-brand-text-muted">{t("BTC 24h change")}</p><p className={"mt-2 text-xl font-semibold tabular-nums " + (btcMarket && btcMarket.chg < 0 ? "text-loss" : "text-profit")}>{btcMarket ? (btcMarket.chg > 0 ? "+" : "") + btcMarket.chg.toLocaleString(numberLocale, {minimumFractionDigits:2,maximumFractionDigits:2}) + "%" : "—"}</p></div>
      <div><p className="text-xs text-brand-text-muted">{t("BTC 24h volume")}</p><p className="mt-2 text-xl font-semibold tabular-nums">{btcMarket ? Number(btcMarket.vol).toLocaleString(numberLocale, {notation:"compact",maximumFractionDigits:2}) : "—"} <span className="text-xs font-normal text-brand-text-muted">USDT</span></p></div>
    </section>}
    <div className="anim-fade-up anim-delay-4 min-w-0">
      <LiveMarketsTable markets={markets} loading={loading} error={error} />
    </div>
    {isMarketsPage && <>
    <div id="market-analysis" className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3 px-1 pt-1">
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
    {!isMarketsPage && <nav aria-label={t("Manage")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[{to:"/markets",label:"Markets",icon:ChartNoAxesCombined},{to:"/trade-hub",label:"Trade",icon:ArrowLeftRight},{to:"/assets",label:"Assets",icon:Wallet},{to:"/support",label:"Support",icon:Headset}].map(({to,label,icon:Icon}) =>
        <Link key={to} to={to} className="group flex min-w-0 items-center gap-3 rounded-xl border border-brand-border bg-brand-surface px-4 py-4 text-sm font-semibold transition-colors hover:border-brand-accent/50 hover:bg-brand-surface-2 sm:py-5">
          <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-text-muted group-hover:text-brand-accent" />
          <span className="min-w-0 break-words">{t(label)}</span>
          <ArrowUpRight aria-hidden="true" className="ml-auto hidden h-4 w-4 shrink-0 text-brand-text-muted sm:block" />
        </Link>)}
    </nav>}
    <footer className="px-1 pb-2 text-[11px] leading-5 text-brand-text-muted">
      TradingView Lightweight Charts™ Copyright (с) 2025 TradingView, Inc.{" "}
      <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-brand-text-secondary">https://www.tradingview.com/</a>
    </footer>
  </div>;
}
