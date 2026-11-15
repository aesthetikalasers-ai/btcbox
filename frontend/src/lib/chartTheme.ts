/**
 * Single source of truth for chart colours.
 *
 * `lightweight-charts` renders to canvas, so it cannot read CSS custom
 * properties. Every chart therefore needs the literal hex values, and those
 * MUST stay in sync with the tokens declared in `src/index.css`:
 *
 *   --color-positive      -> up
 *   --color-negative      -> down
 *   --color-brand-text-muted -> text
 *   --color-brand-border  -> grid / border
 *
 * Before this module existed, charts hard-coded the older `#35D6A6` / `#F06B78`
 * pair next to UI text using `#0ECB81` / `#F6465D`, so a single screen showed
 * two visibly different greens. Import from here instead of typing hex values.
 */
export const CHART_THEME = {
  /** Bullish candles / positive deltas. Matches --color-positive. */
  up: "#0ECB81",
  /** Bearish candles / negative deltas. Matches --color-negative. */
  down: "#F6465D",
  /** Axis labels and secondary chart text. Matches --color-brand-text-muted. */
  text: "#848E9C",
  /** Chart grid lines. Matches --color-brand-border. */
  grid: "#2B3139",
  /** Price/time scale borders. */
  border: "#2B3139",
  /** Chart canvas background — transparent so the panel colour shows through. */
  background: "transparent",
  /** Font stack for axis labels. */
  fontFamily: "JetBrains Mono, Inter, ui-monospace, monospace",
} as const;

/** Candle colour pair for candlestick / bar series. */
export const CANDLE_COLORS = {
  upColor: CHART_THEME.up,
  downColor: CHART_THEME.down,
  borderUpColor: CHART_THEME.up,
  borderDownColor: CHART_THEME.down,
  wickUpColor: CHART_THEME.up,
  wickDownColor: CHART_THEME.down,
  borderVisible: false,
} as const;
