import type { MarketCandle, MarketTicker } from "./api";

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
const POLL_INTERVAL_MS = 3_000;
/** A server snapshot older than this is never presented as live. */
const STALE_AFTER_MS = 90_000;
/** Small allowance for server/browser clock skew; larger future timestamps are invalid. */
const FUTURE_CLOCK_SKEW_SECONDS = 30;

/** Internal shape of a quote already received from the backend. */
interface MarketMemoryRow {
  sym: string;
  name: string;
  price: number;
  chg: number;
  high: number;
  low: number;
  vol: string;
  source: string;
  snapshotTs?: number;
  providerTs?: number | null;
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


// Maintain the latest validated backend snapshot in memory; never synthesize movement.
class LiveMarketEngine {
  private prices: Map<string, MarketMemoryRow> = new Map();
  private listeners: Set<() => void> = new Set();
  /** Snapshot time supplied by the backend; polling success alone never makes quotes live. */
  private lastSnapshotTs: number | null = null;
  private lastNotifiedStatus: MarketStatus = "unavailable";
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
   * Data-source state, derived from backend-supplied snapshot timestamps.
   * A successful HTTP poll carrying an old cached response is not fresh market data.
   */
  public getStatus(): MarketStatus {
    if (this.prices.size === 0 || this.lastSnapshotTs === null) return "unavailable";
    const nowSeconds = Date.now() / 1000;
    const staleAfterSeconds = STALE_AFTER_MS / 1000;
    const hasInvalidOrStaleQuote = Array.from(this.prices.values()).some((item) => (
      !Number.isFinite(item.snapshotTs) ||
      !item.snapshotTs ||
      item.snapshotTs > nowSeconds + FUTURE_CLOCK_SKEW_SECONDS ||
      nowSeconds - item.snapshotTs > staleAfterSeconds
    ));
    return hasInvalidOrStaleQuote ? "stale" : "live";
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
    const previousStatus = this.getStatus();
    if (previousStatus !== this.lastNotifiedStatus) this.notify();
    try {
      const response = await fetch(`${API_BASE_PATH}/market`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        markets?: MarketTicker[];
        data?: Record<string, { ts?: number; providerTs?: number | null; source?: string }>;
      } | null;
      if (!payload || payload.ok !== true || !Array.isArray(payload.markets)) return;

      // An explicitly empty, successful catalogue means there are no enabled
      // markets. Clear old quotes immediately instead of presenting them as live.
      if (payload.markets.length === 0) {
        const hadData = this.prices.size > 0 || this.lastSnapshotTs !== null;
        this.prices.clear();
        this.lastSnapshotTs = null;
        this.tickersSnapshot = null;
        if (hadData) this.notify();
        return;
      }

      const next = new Map<string, MarketMemoryRow>();
      let changed = false;
      let invalidSnapshot = false;
      for (const ticker of payload.markets) {
        if (!ticker || typeof ticker.sym !== "string") continue;
        const sym = ticker.sym.replace(/USDT$/, "").toUpperCase();
        const price = Number(ticker.price);
        const chg = Number(ticker.chg);
        const high = Number(ticker.high);
        const low = Number(ticker.low);
        const volume = Number(ticker.vol);
        if (
          !sym ||
          !Number.isFinite(price) || price <= 0 ||
          !Number.isFinite(chg) ||
          !Number.isFinite(high) || high <= 0 ||
          !Number.isFinite(low) || low <= 0 ||
          !Number.isFinite(volume) || volume < 0
        ) continue;

        const existing = this.prices.get(sym);
        const provenance = payload.data?.[ticker.sym] ?? payload.data?.[`${sym}USDT`];
        const snapshotTs = Number(provenance?.ts);
        const nowSeconds = Date.now() / 1000;
        // Require a real server timestamp and reject stale/future cached payloads.
        // Do not refresh freshness from the browser receipt time.
        if (
          !Number.isFinite(snapshotTs) ||
          snapshotTs <= 0 ||
          snapshotTs > nowSeconds + FUTURE_CLOCK_SKEW_SECONDS ||
          nowSeconds - snapshotTs > STALE_AFTER_MS / 1000
        ) {
          invalidSnapshot = true;
          continue;
        }
        const providerTs = Number.isFinite(provenance?.providerTs) && Number(provenance?.providerTs) > 0
          ? Number(provenance?.providerTs)
          : null;
        const source = typeof provenance?.source === "string"
          ? provenance.source
          : typeof ticker.source === "string" ? ticker.source : "backend";
        const row: MarketMemoryRow = {
          sym,
          name: existing?.name ?? sym,
          price,
          chg,
          high,
          low,
          vol: String(ticker.vol),
          source,
          snapshotTs,
          providerTs,
        };
        next.set(sym, row);
        if (
          !existing ||
          existing.price !== row.price ||
          existing.chg !== row.chg ||
          existing.high !== row.high ||
          existing.low !== row.low ||
          existing.vol !== row.vol ||
          existing.source !== row.source ||
          existing.snapshotTs !== row.snapshotTs ||
          existing.providerTs !== row.providerTs
        ) changed = true;
      }
      if (invalidSnapshot || next.size === 0) return;
      if (next.size !== this.prices.size) changed = true;
      if (next.size === 0) return;
      this.prices = next;
      this.lastSnapshotTs = Math.max(...Array.from(next.values(), (item) => item.snapshotTs || 0));
      this.tickersSnapshot = null;
      if (changed || previousStatus !== this.getStatus()) this.notify();
    } catch {
      // Keep the last known values; getStatus() reports them as stale/unavailable.
    }
  }

  private notify() {
    // 数据已变化：先作废快照缓存，再通知订阅者。这样订阅方重新读取时
    // 会拿到一个新引用（内容确实变了），而在两次变化之间引用保持稳定。
    this.tickersSnapshot = null;
    this.lastNotifiedStatus = this.getStatus();
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
    return {
      sym: item.sym,
      price: item.price,
      chg: item.chg,
      high: item.high,
      low: item.low,
      vol: item.vol,
      source: item.source,
      snapshotTs: item.snapshotTs,
      providerTs: item.providerTs,
    };
  }

  public getAllTickers(): MarketTicker[] {
    // 返回缓存引用：只有当 notify() 作废缓存后才会重建数组。
    // 这是 useSyncExternalStore 的 getSnapshot 契约要求（同一数据必须同一引用）。
    if (this.tickersSnapshot) return this.tickersSnapshot;

    this.tickersSnapshot = Array.from(this.prices.values()).map((item) => ({
      sym: item.sym,
      price: item.price,
      chg: item.chg,
      high: item.high,
      low: item.low,
      vol: item.vol,
      source: item.source,
      snapshotTs: item.snapshotTs,
      providerTs: item.providerTs,
    }));
    return this.tickersSnapshot;
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
