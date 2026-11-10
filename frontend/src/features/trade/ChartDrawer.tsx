import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AreaSeries, CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";

type Snap = "collapsed" | "half" | "full";
type TimeframeKey = "Line" | "1m" | "3m" | "5m" | "15m" | "30m" | "1h";

const TIMEFRAMES: Array<{ key: TimeframeKey; seconds: number }> = [
  { key: "Line", seconds: 60 },
  { key: "1m", seconds: 60 },
  { key: "3m", seconds: 180 },
  { key: "5m", seconds: 300 },
  { key: "15m", seconds: 900 },
  { key: "30m", seconds: 1800 },
  { key: "1h", seconds: 3600 },
];

const HEADER_H = 48;

function snapHeights(): { collapsed: number; half: number; full: number } {
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  return {
    collapsed: HEADER_H,
    half: Math.max(260, Math.round(vh * 0.45)),
    full: Math.max(360, Math.min(Math.round(vh * 0.8), vh - 140)),
  };
}

/** Deterministic seeded walk — stable demo candles per timeframe, never real market data. */
function generateCandles(seconds: number, count = 140) {
  let seed = seconds * 2654435761 + 97;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const now = Math.floor(Date.now() / 1000);
  let price = 67000;
  const candles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const drift = (rand() - 0.48) * price * 0.0022;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rand() * price * 0.0012;
    const low = Math.min(open, close) - rand() * price * 0.0012;
    candles.push({ time: ((now - i * seconds) as unknown) as UTCTimestamp, open, high, low, close });
    price = close;
  }
  return candles;
}

/**
 * Fixed bottom K-line drawer. Three snap states (collapsed ~48px bar / half ~45vh / full ~80vh),
 * drag on the handle to resize, tap collapsed bar to expand. Candlesticks rendered with
 * lightweight-charts v5 (repo pattern) from clearly-labeled simulated demo data.
 */
export function ChartDrawer({ symbol = "BTC/USDT" }: { symbol?: string }) {
  const { t } = useI18n();
  const [snap, setSnap] = useState<Snap>(() => (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? "half" : "collapsed"));
  const [timeframe, setTimeframe] = useState<TimeframeKey>("5m");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const heights = useMemo(snapHeights, [snap]);
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
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A2B0BE",
        fontSize: 11,
        fontFamily: "Inter",
      },
      grid: { vertLines: { color: "rgba(32,45,57,0.85)" }, horzLines: { color: "rgba(32,45,57,0.7)" } },
      rightPriceScale: { borderColor: "#263443" },
      timeScale: { borderColor: "#263443", timeVisible: true, secondsVisible: false },
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

  // (Re)build series + data when timeframe changes.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
    const tf = TIMEFRAMES.find((x) => x.key === timeframe) ?? TIMEFRAMES[1];
    const candles = generateCandles(tf.seconds);
    if (tf.key === "Line") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: "#21C7A8",
        topColor: "rgba(33,199,168,0.28)",
        bottomColor: "rgba(33,199,168,0.0)",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      series.setData(candles.map((c) => ({ time: c.time, value: c.close })));
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#35D6A6", downColor: "#F06B78",
        borderVisible: false, wickUpColor: "#35D6A6", wickDownColor: "#F06B78",
      });
      series.setData(candles);
      seriesRef.current = series;
    }
    chart.timeScale().fitContent();
  }, [timeframe]);

  const nearestSnap = useCallback((h: number): Snap => {
    const hs = snapHeights();
    const dists: Array<[Snap, number]> = [["collapsed", Math.abs(h - hs.collapsed)], ["half", Math.abs(h - hs.half)], ["full", Math.abs(h - hs.full)]];
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
    setDragHeight(Math.max(hs.collapsed, Math.min(hs.full, d.startHeight + dy)));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (d && !d.moved && snap === "collapsed") {
      // Tap on collapsed bar → expand to half.
      setSnap("half");
      setDragHeight(null);
      return;
    }
    setSnap(nearestSnap(dragHeight ?? renderedHeight));
    setDragHeight(null);
  };

  const toggleCollapse = () => setSnap((s) => (s === "collapsed" ? "half" : "collapsed"));

  return (
    <div className={cn("trade-drawer-root", isDragging && "is-dragging")} role="region" aria-label={t("Price chart")}>
      <div className="trade-drawer-panel" style={{ height: renderedHeight }}>
        {/* Header / drag handle — always interactive even when collapsed. */}
        <div
          className="trade-drawer-handle relative flex h-12 shrink-0 select-none items-center gap-2 border-b border-brand-border px-3 sm:px-4"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <GripVertical aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-text-faint" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-text">
            {symbol} · {t("Perpetual")} · {t("Chart")}
          </span>
          {!collapsed ? (
            <Badge variant="outline" className="shrink-0 border-brand-warning/30 bg-brand-warning/10 text-brand-warning">{t("Demo data")}</Badge>
          ) : null}
          {!collapsed ? (
            <div className="hidden shrink-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-brand-border-subtle bg-brand-surface-2 p-0.5 sm:flex trade-nav-scroll">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setTimeframe(tf.key); }}
                  className={cn(
                    "min-h-7 rounded-md px-2 text-[11px] font-medium transition-colors",
                    timeframe === tf.key ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text-secondary",
                  )}
                >
                  {t(tf.key)}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            aria-label={collapsed ? t("Expand chart") : t("Collapse chart")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text"
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Chart body — container always mounted so lightweight-charts initializes on
            mobile (which starts collapsed); it has zero height when collapsed. */}
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          {!collapsed && (
            <>
            <div className="pointer-events-none absolute left-2 top-2 rounded border border-brand-border bg-brand-surface/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-warning">
              {t("Demo data")}
            </div>
            {/* Mobile timeframe row (desktop shows it in the header). */}
            <div className="absolute right-2 top-2 flex gap-0.5 rounded-lg border border-brand-border-subtle bg-brand-surface/90 p-0.5 sm:hidden">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  onClick={() => setTimeframe(tf.key)}
                  className={cn(
                    "min-h-6 rounded px-1.5 text-[10px] font-medium",
                    timeframe === tf.key ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted",
                  )}
                >
                  {t(tf.key)}
                </button>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
