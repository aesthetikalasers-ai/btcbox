export interface MarketTicker {
  sym: string;
  price: number;
  chg: number;
  high: number;
  low: number;
  vol: string;
  source: string;
}

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketResponse {
  ok: boolean;
  markets?: MarketTicker[];
  msg?: string;
  code?: string;
}

interface KlineResponse {
  ok: boolean;
  klines?: MarketCandle[];
  msg?: string;
  code?: string;
}

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
const API_BASE_URL = configuredBase || "/api";

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

export async function getMarkets(signal?: AbortSignal): Promise<MarketTicker[]> {
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
    throw new ApiError("Unable to reach BTCBOX services. Please try again.", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => null)) as MarketResponse | null;
  if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.markets)) {
    throw new ApiError(
      payload?.msg || "BTCBOX market data is temporarily unavailable.",
      response.status,
      payload?.code,
    );
  }

  return payload.markets.filter((item) =>
    item &&
    typeof item.sym === "string" &&
    Number.isFinite(item.price) && item.price > 0 &&
    Number.isFinite(item.chg) &&
    Number.isFinite(item.high) && item.high > 0 &&
    Number.isFinite(item.low) && item.low > 0 &&
    typeof item.vol === "string"
  );
}

export async function getKlines(
  symbol = "BTCUSDT",
  interval = "1h",
  signal?: AbortSignal,
): Promise<MarketCandle[]> {
  const query = new URLSearchParams({ symbol, interval });
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/kline?${query.toString()}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Unable to reach BTCBOX chart service.", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => null)) as KlineResponse | null;
  if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.klines)) {
    throw new ApiError(payload?.msg || "Historical market data is unavailable.", response.status, payload?.code);
  }

  return payload.klines.filter((candle) =>
    candle &&
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) && candle.open > 0 &&
    Number.isFinite(candle.high) && candle.high > 0 &&
    Number.isFinite(candle.low) && candle.low > 0 &&
    Number.isFinite(candle.close) && candle.close > 0 &&
    Number.isFinite(candle.volume) && candle.volume >= 0
  );
}


export interface AccountBalance {
  free: number | string;
  frozen: number | string;
  usdt?: number | string;
  valuation_available?: boolean;
}

export interface WithdrawalRecord {
  id: string;
  coin: string;
  amount: number | string;
  fee?: number | string;
  network?: string;
  address?: string;
  status: string;
  time?: string;
  txid?: string;
  payout_reference?: string;
  paid_at?: string;
}

export interface WithdrawalRecord {
  id: string;
  coin: string;
  amount: number | string;
  fee?: number | string;
  network?: string;
  address?: string;
  status: string;
  time?: string;
  txid?: string;
  payout_reference?: string;
  paid_at?: string;
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
  kyc: { status: string; name?: string; id_type?: string; id_number?: string };
  twofa_enabled: boolean;
  earn_records?: EarnPosition[];
  withdrawals?: WithdrawalRecord[];
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
}

async function readAuthenticated<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/${path}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
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
}

export async function getAccount(signal?: AbortSignal): Promise<AccountSnapshot> {
  const payload = await readAuthenticated<AccountSnapshot & { ok: true }>("account", signal);
  if (!payload.balances || typeof payload.balances !== "object" || !Array.isArray(payload.unpriced_assets)) {
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
    [30, 60, 300, 900].includes(Number(item.duration_sec)) &&
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
      !policy.durations_sec.every((duration) => [30, 60, 300, 900].includes(duration)) ||
      !Number.isFinite(Number(policy.min_stake)) || Number(policy.min_stake) <= 0 ||
      !Number.isFinite(Number(policy.max_stake)) || Number(policy.max_stake) < Number(policy.min_stake) ||
      !Number.isSafeInteger(policy.payout_bps) || policy.payout_bps < 8500 ||
      (policy.per_user_open_exposure !== null && (!Number.isFinite(Number(policy.per_user_open_exposure)) || Number(policy.per_user_open_exposure) <= 0)) ||
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
      ![30, 60, 300, 900].includes(payload.duration_sec) ||
      !Number.isFinite(payload.open_price) || payload.open_price <= 0 ||
      !Number.isSafeInteger(payload.settle_at) || payload.settle_at <= 0) {
    throw new ApiError(payload?.msg || "Order was not confirmed. Check open positions before retrying.", payload?.need_login ? 401 : response.status, payload?.code);
  }
  return payload;
}

export async function settleSecondsPosition(input: { position_id: string; symbol: string; request_id: string }): Promise<{ settled: boolean; duplicate: boolean }> {
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
}

export async function getAuthClientConfig(signal?: AbortSignal): Promise<AuthClientConfig> {
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
    throw new ApiError(payload?.msg || "Google sign-in is not configured.", response.status, payload?.code);
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

export interface SupportMessage {
  id: string;
  from: "user" | "admin";
  content: string;
  time: string;
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

export async function sendSupportMessage(content: string): Promise<void> {
  const normalized = content.trim();
  if (!normalized || normalized.length > 2000) {
    throw new ApiError("Messages must contain 1–2,000 characters.", 400, "INVALID_SUPPORT_MESSAGE");
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/support/chat`, {
      method: "POST", credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      cache: "no-store", body: JSON.stringify({ content: normalized }),
    });
  } catch {
    throw new ApiError("Unable to reach BTCBOX support. Please try again.", 0, "NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; msg?: string; code?: string; need_login?: boolean } | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new ApiError(payload?.msg || "Your message could not be sent.", payload?.need_login ? 401 : response.status, payload?.code);
  }
}


export interface SavedCryptoAddress {
  id: string; type: "crypto"; coin: string; network: string; address: string;
  note?: string; created_at?: string; flagged?: boolean; blocked?: boolean; unbound?: boolean;
}
export async function getSavedCryptoAddresses(signal?: AbortSignal): Promise<SavedCryptoAddress[]> {
  const payload = await readAuthenticated<{ ok: true; addresses: SavedCryptoAddress[] }>("addresses", signal);
  if (!Array.isArray(payload.addresses)) throw new ApiError("BTCBOX returned an invalid address book.", 502, "INVALID_ADDRESS_BOOK");
  return payload.addresses.filter((item) => item && item.type === "crypto" &&
    typeof item.id === "string" && typeof item.coin === "string" &&
    typeof item.network === "string" && typeof item.address === "string")
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
}

export interface WithdrawalSubmissionResult {
  withdrawal_id: string;
  status: string;
  require_admin_review: boolean;
  duplicate: boolean;
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

export async function submitWithdrawal(input: {
  request_id: string;
  coin: string;
  network: string;
  amount: string;
  address: string;
  fund_password: string;
  twofa_code?: string;
}): Promise<WithdrawalSubmissionResult> {
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
  kyc_status?: string;
  kyc?: { status?: string };
  frozen: boolean;
  total_usdt?: string | number;
  balances?: Record<string, AccountBalance>;
}
export interface AdminWithdrawalRecord {
  id: string;
  uid: string;
  coin: string;
  amount: string;
  fee: string;
  network: string;
  address: string;
  status: string;
  payout_reference?: string;
  paid_at?: string | null;
}
export interface AdminConfig {
  deposit_addresses: Record<string, string>;
  announcement: string;
}
export interface AdminKycRecord {
  uid: string;
  email: string;
  name: string;
  id_type: string;
  status: string;
  submitted_at: string;
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
export async function saveAdminConfig(token: string, config: AdminConfig) {
  return adminRequest<AdminConfig & { ok: true; audit_sync_pending?: boolean }>(token, "admin/config", { method: "POST", body: config });
}
export async function adminManualCredit(token: string, input: { uid: string; coin: string; amount: string; reference?: string; note?: string; idempotency_key: string }) {
  return adminRequest<{ ok: true; duplicate?: boolean; balance?: AccountBalance; audit_sync_pending?: boolean }>(token, "admin/deposit/confirm", { method: "POST", body: input });
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
export async function adminApproveKyc(token: string, uid: string, reason = "") {
  return adminRequest<{ ok: true }>(token, "admin/kyc/approve", { method: "POST", body: { uid, reason } });
}
export async function adminRejectKyc(token: string, uid: string, reason: string) {
  return adminRequest<{ ok: true }>(token, "admin/kyc/reject", { method: "POST", body: { uid, reason } });
}
export async function getAdminAuditLogs(token: string, limit = 50, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: String(limit) });
  return adminRequest<{ ok: true; logs: AdminAuditRecord[]; next_before?: string | null; source?: string; completeness?: string }>(token, `admin/audit-logs?${query.toString()}`, { signal });
}
export async function getAdminOrders(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; orders: OrderRecord[]; source?: string }>(token, "admin/orders", { signal });
}
export async function getAdminSupportMessages(token: string, signal?: AbortSignal) {
  return adminRequest<{ ok: true; messages: SupportMessage[] }>(token, "admin/support/messages", { signal });
}
export async function adminReplySupport(token: string, uid: string, content: string) {
  return adminRequest<{ ok: true }>(token, "admin/support/reply", { method: "POST", body: { uid, content } });
}
