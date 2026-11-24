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
