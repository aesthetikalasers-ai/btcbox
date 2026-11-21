import type { MarketCandle, MarketTicker, OrderBookSnapshot, SpotMarketPair } from "./api";

/**
 * Data-source state for the live market engine.
 *
 * There is deliberately no "simulated" state: the engine never invents a price.
 * If the backend cannot be reached the last known quote is kept and reported as
 * stale, and a page that never received data reports it as unavailable.
 */
export type MarketStatus = "live" | "stale" | "unavailable";

/**
 * API prefix for the live market engine.
 *
 * Same-origin `/api` in production. In a split-origin preview (frontend on 4175,
 * market gateway on 8080) it must follow `VITE_API_BASE_URL`, otherwise this
 * engine silently polls a path the dev server does not serve, every ticker stays
 * empty, and the trade headers lose their 24h change with no visible error.
 */
const API_BASE_PATH = (import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "")) || "/api";
/** How often the engine refreshes its snapshot from /api/market. */
const POLL_INTERVAL_MS = 10_000;
/** A snapshot older than this is reported as stale rather than live. */
const STALE_AFTER_MS = 45_000;

/** Internal shape of a quote already received from the backend. */
interface MarketMemoryRow {
  sym: string;
  name: string;
  price: number;
  chg: number;
  high: number;
  low: number;
  vol: string;
}

export const ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  SUI: "Sui",
  NEAR: "NEAR Protocol",
  LINK: "Chainlink",
  DOT: "Polkadot",
  LTC: "Litecoin",
  MATIC: "Polygon",
  UNI: "Uniswap",
  TRX: "TRON",
  BCH: "Bitcoin Cash",
  ATOM: "Cosmos",
  ETC: "Ethereum Classic",
  USDC: "USD Coin",
  USDT: "Tether USD",
  PEPE: "Pepe",
};

export const getAssetName = (sym: string): string => {
  const base = sym.replace(/USDT$/, "");
  return ASSET_NAMES[base] || ASSET_NAMES[sym] || base;
};


// 内存中维持最新价格状态，并产生平滑的高频跳动
class LiveMarketEngine {
  private prices: Map<string, MarketMemoryRow> = new Map();
  private listeners: Set<() => void> = new Set();
  /** Timestamp of the last successful backend snapshot; null until one arrives. */
  private lastFetchAt: number | null = null;
  /** Provider the backend reported (coinbase / bybit), for provenance display. */
  private lastProviderSource = "";
  private pollTimer: number | null = null;

  // React 的 useSyncExternalStore 要求 getSnapshot 在数据未变化时返回同一个引用，
  // 否则每次读取都会生成新数组，触发 "getSnapshot should be cached" 并导致无限重渲染。
  // 因此这里缓存一份快照，仅在 notify()（数据真正变化）时失效重建。
  private tickersSnapshot: MarketTicker[] | null = null;

  constructor() {
    // Nothing is fabricated here. Prices stay empty until the backend answers:
    // a placeholder quote is worse than no quote, because a visitor would then
    // see a number that disagrees with the market and with /api/market.
    this.startBackendPolling();
  }

  /**
   * Data-source state, derived purely from how old the last backend answer is.
   *  - live:        a snapshot arrived within the freshness window
   *  - stale:       the last snapshot is older than the freshness window
   *  - unavailable: the backend has not answered since page load
   */
  public getStatus(): MarketStatus {
    if (this.lastFetchAt === null) return "unavailable";
    return Date.now() - this.lastFetchAt > STALE_AFTER_MS ? "stale" : "live";
  }

  /**
   * The single source of truth is the exchange's own /api/market snapshot, which
   * the backend fills from its provider chain (Coinbase / Bybit).
   *
   * The browser deliberately does not call a third-party exchange directly: that
   * path is blocked by the deployed CSP, is unavailable in some regions, and
   * produced quotes that disagreed with the rest of the site.
   */
  private startBackendPolling() {
    if (typeof window === "undefined") return;
    void this.refreshFromBackend();
    this.pollTimer = window.setInterval(() => { void this.refreshFromBackend(); }, POLL_INTERVAL_MS);
  }

  private async refreshFromBackend() {
    try {
      const response = await fetch(`${API_BASE_PATH}/market`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; markets?: MarketTicker[] } | null;
      if (!payload || payload.ok !== true || !Array.isArray(payload.markets) || payload.markets.length === 0) return;

      let changed = false;
      for (const ticker of payload.markets) {
        if (!ticker || !ticker.sym) continue;
        const sym = String(ticker.sym).replace("USDT", "").toUpperCase();
        const price = Number(ticker.price);
        if (!Number.isFinite(price) || price <= 0) continue;
        const existing = this.prices.get(sym);
        if (ticker.source) this.lastProviderSource = String(ticker.source);
        if (existing && existing.price === price && existing.chg === Number(ticker.chg)) continue;
        changed = true;
        this.prices.set(sym, {
          sym,
          name: existing ? existing.name : sym,
          price,
          chg: Number(ticker.chg) || 0,
          high: Number(ticker.high) || price,
          low: Number(ticker.low) || price,
          vol: String(ticker.vol ?? "0"),
        });
      }
      this.lastFetchAt = Date.now();
      if (changed) this.notify();
      else this.tickersSnapshot = null;
    } catch {
      // Keep the last known values; getStatus() reports them as stale/unavailable.
    }
  }

  private notify() {
    // 数据已变化：先作废快照缓存，再通知订阅者。这样订阅方重新读取时
    // 会拿到一个新引用（内容确实变了），而在两次变化之间引用保持稳定。
    this.tickersSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }

  public subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public getTicker(sym: string): MarketTicker | null {
    const cleanSym = sym.replace("USDT", "").toUpperCase();
    const item = this.prices.get(cleanSym);
    if (!item) return null;
    const now = Math.floor(Date.now() / 1000);
    return {
      sym: item.sym,
      price: item.price,
      chg: item.chg,
      high: item.high,
      low: item.low,
      vol: item.vol,
      source: this.lastProviderSource || "backend",
      snapshotTs: now,
      providerTs: this.lastFetchAt ? Math.floor(this.lastFetchAt / 1000) : now,
    };
  }

  public getAllTickers(): MarketTicker[] {
    // 返回缓存引用：只有当 notify() 作废缓存后才会重建数组。
    // 这是 useSyncExternalStore 的 getSnapshot 契约要求（同一数据必须同一引用）。
    if (this.tickersSnapshot) return this.tickersSnapshot;

    const now = Math.floor(Date.now() / 1000);
    this.tickersSnapshot = Array.from(this.prices.values()).map((item) => ({
      sym: item.sym,
      price: item.price,
      chg: item.chg,
      high: item.high,
      low: item.low,
      vol: item.vol,
      source: this.lastProviderSource || "backend",
      snapshotTs: now,
      providerTs: this.lastFetchAt ? Math.floor(this.lastFetchAt / 1000) : now,
    }));
    return this.tickersSnapshot;
  }

  public getSpotMarketPairs(): SpotMarketPair[] {
    return Array.from(this.prices.values()).map(({ sym }) => ({
      base_asset: sym,
      quote_asset: "USDT",
      enabled: true,
      price_tick: sym === "PEPE" ? "0.000001" : sym === "XRP" || sym === "DOGE" || sym === "MATIC" || sym === "TRX" ? "0.0001" : "0.01",
      quantity_step: "0.0001",
      min_quantity: "0.0001",
      min_notional: "5",
      min_limit_price: null,
      max_limit_price: null,
    }));
  }

  /**
   * Chart candles are never synthesised here. They come from GET /api/kline,
   * which serves the provider chain, so the numbers on a chart always match the
   * numbers in the order book. Kept only for API compatibility.
   */
  public getKlines(_symbol: string, _interval = "1h"): MarketCandle[] {
    return [];
  }
}

export const liveMarketEngine = new LiveMarketEngine();
