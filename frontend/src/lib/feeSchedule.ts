/**
 * Public fee schedule and trading-rule constants.
 *
 * DERIVED FROM THE ACTUAL IMPLEMENTATION — not from industry convention.
 * Every value below was read out of the backend source at the time of writing:
 *
 *   Spot fees      -> backend/supabase/sql/0008_financial_matching_engine_v1.sql
 *                     `maker_fee_rate` / `taker_fee_rate` are `default 0` with
 *                     `check (maker_fee_rate = 0)`, i.e. spot trading is
 *                     currently fee-free BY DATABASE CONSTRAINT. The comment in
 *                     that migration states fees stay zero until fee
 *                     debiting/crediting is implemented atomically.
 *   Perp fees      -> 0041_perpetual_contract_v1.sql, `default 0`.
 *   Min notional   -> backend/api-core.js DEFAULT_SPOT_CATALOG: '5'.
 *   Quantity step  -> DEFAULT_SPOT_CATALOG: '0.00001'.
 *   Funding        -> 0041: funding_interval_sec default 28800 (= 8h),
 *                     funding_rate_cap default 0.0075.
 *   Withdrawal     -> backend/api-core.js DEFAULT_WITHDRAWAL_FEES.
 *
 * If a fee is ever enabled in the backend, THIS FILE MUST CHANGE IN THE SAME
 * RELEASE. Publishing a fee schedule that disagrees with what is charged is a
 * trust failure, and so is publishing a fee that is not actually charged.
 *
 * Withdrawal fees are NOT in this file: the Fees page reads them live from
 * `getWithdrawalConfig()` so the published number can never drift from the
 * number applied to a real withdrawal request.
 */

/** Spot trading is currently fee-free (enforced by a database constraint). */
export const SPOT_FEES_ENABLED = false;

/** Perpetual trading defaults to zero fees in the schema. */
export const PERP_FEES_ENABLED = false;

/** Perpetual funding defaults, mirrored from the schema. */
export const PERP_FUNDING = {
  /** funding_interval_sec default 28800 -> every 8 hours. */
  intervalHours: 8,
  /** funding_rate_cap default 0.0075 -> 0.75% per interval. */
  rateCapPct: 0.75,
  /** maintenance_margin_rate default 0.005 -> 0.5%. */
  maintenanceMarginPct: 0.5,
} as const;

/** Order-type and precision rules that apply platform-wide. */
export interface TradingRule {
  /** i18n key for the rule name. */
  label: string;
  /** i18n key (or literal) for the rule value. */
  value: string;
}

export const SPOT_RULES: TradingRule[] = [
  { label: "Minimum order size", value: "5 USDT notional" },
  { label: "Price precision", value: "0.01 for most pairs (see Markets)" },
  { label: "Quantity precision", value: "0.00001 for most pairs" },
  { label: "Supported order types", value: "Limit, Market" },
  { label: "Order expiry", value: "Good-til-cancelled unless filled" },
  { label: "Self-trade prevention", value: "Enabled" },
];

export const PERP_RULES: TradingRule[] = [
  { label: "Position mode", value: "One-way, isolated margin" },
  { label: "Funding interval", value: "Every 8 hours" },
  { label: "Funding rate cap", value: "0.75% per interval" },
  { label: "Maintenance margin", value: "0.5%" },
  { label: "Liquidation", value: "Automatic when maintenance margin is breached" },
  { label: "Max leverage", value: "Defined per market (see Contract)" },
  { label: "Order types", value: "Limit, Market" },
];

/** Seconds product settlement rules. */
export const SECONDS_RULES: TradingRule[] = [
  { label: "Settlement", value: "Automatic at round expiry" },
  { label: "Payout", value: "Fixed rate shown before you confirm" },
  { label: "Result source", value: "Reference price at expiry timestamp" },
  { label: "Early exit", value: "Not available once a round is placed" },
];

/**
 * Risk disclosures shown to users. These are statements of fact about how the
 * product behaves, not marketing copy — keep them accurate and blunt.
 */
export const RISK_DISCLOSURES: Array<{ title: string; body: string }> = [
  {
    title: "Digital assets are volatile",
    body: "Crypto asset prices can move sharply within minutes. The value of your holdings can fall as well as rise, and you may lose the entire amount you deposited.",
  },
  {
    title: "Leverage magnifies losses",
    body: "Perpetual contracts use leverage. A small adverse price move can liquidate your entire position and the margin backing it. Never post more margin than you can afford to lose.",
  },
  {
    title: "Seconds products settle instantly",
    body: "Seconds rounds are short-duration directional bets. Once placed, a round cannot be cancelled and the outcome is fixed at expiry. Do not treat this product as a savings instrument.",
  },
  {
    title: "Irreversible blockchain transfers",
    body: "Crypto deposits and withdrawals are irreversible. Sending an asset on the wrong network, or to an address you do not control, results in permanent loss that BTCBOX cannot recover.",
  },
  {
    title: "Withdrawals require review",
    body: "Withdrawal requests are reviewed by BTCBOX staff before broadcast. Requests may be delayed or declined if identity verification is incomplete or a risk check is triggered.",
  },
  {
    title: "Not investment advice",
    body: "Nothing on this platform is investment, legal or tax advice. You are responsible for your own decisions and for complying with the laws that apply where you live.",
  },
];
