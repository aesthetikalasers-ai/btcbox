export interface MarketCandle {
  /** Normalized Unix timestamp in seconds for chart libraries. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source?: string;
}

/**
 * Validate provider candles, normalize milliseconds to chart seconds, and keep
 * the last valid candle for each chart second. This module has no browser
 * dependencies so its data contract can be tested independently of Vite.
 */
export function normalizeKlines(values: unknown[], fallbackSource?: string): MarketCandle[] {
  const byChartSecond = new Map<number, MarketCandle>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const candle = value as Record<string, unknown>;
    const rawTime = Number(candle.time);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    const volume = Number(candle.volume);
    if (!Number.isFinite(rawTime) || rawTime <= 0 ||
        !Number.isFinite(open) || open <= 0 ||
        !Number.isFinite(high) || high <= 0 ||
        !Number.isFinite(low) || low <= 0 ||
        !Number.isFinite(close) || close <= 0 ||
        !Number.isFinite(volume) || volume < 0 ||
        high < Math.max(open, close, low) ||
        low > Math.min(open, close, high)) continue;

    const chartSecond = Math.floor(rawTime >= 100_000_000_000 ? rawTime / 1000 : rawTime);
    if (!Number.isSafeInteger(chartSecond) || chartSecond <= 0) continue;
    byChartSecond.set(chartSecond, {
      time: chartSecond,
      open,
      high,
      low,
      close,
      volume,
      source: typeof candle.source === "string" ? candle.source : fallbackSource,
    });
  }
  return [...byChartSecond.values()].sort((a, b) => a.time - b.time);
}
