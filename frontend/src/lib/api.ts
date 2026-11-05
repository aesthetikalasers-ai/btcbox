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

export async function getOrders(signal?: AbortSignal): Promise<OrderRecord[]> {
  const payload = await readAuthenticated<{ ok: true; orders: OrderRecord[] }>("orders", signal);
  if (!Array.isArray(payload.orders)) {
    throw new ApiError("BTCBOX returned an invalid order response.", 502, "INVALID_ORDER_RESPONSE");
  }
  return payload.orders;
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
