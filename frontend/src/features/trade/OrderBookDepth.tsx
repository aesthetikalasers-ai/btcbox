import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { useI18n, localeTags } from "../../lib/i18n";

type Level = { price: number; size: number; total: number; depthPct: number };

/** Deterministic PRNG so the demo book is stable across renders. */
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

/**
 * Simulated order-book depth. Labeled clearly as demo data — never real market data.
 * Columns right-aligned tabular-nums; depth bars use existing success/danger tokens.
 */
export function OrderBookDepth({ mid = 67000 }: { mid?: number }) {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language] || "en-US";
  const asks = useMemo(() => buildLevels(mid, true, "ask"), [mid]);
  const bids = useMemo(() => buildLevels(mid, true, "bid"), [mid]);
  const fmt = (v: number, digits = 2) => v.toLocaleString(numberLocale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const renderRow = (level: Level, side: "ask" | "bid", keyId: string) => (
    <div key={keyId} className="relative grid grid-cols-3 gap-2 py-[3px] text-right font-mono text-[11px] leading-5 tabular-nums sm:text-xs">
      <span
        aria-hidden="true"
        className={
          side === "ask"
            ? "absolute inset-y-0 right-0 bg-brand-danger/10"
            : "absolute inset-y-0 right-0 bg-brand-success/10"
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
        <Badge variant="outline" className="border-brand-warning/30 bg-brand-warning/10 text-brand-warning">{t("Demo data")}</Badge>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="grid grid-cols-3 gap-2 pb-1 text-right text-[10px] uppercase tracking-wide text-brand-text-faint">
          <span>{t("Price")} (USDT)</span>
          <span>{t("Size")} (BTC)</span>
          <span>{t("Total")}</span>
        </div>
        <div className="space-y-0.5">
          {asks.map((l, i) => renderRow(l, "ask", `a${i}`))}
        </div>
        <div className="flex items-center justify-between border-y border-brand-border-subtle py-2">
          <span className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Mid price")}</span>
          <span className="font-mono text-lg font-bold tabular-nums text-brand-success">{fmt(mid)} <span className="text-xs font-medium">USDT</span></span>
        </div>
        <div className="space-y-0.5">
          {bids.map((l, i) => renderRow(l, "bid", `b${i}`))}
        </div>
      </CardContent>
    </Card>
  );
}
