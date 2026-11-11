import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, ShieldCheck, Wallet } from "lucide-react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useDashboardStore } from "./dashboard.data";
import { BrandLogo } from "../../components/BrandLogo";

const LIQUIDITY_INTERVALS: Record<string, string> = { "1h": "1m", "6h": "5m", "24h": "5m", "7d": "1h", "30d": "1d" };
const VOLUME_INTERVALS: Record<string, string> = { "1d": "5m", "7d": "1h", "30d": "1d" };

export function Dashboard() {
  const { t } = useI18n();
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liquidityCandles, setLiquidityCandles] = useState<MarketCandle[]>([]);
  const [volumeCandles, setVolumeCandles] = useState<MarketCandle[]>([]);
  const liquidityRange = useDashboardStore((state) => state.liquidityRange);
  const volumeRange = useDashboardStore((state) => state.volumeRange);
  const liquidityInterval = LIQUIDITY_INTERVALS[liquidityRange] || "5m";
  const volumeInterval = VOLUME_INTERVALS[volumeRange] || "1h";

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;
    const loadMarkets = () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true;
      getMarkets(controller.signal).then((rows) => {
        if (controller.signal.aborted) return;
        setMarkets(rows);
        setError("");
      }).catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        // Do not leave old quotes on screen as if they were current.
        setMarkets([]);
        setError(reason instanceof Error ? reason.message : "Market data is unavailable.");
      }).finally(() => {
        refreshing = false;
        if (!controller.signal.aborted) setLoading(false);
      });
    };
    loadMarkets();
    const refreshId = window.setInterval(loadMarkets, 15000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => getKlines("BTCUSDT", liquidityInterval, controller.signal).then((rows) => {
      if (!controller.signal.aborted) setLiquidityCandles(rows);
    }).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (!controller.signal.aborted) setLiquidityCandles([]);
    });
    setLiquidityCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [liquidityInterval]);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => getKlines("BTCUSDT", volumeInterval, controller.signal).then((rows) => {
      if (!controller.signal.aborted) setVolumeCandles(rows);
    }).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (!controller.signal.aborted) setVolumeCandles([]);
    });
    setVolumeCandles([]);
    load();
    const refreshId = window.setInterval(load, 60000);
    return () => { window.clearInterval(refreshId); controller.abort(); };
  }, [volumeInterval]);

  return <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 p-3 sm:gap-6 sm:p-5 lg:p-7">
    <section className="relative isolate overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-brand-surface via-brand-surface to-[#102a48] p-5 sm:p-7 lg:p-9">
      <div className="pointer-events-none absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-accent/15 blur-3xl" />
      <div className="relative grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.55fr)]">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-2"><BrandLogo compact className="hidden sm:inline-flex" /><Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 text-brand-text-secondary">Digital asset exchange</Badge></div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-brand-accent">{t("BTCBOX / OPEN MARKET")}</p>
          <h1 className="max-w-[680px] text-3xl font-semibold leading-tight tracking-tight text-brand-text sm:text-4xl lg:text-5xl">{t("Explore the market. Trade with confidence.")}</h1>
          <p className="mt-4 max-w-[620px] text-sm leading-6 text-brand-text-secondary sm:text-base sm:leading-7">{t("Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/register">{t("Create account")} <ArrowUpRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/trade-hub">{t("Explore trading")} <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-xl border border-brand-border bg-brand-bg/45 p-4">
            <ChartNoAxesCombined className="mb-3 h-5 w-5 text-brand-accent" />
            <p className="text-sm font-semibold text-brand-text">{t("Public market access")}</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">{t("View market prices and historical movement before you sign in.")}</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-bg/45 p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-profit" />
            <p className="text-sm font-semibold text-brand-text">{t("Account protection")}</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">{t("Personal assets and account actions require an authenticated session.")}</p>
          </div>
        </div>
      </div>
    </section>

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-muted">{t("BTCBOX / MARKETS")}</p>
        <h2 className="type-page-title text-brand-text">{t("Market overview")}</h2>
        <p className="type-body mt-1.5 text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p>
      </div>
      <Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-brand-text-secondary">
        {loading ? t("Connecting") : error ? t("Feed unavailable") : t("Live market feed")}
      </Badge>
    </div>
    <LiveMarketsTable markets={markets} loading={loading} error={error} />
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
    <section className="flex flex-col items-start justify-between gap-4 rounded-xl border border-brand-border bg-brand-surface p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent"><Wallet className="h-5 w-5" /></span>
        <div><h2 className="type-section-title text-brand-text">{t("Ready to access your account?")}</h2><p className="mt-1 text-sm leading-6 text-brand-text-muted">{t("Create an account or sign in to manage your personal assets and account services.")}</p></div>
      </div>
      <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
        <Button asChild variant="outline"><Link to="/login">{t("Sign in")}</Link></Button>
        <Button asChild><Link to="/register">{t("Create account")}</Link></Button>
      </div>
    </section>
  </div>;
}
