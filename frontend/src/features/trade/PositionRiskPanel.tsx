import { useMemo } from "react";
import type { PerpPosition } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";

/** Parses a numeric field that may arrive as number or decimal string. */
const num = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Minimal shape the panel needs. Keeping it structural (rather than requiring
 * the full `PerpPosition`) lets the same panel render both server positions and
 * the local paper-trading book without duplicating the risk maths.
 */
export interface RiskInput {
  id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number | string;
  entryPrice: number | string;
  markPrice?: number | string | null;
  liquidationPrice?: number | string | null;
  margin: number | string;
  leverage?: number;
}

/** Adapts a server perpetual position into the panel's input shape. */
export const fromPerpPosition = (position: PerpPosition): RiskInput => ({
  id: position.position_id,
  symbol: position.symbol,
  side: position.side,
  quantity: position.quantity,
  entryPrice: position.entry_price,
  markPrice: position.mark_price ?? null,
  liquidationPrice: position.liquidation_price ?? null,
  margin: position.isolated_margin,
  leverage: position.leverage,
});

interface RiskRow {
  input: RiskInput;
  markPrice: number | null;
  liquidationPrice: number | null;
  distanceToLiquidationPct: number | null;
  marginRatioPct: number | null;
  pnlPct: number | null;
  riskScore: number | null;
  tone: "safe" | "warn" | "danger" | "unknown";
}

/**
 * Computes risk metrics strictly from supplied fields.
 *
 * If `markPrice` or `liquidationPrice` is absent the corresponding metric
 * renders as "—" rather than a guess. A fabricated liquidation distance would be
 * the most dangerous thing this panel could display.
 */
function buildRow(input: RiskInput): RiskRow {
  const quantity = num(input.quantity);
  const entry = num(input.entryPrice);
  const mark = num(input.markPrice);
  const liq = num(input.liquidationPrice);
  const margin = num(input.margin);

  const notional = quantity !== null && mark !== null ? Math.abs(quantity) * mark : null;

  const distanceToLiquidationPct =
    mark !== null && liq !== null && mark > 0 ? (Math.abs(mark - liq) / mark) * 100 : null;

  const marginRatioPct = margin !== null && notional !== null && notional > 0 ? (margin / notional) * 100 : null;

  const pnlPct =
    entry !== null && mark !== null && entry > 0
      ? ((input.side === "long" ? mark - entry : entry - mark) / entry) * 100
      : null;

  // Gauge: 0% distance to liquidation => risk 100; >= 20% distance => risk 0.
  const riskScore =
    distanceToLiquidationPct === null
      ? null
      : Math.max(0, Math.min(100, 100 - (distanceToLiquidationPct / 20) * 100));

  const tone: RiskRow["tone"] =
    riskScore === null ? "unknown" : riskScore >= 75 ? "danger" : riskScore >= 40 ? "warn" : "safe";

  return { input, markPrice: mark, liquidationPrice: liq, distanceToLiquidationPct, marginRatioPct, pnlPct, riskScore, tone };
}

const TONE_BAR: Record<RiskRow["tone"], string> = {
  safe: "bg-brand-accent",
  warn: "bg-[#F0B90B]",
  danger: "bg-brand-danger",
  unknown: "bg-brand-text-disabled",
};

const TONE_TEXT: Record<RiskRow["tone"], string> = {
  safe: "text-brand-accent",
  warn: "text-[#F0B90B]",
  danger: "text-brand-danger",
  unknown: "text-brand-text-muted",
};


/**
 * Position risk dashboard.
 *
 * Shows, per open perpetual position: distance to liquidation, margin ratio and
 * mark-to-market PnL — the three numbers a trader needs to decide whether to add
 * margin or reduce size. All values derive from server fields.
 */
export function PositionRiskPanel({ positions, emptyHint }: { positions: RiskInput[]; emptyHint?: string }) {
  const { t, language } = useI18n();
  const locale = localeTags[language] || "en-US";
  const rows = useMemo(() => positions.map(buildRow), [positions]);

  const fmt = (value: number | null, digits = 2) =>
    value === null ? "—" : value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-brand-border bg-brand-surface px-3 py-8 text-center">
        <p className="text-[12px] text-brand-text-muted">{t(emptyHint || "No open positions.")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-brand-border bg-brand-surface">
      {rows.map((row) => {
        const isLong = row.input.side === "long";
        return (
          <div key={row.input.id} className="border-b border-brand-border/60 p-3 last:border-b-0 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-brand-text">{row.input.symbol}</span>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  isLong ? "border-brand-accent/40 text-brand-accent" : "border-brand-danger/40 text-brand-danger"
                }`}>
                  {isLong ? t("Long") : t("Short")}
                </span>
                {row.input.leverage ? (
                  <span className="shrink-0 text-[10.5px] font-medium text-brand-text-muted">{row.input.leverage}×</span>
                ) : null}
              </div>
              <span className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${
                row.pnlPct === null ? "text-brand-text-muted" : row.pnlPct >= 0 ? "text-brand-accent" : "text-brand-danger"
              }`}>
                {row.pnlPct === null ? "—" : `${row.pnlPct > 0 ? "+" : ""}${fmt(row.pnlPct)}%`}
              </span>
            </div>

            <div className="mt-2.5">
              <div className="h-1 w-full overflow-hidden rounded-full bg-brand-surface-2" role="presentation">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${TONE_BAR[row.tone]}`}
                  style={{ width: `${row.riskScore ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <p className="text-[10px] text-brand-text-muted">{t("Liq. price")}</p>
                <p className={`mt-0.5 truncate font-mono text-[11.5px] tabular-nums ${TONE_TEXT[row.tone]}`}>
                  {fmt(row.liquidationPrice)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-brand-text-muted">{t("To liquidation")}</p>
                <p className={`mt-0.5 truncate font-mono text-[11.5px] tabular-nums ${TONE_TEXT[row.tone]}`}>
                  {row.distanceToLiquidationPct === null ? "—" : `${fmt(row.distanceToLiquidationPct)}%`}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-brand-text-muted">{t("Margin ratio")}</p>
                <p className="mt-0.5 truncate font-mono text-[11.5px] tabular-nums text-brand-text">
                  {row.marginRatioPct === null ? "—" : `${fmt(row.marginRatioPct)}%`}
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-brand-border/40 pt-2">
              <span className="text-[10px] text-brand-text-muted">
                {t("Entry")} <span className="font-mono tabular-nums text-brand-text-secondary">{fmt(num(row.input.entryPrice))}</span>
                {" · "}
                {t("Mark")} <span className="font-mono tabular-nums text-brand-text-secondary">{fmt(row.markPrice)}</span>
              </span>
              <span className="shrink-0 text-[10px] text-brand-text-muted">
                {t("Margin")} <span className="font-mono tabular-nums text-brand-text-secondary">{fmt(num(row.input.margin))}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

