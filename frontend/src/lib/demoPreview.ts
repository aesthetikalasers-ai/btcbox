import type {
  AccountSnapshot,
  EarnProduct,
  MarketCandle,
  MarketTicker,
  OrderBookSnapshot,
  OrderRecord,
  PerpMarket,
  SpotMarketPair,
  TradingStatus,
} from "./api";

const STORAGE_KEY = "btcbox-demo-preview";
const demoQuery = new URLSearchParams(window.location.search).get("demo");
// Local-dev switch: when VITE_FORCE_DEMO=1 (set in .env.local, gitignored), the
// whole app boots straight into the offline demo account so every screen is
// usable without Supabase. ?demo=0 still forces live mode as an escape hatch.
// Demo data is a local-development aid only. A query string or stale browser
// storage must never switch a production customer into a simulated exchange.
const forceDemo = import.meta.env.DEV && import.meta.env.VITE_FORCE_DEMO === "1";
let demoEnabled = false;

if (import.meta.env.DEV) {
  try {
    if (demoQuery === "1") window.localStorage.setItem(STORAGE_KEY, "1");
    else if (demoQuery === "0") window.localStorage.removeItem(STORAGE_KEY);
    demoEnabled = demoQuery === "0" ? false : (forceDemo || demoQuery === "1" || (demoQuery === null && window.localStorage.getItem(STORAGE_KEY) === "1"));
  } catch {
    demoEnabled = forceDemo || demoQuery === "1";
  }
}

export const DEMO_PREVIEW_ACTIVE = demoEnabled;

const marketSeeds = [
  { sym: "BTC", price: 68420.55, chg: 1.82, high: 69120.0, low: 67105.2, vol: "1284500000" },
  { sym: "ETH", price: 3528.4, chg: 2.46, high: 3594.1, low: 3432.6, vol: "482300000" },
  { sym: "SOL", price: 182.3, chg: -0.74, high: 186.8, low: 180.1, vol: "156700000" },
  { sym: "BNB", price: 602.15, chg: 0.58, high: 609.8, low: 595.4, vol: "92800000" },
  { sym: "XRP", price: 0.6124, chg: 3.12, high: 0.624, low: 0.589, vol: "77300000" },
  { sym: "DOGE", price: 0.1543, chg: -1.26, high: 0.1591, low: 0.1512, vol: "64300000" },
  { sym: "ADA", price: 0.452, chg: 1.65, high: 0.468, low: 0.441, vol: "98000000" },
  { sym: "AVAX", price: 28.4, chg: 4.12, high: 29.6, low: 27.3, vol: "72000000" },
  { sym: "SUI", price: 1.92, chg: 7.85, high: 2.01, low: 1.78, vol: "118000000" },
  { sym: "NEAR", price: 5.1, chg: -0.45, high: 5.32, low: 4.98, vol: "61000000" },
  { sym: "LINK", price: 13.75, chg: 2.1, high: 14.2, low: 13.4, vol: "55000000" },
  { sym: "DOT", price: 6.42, chg: 3.44, high: 6.65, low: 6.18, vol: "88000000" },
  { sym: "LTC", price: 82.9, chg: -1.12, high: 84.7, low: 81.2, vol: "47000000" },
  { sym: "MATIC", price: 0.398, chg: 2.9, high: 0.412, low: 0.384, vol: "76000000" },
  { sym: "UNI", price: 10.8, chg: 5.6, high: 11.3, low: 10.2, vol: "43000000" },
  { sym: "TRX", price: 0.129, chg: 0.75, high: 0.132, low: 0.126, vol: "82000000" },
  { sym: "BCH", price: 418.5, chg: -0.88, high: 426.0, low: 412.5, vol: "31000000" },
  { sym: "ATOM", price: 8.62, chg: 1.95, high: 8.8, low: 8.41, vol: "27000000" },
  { sym: "ETC", price: 23.8, chg: -1.65, high: 24.4, low: 23.1, vol: "34000000" },
  { sym: "USDC", price: 1.0, chg: 0.01, high: 1.0002, low: 0.9998, vol: "380000000" },
  { sym: "PEPE", price: 0.0000128, chg: 11.4, high: 0.000014, low: 0.0000115, vol: "410000000" },
] as const;

export function getDemoMarkets(): MarketTicker[] {
  const timestamp = Math.floor(Date.now() / 1000);
  return marketSeeds.map((market) => ({
    ...market,
    source: "demo-preview",
    snapshotTs: timestamp,
    providerTs: timestamp,
  }));
}

/** Sample pair catalogue for local preview; mirrors {@link getSampleMarkets}. */
export function getSampleMarketPairs(): SpotMarketPair[] {
  return getDemoMarketPairs();
}

/**
 * Preview fallback for local development and design review.
 *
 * Unlike the explicit `?demo=1` switch, this is used automatically when the
 * market API cannot be reached (e.g. a Vite dev server with no backend proxy),
 * so the terminal renders a dense, complete table instead of an empty page.
 *
 * Every row is tagged `source: "sample-data"` so the UI can label it as sample
 * data. Prices are deterministic per page load, never presented as live quotes,
 * and the trading actions stay disabled while sample rows are shown.
 */
export function getSampleMarkets(): MarketTicker[] {
  const timestamp = Math.floor(Date.now() / 1000);
  return marketSeeds.map((market) => ({
    ...market,
    source: "sample-data",
    snapshotTs: timestamp,
    providerTs: timestamp,
  }));
}

/** True when a ticker row came from the preview fallback rather than an exchange. */
export function isSampleTicker(ticker: Pick<MarketTicker, "source">): boolean {
  return ticker.source === "sample-data";
}

export function getDemoMarketPairs(): SpotMarketPair[] {
  return marketSeeds.map(({ sym }) => ({
    base_asset: sym,
    quote_asset: "USDT",
    enabled: true,
    price_tick: sym === "PEPE" ? "0.000001" : sym === "XRP" || sym === "DOGE" || sym === "MATIC" || sym === "TRX" ? "0.0001" : "0.01",
    quantity_step: "0.0001",
    min_quantity: "0.0001",
    min_notional: "10",
    min_limit_price: null,
    max_limit_price: null,
  }));
}

export function getDemoKlines(symbol: string, interval: string): MarketCandle[] {
  const basePrice = marketSeeds.find((market) => `${market.sym}USDT` === symbol.toUpperCase())?.price
    ?? marketSeeds[0].price;
  const step = interval === "1m" ? 60 : interval === "5m" ? 300 : interval === "1d" ? 86_400 : 3_600;
  const now = Math.floor(Date.now() / 1000 / step) * step;
  let previousClose = basePrice * 0.992;

  return Array.from({ length: 48 }, (_, index) => {
    const time = now - (47 - index) * step;
    const open = previousClose;
    const close = basePrice * (1 + 0.004 * Math.sin(index * 0.43) + index * 0.00006);
    const high = Math.max(open, close) * 1.002;
    const low = Math.min(open, close) * 0.998;
    previousClose = close;
    return {
      time,
      open,
      high,
      low,
      close,
      volume: 8 + Math.abs(4 * Math.sin(index * 0.31)),
      source: "demo-preview",
    };
  });
}

export function getDemoTradingStatus(): TradingStatus {
  return { spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: ["limit"] };
}

export function getDemoOrderBook(symbol: string): OrderBookSnapshot {
  const market = marketSeeds.find((item) => `${item.sym}USDT` === symbol.toUpperCase()) ?? marketSeeds[0];
  const bids: Array<[string, string]> = [];
  const asks: Array<[string, string]> = [];
  for (let index = 0; index < 12; index += 1) {
    const offset = (index + 1) * 0.0004;
    const quantity = (0.025 + index * 0.011).toFixed(4);
    bids.push([(market.price * (1 - offset)).toFixed(8), quantity]);
    asks.push([(market.price * (1 + offset)).toFixed(8), quantity]);
  }
  return {
    source: "demo-preview",
    snapshotTs: Math.floor(Date.now() / 1000),
    providerTs: null,
    bids,
    asks,
  };
}

export function getDemoAccount(): AccountSnapshot {
  return {
    uid: "DEMO-0001",
    email: "demo@btcbox.invalid",
    username: "demo_trader",
    // Demo preview represents a fully-onboarded account: a username *and* a login
    // password are already set. Keeping this true means `setSignedIn` computes
    // `needsCredentials=false` and the AccountSetupGate never force-redirects a
    // demo visitor to /account-setup.
    has_login_password: true,
    auth_providers: [],
    balances: {
      BTC: { free: "0.08425", frozen: "0.012", usdt: "6585.48", valuation_available: true },
      ETH: { free: "1.25", frozen: "0.15", usdt: "4939.76", valuation_available: true },
      USDT: { free: "8214.58", frozen: "245.75", usdt: "8460.33", valuation_available: true },
      SOL: { free: "12.5", frozen: "0.5", usdt: "2369.90", valuation_available: true },
    },
    totalUsdt: 22355.47,
    valuation_complete: true,
    unpriced_assets: [],
    kyc: { status: "not_submitted" },
    twofa_enabled: false,
  };
}

export function getDemoOrders(): OrderRecord[] {
  return [];
}

/**
 * Preview fallback for the Earn catalog, used when `DEMO_PREVIEW_ACTIVE` is on.
 * Mirrors the shape of {@link getEarnCatalog} so the Earn page renders a
 * populated product list for design review instead of an empty catalog.
 * `actions_enabled` is false: demo preview is read-only and never mutates funds.
 */
export function getDemoEarnCatalog(): { products: EarnProduct[]; actions_enabled: boolean } {
  return {
    actions_enabled: false,
    products: [
      { product_id: "flex_USDT", asset: "USDT", product_type: "demand", apy_percent: 4.8, term_days: 0, early_fee_percent: 0, amount_scale: 2 },
      { product_id: "flex_BTC", asset: "BTC", product_type: "demand", apy_percent: 1.2, term_days: 0, early_fee_percent: 0, amount_scale: 6 },
      { product_id: "flex_ETH", asset: "ETH", product_type: "demand", apy_percent: 2.1, term_days: 0, early_fee_percent: 0, amount_scale: 6 },
      { product_id: "fixed30_USDT", asset: "USDT", product_type: "fixed", apy_percent: 8.5, term_days: 30, early_fee_percent: 1.5, amount_scale: 2 },
      { product_id: "fixed90_USDT", asset: "USDT", product_type: "fixed", apy_percent: 11.0, term_days: 90, early_fee_percent: 2.5, amount_scale: 2 },
    ],
  };
}

export function getDemoAuthClientConfig() {
  return {
    ok: true as const,
    supabase_url: "https://demo-preview.invalid",
    publishable_key: "demo-preview-disabled",
    google_enabled: false,
    wallet_enabled: false,
  };
}

export function exitDemoPreview(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } finally {
    window.location.assign("/home?demo=0");
  }
}

/**
 * Preview fallback for the perpetual-contract market catalogue, used when
 * `DEMO_PREVIEW_ACTIVE` is on. Mirrors the shape of {@link getPerpMarkets} so
 * the Contract terminal renders a complete, populated workspace for design
 * review instead of an empty "no markets enabled" state.
 *
 * Every row is synthetic and tagged via the `symbol` namespace; mark/index
 * prices are seeded from the same deterministic market table used by the spot
 * preview. Never presented as live quotes.
 */
export function getDemoPerpMarkets(): PerpMarket[] {
  const baseMarkets: Array<{ sym: string; price: number; maxLeverage: number }> = [
    { sym: "BTC", price: 68420.55, maxLeverage: 100 },
    { sym: "ETH", price: 3528.4, maxLeverage: 75 },
    { sym: "SOL", price: 182.3, maxLeverage: 50 },
    { sym: "BNB", price: 602.15, maxLeverage: 50 },
    { sym: "XRP", price: 0.6124, maxLeverage: 50 },
    { sym: "DOGE", price: 0.1543, maxLeverage: 25 },
  ];
  return baseMarkets.map(({ sym, price, maxLeverage }) => ({
    symbol: `${sym}USDT`,
    base_asset: sym,
    quote_asset: "USDT",
    status: "trading",
    max_leverage: maxLeverage,
    price_tick: sym === "XRP" || sym === "DOGE" ? "0.0001" : "0.01",
    quantity_step: "0.0001",
    min_quantity: "0.0001",
    funding_interval_sec: 28800,
    funding_rate_cap: 0.0075,
    next_funding_at: null,
    mark_price: price,
    index_price: price * 0.9998,
  }));
}
