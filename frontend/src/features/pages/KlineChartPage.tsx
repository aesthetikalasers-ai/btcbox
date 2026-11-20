import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Clock3, Info, ListOrdered } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { SubPageLayout } from "../../components/layout/SubPageLayout";
import { TokenIcon } from "../../components/ui/TokenIcon";
import {
  getKlines,
  getMarkets,
  getOrderBook,
  type MarketCandle,
  type MarketTicker,
  type OrderBookSnapshot,
} from "../../lib/api";
import { localeTags, useI18n } from "../../lib/i18n";
import { CHART_THEME } from "../../lib/chartTheme";
import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries, type UTCTimestamp } from "lightweight-charts";
import { cn } from "../../lib/utils";

/** Canonicalize a route symbol into a BTCBOX "BASEUSDT" pair. */
function normalizePair(raw: string | undefined): { base: string; symbol: string } {
  const upper = (raw || "BTCUSDT").toUpperCase();
  const symbol = upper.endsWith("USDT") ? upper : `${upper}USDT`;
  const base = symbol.slice(0, -4);
  return { base, symbol };
}

/** Locale-aware numeric formatting with fixed, monospace-safe digits. */
function fmt(value: number | string | null | undefined, locale: string, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Compact large numbers (e.g. 1.2万 / 12.3亿). */
function compact(value: number | string | null | undefined, locale: string): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

type Timeframe = "分时" | "15m" | "1h" | "4h" | "1D" | "更多";
type TabKey = "depth" | "trades" | "info";

const TIMEFRAMES: Array<{ key: Timeframe; kline: string }> = [
  { key: "分时", kline: "1m" },
  { key: "15m", kline: "15m" },
  { key: "1h", kline: "1h" },
  { key: "4h", kline: "4h" },
  { key: "1D", kline: "1d" },
];

const EXTRA_TIMEFRAMES: Array<{ key: string; kline: string }> = [
  { key: "1m", kline: "1m" },
  { key: "5m", kline: "5m" },
  { key: "30m", kline: "30m" },
  { key: "1w", kline: "1w" },
];

/** Deterministic mock recent-trades rows, stable across re-renders. */
function mockRecentTrades(basePrice: number, count = 18): Array<{ id: number; price: number; qty: number; side: "buy" | "sell"; ts: number }> {
  const rows: Array<{ id: number; price: number; qty: number; side: "buy" | "sell"; ts: number }> = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = 0; i < count; i += 1) {
    const drift = (Math.sin(i * 1.7) * 0.0004 + (Math.random() - 0.5) * 0.0004) * price;
    price = Math.max(0.0001, price + drift);
    rows.push({
      id: i,
      price,
      qty: Math.round((0.01 + Math.random() * 2.5) * 1000) / 1000,
      side: drift >= 0 ? "buy" : "sell",
      ts: now - i * 2600,
    });
  }
  return rows;
}

export function KlineChartPage() {
  const { symbol: routeSymbol } = useParams();
  const { base, symbol } = normalizePair(routeSymbol);
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const navigate = useNavigate();

  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [book, setBook] = useState<OrderBookSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [activeTab, setActiveTab] = useState<TabKey>("depth");
  const [extraOpen, setExtraOpen] = useState(false);

  const chartNodeRef = useRef<HTMLDivElement | null>(null);

  const resolution = useMemo(() => {
    if (timeframe === "更多") return "1h";
    const found = TIMEFRAMES.find((item) => item.key === timeframe);
    return found ? found.kline : "1h";
  }, [timeframe]);

  const isLineMode = timeframe === "分时";

  // ---- Live ticker polling ----
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getMarkets()
        .then((rows) => {
          if (cancelled) return;
          const found = rows.find((m) => m.sym.toUpperCase() === base.toUpperCase()) || null;
          if (found) setTicker(found);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [base]);

  // ---- Candles + order book loading ----
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled([getKlines(symbol, resolution, controller.signal), getOrderBook(symbol, controller.signal)])
      .then(([klineResult, bookResult]) => {
        if (controller.signal.aborted) return;
        if (klineResult.status === "fulfilled") setCandles(klineResult.value);
        if (bookResult.status === "fulfilled") setBook(bookResult.value);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [symbol, resolution]);
  // ---- Candlestick + volume chart rendering ----
  useEffect(() => {
    const node = chartNodeRef.current;
    if (!node || !candles.length || node.clientWidth <= 0) return;
    const chart = createChart(node, {
      width: node.clientWidth,
      height: node.clientHeight || 420,
      layout: {
        // lightlibrary 默认在图表左下角渲染 TradingView 角标；交易所产品不应出现
        // 第三方水印，故统一关闭（与 ChartDrawer.tsx 保持一致）。
        attributionLogo: false,
        background: { type: ColorType.Solid, color: CHART_THEME.background },
        textColor: CHART_THEME.text,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_THEME.grid },
        horzLines: { color: CHART_THEME.grid },
      },
      rightPriceScale: { borderColor: CHART_THEME.border, scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: { borderColor: CHART_THEME.border, timeVisible: true, secondsVisible: false, rightOffset: 6, minBarSpacing: 5 },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(160,180,200,0.45)", width: 1, style: 3, labelBackgroundColor: "#243443" },
        horzLine: { color: "rgba(160,180,200,0.45)", width: 1, style: 3, labelBackgroundColor: "#243443" },
      },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
      handleScale: { pinch: true },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const mapped = candles
      .map((c) => ({
        time: Math.floor(c.time / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));

    const mainSeries = isLineMode
      ? chart.addSeries(LineSeries, {
          color: CHART_THEME.up,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
        })
      : chart.addSeries(CandlestickSeries, {
          upColor: CHART_THEME.up,
          downColor: CHART_THEME.down,
          borderUpColor: CHART_THEME.up,
          borderDownColor: CHART_THEME.down,
          wickUpColor: CHART_THEME.up,
          wickDownColor: CHART_THEME.down,
        });
    mainSeries.setData(
      isLineMode ? mapped.map((c) => ({ time: c.time, value: c.close })) : mapped,
    );

    volumeSeries.setData(
      mapped.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(14,203,129,0.55)" : "rgba(246,70,93,0.55)",
      })),
    );

    chart.timeScale().fitContent();

    // Crosshair tooltip: price + OHLC readout pinned inside the chart container.
    const tooltip = document.createElement("div");
    tooltip.style.cssText =
      "position:absolute;z-index:10;display:none;pointer-events:none;font-variant-numeric:tabular-nums;font-size:11px;line-height:1.5;background:rgba(27,41,54,0.96);border:1px solid rgba(120,140,158,0.35);border-radius:8px;padding:6px 8px;color:#E7EEF4;box-shadow:0 8px 20px rgba(0,0,0,0.4);";
    node.style.position = "relative";
    node.appendChild(tooltip);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point === undefined) {
        tooltip.style.display = "none";
        return;
      }
      const data = param.seriesData.get(mainSeries);
      const candle = data && typeof data === "object" ? (data as { open?: number; high?: number; low?: number; close?: number }) : null;
      const px = candle ? candle.close : undefined;
      const timeLabel = new Date((param.time as number) * 1000).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      const digits = px !== undefined && px >= 100 ? 2 : 4;
      tooltip.innerHTML =
        `<div style="color:${CHART_THEME.text}">${timeLabel}</div>` +
        `<div style="font-weight:600">${px !== undefined ? fmt(px, locale, digits) : "—"}</div>` +
        (candle
          ? `<div style="color:${CHART_THEME.text}">${t("High")} ${fmt(candle.high, locale, digits)}</div>` +
            `<div style="color:${CHART_THEME.text}">${t("Low")} ${fmt(candle.low, locale, digits)}</div>`
          : "");
      const left = Math.min(Math.max(param.point.x + 16, 8), node.clientWidth - 130);
      const top = Math.max(param.point.y - 44, 8);
      tooltip.style.display = "block";
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width: Math.floor(width), height: entries[0].contentRect.height || 420 });
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      tooltip.remove();
      chart.remove();
    };
  }, [candles, locale]);

  const price = ticker?.price ?? candles[candles.length - 1]?.close ?? 0;
  const chg = ticker?.chg ?? 0;
  const rising = chg >= 0;
  const high = ticker?.high ?? (candles.length ? Math.max(...candles.map((c) => c.high)) : 0);
  const low = ticker?.low ?? (candles.length ? Math.min(...candles.map((c) => c.low)) : 0);
  const volBtc = ticker?.vol ?? "0";
  const volUsdt = Number(volBtc) * price;

  const recentTrades = useMemo(() => mockRecentTrades(price || 60000, 18), [price]);

  const bids = (book?.bids || []).slice(0, 8);
  const asks = (book?.asks || []).slice(0, 8).slice().reverse();

  const goTrade = (nextSide: "buy" | "sell") => {
    navigate(`/trade/${symbol}`, { state: { side: nextSide } });
  };
  return (
    <SubPageLayout title={`${base}/USDT`} backLabel={t("Back")}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 p-3 pb-28 sm:p-4">
        {/* 24h Ticker Header */}
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <TokenIcon symbol={base} className="h-11 w-11 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-lg font-bold text-brand-text">{base}/USDT</span>
                  <Badge variant="outline" className={cn("border-0 font-mono tabular-nums", rising ? "bg-brand-accent/15 text-brand-accent" : "bg-brand-danger/15 text-brand-danger")}>
                    {rising ? "+" : ""}{chg.toFixed(2)}%
                  </Badge>
                </div>
                <p className="font-mono text-3xl font-bold tabular-nums leading-tight" style={{ color: rising ? "#0ECB81" : "#F6465D" }}>
                  {fmt(price, locale, price >= 100 ? 2 : 4)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
              <div className="rounded-lg bg-brand-surface-2 px-3 py-2">
                <p className="text-[11px] text-brand-text-muted">{t("24h high")}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-brand-text">{fmt(high, locale, high >= 100 ? 2 : 4)}</p>
              </div>
              <div className="rounded-lg bg-brand-surface-2 px-3 py-2">
                <p className="text-[11px] text-brand-text-muted">{t("24h low")}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-brand-text">{fmt(low, locale, low >= 100 ? 2 : 4)}</p>
              </div>
              <div className="rounded-lg bg-brand-surface-2 px-3 py-2">
                <p className="text-[11px] text-brand-text-muted">{t("24h volume (BTC)")}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-brand-text">{compact(volBtc, locale)}</p>
              </div>
              <div className="rounded-lg bg-brand-surface-2 px-3 py-2">
                <p className="text-[11px] text-brand-text-muted">{t("24h turnover (USDT)")}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-brand-text">{compact(volUsdt, locale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="overflow-hidden border-brand-border bg-brand-surface">
          <CardContent className="p-0">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-brand-border/60 px-2 py-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  type="button"
                  aria-pressed={timeframe === tf.key}
                  onClick={() => setTimeframe(tf.key)}
                  className={cn(
                    "min-h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors",
                    timeframe === tf.key ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text",
                  )}
                >
                  {tf.key}
                </button>
              ))}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setExtraOpen((v) => !v)}
                  className={cn("flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold transition-colors", extraOpen ? "text-brand-accent" : "text-brand-text-muted hover:text-brand-text")}
                >
                  {t("More")}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", extraOpen && "rotate-180")} />
                </button>
                {extraOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-lg border border-brand-border bg-brand-surface-2 py-1 shadow-xl">
                    {EXTRA_TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.key}
                        type="button"
                        onClick={() => {
                          setExtraOpen(false);
                          void getKlines(symbol, tf.kline).then(setCandles);
                        }}
                        className="px-4 py-2 text-left text-sm text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text"
                      >
                        {tf.key}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={chartNodeRef} className="relative h-[45dvh] min-h-[260px] w-full sm:h-[480px]" />

            {loading && candles.length === 0 ? (
              <div className="flex h-[45dvh] min-h-[260px] items-center justify-center text-sm text-brand-text-muted sm:h-[480px]" role="status" aria-live="polite">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-brand-accent" />
                <span className="ml-3">{t("Loading candlestick data…")}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>


        {/* Bottom data tabs */}
        <Card className="border-brand-border bg-brand-surface">
          <div className="flex items-center border-b border-brand-border/60 px-2">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "depth"}
              onClick={() => setActiveTab("depth")}
              className={cn("relative flex items-center gap-1.5 px-3 pb-2.5 pt-3 text-sm font-semibold", activeTab === "depth" ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text")}
            >
              <ListOrdered className="h-4 w-4" />
              {t("Order book")}
              {activeTab === "depth" && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-accent" />}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "trades"}
              onClick={() => setActiveTab("trades")}
              className={cn("relative flex items-center gap-1.5 px-3 pb-2.5 pt-3 text-sm font-semibold", activeTab === "trades" ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text")}
            >
              <Clock3 className="h-4 w-4" />
              {t("Latest trades")}
              {activeTab === "trades" && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-accent" />}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "info"}
              onClick={() => setActiveTab("info")}
              className={cn("relative flex items-center gap-1.5 px-3 pb-2.5 pt-3 text-sm font-semibold", activeTab === "info" ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text")}
            >
              <Info className="h-4 w-4" />
              {t("About this asset")}
              {activeTab === "info" && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-accent" />}
            </button>
          </div>

          <CardContent className="p-3">
            {activeTab === "depth" ? (
              <div className="font-mono tabular-nums">
                <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] text-brand-text-muted">
                  <span>{t("Price (USDT)")}</span>
                  <span className="text-right">{t("Quantity")}({base})</span>
                  <span className="text-right">{t("Total")}</span>
                </div>
                <div className="space-y-0.5">
                  {asks.map((row, i) => (
                    <div key={`a${i}`} className="grid grid-cols-3 gap-2 text-xs">
                      <span className="text-brand-danger">{fmt(row[0], locale, Number(row[0]) >= 100 ? 2 : 4)}</span>
                      <span className="text-right text-brand-text-muted">{fmt(row[1], locale, 4)}</span>
                      <span className="text-right text-brand-text-muted">{fmt(Number(row[1]) * (i + 1), locale, 4)}</span>
                    </div>
                  ))}
                </div>
                <div className="my-1.5 flex items-center justify-between border-y border-brand-border/40 py-1">
                  <span className="font-mono text-sm font-bold tabular-nums" style={{ color: rising ? "var(--color-brand-accent)" : "var(--color-brand-danger)" }}>
                    {fmt(price, locale, price >= 100 ? 2 : 4)}
                  </span>
                  <span className="text-[10px] text-brand-text-muted">{rising ? "↑" : "↓"}</span>
                </div>
                <div className="space-y-0.5">
                  {bids.map((row, i) => (
                    <div key={`b${i}`} className="grid grid-cols-3 gap-2 text-xs">
                      <span className="text-brand-accent">{fmt(row[0], locale, Number(row[0]) >= 100 ? 2 : 4)}</span>
                      <span className="text-right text-brand-text-muted">{fmt(row[1], locale, 4)}</span>
                      <span className="text-right text-brand-text-muted">{fmt(Number(row[1]) * (i + 1), locale, 4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === "trades" ? (

              <div className="font-mono tabular-nums">
                <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] text-brand-text-muted">
                  <span>{t("Price (USDT)")}</span>
                  <span className="text-right">{t("Quantity")}({base})</span>
                  <span className="text-right">{t("Time")}</span>
                </div>
                <div className="space-y-0.5">
                  {recentTrades.map((row) => (
                    <div key={row.id} className="grid grid-cols-3 gap-2 text-xs">
                      <span className={row.side === "buy" ? "text-brand-accent" : "text-brand-danger"}>
                        {fmt(row.price, locale, row.price >= 100 ? 2 : 4)}
                      </span>
                      <span className="text-right text-brand-text-muted">{row.qty.toFixed(4)}</span>
                      <span className="text-right text-brand-text-muted">
                        {new Date(row.ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <TokenIcon symbol={base} className="h-10 w-10" />
                  <div>
                    <p className="text-base font-bold text-brand-text">{base}</p>
                    <p className="text-xs text-brand-text-muted">{base} / USDT {t("spot pair")}</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-brand-text-secondary">
                  {t("{base} is a major crypto asset available for spot, perpetual and earn trading on BTCBOX. This page shows live market data, candlestick trends and order book depth for the {base}/USDT pair.").replaceAll("{base}", base)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-brand-surface-2 p-3">
                    <p className="text-[11px] text-brand-text-muted">{t("Current price")}</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-brand-text">{fmt(price, locale, price >= 100 ? 2 : 4)} USDT</p>
                  </div>
                  <div className="rounded-lg bg-brand-surface-2 p-3">
                    <p className="text-[11px] text-brand-text-muted">{t("24h change")}</p>
                    <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", rising ? "text-brand-accent" : "text-brand-danger")}>
                      {rising ? "+" : ""}{chg.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-brand-bg/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => goTrade("buy")}
            className="flex h-12 items-center justify-center rounded-xl bg-brand-accent text-sm font-bold text-black transition-transform hover:bg-brand-hover active:scale-[0.99]"
          >
            {t("Buy")}
          </button>
          <button
            type="button"
            onClick={() => goTrade("sell")}
            className="flex h-12 items-center justify-center rounded-xl bg-brand-danger text-sm font-bold text-white transition-transform hover:bg-brand-danger/90 active:scale-[0.99]"
          >
            {t("Sell")}
          </button>
        </div>
      </div>
    </SubPageLayout>
  );
}

