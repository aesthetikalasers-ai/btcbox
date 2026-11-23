import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AreaSeries, CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { ChevronDown, ChevronUp, Maximize2, TrendingUp } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { getKlines, type MarketCandle } from "../../lib/api";
import { CHART_THEME } from "../../lib/chartTheme";

type Snap = "collapsed" | "expanded";
type TimeframeKey = "Line" | "15m" | "1h" | "4h" | "1d";

// Binance-style compact timeframe set (分时 / 15m / 1H / 4H / 1D). The line chart
// ("分时") is rendered as an area series; every other key maps directly onto the
// backend kline interval.
const TIMEFRAMES: Array<{ key: TimeframeKey; interval: string; label: string }> = [
  { key: "Line", interval: "1m", label: "分时" },
  { key: "15m", interval: "15m", label: "15m" },
  { key: "1h", interval: "1h", label: "1H" },
  { key: "4h", interval: "4h", label: "4H" },
  { key: "1d", interval: "1d", label: "1D" },
];

// Collapsed bar height (44px) and a viewport-relative expanded band. The drawer
// opens to ~50dvh (matching the reference screenshot's 2/3-height chart) and can
// be dragged up to 75dvh; it never covers the whole screen.
const HEADER_H = 44;
const EXPANDED_DVH = 50;
const MAX_DVH = 75;

/** Resolve dvh-based heights to px against the current viewport. */
function snapHeights(): { collapsed: number; expanded: number; max: number } {
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    collapsed: HEADER_H,
    expanded: Math.round((vh * EXPANDED_DVH) / 100),
    max: Math.round((vh * MAX_DVH) / 100),
  };
}

/**
 * Fixed bottom K-line drawer for the H5 perpetual terminal. Two states: a 36px
 * collapsed bar and a fixed 210px expanded band (no full-screen overlay). The
 * handle can be dragged between the two; tapping the collapsed bar expands it.
 * Candlesticks are rendered with lightweight-charts v5 from the BTCBOX candle API.
 */
export function ChartDrawer({ symbol = "BTC/USDT", marketType = "perpetual", open, onOpenChange }: { symbol?: string; marketType?: "spot" | "perpetual"; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t } = useI18n();
  const [snap, setSnap] = useState<Snap>("collapsed");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("Line");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  const pairSymbol = useMemo(() => {
    const normalized = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return normalized.endsWith("USDT") ? normalized : normalized + "USDT";
  }, [symbol]);
  const chartInterval = timeframe === "Line" ? "1m" : timeframe;

  useEffect(() => {
    if (open === true) setSnap("expanded");
    else if (open === false) setSnap("collapsed");
  }, [open]);

  const [heights, setHeights] = useState(snapHeights);
  useEffect(() => {
    const updateHeights = () => setHeights(snapHeights());
    window.addEventListener("resize", updateHeights);
    return () => window.removeEventListener("resize", updateHeights);
  }, []);
  const collapsed = snap === "collapsed" && dragHeight === null;
  const renderedHeight = dragHeight ?? heights[snap];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  // Create chart once.
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
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(162,176,190,0.4)", width: 1, style: 3, labelBackgroundColor: "#1B2936" },
        horzLine: { color: "rgba(162,176,190,0.4)", width: 1, style: 3, labelBackgroundColor: "#1B2936" },
      },
    });
    chartRef.current = chart;
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  // Load only provider-verified candles. An unavailable/empty response is
  // rendered as an explicit error state; this component never creates sample data.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setChartLoading(true);
    setChartError("");
    setCandles([]);
    getKlines(pairSymbol, chartInterval, controller.signal)
      .then((rows) => { if (!cancelled) setCandles(rows); })
      .catch((reason: unknown) => {
        if (cancelled || (reason instanceof Error && reason.name === "AbortError")) return;
        setCandles([]);
        setChartError(reason instanceof Error ? reason.message : "Chart data is temporarily unavailable.");
      })
      .finally(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [pairSymbol, chartInterval, retryTick]);

  // Refresh while the mobile chart is expanded. Requests are serialized and
  // aborted on close, pair change, or unmount.
  useEffect(() => {
    if (snap !== "expanded") return;
    let cancelled = false;
    let refreshing = false;
    let pending: AbortController | undefined;
    const refresh = () => {
      if (cancelled || refreshing) return;
      refreshing = true;
      const controller = new AbortController();
      pending = controller;
      getKlines(pairSymbol, chartInterval, controller.signal)
        .then((rows) => { if (!cancelled) { setCandles(rows); setChartError(""); } })
        .catch((reason: unknown) => {
          if (cancelled || (reason instanceof Error && reason.name === "AbortError")) return;
          setCandles([]);
          setChartError(reason instanceof Error ? reason.message : "Chart data is temporarily unavailable.");
        })
        .finally(() => { refreshing = false; });
    };
    const timer = window.setInterval(refresh, 30000);
    return () => { cancelled = true; pending?.abort(); window.clearInterval(timer); };
  }, [pairSymbol, chartInterval, snap]);
  // (Re)build series + data when candles or timeframe change.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
    if (!candles.length) return;
    const data = candles
      .map((c) => ({ time: Math.floor(c.time / 1000) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
      .sort((a, b) => Number(a.time) - Number(b.time));
    if (timeframe === "Line") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: CHART_THEME.up,
        topColor: "rgba(14,203,129,0.28)",
        bottomColor: "rgba(14,203,129,0.0)",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      series.setData(data.map((d) => ({ time: d.time, value: d.close })));
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: CHART_THEME.up, downColor: CHART_THEME.down,
        borderVisible: false, wickUpColor: CHART_THEME.up, wickDownColor: CHART_THEME.down,
      });
      series.setData(data);
      seriesRef.current = series;
    }
    chart.timeScale().fitContent();
  }, [candles, timeframe]);

  const nearestSnap = useCallback((h: number): Snap => {
    const hs = snapHeights();
    // Anything dragged past the 65dvh open position settles at the 92dvh ceiling;
    // below that it snaps to the collapsed bar or the 65dvh open band.
    if (h > hs.expanded) return "expanded";
    const dists: Array<[Snap, number]> = [["collapsed", Math.abs(h - hs.collapsed)], ["expanded", Math.abs(h - hs.expanded)]];
    dists.sort((a, b) => a[1] - b[1]);
    return dists[0][0];
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startHeight: renderedHeight, moved: false };
    setIsDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    const hs = snapHeights();
    setDragHeight(Math.max(hs.collapsed, Math.min(hs.max, d.startHeight + dy)));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (d && !d.moved && snap === "collapsed") {
      setSnap("expanded");
      setDragHeight(null);
      return;
    }
    const nextSnap = nearestSnap(dragHeight ?? renderedHeight);
    setSnap(nextSnap);
    onOpenChange?.(nextSnap === "expanded");
    setDragHeight(null);
  };

  const toggleCollapse = () => setSnap((current) => {
    const next = current === "collapsed" ? "expanded" : "collapsed";
    onOpenChange?.(next === "expanded");
    return next;
  });

  return (
    <div className={cn("trade-drawer-root", isDragging && "is-dragging")} role="region" aria-label={t("Price chart")}>
      <div
        className={cn(
          "trade-drawer-panel transition-all",
          collapsed && "border-t-2 border-brand-accent/50 shadow-[0_-6px_20px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(14,203,129,0.35)] bg-gradient-to-r from-brand-surface via-brand-surface-2 to-brand-surface"
        )}
        style={{ height: renderedHeight }}
      >
        {/* Collapsed bar — single tap target showing the pair + chart label with enhanced visual affordance. */}
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapse}
            className="group relative flex h-11 w-full shrink-0 select-none items-center justify-between px-3.5 text-[13px] text-brand-text transition-colors hover:bg-brand-surface-hover/60 active:bg-brand-surface-hover"
            aria-label={t("Expand chart")}
          >
            {/* Top pill drag handle indicator */}
            <span className="pointer-events-none absolute left-1/2 top-1 h-1 w-9 -translate-x-1/2 rounded-full bg-brand-text-muted/40 transition-colors group-hover:bg-brand-accent/70" />
            
            <div className="flex min-w-0 flex-1 items-center gap-2 pt-1">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-brand-accent/30 bg-brand-accent/15 text-brand-accent shadow-sm">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              <span className="truncate font-semibold tracking-tight text-brand-text">
                {pairSymbol} {marketType === "spot" ? t("Spot") : t("Perpetual")} {t("Chart")}
              </span>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/40 bg-brand-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-brand-accent shadow-sm transition-transform group-hover:scale-105">
                <ChevronUp className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>{t("Expand")}</span>
              </span>
            </div>
          </button>
        ) : (
          <>
            {/* Thin drag indicator strip. */}
            <div
              className="trade-drawer-handle flex h-1 shrink-0 select-none items-center justify-center"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              aria-hidden="true"
            >
              <span className="h-0.5 w-8 rounded-full bg-brand-border" />
            </div>
            {/* Single-line header: title + timeframe pills + fullscreen/collapse. */}
            {/* Single-line header: title + timeframe pills + fullscreen/collapse.
                The title itself is a tap target so the sheet closes on a second
                tap of the same label the user opened it with. */}
            <div className="flex h-7 shrink-0 select-none items-center gap-2 px-3 text-[11px]">
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex min-w-0 flex-1 items-center gap-1 text-left font-semibold text-[#eaecef]"
                aria-label={t("Collapse chart")}
              >
                <span className="min-w-0 truncate">{pairSymbol} {marketType === "spot" ? t("Spot") : t("Perpetual")} {t("Chart")}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-brand-text-muted" />
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setTimeframe(tf.key)}
                    className={cn(
                      "rounded px-1.5 py-0.5 font-medium transition-colors",
                      timeframe === tf.key ? "bg-[#0ecb81]/15 text-[#0ecb81]" : "text-brand-text-muted hover:text-brand-text-secondary",
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <button type="button" aria-label={t("Fullscreen chart")} onClick={toggleCollapse}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label={t("Collapse chart")} onClick={toggleCollapse}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* Chart body — container always mounted so lightweight-charts initializes on
            mobile (which starts collapsed); it has zero height when collapsed. */}
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          {!collapsed && candles.length > 0 ? (
            <div className="pointer-events-none absolute left-2 top-1 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-brand-text-muted">
              {t("Source")}: {candles[candles.length - 1].source || "—"} · {new Date(candles[candles.length - 1].time).toLocaleTimeString()}
            </div>
          ) : null}
          {!collapsed && (
            <>
              {chartLoading ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-brand-text-muted" role="status">{t("Loading…")}</div>
              ) : chartError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-surface/80 px-4 text-center text-xs text-brand-danger" role="alert">
                  <span>{t(chartError)}</span>
                  <button type="button" className="min-h-9 rounded-md border border-brand-border px-3 text-brand-text" onClick={() => setRetryTick((value) => value + 1)}>{t("Retry")}</button>
                </div>
              ) : !candles.length ? (
                <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-brand-text-muted" role="status">{t("No verified candle data is available for this market.")}</div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
