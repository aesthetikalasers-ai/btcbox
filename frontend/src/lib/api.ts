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
