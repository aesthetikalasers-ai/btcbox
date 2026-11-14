/**
 * Pre-trade confirmation policy.
 *
 * The thresholds protect against expensive mistakes without adding friction to
 * routine orders: a confirmation is required only when
 *   - the order value is large (>= 1,000 USDT), or
 *   - the limit price sits far from the market (>= 3%), the classic typo
 *     signature of a misplaced decimal point.
 *
 * Kept in its own module so the policy can be asserted in tests without
 * mounting the trading page.
 */
export const CONFIRM_NOTIONAL_USDT = 1000;
export const CONFIRM_DEVIATION_PCT = 3;

export function shouldConfirmOrder(notional: number, deviationPct: number | null): boolean {
  if (Number.isFinite(notional) && notional >= CONFIRM_NOTIONAL_USDT) return true;
  return deviationPct !== null && deviationPct >= CONFIRM_DEVIATION_PCT;
}

/** Absolute percentage difference between a limit price and the market price. */
export function priceDeviationPct(limitPrice: number, marketPrice: number | null): number | null {
  if (marketPrice === null || !Number.isFinite(marketPrice) || marketPrice <= 0) return null;
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return null;
  return Math.abs((limitPrice - marketPrice) / marketPrice) * 100;
}
