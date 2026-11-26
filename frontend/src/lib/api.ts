import {
  DEMO_PREVIEW_ACTIVE,
  getDemoAccount,
  getDemoAuthClientConfig,
  getDemoEarnCatalog,
  getDemoKlines,
  getDemoMarketPairs,
  getDemoMarkets,
  getDemoOrderBook,
  getDemoOrders,
  getDemoPerpMarkets,
  getDemoTradingStatus,
} from "./demoPreview";
import { normalizeKlines, type MarketCandle } from "./klineData";
export type { MarketCandle } from "./klineData";
import {
  demoCancelPerpOrder,
  demoClosePerpPosition,
  demoLedgerPerpOpenOrders,
  demoLedgerPerpOrderHistory,
  demoLedgerPerpPositions,
  demoLedgerPerpTrades,
  demoLedgerSpotOrders,
  demoPlacePerpOrder,
  demoPlaceSpotOrder,
} from "./localPaper";

export interface MarketTicker {
  sym: string;
  price: number;
  chg: number;
  high: number;
  low: number;
  vol: string;
  source: string;
  /** Server snapshot time (Unix seconds), not an exchange event timestamp. */
  snapshotTs?: number;
  /** Timestamp supplied by the selected upstream provider (Unix seconds), when available; never synthesized by the browser. */
  providerTs?: number | null;
}


interface MarketResponse {
  ok: boolean;
  markets?: MarketTicker[];
  data?: Record<string, { ts?: number; providerTs?: number | null; source?: string }>;
  msg?: string;
  code?: string;
}

interface KlineResponse {
  ok: boolean;
  source?: string;
  klines?: MarketCandle[];
  msg?: string;
  code?: string;
}

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
export const API_BASE_URL = DEMO_PREVIEW_ACTIVE ? "/__demo_preview_blocked__" : configuredBase || "/api";

/**
 * Single user-visible message for a market-data outage. Shown verbatim by the
 * terminal, the markets page and the dashboard, so an operator reading a
 * screenshot knows which upstream failed instead of guessing.
 */
export const MARKET_UNAVAILABLE_MESSAGE = "行情连接已断开，暂时无法获取最新价格。请稍后重试。";

function hasFiniteValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function rejectDemoFinancialAction(): never {
  throw new ApiError("Financial actions are disabled in demo preview.", 403, "DEMO_MODE");
}

/**
 * Probes the API health endpoint.
 *
 * Returns a discriminated result rather than throwing: the status page must be
 * able to render "degraded" while the API is down, which is exactly the moment
 * a throwing helper would be most inconvenient.
 */
export type HealthProbeResult =
  | { ok: true; latencyMs: number; ts: number }
  | { ok: false; reason: string; latencyMs: number };

export async function probeHealth(signal?: AbortSignal): Promise<HealthProbeResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  if (DEMO_PREVIEW_ACTIVE) return { ok: false, reason: "Unavailable in demo preview.", latencyMs: elapsed() };
  try {
    const response = await fetch(`${API_BASE_URL}/healthz`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}`, latencyMs: elapsed() };
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; ts?: number } | null;
    if (payload?.ok !== true) return { ok: false, reason: "Unexpected health payload.", latencyMs: elapsed() };
    return { ok: true, latencyMs: elapsed(), ts: Number(payload.ts) || Date.now() };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    return { ok: false, reason: cause instanceof Error ? cause.message : "Network error.", latencyMs: elapsed() };
  }
}

export async function getSpotMarketPairs(signal?: AbortSignal): Promise<SpotMarketPair[]> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoMarketPairs();
  try {
    const response = await fetch(`${API_BASE_URL}/market/pairs`, {
      method: "GET", credentials: "include", headers: { Accept: "application/json" },
      cache: "no-store", signal,
    });
    if (response.ok) {
      const payload = await response.json().catch(() => null) as { ok?: boolean; markets?: SpotMarketPair[] } | null;
      if (payload && payload.ok === true && Array.isArray(payload.markets) && payload.markets.length > 0) {
        const validMarkets = payload.markets.filter(market =>
          market && market.enabled === true && typeof market.base_asset === "string" &&
          market.quote_asset === "USDT" &&
          Number.isFinite(Number(market.price_tick)) && Number(market.price_tick) > 0 &&
          Number.isFinite(Number(market.quantity_step)) && Number(market.quantity_step) > 0 &&
          Number.isFinite(Number(market.min_quantity)) && Number(market.min_quantity) > 0 &&
          Number.isFinite(Number(market.min_notional)) && Number(market.min_notional) >= 0
        );
        if (validMarkets.length > 0) return validMarkets;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
  }
  throw new ApiError("Spot market catalogue is unavailable. No markets can be shown until the exchange configuration is restored.", 503, "MARKET_CATALOG_UNAVAILABLE");
}

/**
 * Fetches the live market snapshot.
 *
 * Throws instead of falling back to a sample table. A previous version returned
 * `getSampleMarkets()` on failure, which put plausible-looking prices on screen
 * while the backend was down — indistinguishable from real data, and therefore
 * more dangerous than an empty panel. Callers render `error.message` so the
 * outage is visible to users and developers alike.
 */
export async function getMarkets(signal?: AbortSignal): Promise<MarketTicker[]> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoMarkets();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/market`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(MARKET_UNAVAILABLE_MESSAGE, 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => null)) as (MarketResponse & { code?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || MARKET_UNAVAILABLE_MESSAGE, response.status, payload?.code || "MARKET_DATA_UNAVAILABLE");
  }
  if (!Array.isArray(payload.markets) || payload.markets.length === 0) {
    throw new ApiError(payload?.msg || MARKET_UNAVAILABLE_MESSAGE, response.status, payload?.code || "MARKET_DATA_UNAVAILABLE");
  }

  const rows = payload.markets
    .filter((item) => {
      if (!item || typeof item.sym !== "string" || !item.sym.trim()) return false;
      const snapshot = payload.data?.[item.sym];
      const source = typeof snapshot?.source === "string" && snapshot.source.trim()
        ? snapshot.source
        : typeof item.source === "string" ? item.source.trim() : "";
      return hasFiniteValue(item.price) && Number(item.price) > 0 &&
        hasFiniteValue(item.chg) &&
        hasFiniteValue(item.high) && Number(item.high) > 0 &&
        hasFiniteValue(item.low) && Number(item.low) > 0 &&
        Number(item.high) >= Number(item.low) &&
        hasFiniteValue(item.vol) && Number(item.vol) >= 0 &&
        source.length > 0;
    })
    .map(item => {
      const snapshot = payload.data?.[item.sym];
      return {
        ...item,
        price: Number(item.price),
        chg: Number(item.chg),
        high: Number(item.high),
        low: Number(item.low),
        vol: String(item.vol),
        snapshotTs: Number.isFinite(snapshot?.ts) && Number(snapshot?.ts) > 0 ? Number(snapshot?.ts) : undefined,
        providerTs: Number.isFinite(snapshot?.providerTs) && Number(snapshot?.providerTs) > 0 ? Number(snapshot?.providerTs) : null,
        source: typeof snapshot?.source === "string" && snapshot.source.trim() ? snapshot.source : item.source,
      };
    });

  // Empty or malformed provider data is an outage, never a reason to display seeded prices as live.
  if (rows.length === 0) throw new ApiError(MARKET_UNAVAILABLE_MESSAGE, 502, "MARKET_DATA_INVALID");
  const nowSeconds = Date.now() / 1000;
  const snapshotInvalid = rows.some((row) => (
    typeof row.snapshotTs !== "number" ||
    !Number.isFinite(row.snapshotTs) ||
    row.snapshotTs <= 0 ||
    row.snapshotTs > nowSeconds + 30
  ));
  // providerTs is the provider's last-trade/event time, not the time at
  // which this aggregate snapshot was fetched. Quiet markets can legitimately
  // have an older last trade while their current 24h ticker remains valid.
  // Reject impossible/future provider timestamps, but use snapshotTs alone
  // for freshness so one illiquid pair cannot blank the entire market list.
  const providerTimestampInvalid = rows.some((row) => row.providerTs !== null && (
    typeof row.providerTs !== "number" ||
    !Number.isFinite(row.providerTs) ||
    row.providerTs <= 0 ||
    row.providerTs > nowSeconds + 30
  ));
  const snapshotStale = snapshotInvalid || providerTimestampInvalid || rows.some((row) => (
    typeof row.snapshotTs !== "number" || nowSeconds - row.snapshotTs > 90
  ));
  if (snapshotStale) {
    throw new ApiError("Market service snapshot is missing, invalid or older than 90 seconds.", 502, "MARKET_SNAPSHOT_STALE");
  }
  return rows;
}

export async function getKlines(
  symbol = "BTCUSDT",
  interval = "1h",
  signal?: AbortSignal,
): Promise<MarketCandle[]> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoKlines(symbol, interval);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 8000);
  try {
    const query = new URLSearchParams({ symbol, interval });
    const response = await fetch(`${API_BASE_URL}/kline?${query.toString()}`, {
      method: "GET", credentials: "include",
      headers: { Accept: "application/json" }, cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as KlineResponse | null;
    if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.klines)) {
      throw new ApiError(payload?.msg || "Chart data is temporarily unavailable.", response.status, payload?.code || "KLINE_DATA_UNAVAILABLE");
    }

    const normalized = normalizeKlines(payload.klines, payload.source);
    if (normalized.length === 0) {
      throw new ApiError("No verified candle data is available for this market.", response.status || 503, "KLINE_DATA_UNAVAILABLE");
    }
    return normalized;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Chart data is temporarily unavailable. Please retry.", 0, "KLINE_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export interface TradingStatus {
  spot_order_entry_enabled: boolean;
  spot_cancel_enabled: boolean;
  supported_order_types: string[];
}
export async function getTradingStatus(signal?: AbortSignal): Promise<TradingStatus> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoTradingStatus();
  try {
    const response = await fetch(`${API_BASE_URL}/trading/status`, { credentials: "include", cache: "no-store", signal, headers: { Accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json().catch(() => null) as (TradingStatus & { ok?: boolean }) | null;
      if (payload && payload.ok === true && typeof payload.spot_order_entry_enabled === "boolean") {
        return payload;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
  }
  // Fail closed: if server policy cannot be read, order entry stays disabled.
  // Guessing "enabled" here would expose the entry form during an outage.
  return { spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: [] };
}
export interface OrderBookSnapshot { source: string; snapshotTs?: number; providerTs?: number | null; bids: Array<[string,string]>; asks: Array<[string,string]>; }
/**
 * Fetches the live order book.
 *
 * Returns `null` when the book cannot be fetched from the service. It never
 * falls back to synthetic levels: an order book is what a trader uses to price
 * a limit order, so a randomly generated book would be actively dangerous.
 * Callers must render an explicit "unavailable" state.
 */
export async function getOrderBook(symbol = "BTCUSDT", signal?: AbortSignal): Promise<OrderBookSnapshot | null> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoOrderBook(symbol);
  try {
    const query = new URLSearchParams({ symbol });
    const response = await fetch(`${API_BASE_URL}/depth?${query.toString()}`, { credentials: "include", cache: "no-store", signal, headers: { Accept: "application/json" } });
    if (response.ok) {
      const payload = await response.json().catch(() => null) as (OrderBookSnapshot & { ok?: boolean }) | null;
      if (payload && payload.ok === true && Array.isArray(payload.bids) && Array.isArray(payload.asks)) {
        const normalizeLevels = (rows: unknown[]): Array<[string, string]> => rows
          .filter((row): row is [string | number, string | number] =>
            Array.isArray(row) && row.length >= 2 &&
            Number.isFinite(Number(row[0])) && Number(row[0]) > 0 &&
            Number.isFinite(Number(row[1])) && Number(row[1]) > 0)
          .map(row => [String(row[0]), String(row[1])]);
        const bids = normalizeLevels(payload.bids).sort((left, right) => Number(right[0]) - Number(left[0])).slice(0, 20);
        const asks = normalizeLevels(payload.asks).sort((left, right) => Number(left[0]) - Number(right[0])).slice(0, 20);
        if (!bids.length || !asks.length) throw new ApiError("Order book data is malformed or empty.", response.status, "INVALID_ORDER_BOOK");
        return { ...payload, bids, asks };
      }
    }
  } catch (error) {
    if (error instanceof ApiError && error.code === "INVALID_ORDER_BOOK") throw error;
    if (error instanceof Error && error.name === "AbortError" && signal?.aborted) throw error;
    // Live depth must never be replaced by fabricated levels. The caller
    // renders an unavailable state and keeps order submission fail-closed.
    return null;
  }
  // A missing or malformed live payload is unavailable, not a reason to invent
  // prices or quantities that could be mistaken for executable liquidity.
  return null;
}
export interface UsdtUsdRate { rate: number | null; source: string; stale?: boolean; }
/**
 * USDT → USD conversion rate for the "≈ $" hint under the order-book mid price.
 *
 * The trading pair is quoted in USDT, which is not exactly one dollar, so the
 * hint must be computed rather than echoed. On a cold-start provider outage this
 * returns `rate: null`, so the UI can omit the hint instead of showing a guessed
 * conversion.
 */
export async function getUsdtUsdRate(signal?: AbortSignal): Promise<UsdtUsdRate> {
  try {
    const response = await fetch(`${API_BASE_URL}/fx/usdt-usd`, {
      credentials: "include", cache: "no-store", signal, headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const payload = await response.json().catch(() => null) as { ok?: boolean; rate?: number; source?: string; stale?: boolean } | null;
      const rate = Number(payload?.rate);
      if (payload?.ok === true && Number.isFinite(rate) && rate > 0.5 && rate < 1.5) {
        return { rate, source: payload.source || "unknown", stale: payload.stale === true };
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
  }
  return { rate: null, source: "unavailable", stale: true };
}
export interface SpotOrderInput { symbol: string; side: "buy" | "sell"; type: "limit"; qty: string; price: string; client_order_id: string; }
export interface SpotOrderResult { order_id: string; status: string; price: number | string; quantity: number | string; remaining_quantity?: number | string; duplicate: boolean; }
export async function submitSpotOrder(input: SpotOrderInput): Promise<SpotOrderResult> {
  if (DEMO_PREVIEW_ACTIVE) return demoPlaceSpotOrder(input);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/order`, { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(input) });
  } catch {
    throw new ApiError("Order result is unconfirmed. Keep the same request ID and check order history before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as (SpotOrderResult & { ok?: boolean; need_login?: boolean; msg?: string; code?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.order_id !== "string" || typeof payload.status !== "string") {
    throw new ApiError(payload?.msg || "Spot order was not confirmed. Check order history before retrying.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return payload;
}
export async function cancelSpotOrder(input: { order_id: string; client_cancel_id: string }): Promise<{ order_id: string; status: string; duplicate: boolean }> {
  if (DEMO_PREVIEW_ACTIVE) return { order_id: input.order_id, status: "canceled", duplicate: false };
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/order/cancel`, { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(input) });
  } catch {
    throw new ApiError("Cancel result is unconfirmed. Keep the same request ID and refresh order history before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; order_id?: string; status?: string; duplicate?: boolean; need_login?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.order_id !== "string" || typeof payload.status !== "string") {
    throw new ApiError(payload?.msg || "Order cancellation was not confirmed.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return { order_id: payload.order_id, status: payload.status, duplicate: !!payload.duplicate };
}

export interface AccountBalance {
  free: number | string;
  frozen: number | string;
  usdt?: number | string;
  valuation_available?: boolean;
}

export interface DepositRecord {
  id?: string;
  coin: string;
  amount: number | string;
  network?: string;
  status: string;
  time?: string;
  confirmed_at?: string | null;
  txid?: string;
  reference?: string;
  source?: string;
}

export interface WithdrawalRecord {
  /** Server-generated withdrawal application number (never supplied by the customer). */
  id: string;
  coin: string;
  amount: number | string;
  fee?: number | string;
  settlement_asset?: string;
  settlement_amount?: number | string | null;
  conversion_rate?: number | string | null;
  network?: string;
  address?: string;
  status: string;
  time?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export interface WithdrawalHistoryPage {
  withdrawals: WithdrawalRecord[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface AccountSnapshot {
  uid: string;
  email: string;
  username?: string;
  has_login_password?: boolean;
  auth_providers?: string[];
  linked_identities?: Array<{ provider: string; wallet_address?: string; wallet_chain?: string; linked_at?: string }>;
  wallet_address?: string;
  wallet_chain?: "ethereum" | "solana" | "";
  balances: Record<string, AccountBalance>;
  totalUsdt: number;
  valuation_complete: boolean;
  unpriced_assets: string[];
  kyc: { status: string; name?: string; id_type?: string; id_number?: string; reject_reason?: string; };
  twofa_enabled: boolean;
  earn_records?: EarnPosition[];
  deposits?: DepositRecord[];
  withdrawals?: WithdrawalRecord[];
  /**
   * Backend-driven targeted notice (single-user restriction). When the server
   * flags this account — account suspension, fund freeze, or risk-control alert —
   * it returns this object and the global high-priority modal renders it. Absent
   * by default, so existing deployments are unaffected.
   */
  restriction?: AccountRestriction;
}

/** A backend-driven, single-user targeted notice. */
export interface AccountRestriction {
  /** Short headline, e.g. "Account frozen" / "Funds on hold". */
  title: string;
  /** Longer explanation shown under the headline. */
  detail?: string;
  /** Severity drives the accent color: "info" | "warning" | "danger". */
  level?: "info" | "warning" | "danger";
  /**
   * Optional action buttons rendered by the frontend. `href` opens in-place
   * navigation, `label` is the visible text. If omitted, a single dismiss
   * ("Understood") button is shown only when `dismissible` is true.
   */
  actions?: Array<{ label: string; href?: string }>;
  /** Whether the user can dismiss the modal. Defaults to false (blocking). */
  dismissible?: boolean;
}

export interface OrderRecord {
  order_id?: string | number;
  id?: string | number;
  symbol?: string;
  side?: string;
  type?: string;
  price?: number | string;
  quantity?: number | string;
  amount?: number | string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  remaining_quantity?: number | string;
  client_order_id?: string;
}

async function readAuthenticated<T>(path: string, signal?: AbortSignal): Promise<T> {
  // Bound read-only account requests so refresh controls can recover. Mutation
  // requests retain their existing semantics and are never retried here.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, 15000);
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/${path}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError("Unable to reach BTCBOX services. Please try again.", 0, "NETWORK_ERROR");
    }

    const payload = await response.json().catch(() => null) as (T & { ok?: boolean; msg?: string; code?: string; need_login?: boolean }) | null;
    if (!response.ok || !payload || payload.ok !== true) {
      const authRequired = !!payload?.need_login;
      throw new ApiError(
        payload?.msg || (authRequired ? "Please sign in to continue." : "BTCBOX account data is temporarily unavailable."),
        authRequired ? 401 : response.status,
        authRequired ? "AUTH_REQUIRED" : payload?.code,
      );
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new ApiError("Unable to reach BTCBOX services. Please try again.", 0, "NETWORK_ERROR");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function getAccount(signal?: AbortSignal): Promise<AccountSnapshot> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoAccount();
  const payload = await readAuthenticated<AccountSnapshot & { ok: true }>("account", signal);
  const validAmount = (value: unknown) =>
    (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
    (typeof value === "string" && /^(?:\d+)(?:\.\d{1,18})?$/.test(value.trim()));
  const validBalances = !!payload.balances &&
    typeof payload.balances === "object" &&
    !Array.isArray(payload.balances) &&
    Object.entries(payload.balances).every(([asset, balance]) =>
      !!asset && !!balance && typeof balance === "object" && !Array.isArray(balance) &&
      validAmount((balance as AccountBalance).free) &&
      validAmount((balance as AccountBalance).frozen)
    );
  // Fail closed: a malformed balance or missing history array must never be
  // replaced with synthetic figures — balances drive withdrawable amounts.
  if (!validBalances || !Array.isArray(payload.unpriced_assets)) {
    throw new ApiError("BTCBOX returned an invalid account response.", 502, "INVALID_ACCOUNT_RESPONSE");
  }
  return payload;
}

export interface EarnProduct {
  product_id: string;
  asset: string;
  product_type: "demand" | "fixed";
  apy_percent: number | string;
  term_days: number;
  early_fee_percent: number | string;
  amount_scale: number;
  updated_at?: string;
}

export interface EarnPosition {
  id: string;
  product_id: string;
  product: string;
  amount: number | string;
  apy: number | string;
  expected_interest: number | string;
  type: "flexible" | "fixed";
  status: string;
  start: string;
  end: string;
}

export interface EarnCatalogSnapshot {
  products: EarnProduct[];
  actions_enabled: boolean;
}

export interface EarnActionResult {
  record_id: string;
  status: string;
  duplicate: boolean;
  operation_id?: string;
  msg?: string;
}

export async function getEarnCatalog(signal?: AbortSignal): Promise<EarnCatalogSnapshot> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoEarnCatalog();
  const payload = await readAuthenticated<{ ok: true; products: EarnProduct[]; actions_enabled: boolean }>("earn/products", signal);
  if (!Array.isArray(payload.products) || typeof payload.actions_enabled !== "boolean" ||
      !payload.products.every((item) => item && typeof item.product_id === "string" &&
        typeof item.asset === "string" && (item.product_type === "demand" || item.product_type === "fixed") &&
        Number.isFinite(Number(item.apy_percent)) && Number.isInteger(Number(item.term_days)) &&
        Number.isFinite(Number(item.early_fee_percent)) && Number.isInteger(Number(item.amount_scale)))) {
    throw new ApiError("BTCBOX returned an invalid Earn catalog.", 502, "INVALID_EARN_CATALOG");
  }
  return payload;
}

export async function submitEarnAction(
  action: "subscribe" | "redeem",
  input: { request_id: string; product_id?: string; amount?: string; record_id?: string },
): Promise<EarnActionResult> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/earn`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action, ...input }),
    });
  } catch {
    throw new ApiError("Unable to confirm the Earn operation. Check Earn history before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as (EarnActionResult & { ok?: boolean; need_login?: boolean; code?: string; msg?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.record_id !== "string" || typeof payload.status !== "string") {
    throw new ApiError(payload?.msg || "Earn operation was not confirmed. Check Earn history before retrying.", response.status, payload?.code);
  }
  return payload;
}

export async function getOrders(signal?: AbortSignal): Promise<OrderRecord[]> {
  if (DEMO_PREVIEW_ACTIVE) return demoLedgerSpotOrders();
  const payload = await readAuthenticated<{ ok: true; orders: OrderRecord[] }>("orders", signal);
  if (!Array.isArray(payload.orders)) {
    throw new ApiError("BTCBOX returned an invalid order response.", 502, "INVALID_ORDER_RESPONSE");
  }
  return payload.orders;
}


export interface SecondsPosition {
  position_id: string;
  symbol: string;
  direction: "up" | "down";
  amount: number | string;
  duration_sec: number;
  open_price: number | string;
  settle_at: number;
}
export interface SecondsHistoryRecord extends SecondsPosition {
  settle_price: number | string;
  pnl: number | string;
  win: boolean;
  tie: boolean;
  settled_at: number;
}
export interface SecondsPositionsSnapshot {
  server_now: number;
  open: SecondsPosition[];
  history: SecondsHistoryRecord[];
  cutover_incomplete?: boolean;
}
function isSecondsPosition(value: unknown): value is SecondsPosition {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.position_id === "string" && /^SC[A-Fa-f0-9]{30}$/.test(item.position_id) &&
    typeof item.symbol === "string" && ["BTC", "ETH", "SOL", "BNB"].includes(item.symbol) &&
    (item.direction === "up" || item.direction === "down") &&
    (typeof item.amount === "string" || (typeof item.amount === "number" && Number.isFinite(item.amount))) &&
    Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 &&
    Number.isSafeInteger(Number(item.duration_sec)) && Number(item.duration_sec) > 0 &&
    (typeof item.open_price === "string" || (typeof item.open_price === "number" && Number.isFinite(item.open_price))) &&
    Number.isFinite(Number(item.open_price)) && Number(item.open_price) > 0 &&
    Number.isSafeInteger(item.settle_at) && Number(item.settle_at) > 0;
}
export async function getSecondsPositions(signal?: AbortSignal): Promise<SecondsPositionsSnapshot> {
  const payload = await readAuthenticated<SecondsPositionsSnapshot & { ok: true }>("seconds/positions", signal);
  if (!Number.isFinite(payload.server_now) || payload.server_now <= 0 ||
      !Array.isArray(payload.open) || !Array.isArray(payload.history) ||
      (payload.cutover_incomplete !== undefined && typeof payload.cutover_incomplete !== "boolean") ||
      !payload.open.every(isSecondsPosition) ||
      !payload.history.every((item) => isSecondsPosition(item) &&
        (typeof item.settle_price === "string" || (typeof item.settle_price === "number" && Number.isFinite(item.settle_price))) &&
        Number.isFinite(Number(item.settle_price)) && Number(item.settle_price) > 0 &&
        (typeof item.pnl === "string" || (typeof item.pnl === "number" && Number.isFinite(item.pnl))) &&
        Number.isFinite(Number(item.pnl)) && typeof item.win === "boolean" &&
        typeof item.tie === "boolean" && Number.isSafeInteger(item.settled_at) && item.settled_at > 0)) {
    throw new ApiError("BTCBOX returned an invalid seconds-position response.", 502, "INVALID_SECONDS_POSITIONS_RESPONSE");
  }
  if (payload.cutover_incomplete === true && (payload.open.length || payload.history.length)) {
    throw new ApiError("BTCBOX returned inconsistent seconds cutover status.", 502, "INVALID_SECONDS_CUTOVER_RESPONSE");
  }
  return payload;
}

export interface SecondsPolicySnapshot {
  policy_id: string;
  policy_version: number;
  symbols: string[];
  durations_sec: number[];
  min_stake: number | string;
  max_stake: number | string;
  payout_bps: number;
  per_user_open_exposure: number | string | null;
  max_open_positions_per_user: number | null;
}
export interface SecondsPolicyResponse {
  policy: SecondsPolicySnapshot;
  actions_enabled: boolean;
}
export async function getSecondsPolicy(signal?: AbortSignal): Promise<SecondsPolicyResponse> {
  const payload = await readAuthenticated<SecondsPolicyResponse & { ok: true }>("seconds/policy", signal);
  const policy = payload.policy;
  if (!policy || typeof policy.policy_id !== "string" ||
      !Number.isSafeInteger(policy.policy_version) || policy.policy_version <= 0 ||
      !Array.isArray(policy.symbols) || !policy.symbols.length ||
      !policy.symbols.every((symbol) => ["BTC", "ETH", "SOL", "BNB"].includes(symbol)) ||
      !Array.isArray(policy.durations_sec) || !policy.durations_sec.length ||
      !policy.durations_sec.every((duration) => Number.isSafeInteger(duration) && duration > 0) ||
      !Number.isFinite(Number(policy.min_stake)) || Number(policy.min_stake) <= 0 ||
      !Number.isFinite(Number(policy.max_stake)) || Number(policy.max_stake) < Number(policy.min_stake) ||
      !Number.isSafeInteger(policy.payout_bps) || policy.payout_bps < 8500 ||
      (policy.per_user_open_exposure !== null && (!Number.isFinite(Number(policy.per_user_open_exposure)) || Number(policy.per_user_open_exposure) <= 0)) ||
      (policy.max_open_positions_per_user !== null && (!Number.isSafeInteger(policy.max_open_positions_per_user) || policy.max_open_positions_per_user <= 0)) ||
      typeof payload.actions_enabled !== "boolean") {
    throw new ApiError("BTCBOX returned an invalid seconds policy.", 502, "INVALID_SECONDS_POLICY");
  }
  return payload;
}

export interface SecondsOrderInput {
  request_id: string;
  symbol: string;
  direction: "up" | "down";
  duration_sec: number;
  amount: string;
}
export interface SecondsOrderResult {
  position_id: string;
  symbol: string;
  direction: "up" | "down";
  amount: number | string;
  duration_sec: number;
  open_price: number;
  settle_at: number;
  duplicate: boolean;
}
export async function submitSecondsOrder(input: SecondsOrderInput): Promise<SecondsOrderResult> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/seconds/order`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Order result is unconfirmed. Keep the same request ID and check open positions before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as (SecondsOrderResult & { ok?: boolean; msg?: string; code?: string; need_login?: boolean }) | null;
  if (!response.ok || !payload || payload.ok !== true ||
      typeof payload.position_id !== "string" || !/^SC[A-Fa-f0-9]{30}$/.test(payload.position_id) ||
      !["BTC", "ETH", "SOL", "BNB"].includes(payload.symbol) ||
      (payload.direction !== "up" && payload.direction !== "down") ||
      !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0 ||
      (!Number.isSafeInteger(payload.duration_sec) || payload.duration_sec <= 0) ||
      !Number.isFinite(payload.open_price) || payload.open_price <= 0 ||
      !Number.isSafeInteger(payload.settle_at) || payload.settle_at <= 0) {
    throw new ApiError(payload?.msg || "Order was not confirmed. Check open positions before retrying.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return payload;
}

export async function settleSecondsPosition(input: { position_id: string; symbol: string; request_id: string }): Promise<{ settled: boolean; duplicate: boolean }> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/seconds/settle`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Settlement is not yet confirmed. The position remains visible until the server confirms its result.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; settled?: boolean; duplicate?: boolean; need_login?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.settled !== "boolean") {
    throw new ApiError(payload?.msg || "Settlement is not yet confirmed. Refresh the position later.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return { settled: payload.settled, duplicate: !!payload.duplicate };
}



export async function logout(): Promise<void> {
  if (DEMO_PREVIEW_ACTIVE) return;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to reach BTCBOX services. Please try again.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Sign out could not be confirmed.", response.status, payload?.code);
  }
}


export interface AuthClientConfig {
  ok: true;
  supabase_url: string;
  publishable_key: string;
  google_enabled: boolean | null;
  wallet_enabled: boolean | null;
}

export async function getAuthClientConfig(signal?: AbortSignal): Promise<AuthClientConfig> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoAuthClientConfig();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth-client-config`, {
      method: "GET", credentials: "include", headers: { Accept: "application/json" },
      cache: "no-store", signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Unable to reach BTCBOX authentication service.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as (AuthClientConfig & { msg?: string; code?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true || !payload.supabase_url || !payload.publishable_key) {
    throw new ApiError(payload?.msg || "BTCBOX authentication is not configured.", response.status, payload?.code);
  }
  return payload;
}

export interface SupabaseLoginResult {
  ok: boolean;
  require_2fa?: boolean;
  temp_token?: string;
  uid?: string;
  msg?: string;
  code?: string;
}

export async function exchangeSupabaseSession(accessToken: string): Promise<SupabaseLoginResult> {
  const response = await fetch(`${API_BASE_URL}/supabase-login`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ supabase_access_token: accessToken }),
  });
  const payload = await response.json().catch(() => null) as SupabaseLoginResult | null;
  if (!response.ok || !payload) throw new ApiError(payload?.msg || "BTCBOX sign-in failed.", response.status, payload?.code);
  if (payload.require_2fa) return payload;
  if (payload.ok !== true) throw new ApiError(payload.msg || "BTCBOX sign-in failed.", response.status, payload.code);
  return payload;
}

export async function loginWithUsername(username: string, password: string): Promise<SupabaseLoginResult> {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ username, password }),
  });
  const payload = await response.json().catch(() => null) as SupabaseLoginResult | null;
  if (!response.ok || !payload) throw new ApiError(payload?.msg || "BTCBOX sign-in failed.", response.status, payload?.code);
  if (payload.require_2fa) return payload;
  if (payload.ok !== true) throw new ApiError(payload.msg || "Username or password is incorrect.", response.status, payload.code);
  return payload;
}

export async function setBtcboxCredentials(username: string, password: string, currentPassword?: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/account/credentials`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ username, password, current_password: currentPassword || "" }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "BTCBOX credentials could not be saved.", response.status, payload?.code);
  }
}

export async function reauthenticateBtcboxCredentials(accessToken: string, twoFactorCode = ""): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/account/credentials/reauth`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ supabase_access_token: accessToken, twofa_code: twoFactorCode }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Recent identity verification could not be confirmed.", response.status, payload?.code);
  }
}

export async function setFundPassword(input: { fund_password: string; current_password?: string; twofa_code?: string }): Promise<void> {
  if (DEMO_PREVIEW_ACTIVE) throw new ApiError("Fund-password changes are disabled in demo preview.", 403, "DEMO_MODE");
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/settings/fundpwd`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Fund-password update could not be confirmed. Check your account security status before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string; need_login?: boolean } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Fund password could not be saved.", payload?.need_login ? 401 : response.status, payload?.code);
  }
}

export async function recoverBtcboxCredentials(password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/account/credentials/recover`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ password }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "BTCBOX password could not be reset.", response.status, payload?.code);
  }
}

export async function reauthenticateIdentityForLink(accessToken: string, twoFactorCode = ""): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/link-identity/reauth`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ supabase_access_token: accessToken, twofa_code: twoFactorCode }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Existing sign-in method could not be reverified.", response.status, payload?.code);
  }
}

export async function linkSupabaseIdentity(accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/link-identity`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ supabase_access_token: accessToken }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Identity could not be linked.", response.status, payload?.code);
  }
}

export async function completeLogin2fa(tempToken: string, code: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/login/2fa`, {
    method: "POST", credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store", body: JSON.stringify({ temp_token: tempToken, code }),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "The verification code was not accepted.", response.status, payload?.code);
  }
}

/** Posts to a 2FA endpoint and normalises the response envelope. */
async function postTwoFactor<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/2fa/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; msg?: string; code?: string } & Record<string, unknown>)
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Two-factor authentication request failed.", response.status, payload?.code);
  }
  return payload as T;
}

/**
 * Starts TOTP enrollment.
 *
 * The server never discloses the secret of an already-enabled factor, and it
 * requires fresh proof of identity before enrolling:
 *   - password accounts must send `currentPassword`
 *   - OAuth / magic-link accounts must have signed in within the last 5 minutes
 *     (otherwise the server answers `REAUTH_REQUIRED`)
 *
 * Returns the base32 secret to render as a QR code; `enabled` stays false until
 * {@link confirmTwoFactor} is called with a valid code.
 */
export async function beginTwoFactorEnrollment(currentPassword?: string): Promise<{ secret: string }> {
  const payload = await postTwoFactor<{ secret: string }>("enable", currentPassword ? { current_password: currentPassword } : {});
  if (typeof payload.secret !== "string" || payload.secret.length === 0) {
    throw new ApiError("The server did not return a two-factor secret.", 502, "INVALID_2FA_SECRET");
  }
  return { secret: payload.secret };
}

/**
 * Confirms enrollment. Enabling a second factor revokes every other session for
 * the account, so the user should expect other devices to be signed out.
 */
export async function confirmTwoFactor(code: string): Promise<void> {
  await postTwoFactor("confirm", { code });
}

/**
 * Disables 2FA. Requires a valid current code; the secret is rotated server-side
 * so a re-enrollment never reuses the old one.
 */
export async function disableTwoFactor(code: string): Promise<void> {
  await postTwoFactor("disable", { code });
}

/**
 * Builds the otpauth:// URI that authenticator apps scan.
 * Kept next to the API helpers so the issuer/label convention lives in one place.
 */
export function buildTotpUri(secret: string, accountLabel: string): string {
  const issuer = "BTCBOX";
  const label = encodeURIComponent(`${issuer}:${accountLabel || "account"}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}


export interface SupportMessage {
  id: string;
  from: "user" | "admin";
  content: string;
  time: string;
}

export interface AdminPayoutAddress {
  id: string; type: "bank" | "crypto"; uid: string; email?: string;
  account_holder?: string; bank_name?: string; account_number?: string; iban?: string; country?: string;
  routing_number?: string; swift?: string; bank_address?: string; note?: string;
  coin?: string; network?: string; address?: string; created_at?: string;
  flagged?: boolean; blocked?: boolean; unbound?: boolean;
}

/** One help-centre entry as published to customers (enabled entries only). */
export interface SupportFaqEntry {
  id: string;
  question: string;
  answer: string;
}

/** One help-centre entry as managed by staff, including disabled entries. */
export interface AdminSupportFaqEntry extends SupportFaqEntry {
  order: number;
  enabled: boolean;
  updated_at: string;
}

export async function submitKyc(input: {
  name: string;
  id_type: "passport" | "id_card" | "driver_license";
  id_number: string;
  document_content_type: "image/jpeg" | "image/png" | "image/webp";
  document_image_base64: string;
}): Promise<{ status: "pending" }> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/kyc`, { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(input) });
  } catch {
    throw new ApiError("Verification submission could not be confirmed. Refresh your account status before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; status?: string; msg?: string; code?: string; need_login?: boolean } | null;
  if (!response.ok || !payload || payload.ok !== true || payload.status !== "pending") {
    throw new ApiError(payload?.msg || "Verification submission was not accepted.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return { status: "pending" };
}

export async function getSupportMessages(signal?: AbortSignal): Promise<SupportMessage[]> {
  const payload = await readAuthenticated<{ ok: true; messages: SupportMessage[] }>("support/messages", signal);
  if (!Array.isArray(payload.messages) || !payload.messages.every((item) =>
    item && typeof item.id === "string" && (item.from === "user" || item.from === "admin") &&
    typeof item.content === "string" && typeof item.time === "string"
  )) {
    throw new ApiError("BTCBOX returned an invalid support conversation.", 502, "INVALID_SUPPORT_RESPONSE");
  }
  return payload.messages;
}

/**
 * Number of unread support replies for the signed-in account.
 *
 * Backed by `GET /api/chat/unread` (see backend/api-core.js): the server compares
 * each admin message timestamp against the account's `last_read_chat_at`, so the
 * count is authoritative and cannot drift client-side. Failures degrade to 0 —
 * a badge is never worth breaking the account page over.
 */
export async function getSupportUnread(signal?: AbortSignal): Promise<number> {
  try {
    const payload = await readAuthenticated<{ ok: true; unread: number }>("chat/unread", signal);
    return Number.isFinite(payload.unread) && payload.unread > 0 ? Math.floor(payload.unread) : 0;
  } catch (reason) {
    if (reason instanceof Error && reason.name === "AbortError") throw reason;
    return 0;
  }
}

/**
 * Help-centre entries for the signed-out and signed-in support page.
 *
 * Content is owned by the backend (`support_faq` in the persisted state document)
 * so operations can edit it from the administrator console without a deploy.
 * An unavailable or empty catalogue returns an empty array: the page then shows
 * an honest empty state instead of inventing answers.
 */
export async function getSupportFaq(signal?: AbortSignal): Promise<SupportFaqEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/support/faq`, {
      method: "GET", credentials: "include", headers: { Accept: "application/json" },
      cache: "no-store", signal,
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null) as { ok?: boolean; entries?: SupportFaqEntry[] } | null;
    if (!payload || payload.ok !== true || !Array.isArray(payload.entries)) return [];
    return payload.entries.filter((entry): entry is SupportFaqEntry =>
      !!entry && typeof entry.id === "string" && typeof entry.question === "string" && typeof entry.answer === "string"
    );
  } catch (reason) {
    if (reason instanceof Error && reason.name === "AbortError") throw reason;
    return [];
  }
}

export async function sendSupportMessage(content: string, requestId?: string): Promise<{ duplicate?: boolean; message_id?: string; time?: string }> {
  const normalized = content.trim();
  if (!normalized || normalized.length > 2000) {
    throw new ApiError("Messages must contain 1–2,000 characters.", 400, "INVALID_SUPPORT_MESSAGE");
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/support/chat`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify({ content: normalized, ...(requestId ? { request_id: requestId } : {}) }),
    });
  } catch {
    throw new ApiError("Unable to reach BTCBOX support. Please try again.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string; need_login?: boolean; duplicate?: boolean; message_id?: string; time?: string } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Your message could not be sent.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return { duplicate: payload.duplicate, message_id: payload.message_id, time: payload.time };
}


export interface SavedCryptoAddress {
  id: string; type: "crypto"; coin: string; network: string; address: string;
  note?: string; created_at?: string; flagged?: boolean; blocked?: boolean; unbound?: boolean;
}

/** Bank account (fiat withdrawal method) saved in the address book. */
export interface BankAddress {
  id: string; type: "bank";
  account_holder: string; bank_name: string;
  account_number?: string; iban?: string; country?: string; routing_number?: string;
  swift?: string; bank_address?: string;
  note?: string; created_at?: string; flagged?: boolean; blocked?: boolean; unbound?: boolean;
}

export type SavedAddress = SavedCryptoAddress | BankAddress;

/** Input for creating a crypto address entry. */
export interface CryptoAddressInput {
  type: "crypto"; coin: string; network: string; address: string; note?: string;
}

/** Input for creating a bank (fiat) address entry. */
export interface BankAddressInput {
  type: "bank"; account_holder: string; bank_name: string;
  account_number?: string; iban?: string; country?: string; routing_number?: string;
  swift?: string; bank_address?: string; note?: string;
}

export async function addAddress(input: CryptoAddressInput | BankAddressInput): Promise<{ msg: string; address: SavedAddress }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/addresses`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Unable to reach BTCBOX address book. Please try again.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string; need_login?: boolean; address?: SavedAddress } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Your address could not be added.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return { msg: payload.msg || "Submitted successfully.", address: payload.address as SavedAddress };
}
export async function getSavedCryptoAddresses(signal?: AbortSignal): Promise<SavedAddress[]> {
  const payload = await readAuthenticated<{ ok: true; addresses: SavedAddress[] }>("addresses", signal);
  if (!Array.isArray(payload.addresses)) throw new ApiError("BTCBOX returned an invalid address book.", 502, "INVALID_ADDRESS_BOOK");
  return payload.addresses.filter((item) => item && typeof item.id === "string" && (item.type === "crypto" || item.type === "bank"))
    .map((item) => ({ ...item, blocked: item.blocked === true, unbound: item.unbound === true }));
}
export interface SelectedCryptoAddress {
  address: string;
  coin: string;
  network: string;
}

export interface WithdrawalConfig {
  actions_enabled: boolean;
  fees: Record<string, number | string>;
  allowed_networks: Record<string, string[]>;
  /** Indicative live rate; the server locks its own rate when a USDC request is created. */
  usdc_usdt_rate: string | null;
}

export interface WithdrawalSubmissionResult {
  withdrawal_id: string;
  status: string;
  require_admin_review: boolean;
  duplicate: boolean;
  settlement_asset?: string;
  settlement_amount?: string;
  conversion_rate?: string;
  msg?: string;
}

export async function getSelectedCryptoAddress(id: string, signal?: AbortSignal): Promise<SelectedCryptoAddress> {
  const query = new URLSearchParams({ id });
  const payload = await readAuthenticated<{ ok: true; address: string; coin: string; network: string }>(`addresses/select?${query.toString()}`, signal);
  if (typeof payload.address !== "string" || !payload.address || typeof payload.coin !== "string" || typeof payload.network !== "string") {
    throw new ApiError("BTCBOX returned an invalid selected withdrawal address.", 502, "INVALID_WITHDRAWAL_ADDRESS");
  }
  return { address: payload.address, coin: payload.coin, network: payload.network };
}

export async function getWithdrawalConfig(signal?: AbortSignal): Promise<WithdrawalConfig> {
  const payload = await readAuthenticated<WithdrawalConfig & { ok: true }>("withdrawal/config", signal);
  if (typeof payload.actions_enabled !== "boolean" || !payload.fees || typeof payload.fees !== "object" ||
      !payload.allowed_networks || typeof payload.allowed_networks !== "object") {
    throw new ApiError("BTCBOX returned an invalid withdrawal configuration.", 502, "INVALID_WITHDRAWAL_CONFIG");
  }
  return payload;
}

export interface InternalConversionQuote {
  from_asset: string;
  to_asset: string;
  from_amount: string;
  to_amount: string;
  rate: string;
  expires_at: number;
  quote_token: string;
}

export interface InternalConversionResult {
  operation_id: string;
  duplicate: boolean;
  from_asset: string;
  to_asset: string;
  from_amount: string;
  to_amount: string;
  rate: string;
}

export async function getInternalConversionQuote(fromAsset: string, toAsset: string, amount: string, signal?: AbortSignal): Promise<InternalConversionQuote> {
  const query = new URLSearchParams({ from: fromAsset, to: toAsset, amount });
  const payload = await readAuthenticated<InternalConversionQuote & { ok: true }>(`convert/quote?${query.toString()}`, signal);
  if (payload.from_asset !== fromAsset || payload.to_asset !== toAsset ||
      typeof payload.from_amount !== "string" || typeof payload.to_amount !== "string" ||
      typeof payload.rate !== "string" || typeof payload.expires_at !== "number" ||
      typeof payload.quote_token !== "string" || !payload.quote_token) {
    throw new ApiError("BTCBOX returned an invalid conversion quote.", 502, "INVALID_CONVERSION_QUOTE");
  }
  return payload;
}

export async function submitInternalConversion(input: { request_id: string; quote_token: string }): Promise<InternalConversionResult> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/convert`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Conversion result is unconfirmed. Refresh your balances and check operation history before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as (InternalConversionResult & { ok?: boolean; need_login?: boolean; code?: string; msg?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.operation_id !== "string" ||
      typeof payload.from_asset !== "string" || typeof payload.to_asset !== "string" ||
      typeof payload.from_amount !== "string" || typeof payload.to_amount !== "string" ||
      typeof payload.duplicate !== "boolean") {
    throw new ApiError(payload?.msg || "Conversion was not confirmed. Check your balances before retrying.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return payload;
}

export async function getWithdrawalHistoryPage(cursor?: string | null, signal?: AbortSignal): Promise<WithdrawalHistoryPage> {
  if (DEMO_PREVIEW_ACTIVE) {
    const demo = await getDemoAccount();
    return { withdrawals: demo.withdrawals || [], has_more: false, next_cursor: null };
  }
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const payload = await readAuthenticated<WithdrawalHistoryPage & { ok: true }>(`withdrawal/history${query}`, signal);
  if (!Array.isArray(payload.withdrawals) || typeof payload.has_more !== "boolean" ||
      (payload.next_cursor !== null && typeof payload.next_cursor !== "string")) {
    throw new ApiError("BTCBOX returned an invalid withdrawal history page.", 502, "INVALID_WITHDRAWAL_HISTORY");
  }
  return payload;
}

export async function submitWithdrawal(input: {
  request_id: string;
  coin: string;
  network: string;
  amount: string;
  address: string;
  fund_password: string;
  expected_fee?: string;
  twofa_code?: string;
}): Promise<WithdrawalSubmissionResult> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/withdraw`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Withdrawal result is unconfirmed. Keep the same request ID and check your withdrawal history before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as (WithdrawalSubmissionResult & { ok?: boolean; need_login?: boolean; code?: string; msg?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.withdrawal_id !== "string" || typeof payload.status !== "string") {
    throw new ApiError(payload?.msg || "Withdrawal request was not confirmed. Check your withdrawal history before retrying.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return payload;
}

export async function getDepositAddress(coin: string, network: string, signal?: AbortSignal): Promise<string> {
  if (DEMO_PREVIEW_ACTIVE) rejectDemoFinancialAction();
  const normalizedCoin = coin.trim().toUpperCase();
  const normalizedNetwork = network.trim().toUpperCase();
  const supported: Record<string, string[]> = { BTC:["BTC"], ETH:["ERC20"], USDT:["TRC20","ERC20","BEP20"], SOL:["SOL"], BNB:["BEP20"], USDC:["ERC20"] };
  if (!supported[normalizedCoin]?.includes(normalizedNetwork)) throw new ApiError("Unsupported asset/network combination.", 400, "UNSUPPORTED_DEPOSIT_NETWORK");
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/deposit`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", signal,
      body: JSON.stringify({ coin: normalizedCoin, network: normalizedNetwork, amount: "0" }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Unable to reach BTCBOX deposit service.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; address?: string; msg?: string; code?: string; need_login?: boolean } | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.address !== "string" || !payload.address.trim()) {
    throw new ApiError(payload?.msg || "Deposit address is not available for this network.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return payload.address;
}


export interface AdminSession {
  user_id: string;
  status: "active";
  is_super_admin: boolean;
  permissions: string[];
}
export interface AdminUserRecord {
  uid: string;
  email: string;
  /** Supabase Auth UUID, populated only for Super Admin user-list responses. */
  admin_auth_user_id?: string;
  kyc_status?: string;
  kyc?: { status?: string };
  frozen: boolean;
  total_usdt?: string | number;
  balances?: Record<string, AccountBalance>;
  financial_balance_source?: "postgres_financial_ledger" | "legacy_state_retention_limited" | "unverified";
  deposit_history?: DepositRecord[];
  deposit_history_source?: "postgres_financial_ledger" | "legacy_state_retention_limited";
  withdrawal_history?: AdminUserWithdrawalRecord[];
  withdrawal_history_source?: "postgres_financial_ledger" | "legacy_state_retention_limited";
}
/** Expanded withdrawal shape used only in the authenticated admin user-detail view. */
export interface AdminUserWithdrawalRecord extends WithdrawalRecord {
  txid?: string;
  payout_reference?: string;
  paid_at?: string;
  reviewed_by?: string;
  freeze_operation_id?: string;
  review_operation_id?: string;
  payout_operation_id?: string;
}
export interface AdminWithdrawalRecord {
  id: string;
  uid: string;
  coin: string;
  amount: string;
  fee: string;
  settlement_asset?: string;
  settlement_amount?: string;
  conversion_rate?: string;
  network: string;
  address: string;
  status: string;
  time?: string;
  reviewed_at?: string | null;
  reviewed_by?: string;
  rejection_reason?: string;
  freeze_operation_id?: string;
  review_operation_id?: string;
  payout_operation_id?: string;
  payout_reference?: string;
  paid_at?: string | null;
}
export interface AdminMembershipRecord {
  user_id: string;
  status: "active" | "suspended" | "revoked";
  revision: number;
  created_at?: string;
  updated_at?: string;
  permissions: string[];
}
export type AdminMembershipAction = "provision" | "set_permissions" | "suspend" | "reactivate" | "revoke";
export interface AdminMembershipChangeResult { action: AdminMembershipAction; target_user_id: string; revision: number; status: string; permissions: string[]; replayed?: boolean; }

export interface AdminConfig {
  deposit_addresses: Record<string, string>;
  withdrawal_fees: Record<string, string>;
  withdrawal_networks: Record<string, string[]>;
  announcement: string;
}
export interface AdminPerpMarket {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  status: "trading" | "paused" | "open_only" | "liquidation_only";
  price_tick: string | number;
  quantity_step: string | number;
  min_quantity: string | number;
  min_notional: string | number;
  market_quantity_step: string | number;
  market_min_quantity: string | number;
  market_max_quantity?: string | number | null;
  max_quantity?: string | number | null;
  max_position_notional: string | number;
  max_leverage: number;
  maintenance_margin_rate: string | number;
  maker_fee_rate: string | number;
  taker_fee_rate: string | number;
  funding_interval_sec: number;
  funding_rate_cap: string | number;
  mark_price_stale_sec: number;
  circuit_breaker_deviation_pct: string | number;
  updated_at?: string;
}
export interface AdminSpotMarket {
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  price_tick: string | number;
  quantity_step: string | number;
  min_quantity: string | number;
  min_notional: string | number;
  min_limit_price?: string | number | null;
  max_limit_price?: string | number | null;
  maker_fee_rate?: string | number;
  taker_fee_rate?: string | number;
  updated_at?: string;
}
export interface SpotMarketPair {
  base_asset: string;
  quote_asset: "USDT";
  enabled: true;
  /** False when this pair is listed from a degraded public-only catalogue fallback. */
  trading_enabled?: boolean;
  price_tick: string;
  quantity_step: string;
  min_quantity: string;
  min_notional: string;
  min_limit_price: string | null;
  max_limit_price: string | null;
}
export interface AdminKycRecord {
  uid: string;
  email: string;
  name: string;
  id_type: string;
  status: string;
  submitted_at: string;
  document_url?: string;
  document_preview_error?: string;
  document_uploaded?: boolean;
}
export interface AdminAuditRecord {
  id: string;
  time: string;
  action: string;
  uid: string;
  by: string;
  detail: string;
  postgres_sync_status: string;
}
async function adminRequest<T>(token: string, path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!token || token.length < 20) throw new ApiError("Administrator Supabase session is missing.", 401, "ADMIN_AUTH_REQUIRED");
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/${path}`, {
      method: options.method || "GET",
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(options.body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError("Administrator request could not reach BTCBOX.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Administrator request was not accepted.", response.status, payload?.code);
  }
  return payload as T;
}
export async function getAdminSession(token: string, signal?: AbortSignal) {
  return adminRequest<AdminSession & { ok: true }>(token, "admin/session", { signal });
}
export async function getAdminMemberships(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; admins: AdminMembershipRecord[] }>(token, "admin/admins", { signal });
}
export async function manageAdminMembership(token: string, input: {
  target_user_id: string; expected_revision: number; action: AdminMembershipAction;
  permissions: string[]; reason: string; request_id: string;
}) {
  return adminRequest<{ ok: true; result: AdminMembershipChangeResult }>(token, "admin/admins/manage", { method: "POST", body: input });
}
export async function getAdminStats(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; total_users: number; pending_withdrawals: number; pending_admin_review_withdrawals: number; pending_kyc: number; deposit_addresses: Record<string, string>; announcement: string }>(token, "admin/stats", { signal });
}
export async function getAdminUsers(token: string, search = "", signal?: AbortSignal) {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return adminRequest<{ ok: true; users: AdminUserRecord[] }>(token, `admin/users${query}`, { signal });
}
export async function getAdminUser(token: string, uid: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; user: AdminUserRecord }>(token, `admin/user?uid=${encodeURIComponent(uid)}`, { signal });
}
export async function getAdminWithdrawals(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; withdrawals: AdminWithdrawalRecord[]; pending_count?: number; pending_admin_review_count?: number }>(token, "admin/withdrawals", { signal });
}
export async function getAdminConfig(token: string, signal?: AbortSignal) {
  return adminRequest<AdminConfig & { ok: true }>(token, "admin/config", { signal });
}
export async function getAdminSpotMarkets(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; markets: AdminSpotMarket[] }>(token, "admin/spot-markets", { signal });
}
export async function saveAdminSpotMarket(token: string, input: {
  base_asset: string; quote_asset: string; enabled: boolean;
  price_tick: string; quantity_step: string; min_quantity: string; min_notional: string;
  min_limit_price: string | null; max_limit_price: string | null;
  reason: string; request_id: string;
}) {
  return adminRequest<{ ok: true; market: AdminSpotMarket; replayed?: boolean }>(token, "admin/spot-markets", { method: "POST", body: input });
}
export async function getAdminPerpMarkets(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; markets: AdminPerpMarket[] }>(token, "admin/perpetual/markets", { signal });
}
export async function saveAdminPerpMarket(token: string, input: Omit<AdminPerpMarket, "symbol" | "updated_at"> & { base_asset: string; reason: string }) {
  return adminRequest<{ ok: true; symbol: string; enabled: boolean }>(token, "admin/perpetual/market", { method: "POST", body: input });
}

export interface AdminSecondsOpenPosition {
  position_id: string;
  user_id: string;
  symbol: string;
  direction: "up" | "down";
  amount: number | string;
  duration_sec: number;
  open_price: number | string;
  settle_at: number;
  created_at: number;
  payout_bps_snapshot: number | null;
  policy_version: number | null;
  overdue: boolean;
}
export interface AdminSecondsOpenPositionsSnapshot {
  generated_at: number;
  total_open_count: number;
  total_open_exposure: number | string;
  overdue_count: number;
  truncated: boolean;
  positions: AdminSecondsOpenPosition[];
}
export async function getAdminSecondsOpenPositions(token: string, signal?: AbortSignal) {
  const result = await adminRequest<{ ok: true } & AdminSecondsOpenPositionsSnapshot>(token, "admin/seconds-positions", { signal });
  if (!Number.isSafeInteger(result.generated_at) || result.generated_at <= 0 ||
      !Number.isSafeInteger(result.total_open_count) || result.total_open_count < 0 ||
      !Number.isSafeInteger(result.overdue_count) || result.overdue_count < 0 ||
      typeof result.truncated !== "boolean" || !Array.isArray(result.positions) ||
      !result.positions.every((item) =>
        item && typeof item.position_id === "string" &&
        /^SC[A-Fa-f0-9]{30}$/.test(item.position_id) &&
        typeof item.user_id === "string" &&
        ["BTC", "ETH", "SOL", "BNB"].includes(item.symbol) &&
        (item.direction === "up" || item.direction === "down") &&
        Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 &&
        Number.isSafeInteger(item.duration_sec) && item.duration_sec > 0 &&
        Number.isFinite(Number(item.open_price)) && Number(item.open_price) > 0 &&
        Number.isSafeInteger(item.settle_at) && Number.isSafeInteger(item.created_at) &&
        (item.payout_bps_snapshot === null || (Number.isSafeInteger(item.payout_bps_snapshot) && item.payout_bps_snapshot >= 8500)) &&
        (item.policy_version === null || (Number.isSafeInteger(item.policy_version) && item.policy_version > 0)) &&
        typeof item.overdue === "boolean"
      )) {
    throw new ApiError("BTCBOX returned an invalid open Seconds position queue.", 502, "INVALID_SECONDS_POSITIONS");
  }
  return result;
}
export async function getAdminSecondsPolicy(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; policy: SecondsPolicySnapshot }>(token, "admin/seconds-policy", { signal });
}
export async function saveAdminSecondsPolicy(token: string, input: {
  expected_policy_version: number; symbols: string[]; durations_sec: number[];
  min_stake: string; max_stake: string; payout_bps: number;
  per_user_open_exposure: string | null; max_open_positions_per_user: number | null; reason: string; request_id: string;
}) {
  return adminRequest<{ ok: true; policy: SecondsPolicySnapshot; replayed?: boolean }>(token, "admin/seconds-policy", { method: "POST", body: input });
}
export async function saveAdminConfig(token: string, config: AdminConfig) {
  return adminRequest<AdminConfig & { ok: true; audit_sync_pending?: boolean }>(token, "admin/config", { method: "POST", body: config });
}
export async function adminManualCredit(token: string, input: { uid: string; coin: string; amount: string; reference: string; note?: string; idempotency_key: string }) {
  return adminRequest<{ ok: true; duplicate?: boolean; balance?: AccountBalance; audit_sync_pending?: boolean }>(token, "admin/deposit/confirm", { method: "POST", body: input });
}
export async function adminAdjustBalance(token: string, input: {
  uid: string; coin: string; delta: string;
  mode: "adjust" | "freeze" | "unfreeze"; reason?: string; request_id: string;
}) {
  return adminRequest<{
    ok: true; msg?: string; duplicate?: boolean; operation_id?: string;
    balances?: Record<string, { free: string; frozen: string }>;
  }>(token, "admin/user/balance", { method: "POST", body: input });
}
export async function adminSetUserFrozen(token: string, input: { uid: string; frozen: boolean; reason: string }) {
  return adminRequest<{ ok: true; msg?: string; audit_sync_pending?: boolean }>(token, "admin/user/freeze", { method: "POST", body: input });
}
export async function adminResetUserPassword(token: string, input: { uid: string; new_password: string }) {
  return adminRequest<{ ok: true; msg?: string; audit_sync_pending?: boolean }>(token, "admin/user/reset-pwd", { method: "POST", body: input });
}
export async function adminResetUserEmail(token: string, input: { uid: string; new_email: string }) {
  return adminRequest<{ ok: true; msg?: string; audit_sync_pending?: boolean }>(token, "admin/user/reset-email", { method: "POST", body: input });
}
export async function adminApproveWithdrawal(token: string, id: string) {
  return adminRequest<{ ok: true; status: string; audit_sync_pending?: boolean }>(token, "admin/withdraw/approve", { method: "POST", body: { id } });
}
export async function adminRejectWithdrawal(token: string, id: string, reason: string) {
  return adminRequest<{ ok: true; status: string; audit_sync_pending?: boolean }>(token, "admin/withdraw/reject", { method: "POST", body: { id, reason } });
}
export async function adminMarkWithdrawalPaid(token: string, input: { id: string; reference: string; note?: string }) {
  return adminRequest<{ ok: true; status: string; duplicate: boolean; payout_reference: string; paid_at: string | null }>(token, "admin/withdraw/mark-paid", { method: "POST", body: input });
}
export async function getAdminKyc(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; kycs: AdminKycRecord[] }>(token, "admin/kyc", { signal });
}
export async function adminApproveKyc(token: string, uid: string, options: { admin_override?: boolean; reason?: string } = {}) {
  return adminRequest<{ ok: true; audit_sync_pending?: boolean; msg?: string }>(token, "admin/kyc/approve", { method: "POST", body: { uid, ...options } });
}
export async function adminRejectKyc(token: string, uid: string, reason: string) {
  return adminRequest<{ ok: true }>(token, "admin/kyc/reject", { method: "POST", body: { uid, reason } });
}
export async function getAdminAuditLogs(token: string, limit = 50, signal?: AbortSignal, before?: string | null) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set("before", before);
  return adminRequest<{ ok: true; logs: AdminAuditRecord[]; next_before?: string | null; source?: string; completeness?: string }>(token, `admin/audit-logs?${query.toString()}`, { signal });
}
export async function getAdminOrders(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; orders: OrderRecord[]; source?: string }>(token, "admin/orders", { signal });
}
export async function getAdminSupportMessages(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; messages: SupportMessage[] }>(token, "admin/support/messages", { signal });
}
export async function markAdminSupportRead(token: string, uid: string) {
  return adminRequest<{ ok: true; duplicate?: boolean; unread: number; audit_sync_pending?: boolean }>(token, "admin/support/read", { method: "POST", body: { uid } });
}
export async function getAdminAddresses(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; addresses: AdminPayoutAddress[] }>(token, "admin/addresses", { signal });
}
export async function manageAdminAddress(token: string, input: {
  id: string; action: "update" | "delete"; reason: string;
  account_holder?: string; bank_name?: string; account_number?: string; iban?: string;
  country?: string; routing_number?: string; swift?: string; bank_address?: string; note?: string;
}) {
  return adminRequest<{ ok: true; audit_sync_pending?: boolean; msg: string }>(token, "admin/address/manage", { method: "POST", body: input });
}
export async function getAdminSupportFaq(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; entries: AdminSupportFaqEntry[] }>(token, "admin/support/faq", { signal });
}
export async function saveAdminSupportFaq(token: string, input: { id?: string; question: string; answer: string; order: number; enabled: boolean }) {
  return adminRequest<{ ok: true; created: boolean; entry: AdminSupportFaqEntry; audit_sync_pending?: boolean }>(token, "admin/support/faq", {
    method: "POST",
    body: { ...input },
  });
}
export async function deleteAdminSupportFaq(token: string, id: string) {
  return adminRequest<{ ok: true; deleted: string; audit_sync_pending?: boolean }>(token, "admin/support/faq/delete", {
    method: "POST",
    body: { id },
  });
}
export async function adminReplySupport(token: string, uid: string, content: string, requestId: string) {
  return adminRequest<{ ok: true; duplicate?: boolean; message_id?: string; audit_sync_pending?: boolean }>(token, "admin/support/reply", {
    method: "POST",
    body: { uid, content, request_id: requestId },
  });
}

// ================= Perpetual contract (Contract product) client =================
// Endpoints: /api/perpetual/*. Field names mirror backend/supabase/sql/0041_perpetual_contract_v1.sql.
// Until the API-layer handlers are enabled these calls fail closed and the UI shows honest empty states.
export interface PerpMarket {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  status: "trading" | "paused" | "open_only" | "liquidation_only";
  max_leverage: number;
  price_tick: string;
  quantity_step: string;
  min_quantity: string;
  min_notional: string;
  market_quantity_step: string;
  market_min_quantity: string;
  market_max_quantity?: string | null;
  funding_interval_sec: number;
  funding_rate_cap: number;
  next_funding_at?: string | null;
  mark_price?: number | string | null;
  index_price?: number | string | null;
  mark_price_status?: "ok" | "degraded" | "stale" | "unavailable";
}
export interface PerpPosition {
  position_id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number | string;
  entry_price: number | string;
  mark_price?: number | string | null;
  liquidation_price?: number | string | null;
  isolated_margin: number | string;
  leverage?: number;
  unrealized_pnl?: number | string | null;
  realized_pnl: number | string;
  created_at?: string;
}
export interface PerpOrder {
  order_id: string;
  client_order_id?: string;
  symbol: string;
  type: "market" | "limit";
  side: "buy" | "sell";
  price?: number | string | null;
  quantity: number | string;
  filled_quantity?: number | string;
  status: string;
  leverage: number;
  reduce_only?: boolean;
  close_position?: boolean;
  created_at?: string;
}
export interface PerpTrade {
  trade_id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number | string;
  quantity: number | string;
  fee?: number | string;
  role?: "maker" | "taker";
  created_at?: string;
}
export interface PerpFundingRecord {
  symbol: string;
  funding_at: string;
  funding_rate: number | string | null;
  payment?: number | string;
  mark_price?: number | string | null;
}
export interface PerpOrderInput {
  symbol: string;
  type: "market" | "limit";
  side: "buy" | "sell";
  price?: string;
  quantity: string;
  leverage: number;
  reduceOnly?: boolean;
  closePosition?: boolean;
  clientOrderId: string;
}
export async function getPerpMarkets(signal?: AbortSignal): Promise<PerpMarket[]> {
  if (DEMO_PREVIEW_ACTIVE) return getDemoPerpMarkets();
  const payload = await readAuthenticated<{ ok: true; markets: PerpMarket[] }>("perpetual/markets", signal);
  if (!Array.isArray(payload.markets)) throw new ApiError("Perpetual market catalogue is unavailable.", 502, "INVALID_PERP_MARKETS");
  return payload.markets.filter((m) => m && typeof m.symbol === "string" && typeof m.max_leverage === "number");
}
export async function submitPerpOrder(input: PerpOrderInput): Promise<{ order_id: string; status: string; duplicate?: boolean }> {
  if (DEMO_PREVIEW_ACTIVE) return demoPlacePerpOrder(input);
  const body = {
    symbol: input.symbol, type: input.type, side: input.side, quantity: input.quantity,
    leverage: input.leverage, reduce_only: input.reduceOnly === true, close_position: input.closePosition === true,
    client_order_id: input.clientOrderId,
  };
  if (input.type === "limit") (body as { price?: string }).price = input.price;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/perpetual/order`, { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Perpetual order result is unconfirmed. Keep the same request ID and check order history before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as ({ ok?: boolean; order_id?: string; status?: string; duplicate?: boolean; msg?: string; code?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true || typeof payload.order_id !== "string") {
    throw new ApiError(payload?.msg || "Perpetual order was not accepted.", response.status, payload?.code || "PERP_ORDER_REJECTED");
  }
  return { order_id: payload.order_id, status: payload.status || "open", duplicate: payload.duplicate === true };
}
export async function cancelPerpOrder(input: { orderId: string; clientCancelId: string }): Promise<{ order_id: string; status: string; duplicate?: boolean }> {
  if (DEMO_PREVIEW_ACTIVE) return demoCancelPerpOrder(input.orderId);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/perpetual/order`, { method: "DELETE", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ order_id: input.orderId, client_cancel_id: input.clientCancelId }) });
  } catch {
    throw new ApiError("Perpetual cancel result is unconfirmed. Check open orders before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as ({ ok?: boolean; order_id?: string; status?: string; duplicate?: boolean; msg?: string; code?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true) throw new ApiError(payload?.msg || "Perpetual cancel was not accepted.", response.status, payload?.code || "PERP_CANCEL_REJECTED");
  return { order_id: payload.order_id || input.orderId, status: payload.status || "canceled", duplicate: payload.duplicate === true };
}
export async function closePerpPosition(input: { symbol: string; clientOrderId: string }): Promise<{ order_id: string; status: string; duplicate?: boolean }> {
  if (DEMO_PREVIEW_ACTIVE) return demoClosePerpPosition(input.symbol);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/perpetual/close-position`, { method: "POST", credentials: "include", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ symbol: input.symbol, client_order_id: input.clientOrderId }) });
  } catch {
    throw new ApiError("Perpetual close-position result is unconfirmed. Check positions before retrying.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as ({ ok?: boolean; order_id?: string; status?: string; duplicate?: boolean; msg?: string; code?: string }) | null;
  if (!response.ok || !payload || payload.ok !== true) throw new ApiError(payload?.msg || "Close-position request was not accepted.", response.status, payload?.code || "PERP_CLOSE_REJECTED");
  return { order_id: payload.order_id || "", status: payload.status || "accepted", duplicate: payload.duplicate === true };
}
type PerpOrderApiRow = Omit<PerpOrder, "order_id"> & { id: string; order_id?: string };
type PerpPositionApiRow = Omit<PerpPosition, "position_id" | "unrealized_pnl" | "liquidation_price"> & {
  id?: string; position_id?: string;
  unrealized_pnl?: number | string | null;
  liquidation_price?: number | string | null;
  unrealized_pnl_est?: number | string | null;
  liquidation_price_est?: number | string | null;
};
function normalizePerpOrder(row: PerpOrderApiRow): PerpOrder {
  if (!row || typeof (row.order_id || row.id) !== "string") {
    throw new ApiError("Perpetual order response contains an invalid order identifier.", 502, "INVALID_PERP_ORDER_ROW");
  }
  return { ...row, order_id: row.order_id || row.id };
}
export async function getPerpOpenOrders(signal?: AbortSignal): Promise<PerpOrder[]> {
  if (DEMO_PREVIEW_ACTIVE) return demoLedgerPerpOpenOrders();
  const payload = await readAuthenticated<{ ok: true; orders?: PerpOrderApiRow[]; open?: PerpOrderApiRow[] }>("perpetual/orders", signal);
  const rows = payload.open ?? payload.orders;
  if (!Array.isArray(rows)) throw new ApiError("Perpetual open orders are unavailable.", 502, "INVALID_PERP_ORDERS");
  return rows.map(normalizePerpOrder);
}
export async function getPerpOrderHistory(signal?: AbortSignal): Promise<PerpOrder[]> {
  if (DEMO_PREVIEW_ACTIVE) return demoLedgerPerpOrderHistory();
  const payload = await readAuthenticated<{ ok: true; orders?: PerpOrderApiRow[]; history?: PerpOrderApiRow[] }>("perpetual/orders", signal);
  const rows = payload.history ?? payload.orders;
  if (!Array.isArray(rows)) throw new ApiError("Perpetual order history is unavailable.", 502, "INVALID_PERP_ORDER_HISTORY");
  return rows.map(normalizePerpOrder);
}
export async function getPerpPositions(signal?: AbortSignal): Promise<PerpPosition[]> {
  if (DEMO_PREVIEW_ACTIVE) return demoLedgerPerpPositions();
  const payload = await readAuthenticated<{ ok: true; positions: PerpPositionApiRow[] }>("perpetual/positions", signal);
  if (!Array.isArray(payload.positions)) throw new ApiError("Perpetual positions are unavailable.", 502, "INVALID_PERP_POSITIONS");
  return payload.positions.map((row) => {
    const positionId = row.position_id || row.id;
    if (!positionId) throw new ApiError("Perpetual position response is missing its identifier.", 502, "INVALID_PERP_POSITION_ID");
    return {
      ...row,
      position_id: positionId,
      unrealized_pnl: row.unrealized_pnl ?? row.unrealized_pnl_est ?? null,
      liquidation_price: row.liquidation_price ?? row.liquidation_price_est ?? null,
    };
  });
}
export async function getPerpTrades(symbol: string, signal?: AbortSignal): Promise<PerpTrade[]> {
  if (DEMO_PREVIEW_ACTIVE) return demoLedgerPerpTrades();
  const query = new URLSearchParams({ symbol });
  const payload = await readAuthenticated<{ ok: true; trades: PerpTrade[] }>(`perpetual/trades?${query.toString()}`, signal);
  if (!Array.isArray(payload.trades)) throw new ApiError("Perpetual trade history is unavailable.", 502, "INVALID_PERP_TRADES");
  return payload.trades.filter((trade) => trade.symbol === symbol);
}
export async function getPerpFundingHistory(symbol: string, signal?: AbortSignal): Promise<PerpFundingRecord[]> {
  if (DEMO_PREVIEW_ACTIVE) return [];
  const payload = await readAuthenticated<{
    ok: true;
    funding?: PerpFundingRecord[];
    history?: Array<{ symbol: string; funding_at: string; payment_delta: number | string }>;
    rates?: Array<{ symbol: string; funding_at: string; rate: number | string; mark_price?: number | string | null }>;
  }>("perpetual/funding", signal);
  if (Array.isArray(payload.funding)) return payload.funding.filter((row) => row.symbol === symbol);
  if (!Array.isArray(payload.history) || !Array.isArray(payload.rates)) {
    throw new ApiError("Perpetual funding history is unavailable.", 502, "INVALID_PERP_FUNDING");
  }
  const rates = new Map(payload.rates.map((row) => [`${row.symbol}:${row.funding_at}`, row]));
  return payload.history.filter((row) => row.symbol === symbol).map((row) => {
    const rate = rates.get(`${row.symbol}:${row.funding_at}`);
    return {
      symbol: row.symbol,
      funding_at: row.funding_at,
      funding_rate: rate?.rate ?? null,
      payment: row.payment_delta,
      mark_price: rate?.mark_price ?? null,
    };
  });
}
