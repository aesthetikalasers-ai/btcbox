import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { useI18n, localeTags } from "../../lib/i18n";
import { cn } from "../../lib/utils";

type Level = { price: number; size: number; total: number; depthPct: number };
type ViewMode = "both" | "asks" | "bids";

/** Raw price/size pairs as delivered by the depth feed. */
export interface DepthLevels {
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

/**
 * Turns raw levels into cumulative rows with a depth percentage.
 * `asks` are returned highest-first so they render on top, converging on the mid.
 */
function levelsFromBook(rows: Array<[string, string]>, side: "ask" | "bid", limit: number): Level[] {
  const parsed = rows
    .map(([price, size]) => ({ price: Number(price), size: Number(size) }))
    .filter((row) => Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.size) && row.size > 0)
    .slice(0, limit);
  let cumul = 0;
  const levels = parsed.map((row) => {
    cumul += row.size;
    return { price: row.price, size: row.size, total: cumul, depthPct: 0 };
  });
  const maxCumul = cumul || 1;
  for (const level of levels) level.depthPct = Math.min(100, (level.total / maxCumul) * 100);
  return side === "ask" ? levels.reverse() : levels;
}

/** Deterministic PRNG so the fallback book is stable across renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLevels(mid: number, tickUp: boolean, side: "ask" | "bid"): Level[] {
  const rand = mulberry32(side === "ask" ? 99173 : 44129);
  const tick = Math.max(0.5, mid * 0.0001);
  const levels: Level[] = [];
  let cumul = 0;
  for (let i = 0; i < 9; i++) {
    const price = side === "ask" ? mid + tick * (i + 1) * (1 + rand() * 0.4) : mid - tick * (i + 1) * (1 + rand() * 0.4);
    const size = 0.05 + rand() * 1.8;
    cumul += size;
    levels.push({ price, size, total: cumul, depthPct: 0 });
  }
  const maxCumul = cumul;
  for (const l of levels) l.depthPct = Math.min(100, (l.total / maxCumul) * 100);
  // Asks render highest->lowest (toward the mid); bids render lowest->highest (toward mid).
  return side === "ask" ? levels.reverse() : levels;
}


/** Available price precisions for the order book. */
const PRECISIONS = [0.1, 0.01, 0.001, 0.0001] as const;

/** Decimal places implied by a precision step (0.01 -> 2). */
function decimalsFor(precision: number): number {
  const str = String(precision);
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}

/**
 * Order-book depth panel.
 *
 * Two modes:
 *   - `book` supplied  -> renders the live feed (streamed or polled). This is
 *     the production path.
 *   - `book` omitted   -> renders a deterministic demo book, explicitly badged
 *     "Demo data". Never presented as live.
 */
export function OrderBookDepth({ mid = 67000, book, streamState }: { mid?: number; book?: DepthLevels | null; streamState?: "idle" | "connecting" | "live" | "degraded" | "closed" }) {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language] || "en-US";
  const [precision, setPrecision] = useState<number>(0.01);
  const [view, setView] = useState<ViewMode>("both");
  const decimals = decimalsFor(precision);
  // Live feed takes precedence; the demo book is only used when no book is
  // passed at all (and is badged accordingly below).
  const isLive = book !== undefined;
  const levelled = useMemo(() => {
    if (isLive) {
      return {
        asks: book ? levelsFromBook(book.asks, "ask", 9) : [],
        bids: book ? levelsFromBook(book.bids, "bid", 9) : [],
      };
    }
    return { asks: buildLevels(mid, true, "ask"), bids: buildLevels(mid, true, "bid") };
  }, [isLive, book, mid]);
  const asks = levelled.asks;
  const bids = levelled.bids;
  const fmt = (v: number, digits = decimals) =>
    v.toLocaleString(numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const renderRow = (level: Level, side: "ask" | "bid", keyId: string) => (
    <div key={keyId} className="relative grid grid-cols-3 gap-2 py-[3px] text-right font-mono text-[11px] leading-5 tabular-nums sm:text-xs">
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
        <CardTitle className="text-sm">{t("Order book")}</CardTitle>
        <div className="flex items-center gap-1">
          {isLive ? (
            <Badge variant="outline" className="border-brand-border-subtle bg-brand-surface-2 text-brand-text-muted">
              <span
                aria-hidden="true"
                className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
                  streamState === "live" ? "bg-brand-accent" : streamState === "degraded" ? "bg-brand-danger" : "bg-brand-text-disabled"
                }`}
              />
              {streamState === "live" ? t("Live") : streamState === "degraded" ? t("Degraded") : t("Idle")}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-brand-border-subtle bg-brand-surface-2 text-brand-text-muted">{t("Demo data")}</Badge>
          )}
          {/* Precision selector — compact segmented control, touch-friendly. */}
          <div className="flex items-center rounded-md border border-brand-border/60 bg-brand-surface-2/60 p-0.5" role="group" aria-label={t("Order book precision")}>
            {PRECISIONS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={precision === p}
                onClick={() => setPrecision(p)}
                className={cn(
                  "min-h-6 rounded px-1.5 text-[10px] font-semibold tabular-nums transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50",
                  precision === p ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-text-muted hover:text-brand-text",
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
      <CardContent className="space-y-1.5">
        {isLive && !book ? (
          <div className="py-10 text-center">
            <p className="text-[11.5px] text-brand-text-muted">
              {streamState === "degraded" ? t("Order book is temporarily unavailable.") : t("Waiting for the order book…")}
            </p>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-3 gap-2 pb-1 text-right text-[10px] uppercase tracking-wide text-brand-text-faint">
          <span>{t("Price")} (USDT)</span>
          <span>{t("Size")} (BTC)</span>
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
            <span className="font-mono text-lg font-bold tabular-nums text-brand-success">{fmt(mid)} <span className="text-xs font-medium">USDT</span></span>
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
