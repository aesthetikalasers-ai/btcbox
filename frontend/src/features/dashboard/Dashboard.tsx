import { useEffect, useState } from "react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { useDashboardStore } from "./dashboard.data";

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
        // Keep the last confirmed rows visible while the provider is unavailable.
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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-muted">{t("BTCBOX / MARKETS")}</p>
        <h1 className="type-page-title text-brand-text">{t("Market overview")}</h1>
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
  </div>;
}
