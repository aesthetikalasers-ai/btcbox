import type { MarketCandle, MarketTicker, OrderBookSnapshot, SpotMarketPair } from "./api";

// 初始种子价格与数据（基于主流市场基准，保证离线及无后端时秒开）
export interface MockSeed {
  sym: string;
  name: string;
  price: number;
  chg: number;
  high: number;
  low: number;
  vol: string;
}

export const INITIAL_SEEDS: MockSeed[] = [
  { sym: "BTC", name: "Bitcoin", price: 88450.25, chg: 2.45, high: 89800.0, low: 86900.0, vol: "2485600000" },
  { sym: "ETH", name: "Ethereum", price: 3120.8, chg: 3.18, high: 3185.5, low: 3010.2, vol: "1150400000" },
  { sym: "SOL", name: "Solana", price: 214.65, chg: -1.24, high: 221.4, low: 208.5, vol: "682300000" },
  { sym: "BNB", name: "BNB", price: 635.4, chg: 0.82, high: 642.0, low: 628.5, vol: "320100000" },
  { sym: "XRP", name: "XRP", price: 0.7245, chg: 5.42, high: 0.748, low: 0.685, vol: "415000000" },
  { sym: "DOGE", name: "Dogecoin", price: 0.1842, chg: -2.15, high: 0.1925, low: 0.179, vol: "210000000" },
  { sym: "ADA", name: "Cardano", price: 0.584, chg: 1.65, high: 0.602, low: 0.571, vol: "142000000" },
  { sym: "AVAX", name: "Avalanche", price: 34.85, chg: 4.12, high: 36.2, low: 33.1, vol: "185000000" },
  { sym: "SUI", name: "Sui", price: 3.28, chg: 7.85, high: 3.42, low: 3.01, vol: "275000000" },
  { sym: "NEAR", name: "NEAR Protocol", price: 5.62, chg: -0.45, high: 5.85, low: 5.48, vol: "98000000" },
  { sym: "LINK", name: "Chainlink", price: 14.5, chg: 2.1, high: 14.95, low: 14.1, vol: "85000000" },
  { sym: "DOT", name: "Polkadot", price: 6.82, chg: 3.44, high: 7.05, low: 6.58, vol: "124000000" },
  { sym: "LTC", name: "Litecoin", price: 84.3, chg: -1.12, high: 86.1, low: 82.4, vol: "96000000" },
  { sym: "MATIC", name: "Polygon", price: 0.412, chg: 2.9, high: 0.428, low: 0.398, vol: "138000000" },
  { sym: "UNI", name: "Uniswap", price: 11.85, chg: 5.6, high: 12.3, low: 11.2, vol: "72000000" },
  { sym: "TRX", name: "TRON", price: 0.134, chg: 0.75, high: 0.137, low: 0.131, vol: "155000000" },
  { sym: "BCH", name: "Bitcoin Cash", price: 425.6, chg: -0.88, high: 432.0, low: 418.5, vol: "58000000" },
  { sym: "ATOM", name: "Cosmos", price: 8.94, chg: 1.95, high: 9.12, low: 8.71, vol: "47000000" },
  { sym: "ETC", name: "Ethereum Classic", price: 24.15, chg: -1.65, high: 24.8, low: 23.6, vol: "52000000" },
  { sym: "USDC", name: "USD Coin", price: 1.0001, chg: 0.01, high: 1.0003, low: 0.9998, vol: "520000000" },
  { sym: "PEPE", name: "Pepe", price: 0.0000185, chg: 11.4, high: 0.0000198, low: 0.0000165, vol: "380000000" },
];

// 内存中维持最新价格状态，并产生平滑的高频跳动
class LiveMarketEngine {
  private prices: Map<string, MockSeed> = new Map();
  private listeners: Set<() => void> = new Set();
  private wsConnected = false;
  private wsTimeoutId: number | null = null;

  // React 的 useSyncExternalStore 要求 getSnapshot 在数据未变化时返回同一个引用，
  // 否则每次读取都会生成新数组，触发 "getSnapshot should be cached" 并导致无限重渲染。
  // 因此这里缓存一份快照，仅在 notify()（数据真正变化）时失效重建。
  private tickersSnapshot: MarketTicker[] | null = null;

  constructor() {
    INITIAL_SEEDS.forEach((s) => this.prices.set(s.sym, { ...s }));
    this.startSimulation();
    this.tryBinanceWebSocket();
  }

  /** 当前数据源模式："live"（Binance 直连）或 "simulated"（模拟高频引擎）。 */
  public getStatus(): "live" | "simulated" {
    return this.wsConnected ? "live" : "simulated";
  }

  // 尝试直连 Binance 公共行情 WebSocket，3 秒超时后无缝降级为模拟高频引擎
  private tryBinanceWebSocket() {
    if (typeof window === "undefined") return;
    try {
      const symbols = ["btcusdt", "ethusdt", "solusdt", "bnbusdt", "xrpusdt", "dogeusdt", "adausdt", "avaxusdt", "suiusdt", "nearusdt", "linkusdt", "dotusdt", "ltcusdt", "maticusdt", "uniusdt", "trxusdt", "bchusdt", "atomusdt", "etcusdt", "usdcusdt", "pepeusdt"];
      const streams = symbols.map((s) => `${s}@ticker`).join("/");
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streams}`);

      // 3 秒连接超时：网络被阻断或离线时立即进入模拟模式，不弹出任何错误
      this.wsTimeoutId = window.setTimeout(() => {
        if (!this.wsConnected) {
          try { ws.close(); } catch { /* noop */ }
          this.wsConnected = false;
          this.notify();
        }
      }, 3000);

      ws.onopen = () => {
        if (this.wsTimeoutId !== null) { window.clearTimeout(this.wsTimeoutId); this.wsTimeoutId = null; }
        this.wsConnected = true;
        this.notify();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.s) {
            const sym = data.s.replace("USDT", "").toUpperCase();
            const current = this.prices.get(sym);
            if (current) {
              const p = parseFloat(data.c);
              const chg = parseFloat(data.P);
              const h = parseFloat(data.h);
              const l = parseFloat(data.l);
              const v = parseFloat(data.q).toFixed(0);
              if (Number.isFinite(p) && p > 0) {
                current.price = p;
                current.chg = chg;
                current.high = h;
                current.low = l;
                current.vol = v;
                this.notify();
              }
            }
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onerror = () => {
        if (this.wsTimeoutId !== null) { window.clearTimeout(this.wsTimeoutId); this.wsTimeoutId = null; }
        this.wsConnected = false;
        this.notify();
      };
      ws.onclose = () => {
        if (this.wsTimeoutId !== null) { window.clearTimeout(this.wsTimeoutId); this.wsTimeoutId = null; }
        this.wsConnected = false;
        this.notify();
        // 15秒后自动重连
        setTimeout(() => this.tryBinanceWebSocket(), 15000);
      };
    } catch {
      this.wsConnected = false;
    }
  }

  // 模拟平滑呼吸波动（确保断网或在任何离线模式下都能看到极具金融氛围的跳动）
  private startSimulation() {
    if (typeof window === "undefined") return;
    setInterval(() => {
      // 若 WebSocket 已连上，仅微调其他小币种
      this.prices.forEach((item) => {
        if (!this.wsConnected || Math.random() < 0.25) {
          // 产生 -0.15% ~ +0.15% 的高频微震荡
          const deltaPct = (Math.random() - 0.495) * 0.003;
          item.price = Number((item.price * (1 + deltaPct)).toFixed(item.price < 1 ? 6 : 2));
          item.high = Math.max(item.high, item.price);
          item.low = Math.min(item.low, item.price);
        }
      });
      this.notify();
    }, 1800);
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
      source: this.wsConnected ? "binance-live" : "exchange-core",
      snapshotTs: now,
      providerTs: now,
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
      source: this.wsConnected ? "binance-live" : "exchange-core",
      snapshotTs: now,
      providerTs: now,
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

  public getKlines(symbol: string, interval = "1h"): MarketCandle[] {
    const cleanSym = symbol.replace("USDT", "").toUpperCase();
    const item = this.prices.get(cleanSym) || INITIAL_SEEDS[0];
    const basePrice = item.price;

    const stepMs = interval === "1m" ? 60_000 : interval === "5m" ? 300_000 : interval === "1d" ? 86_400_000 : 3_600_000;
    const now = Math.floor(Date.now() / stepMs) * stepMs;
    const count = 60;
    const candles: MarketCandle[] = [];
    let prev = basePrice * 0.985;

    for (let i = 0; i < count; i++) {
      const time = now - (count - 1 - i) * stepMs;
      // 拟真分形曲线
      const wave = Math.sin(i * 0.28) * 0.012 + Math.cos(i * 0.14) * 0.008;
      const progress = (i / count) * 0.015;
      const close = i === count - 1 ? basePrice : basePrice * (0.985 + wave + progress);
      const open = prev;
      const high = Math.max(open, close) * (1 + Math.random() * 0.0035);
      const low = Math.min(open, close) * (1 - Math.random() * 0.0035);
      const volume = Math.floor(15 + Math.random() * 50 + (i === count - 1 ? 40 : 0));
      prev = close;
      candles.push({ time, open, high, low, close, volume, source: "exchange-klines" });
    }
    return candles;
  }
}

export const liveMarketEngine = new LiveMarketEngine();
