import { useEffect, useState } from "react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { TopTokensTable } from "./components/TopTokensTable";
import { Badge } from "../../components/ui/badge";
import { getMarkets, type MarketTicker } from "../../lib/api";

export function Dashboard() {
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getMarkets(controller.signal)
      .then((rows) => {
        setMarkets(rows);
        setError("");
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Market data is temporarily unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-4 p-3 sm:gap-5 sm:p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-brand-text-muted">BTCBOX / MARKETS</p>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">Market overview</h1>
          <p className="mt-1 text-sm text-brand-text-secondary">Live spot prices and 24-hour market movement.</p>
        </div>
        <Badge variant="outline" className="border-brand-border bg-brand-surface text-brand-text-secondary">
          {loading ? "Connecting" : error ? "Feed unavailable" : "Live market feed"}
        </Badge>
      </div>

      <TopTokensTable markets={markets} loading={loading} error={error} />

      <div className="flex items-center justify-between gap-3 px-1 pt-1">
        <div>
          <h2 className="text-sm font-semibold text-brand-text">Market analytics</h2>
          <p className="mt-1 text-xs text-brand-text-muted">Historical chart integration is still in progress.</p>
        </div>
        <Badge variant="outline" className="shrink-0">Chart preview</Badge>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5">
        <LiquidityChart />
        <VolumeChart />
      </div>
    </div>
  );
}
