const priceCache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let cached = priceCache.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(locale, options);
    priceCache.set(key, cached);
  }
  return cached;
}

/** Canonical quote formatting: >=1 keeps 2–4 decimals, sub-1 keeps 2–6 so small prices stay readable. */
export function formatPrice(value: number | string | null | undefined, locale: string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "—";
  const options = parsed >= 1
    ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 6 };
  return formatter(locale, options).format(parsed);
}

/** Canonical quantity formatting: up to 8 decimals, trailing zeros trimmed. */
export function formatQuantity(value: number | string | null | undefined, locale: string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return formatter(locale, { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(parsed);
}

/** Canonical percent formatting: always two decimals with an explicit sign option. */
export function formatPercent(value: number | string | null | undefined, locale: string, signed = false): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "—";
  const body = formatter(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(parsed));
  if (!signed) return `${parsed < 0 ? "-" : ""}${body}%`;
  return `${parsed > 0 ? "+" : parsed < 0 ? "-" : ""}${body}%`;
}

/** Canonical compact formatting for volumes and totals. */
export function formatCompact(value: number | string | null | undefined, locale: string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "—";
  return formatter(locale, { notation: "compact", maximumFractionDigits: 2 }).format(parsed);
}

/**
 * 24h volume / turnover for ticker headers.
 *
 * A provider snapshot can carry six decimals (`1,301,845,540.465216`), which is
 * unreadable in a header and implies a precision nobody trades on. Anything at
 * or above 1,000 collapses to a compact suffix; smaller volumes keep at most two
 * decimals.
 */
export function formatVolume(value: number | string | null | undefined, locale: string): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "—";
  if (parsed >= 1000) return formatter(locale, { notation: "compact", maximumFractionDigits: 2 }).format(parsed);
  return formatter(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(parsed);
}

/**
 * Order-book size and cumulative total.
 *
 * Large values use K/M suffixes so a narrow depth column never wraps, while
 * small values keep a stable decimal width so the right-aligned column stays
 * flush. Mirrors the desktop book so both presentations agree.
 */
export function formatBookSize(value: number | string | null | undefined, minDigits = 0): string {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "—";
  if (parsed >= 1_000_000) return (parsed / 1_000_000).toFixed(2) + "M";
  if (parsed >= 1_000) return (parsed / 1_000).toFixed(2) + "K";
  return formatter("en-US", {
    minimumFractionDigits: Math.min(minDigits, 5),
    maximumFractionDigits: 5,
  }).format(parsed);
}
