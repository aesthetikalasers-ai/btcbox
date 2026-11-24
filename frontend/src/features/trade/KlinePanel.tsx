import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { getKlines, type MarketCandle } from "../../lib/api";
import { CHART_THEME } from "../../lib/chartTheme";

/** K-line intervals offered inside the perpetual chart dialog. */
const INTERVALS = [
  { interval: "1m", label: "1m" },
  { interval: "15m", label: "15m" },
  { interval: "1h", label: "1H" },
  { interval: "4h", label: "4H" },
  { interval: "1d", label: "1D" },
] as const;

type IntervalKey = (typeof INTERVALS)[number]["interval"];

/**
 * Candlestick chart used by the perpetual page's chart dialog.
 *
 * The dialog previously rendered only its title (no series, no container
 * height), so it opened as an empty 30px strip. This panel owns an explicit
 * pixel height, an `autoSize` chart, and its own loading/degraded states, so the
 * dialog always has a real, measurable drawing surface.
 */
export function KlinePanel({ symbol, height = 480 }: { symbol: string; height?: number }) {
  const { t } = useI18n();
  const [timeframe, setTimeframe] = useState<IntervalKey>("1m");
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pairSymbol = useMemo(() => {
    const normalized = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return normalized.endsWith("USDT") ? normalized : normalized + "USDT";
  }, [symbol]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const chart = createChart(node, {
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: CHART_THEME.background },
        textColor: CHART_THEME.text,
        fontSize: 11,
        fontFamily: "Inter",
      },
      grid: { vertLines: { color: CHART_THEME.grid }, horzLines: { color: CHART_THEME.grid } },
      rightPriceScale: { borderColor: CHART_THEME.border },
      timeScale: { borderColor: CHART_THEME.border, timeVisible: true, secondsVisible: false, rightOffset: 6, minBarSpacing: 5 },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
      handleScale: { pinch: true },
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCandles([]);
    getKlines(pairSymbol, timeframe, controller.signal)
      .then((rows) => { if (!cancelled) setCandles(rows); })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setCandles([]);
        setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Chart data is temporarily unavailable.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [pairSymbol, timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
    if (!candles.length) return;
    const data = candles
      .map((candle) => ({
        time: Math.floor(candle.time) as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
      .sort((left, right) => Number(left.time) - Number(right.time));
    const series = chart.addSeries(CandlestickSeries, {
      upColor: CHART_THEME.up, downColor: CHART_THEME.down,
      borderVisible: false, wickUpColor: CHART_THEME.up, wickDownColor: CHART_THEME.down,
    });
    series.setData(data);
    seriesRef.current = series;
    chart.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 pb-2" role="group" aria-label={t("Chart")}>
        {INTERVALS.map((option) => (
          <button
            key={option.interval}
            type="button"
            aria-pressed={timeframe === option.interval}
            onClick={() => setTimeframe(option.interval)}
            className={cn(
              "min-h-7 rounded-md px-2 text-[11px] font-semibold leading-none transition-colors",
              timeframe === option.interval ? "bg-brand-surface-2 text-brand-text" : "text-brand-text-muted hover:text-brand-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="relative w-full min-w-0 overflow-hidden rounded-lg border border-brand-border bg-brand-surface-2" style={{ height }}>
        <div ref={containerRef} className="absolute inset-0" />
        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-brand-text-muted" role="status">{t("Loading…")}</div>
        ) : error ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-brand-danger" role="alert">{t(error)}</div>
        ) : null}
      </div>
    </div>
  );
}