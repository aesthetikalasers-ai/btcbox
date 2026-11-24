import { cn } from "../../lib/utils";

/**
 * PriceBadge — the single price-change pill used across the product.
 *
 * Design spec §26:
 * - 22px high, 8px horizontal padding, 11px text, 4px radius, 10px arrow.
 * - Gains are green, losses are red, a flat change is neutral.
 * - Supports both percentage and absolute value changes.
 * - The badge reserves its own minimum width so a live-updating price can never
 *   push the surrounding layout (the "no jumping label" requirement).
 *
 * The component is presentation-only: callers pass the already-computed change.
 * It never rounds, derives or replaces the underlying value.
 */
export type PriceBadgeTone = "up" | "down" | "flat";

export interface PriceBadgeProps {
  /** Numeric change. `null`/`undefined` renders a neutral placeholder. */
  value?: number | string | null;
  /** `percent` appends %, `value` shows the raw figure. */
  unit?: "percent" | "value";
  /** Digits used for display only. Defaults to 2 for percent, 8 for value. */
  decimals?: number;
  /** Optional fixed width class for dense tables. */
  className?: string;
  /** Accessible label; defaults to the rendered text. */
  ariaLabel?: string;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toneFor(value: number): PriceBadgeTone {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export function PriceBadge({ value, unit = "percent", decimals, className, ariaLabel }: PriceBadgeProps) {
  const parsed = toNumber(value);
  const tone = parsed === null ? "flat" : toneFor(parsed);
  const digits = decimals ?? (unit === "percent" ? 2 : 8);
  const magnitude = parsed === null ? null : Math.abs(parsed);
  const sign = tone === "up" ? "+" : tone === "down" ? "-" : "";
  const arrow = tone === "up" ? "↑" : tone === "down" ? "↓" : "";
  const text =
    magnitude === null
      ? "—"
      : `${sign}${magnitude.toFixed(digits)}${unit === "percent" ? "%" : ""}`;

  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center justify-center gap-0.5 rounded-[4px] px-2 text-[11px] font-semibold leading-none",
        "tabular-nums [font-feature-settings:'tnum'_1]",
        "transition-colors duration-150 motion-reduce:transition-none",
        tone === "up" && "bg-brand-success/12 text-brand-success",
        tone === "down" && "bg-brand-danger/12 text-brand-danger",
        tone === "flat" && "bg-brand-surface-2 text-brand-text-muted",
        className,
      )}
      data-tone={tone}
      aria-label={ariaLabel ?? text}
      title={ariaLabel ?? text}
    >
      {arrow ? <span aria-hidden="true" className="text-[10px] leading-none">{arrow}</span> : null}
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

export default PriceBadge;
