import { useMemo } from "react";
import { Columns2, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import type { OrderBookSnapshot } from "../../lib/api";

export type DepthPrecision = "0.0001" | "0.001" | "0.01" | "0.1" | "1";
/** `both` = asks above the mid price and bids below it; `bids`/`asks` = single side. */
export type BookView = "both" | "bids" | "asks";

const ALL_PRECISION_OPTIONS: DepthPrecision[] = ["0.0001", "0.001", "0.01", "0.1", "1"];
const DECIMALS: Record<DepthPrecision, number> = { "0.0001": 4, "0.001": 3, "0.01": 2, "0.1": 1, "1": 0 };
/** Decimal places each depth step implies; exported so callers format identically. */
export const DECIMALS_BY_PRECISION = DECIMALS;

/**
 * Depth steps appropriate for an instrument, finest first.
 *
 * Listing low-priced pairs (ARB at 0.1277, SUI at 0.7271) next to BTC broke the
 * old fixed 0.01/0.1/1 ladder: bucketing ARB at 0.01 merges distinct levels into
 * one row and prints the best bid as 0.13. The steps are therefore derived from
 * the last price — a base step sized to the price magnitude, then two steps one
 * and two decades finer — so every market always has a bucket that still
 * resolves its own quote precision.
 *
 *   63,604.94 -> ["0.01", "0.1", "1"]
 *    1,805.97 -> ["0.001", "0.01", "0.1"]
 *        0.1277 -> ["0.0001", "0.001", "0.01"]
 */
export function precisionOptionsFor(price: number | null | undefined): DepthPrecision[] {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return ["0.01", "0.1", "1"];
  // Target ~4 significant digits of resolution, then clamp to the supported
  // ladder so a micro-cap never produces a step the UI cannot label.
  const rawBase = Math.pow(10, Math.floor(Math.log10(p / 10000)));
  const ladder: DepthPrecision[] = ["0.0001", "0.001", "0.01", "0.1", "1"];

  // Only drop to sub-0.01 steps for instruments priced under ~10, where a 0.01
  // bucket would genuinely merge levels (ARB 0.1277, XRP 0.9791). Mid-caps like
  // BCH (207.5) stay on a 3-step ladder starting at 0.001 rather than exposing a
  // needlessly fine 0.0001 that no level would ever use.
  const floor: DepthPrecision = p >= 10 ? "0.001" : "0.0001";
  const base = Math.min(1, Math.max(Number(floor), rawBase));
  const floorIndex = ladder.indexOf(floor);
  const baseIndex = ladder.findIndex((step) => Number(step) >= base);
  // Never start finer than the floor: a mid-cap should not offer 0.0001 steps.
  const start = Math.max(floorIndex, Math.max(0, (baseIndex === -1 ? ladder.length : baseIndex) - 2));
  return ladder.slice(start, Math.min(ladder.length, start + 3));
}

/**
 * Groups raw book levels into price buckets (`step`) and keeps the best
 * `limit` buckets for one side. Asks stay ascending (best ask first) and bids
 * descending (best bid first), so the caller never re-sorts.
 *
 * Depth is display-only: sizes are summed per bucket and never feed order
 * sizing or financial validation.
 */
export function aggregateLevels(
  rows: Array<[string | number, string | number]>,
  side: "ask" | "bid",
  step: number,
  limit = 100,
): Array<[string, string]> {
  const decimals = Math.max(0, Math.min(8, (String(step).split(".")[1] || "").length));
  const buckets = new Map<number, number>();
  for (const row of rows) {
    const price = Number(row[0]);
    const qty = Number(row[1]);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) continue;
    const units = price / step;
    const bucket = Number(((side === "ask" ? Math.ceil(units - 1e-8) : Math.floor(units + 1e-8)) * step).toFixed(decimals));
    buckets.set(bucket, (buckets.get(bucket) || 0) + qty);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (side === "ask" ? a[0] - b[0] : b[0] - a[0]))
    .slice(0, limit)
    .map(([price, qty]) => [price.toFixed(decimals), String(qty)] as [string, string]);
}

/**
 * Cumulative size for each row, measured from the mid price outwards, so the
 * last row of each side carries the whole visible side size.
 */
export function cumulativeSizes(rows: Array<[string, string]>): number[] {
  let acc = 0;
  return rows.map((row) => (acc += Number(row[1]) || 0));
}

/** Relative depth bar widths (0–100) for the row backgrounds. */
export function depthBarWidths(cumulative: number[]): number[] {
  const max = cumulative.length ? cumulative[cumulative.length - 1] : 0;
  return cumulative.map((value) => (max > 0 ? Math.min(100, (value / max) * 100) : 0));
}

function formatLevel(value: number | string, decimals: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Compact size formatter, matching tier-1 exchange conventions.
 *
 * - `>= 1e6`  → `1.23M`
 * - `>= 1e3`  → `4.64K`
 * - otherwise → fixed decimals in `[minDigits, 5]`
 *
 * Large values use K/M suffixes so a 375px column never overflows or wraps;
 * small values keep a stable decimal width so the right-aligned column stays
 * flush (see `sizeDecimalsFor` for the per-market precision).
 */
function formatSize(value: number | string, minDigits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(minDigits, 5),
    maximumFractionDigits: 5,
  });
}

/**
 * Fixed decimal width for the size column, derived from the price step so each
 * market shows a consistent number of decimals (spot 5, 0.1-step markets 4).
 */
function sizeDecimalsFor(decimals: number) {
  return decimals >= 2 ? 5 : decimals === 1 ? 4 : 2;
}

/** One clickable price level. Clicking fills the order form price. */
function LevelRows({
  rows,
  cumulative,
  widths,
  side,
  decimals,
  sizeDecimals,
  onPick,
}: {
  rows: Array<[string, string]>;
  cumulative: number[];
  widths: number[];
  side: "ask" | "bid";
  decimals: number;
  sizeDecimals: number;
  onPick: (price: string) => void;
}) {
  const color = side === "ask" ? "text-loss" : "text-profit";
  return (
    <>
      {rows.map((row, index) => (
        <button
          key={side + row[0]}
          type="button"
          onClick={() => onPick(row[0])}
          data-side={side}
          title={row[0] + " · " + row[1]}
          className="spot-book-row spot-book-row--click font-mono tabular-nums"
        >
          {/* Depth bar: grows left-to-right with the cumulative size so the
              book reads as a histogram, not a flat tinted row. */}
          <span
            className="spot-book-depth"
            data-side={side}
            style={{ width: Math.max(2, widths[index]) + "%" }}
            aria-hidden="true"
          />
          <span className={"text-right " + color}>{formatLevel(row[0], decimals)}</span>
          <span className="text-right text-brand-text-secondary">{formatSize(row[1], sizeDecimals)}</span>
          <span className="spot-book-cum text-right text-brand-text-muted">{formatSize(cumulative[index], sizeDecimals)}</span>
        </button>
      ))}
    </>
  );
}

/**
 * Desktop order book (middle column of the terminal).
 *
 * Renders asks top-down, the last-trade price in the middle, and bids below,
 * matching tier-1 exchange conventions. Every number uses fixed tabular digits
 * so live updates never shift the columns.
 */
export function TerminalOrderBook({
  book,
  lastPrice,
  changePercent,
  precision,
  onPrecisionChange,
  view,
  onViewChange,
  onPickPrice,
  usdtUsd,
  rows = 10,
  className = "",
}: {
  book: OrderBookSnapshot | null;
  lastPrice: string;
  changePercent: number;
  precision: DepthPrecision;
  onPrecisionChange: (value: DepthPrecision) => void;
  view: BookView;
  onViewChange: (value: BookView) => void;
  onPickPrice: (price: string) => void;
  /** Verified USDT→USD rate for the "≈ $" hint; null means unavailable. */
  usdtUsd?: number | null;
  rows?: number;
  className?: string;
}) {
  const { t } = useI18n();
  const step = Number(precision);
  const decimals = DECIMALS[precision];

  const asks = useMemo(() => aggregateLevels(book?.asks || [], "ask", step, rows), [book, step, rows]);
  const bids = useMemo(() => aggregateLevels(book?.bids || [], "bid", step, rows), [book, step, rows]);
  const askCumulative = useMemo(() => cumulativeSizes(asks), [asks]);
  const bidCumulative = useMemo(() => cumulativeSizes(bids), [bids]);
  const askWidths = useMemo(() => depthBarWidths(askCumulative), [askCumulative]);
  const bidWidths = useMemo(() => depthBarWidths(bidCumulative), [bidCumulative]);
  // Rendered top-to-bottom, so the best ask sits directly above the price.
  const askRows = useMemo(() => [...asks].reverse(), [asks]);
  const askRowsCumulative = useMemo(() => [...askCumulative].reverse(), [askCumulative]);
  const askRowsWidths = useMemo(() => [...askWidths].reverse(), [askWidths]);

  const spread = asks.length && bids.length ? Number(asks[0][0]) - Number(bids[0][0]) : null;
  const up = lastPrice !== "" && changePercent >= 0;
  const sizeDecimals = sizeDecimalsFor(decimals);
  /* Dollar-equivalent of the mid price; only show it when a verified rate exists. */
  const usdEquivalent = useMemo(() => {
    const price = Number(lastPrice);
    if (!Number.isFinite(price) || price <= 0) return "";
    const rate = Number(usdtUsd);
    if (!Number.isFinite(rate) || rate <= 0) return "";
    const usd = price * rate;
    return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }, [lastPrice, usdtUsd, decimals]);

  /* Buy/sell pressure bar, tier-1 convention: share of visible size sitting on
     each side, measured in quote terms so a 1-unit ask and a 1-unit bid at
     different prices weigh correctly. No ratio is shown when either side is empty. */
  const pressure = useMemo(() => {
    const askNotional = asks.reduce((sum, row) => sum + Number(row[0]) * Number(row[1]), 0);
    const bidNotional = bids.reduce((sum, row) => sum + Number(row[0]) * Number(row[1]), 0);
    const total = askNotional + bidNotional;
    if (!asks.length || !bids.length || !Number.isFinite(total) || total <= 0) return null;
    const buy = (bidNotional / total) * 100;
    return { buy: Math.min(100, Math.max(0, buy)), sell: Math.min(100, Math.max(0, 100 - buy)) };
  }, [asks, bids]);

  /* Steps are derived from the traded price, not fixed at 0.01/0.1/1: bucketing
     ARB (0.1277) at 0.01 would merge distinct levels and print a 0.13 best bid.
     `precisionOptionsFor` returns three steps centred on the price magnitude. */
  const precisionOptions = useMemo(
    () => precisionOptionsFor(lastPrice ? Number(lastPrice) : null),
    [lastPrice],
  );

  const viewButtons = [
    { key: "both" as const, label: t("Both sides"), Icon: Columns2 },
    { key: "bids" as const, label: t("Bids only"), Icon: TrendingUp },
    { key: "asks" as const, label: t("Asks only"), Icon: TrendingDown },
  ];

  return (
    <div className={"flex min-h-0 flex-col " + className}>
      <div className="term-book-head">
        <span>{t("Price (USDT)")}</span>
        <span className="text-right">{t("Amount")}</span>
        <span className="spot-book-cum text-right">{t("Total")}</span>
      </div>

      <div className="term-book-toolbar">
        <div className="term-seg" role="group" aria-label={t("Depth precision")}>
          {precisionOptions.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={precision === option}
              onClick={() => onPrecisionChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="term-icon-group" role="group" aria-label={t("Order book")}>
          {viewButtons.map(({ key, label, Icon }) => (
            <button key={key} type="button" aria-label={label} aria-pressed={view === key} onClick={() => onViewChange(key)}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {!book ? (
        <div className="space-y-1 py-2" role="status" aria-label={t("Loading order book")}>
          {Array.from({ length: rows * 2 }).map((_, i) => (
            <div key={i} className="h-[22px] animate-pulse rounded bg-brand-surface-2" />
          ))}
        </div>
      ) : (
        <div className="term-book-body">
          <div className={view === "bids" ? "hidden" : "flex flex-col"} data-book-side="asks">
            {askRows.length ? (
              <LevelRows rows={askRows} cumulative={askRowsCumulative} widths={askRowsWidths} side="ask" decimals={decimals} sizeDecimals={sizeDecimals} onPick={onPickPrice} />
            ) : (
              <p className="py-2 text-center text-[11px] text-brand-text-muted">—</p>
            )}
          </div>

          <div className="term-book-mid">
            <button
              type="button"
              className={"term-book-mid-price " + (up ? "text-profit" : "text-loss")}
              title={t("Last price")}
              onClick={() => onPickPrice(lastPrice)}
            >
              {lastPrice || "—"}
            </button>
            <span className="term-book-mid-spread">
              {spread !== null && spread >= 0 ? t("Spread") + " " + formatLevel(spread, decimals) : "—"}
            </span>
          </div>
          {/* Approximate dollar value of the mid price. The book is quoted in
              USDT, so this is `lastPrice x usdtUsd` — a real conversion, not the
              USDT figure relabelled with a "$". If the rate is unavailable, no
              dollar-equivalent is shown. */}
          <div className="term-book-mid-alt">
            {usdEquivalent ? (
              <>
                <span className="term-book-mid-alt-label">≈</span>
                <span className="font-mono tabular-nums">{usdEquivalent}</span>
              </>
            ) : <span className="font-mono tabular-nums">—</span>}
            <TrendingUp className={"ml-auto h-3 w-3 " + (up ? "text-profit" : "text-loss rotate-180")} aria-hidden="true" />
          </div>

          <div className={view === "asks" ? "hidden" : "flex flex-col"} data-book-side="bids">
            {bids.length ? (
              <LevelRows rows={bids} cumulative={bidCumulative} widths={bidWidths} side="bid" decimals={decimals} sizeDecimals={sizeDecimals} onPick={onPickPrice} />
            ) : (
              <p className="py-2 text-center text-[11px] text-brand-text-muted">—</p>
            )}
          </div>
        </div>
      )}

      {/* Buy/sell pressure bar — the tier-1 order-book footer. Replaces the old
          one-line hint so the book closes with a summary instead of prose. */}
      {pressure ? (
        <div
          className="term-book-ratio"
          role="img"
          aria-label={`${t("Buyers")} ${pressure.buy.toFixed(2)}% / ${t("Sellers")} ${pressure.sell.toFixed(2)}%`}
          title={view === "both" ? t("Click a price to fill the order form") : view === "bids" ? t("Bids only") : t("Asks only")}
        >
          <span className="term-book-ratio-buy" style={{ width: pressure.buy + "%" }} />
          <span className="term-book-ratio-sell" style={{ width: pressure.sell + "%" }} />
          <span className="term-book-ratio-labels">
            <b className="text-profit tabular-nums">{pressure.buy.toFixed(2)}%</b>
            <b className="text-loss tabular-nums">{pressure.sell.toFixed(2)}%</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}
