import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useI18n, localeTags } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { aggregateLevels, precisionOptionsFor } from "./TerminalOrderBook";

type Level = { price: number; size: number; total: number; depthPct: number };
type ViewMode = "both" | "asks" | "bids";

/** Raw price/size pairs as delivered by the depth feed. */
export interface DepthLevels {
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

/**
 * Turns raw levels into cumulative rows with a depth percentage.
 *
 * Levels are aggregated into the selected price bucket first: the provider can
 * return several rows at the same tick (0.15, 0.15, 0.15), which previously
 * printed one price three times and made the ladder look deeper than it is.
 * Asks come back highest-first so they render on top, converging on the mid.
 */
function levelsFromBook(rows: Array<[string, string]>, side: "ask" | "bid", step: number, limit: number): Level[] {
  const aggregated = aggregateLevels(rows, side, step, limit);
  let cumul = 0;
  const levels = aggregated.map(([price, size]) => {
    const sizeNum = Number(size);
    cumul += sizeNum;
    return { price: Number(price), size: sizeNum, total: cumul, depthPct: 0 };
  });
  const maxCumul = cumul || 1;
  for (const level of levels) level.depthPct = Math.min(100, (level.total / maxCumul) * 100);
  return side === "ask" ? levels.reverse() : levels;
}



/** Available price precisions for the order book. */
const FALLBACK_PRECISIONS = [0.01, 0.1, 1] as const;

/** Decimal places implied by a precision step (0.01 -> 2). */
function decimalsFor(precision: number): number {
  const str = String(precision);
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}

/**
 * Order-book depth panel. It renders only backend/provider depth levels.
 * Missing or stale depth is an unavailable state, never a synthetic book.
 */
export function OrderBookDepth({ mid, book, streamState, baseAsset = "BTC", levels = 6, compact = false }: { mid?: number; book: DepthLevels | null; streamState?: "idle" | "connecting" | "live" | "degraded" | "closed"; baseAsset?: string; levels?: number; compact?: boolean }) {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language] || "en-US";
  const [precision, setPrecision] = useState<number>(0.01);
  const [view, setView] = useState<ViewMode>("both");
  /* Bucket sizes follow the traded price: a fixed 0.01 ladder merges a 0.15
     market's ticks, while a fixed 0.0001 ladder is noise on BTC. The finest
     option is the default so no real level is hidden. */
  const precisionOptions = useMemo<number[]>(() => {
    const derived = precisionOptionsFor(Number(mid)).map(Number);
    return derived.length ? derived : [...FALLBACK_PRECISIONS];
  }, [mid]);
  const effectivePrecision = precisionOptions.includes(precision) ? precision : precisionOptions[0];
  const decimals = decimalsFor(effectivePrecision);
  const levelled = useMemo(() => ({
    asks: book ? levelsFromBook(book.asks, "ask", effectivePrecision, levels) : [],
    bids: book ? levelsFromBook(book.bids, "bid", effectivePrecision, levels) : [],
  }), [book, effectivePrecision, levels]);
  const asks = levelled.asks;
  const bids = levelled.bids;
  const fmt = (v: number, digits = decimals) =>
    v.toLocaleString(numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const midText = Number.isFinite(mid) && Number(mid) > 0 ? fmt(Number(mid)) : "—";

  const renderRow = (level: Level, side: "ask" | "bid", keyId: string) => (
    /* Keep the original touch-friendly row rhythm on mobile; desktop opts into compact rows. */
    <div key={keyId} className={cn("relative grid grid-cols-3 text-right font-mono tabular-nums", compact ? "gap-1 py-[2px] text-[10px] leading-[17px] sm:text-[11px]" : "gap-2 py-[3px] text-[11px] leading-[18px] sm:text-xs")}>
      <span
        aria-hidden="true"
        className={
          side === "ask"
            ? "absolute inset-y-0 right-0 bg-brand-danger/[0.12]"
            : "absolute inset-y-0 right-0 bg-brand-success/[0.12]"
        }
        style={{ width: `${level.depthPct}%` }}
      />
      <span className={side === "ask" ? "relative text-brand-danger" : "relative text-brand-success"}>{fmt(level.price)}</span>
      <span className="relative text-brand-text-secondary">{fmt(level.size, 3)}</span>
      <span className="relative text-brand-text-muted">{fmt(level.total, 3)}</span>
    </div>
  );

  return (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">{t("Market depth")}</CardTitle>
        <div className="flex items-center gap-1">
          {/* Precision selector — compact segmented control, touch-friendly. */}
          <div className="flex items-center rounded-md border border-brand-border/60 bg-brand-surface-2/60 p-0.5" role="group" aria-label={t("Order book precision")}>
            {precisionOptions.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={effectivePrecision === p}
                onClick={() => setPrecision(p)}
                className={cn(
                  "min-h-6 rounded px-1.5 text-[10px] font-semibold tabular-nums transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50",
                  effectivePrecision === p ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-text-muted hover:text-brand-text",
                )}
              >
                {String(p)}
              </button>
            ))}
          </div>
          {/* View toggle: combined / asks-only / bids-only. */}
          <div className="flex items-center rounded-md border border-brand-border/60 bg-brand-surface-2/60 p-0.5" role="group" aria-label={t("Order book view")}>
            {([["both", "☰"], ["asks", "△"], ["bids", "▽"]] as const).map(([mode, glyph]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className={cn(
                  "flex min-h-6 w-6 items-center justify-center rounded text-[10px] font-bold leading-none transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50",
                  view === mode ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-text-muted hover:text-brand-text",
                )}
              >
                {glyph}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "space-y-1 px-3 pb-3 pt-1" : "space-y-1.5")}>
        {!book ? (
          <div className="py-10 text-center">
            <p className="text-[11.5px] text-brand-text-muted">
              {streamState === "degraded" ? t("Order book is temporarily unavailable.") : t("Waiting for the order book…")}
            </p>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-3 gap-2 pb-1 text-right text-[10px] uppercase tracking-wide text-brand-text-faint">
          <span>{t("Price")} (USDT)</span>
          <span>{t("Size")} ({baseAsset})</span>
          <span>{t("Total")}</span>
        </div>
        {view !== "bids" ? (
          <div className="space-y-0.5">
            {asks.map((l, i) => renderRow(l, "ask", `a${i}`))}
          </div>
        ) : null}
        {view === "both" ? (
          <div className="flex items-center justify-between border-y border-brand-border-subtle py-2">
            <span className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Mid price")}</span>
            <span className="flex flex-col items-end">
              <span className="font-mono text-lg font-bold tabular-nums text-brand-success">{midText} <span className="text-xs font-medium">USDT</span></span>
            </span>
          </div>
        ) : null}
        {view !== "asks" ? (
          <div className="space-y-0.5">
            {bids.map((l, i) => renderRow(l, "bid", `b${i}`))}
          </div>
        ) : null}
        </>
        )}
      </CardContent>
    </Card>
  );
}
