import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/src");

test("customer app keeps the provider but makes the local paper ledger development-only", () => {
  const entry = fs.readFileSync(path.join(root, "main.tsx"), "utf8");
  assert.ok(entry.includes("TradingProvider"), "trading context must remain mounted");
  assert.ok(!entry.includes("TradingInitializer"), "automatic demo wallet initialization must stay disabled");

  const trading = fs.readFileSync(path.join(root, "lib/trading.tsx"), "utf8");
  assert.ok(trading.includes("import.meta.env.DEV ? loadLedger() : emptyLedger()"));
  assert.ok(trading.includes("if (!import.meta.env.DEV) return;"));
  assert.ok(trading.includes('if (import.meta.env.DEV && status === "authenticated") initializeDemoWallet();'));
});

test("real asset balances are sourced only from the backend account snapshot", () => {
  const page = fs.readFileSync(path.join(root, "features/assets/AssetsPage.tsx"), "utf8");
  assert.ok(page.includes("Object.entries(account?.balances ?? {})"));
  assert.ok(!page.includes("useTrading"));
  assert.ok(!page.includes("paperBalances"));
});

test("customer order history never merges local paper orders", () => {
  const page = fs.readFileSync(path.join(root, "features/orders/OrdersPage.tsx"), "utf8");
  assert.ok(page.includes("getOrders(controller.signal)"));
  assert.ok(!page.includes("useTrading"));
  assert.ok(!page.includes("paperOrders"));
});

test("seconds page displays only server positions and settlement history", () => {
  const page = fs.readFileSync(path.join(root, "features/pages/SecondsPage.tsx"), "utf8");
  assert.ok(page.includes("getSecondsPositions(controller.signal)"));
  assert.ok(page.includes("submitSecondsOrder(intent)"));
  assert.ok(!page.includes("useTrading"));
  assert.ok(!page.includes("settleSecondsTrade"));
  assert.ok(!page.includes("lastSettleResult"));
});

test("perpetual market failures never fall back to synthetic customer markets", () => {
  const page = fs.readFileSync(path.join(root, "features/pages/ContractPage.tsx"), "utf8");
  assert.ok(!page.includes("getDemoPerpMarkets"));
  assert.ok(page.includes("setMarkets([])"));
  assert.ok(page.includes("setMarketsFallback(true)"));
  assert.ok(page.includes("markets.length === 0 && !marketsLoading"));
  assert.ok(page.includes("marketsError || t("));
});

test("production market data has no dormant hardcoded seed-price table", () => {
  const market = fs.readFileSync(path.join(root, "lib/marketData.ts"), "utf8");
  assert.ok(!market.includes("INITIAL_SEEDS"));
  assert.ok(!market.includes("MockSeed"));
  assert.ok(market.includes("Nothing is fabricated here"));
});

test("offline demo preview can only be enabled in development builds", () => {
  const preview = fs.readFileSync(path.join(root, "lib/demoPreview.ts"), "utf8");
  assert.ok(preview.includes("const forceDemo = import.meta.env.DEV &&"));
  const gate = preview.indexOf("if (import.meta.env.DEV) {");
  const activation = preview.indexOf("demoEnabled = demoQuery");
  assert.ok(gate >= 0 && activation > gate, "query and localStorage activation must stay inside the DEV gate");
  assert.ok(preview.includes("export const DEMO_PREVIEW_ACTIVE = demoEnabled"));
});

test("new server-side customer accounts start with zero balances", () => {
  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = fs.readFileSync(path.join(backendRoot, "api-core.js"), "utf8");
  const emptyBalances = source.match(/function emptyBalances\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(emptyBalances, "server zero-balance initializer must exist");
  assert.match(emptyBalances[1], /USDT:\s*\{\s*free:\s*0,\s*frozen:\s*0\s*\}/);
  assert.ok(source.includes("balances: emptyBalances(), orders: [], deposits: [], withdrawals: [], earn_records: [], support_messages: []"));
});

test("no customer-facing component reads the local paper-trading context", () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
  const files = walk(root).filter((file) => !file.endsWith("/lib/trading.tsx"));
  const consumers = files.filter((file) => fs.readFileSync(file, "utf8").includes("useTrading"));
  assert.deepEqual(consumers, [], "paper-trading context must not be consumed by customer pages or components");
});

test("production account routes remain login-protected while market preview routes stay public", () => {
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  assert.ok(app.includes("function PublicRoute"));
  assert.ok(!app.includes("DemoRoute"));
  assert.ok(app.includes("if (import.meta.env.DEV) return <>{children}</>;"));
  assert.ok(app.includes('if (status !== "authenticated") return <SignInPrompt />;'));
  assert.ok(app.includes('<Route path="/assets" element={<ProtectedAccountRoute><AssetsPage /></ProtectedAccountRoute>} />'));
  assert.ok(app.includes('<Route path="/orders" element={<ProtectedAccountRoute><OrdersPage /></ProtectedAccountRoute>} />'));
  assert.ok(app.includes('<Route path="/markets" element={<PublicRoute><MarketsPage /></PublicRoute>} />'));
});

test("production K-line requests never fall back to synthetic candles", () => {
  const api = fs.readFileSync(path.join(root, "lib/api.ts"), "utf8");
  const start = api.indexOf("export async function getKlines(");
  const end = api.indexOf("export interface TradingStatus", start);
  const getKlines = api.slice(start, end);
  assert.ok(getKlines.includes("if (DEMO_PREVIEW_ACTIVE) return getDemoKlines(symbol, interval)"));
  assert.equal((getKlines.match(/getDemoKlines/g) || []).length, 1);
  assert.ok(!getKlines.includes("return getDemoKlines"));
  assert.ok(getKlines.includes("rawTime / 1000"));
  assert.ok(getKlines.includes("bySecond.set(time"));
});

test("market quote provenance never invents provider timestamps", () => {
  const api = fs.readFileSync(path.join(root, "lib/api.ts"), "utf8");
  const start = api.indexOf("export async function getMarkets(");
  const end = api.indexOf("export async function getKlines(", start);
  const getMarkets = api.slice(start, end);
  assert.ok(getMarkets.includes(": undefined"));
  assert.ok(getMarkets.includes(": null"));
  assert.ok(!getMarkets.includes("Math.floor(Date.now() / 1000)"));
});

test("live market stream preserves provider provenance and does not invent quote metrics", () => {
  const market = fs.readFileSync(path.join(root, "lib/marketData.ts"), "utf8");
  assert.ok(market.includes("providerTs,"));
  assert.ok(market.includes("snapshotTs,"));
  assert.ok(!market.includes("providerTs: this.lastFetchAt"));
  assert.ok(!market.includes("snapshotTs: now"));
  assert.ok(!market.includes("Number(ticker.chg) || 0"));
  assert.ok(!market.includes("Number(ticker.high) || price"));
  assert.ok(!market.includes("Number(ticker.low) || price"));
});

test("USDT to USD display never invents a near-parity fallback rate", () => {
  const api = fs.readFileSync(path.join(root, "lib/api.ts"), "utf8");
  const start = api.indexOf("export async function getUsdtUsdRate(");
  const end = api.indexOf("export interface SpotOrderInput", start);
  const fx = api.slice(start, end);
  assert.ok(fx.includes("rate: null"));
  assert.ok(!fx.includes("0.99999"));
  for (const file of ["features/trade/OrderBookDepth.tsx", "features/trade/TerminalOrderBook.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(!source.includes("0.99999"));
  }
});

test("order books never synthesize depth or neutral buy/sell pressure", () => {
  const depth = fs.readFileSync(path.join(root, "features/trade/OrderBookDepth.tsx"), "utf8");
  assert.ok(!depth.includes("buildLevels"));
  assert.ok(!depth.includes("mulberry32"));
  assert.ok(!depth.includes("67000"));
  assert.ok(depth.includes("book: DepthLevels | null"));

  const terminal = fs.readFileSync(path.join(root, "features/trade/TerminalOrderBook.tsx"), "utf8");
  assert.ok(!terminal.includes("return { buy: 50, sell: 50 }"));
  assert.ok(terminal.includes("return null"));
  assert.ok(terminal.includes("{pressure ? ("));
});

test("spot and perpetual pages do not seed a guessed USDT/USD rate", () => {
  for (const file of ["features/pages/Pages.tsx", "features/pages/ContractPage.tsx"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(source.includes("useState<number | null>(null)"));
    assert.ok(!source.includes("0.99999"));
  }
});

test("all chart consumers use the normalized Unix-second candle timestamps", () => {
  const files = [
    "features/pages/SecondsPage.tsx",
    "features/pages/Pages.tsx",
    "features/trade/KlinePanel.tsx",
    "features/trade/ChartDrawer.tsx",
    "features/pages/KlineChartPage.tsx",
    "features/dashboard/components/VolumeChart.tsx",
    "features/dashboard/components/LiquidityChart.tsx",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.ok(!source.includes("time / 1000"), file + " must not divide already-normalized timestamps again");
  }
});

test("seconds payout and limits come only from the active server policy", () => {
  const page = fs.readFileSync(path.join(root, "features/pages/SecondsPage.tsx"), "utf8");
  assert.ok(page.includes("policy.policy.payout_bps / 100"));
  assert.ok(page.includes("policy.policy.durations_sec.map"));
  assert.ok(page.includes("policy.policy.min_stake"));
  assert.ok(page.includes("policy.policy.max_stake"));
  assert.ok(page.includes("numeric > Number(availableUSDT)"));
  assert.ok(page.includes("availableUSDT === null"));
  assert.ok(!page.includes("DURATION_OPTIONS"));
  assert.ok(!page.includes("rate: 85"));
  assert.ok(!page.includes('useState<string>("0.00")'));
});

test("public market provenance keeps server and provider timestamps separate", () => {
  const marketTable = fs.readFileSync(path.join(root, "features/dashboard/components/LiveMarketsTable.tsx"), "utf8");
  assert.ok(marketTable.includes('t("Server snapshot")'));
  assert.ok(marketTable.includes('t("Provider snapshot")'));
  assert.ok(marketTable.includes("providerTimestamp"));
  assert.ok(!marketTable.includes("providerTs ?? snapshotTs"));

  const spotPage = fs.readFileSync(path.join(root, "features/pages/Pages.tsx"), "utf8");
  assert.ok(spotPage.includes("marketDataSourceLabel"));
  assert.ok(spotPage.includes("displayBook?.source"));
  assert.ok(spotPage.includes("rows.find(row=>typeof row.source==="));
  const api = fs.readFileSync(path.join(root, "lib/api.ts"), "utf8");
  assert.ok(api.includes("source: candle.source ?? candleSource"));
});

test("perpetual page labels spot data and funding caps honestly", () => {
  const page = fs.readFileSync(path.join(root, "features/pages/ContractPage.tsx"), "utf8");
  assert.ok(page.includes('t("Spot reference")'));
  assert.ok(page.includes('t("Funding rate cap")'));
  assert.ok(page.includes("fundingRateCapPct"));
  assert.ok(page.includes('setFundingCountdown("")'));
  assert.ok(!page.includes("Math.ceil(now / (interval * 1000))"));
  assert.ok(page.includes("estimatedMargin === null ? EM_DASH"));
  const depth = fs.readFileSync(path.join(root, "features/trade/OrderBookDepth.tsx"), "utf8");
  assert.ok(depth.includes('t("Underlying spot order book")'));
  assert.ok(depth.includes('t("Spot reference only — not the perpetual execution book.")'));
});

test("the live app routes seconds trading through the policy-backed page", () => {
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  assert.ok(app.includes('from "./features/pages/SecondsPage"'));
  assert.ok(!app.includes('SecondsPage } from "./features/pages/Pages"'));
});

test("spot trading provenance shows the actual source for each feed", () => {
  const page = fs.readFileSync(path.join(root, "features/pages/Pages.tsx"), "utf8");
  assert.ok(page.includes('t("Market data")'));
  assert.ok(page.includes("displayTicker?.source"));
  assert.ok(page.includes("displayBook?.source"));
  assert.ok(page.includes("chartSource"));
});

test("market ticker rows require real price, change, high, low and volume values", () => {
  const api = fs.readFileSync(path.join(root, "lib/api.ts"), "utf8");
  assert.ok(api.includes("hasFiniteValue(item.price)"));
  assert.ok(api.includes("hasFiniteValue(item.chg)"));
  assert.ok(api.includes("hasFiniteValue(item.high)"));
  assert.ok(api.includes("hasFiniteValue(item.low)"));
  assert.ok(api.includes("hasFiniteValue(item.vol)"));
  assert.ok(api.includes("Number(item.price) > 0"));

  const spot = fs.readFileSync(path.join(root, "features/pages/Pages.tsx"), "utf8");
  assert.ok(spot.includes("!ticker?.source"));
});

test("admin does not invent zero balances or allow credits against an unknown ledger source", () => {
  const admin = fs.readFileSync(path.join(root, "features/admin/AdminPage.tsx"), "utf8");
  assert.ok(admin.includes('balances?.[coin]?.free == null ? "—"'));
  assert.ok(admin.includes('financial_balance_source !== "postgres_financial_ledger"'));
  assert.ok(!admin.includes('balances?.[coin]?.free ?? "0"'));
  assert.ok(admin.includes("Manual credit is disabled until the user's PostgreSQL ledger balance source is confirmed."));
});

test("obsolete hard-coded seconds page is not left in the shared pages module", () => {
  const pages = fs.readFileSync(path.join(root, "features/pages/Pages.tsx"), "utf8");
  assert.ok(!pages.includes("export function SecondsPage"));
  assert.ok(!pages.includes("DURATION_OPTIONS"));
  assert.ok(!pages.includes("QUICK_AMOUNTS"));
});

test("demo preview cannot be enabled by a production query string or stale browser storage", () => {
  const preview = fs.readFileSync(path.join(root, "lib/demoPreview.ts"), "utf8");
  assert.ok(preview.includes("const forceDemo = import.meta.env.DEV &&"));
  assert.ok(preview.includes("if (import.meta.env.DEV)"));
  assert.ok(preview.includes("let demoEnabled = false"));
  assert.ok(preview.includes("export const DEMO_PREVIEW_ACTIVE = demoEnabled"));
});

test("withdrawal requires verified balance and fee instead of assuming zero", () => {
  const pages = fs.readFileSync(path.join(root, "features/pages/Pages.tsx"), "utf8");
  assert.ok(pages.includes("feeValue=selectedAddress&&config?config.fees?.[selectedAddress.coin]:undefined"));
  assert.ok(pages.includes("available=balance?.free==null?null:Number(balance.free)"));
  assert.ok(pages.includes("feeVerified"));
  assert.ok(pages.includes("balanceVerified"));
  assert.ok(!pages.includes("Number(balance?.free??0)"));
  assert.ok(!pages.includes("Number(config.fees[selectedAddress.coin]??0)"));
  assert.ok(pages.includes('value===null||value===undefined||value===""'));
});

test("asset balances show only backend values and contain no decorative fake sparkline", () => {
  const assets = fs.readFileSync(path.join(root, "features/assets/AssetsPage.tsx"), "utf8");
  assert.ok(assets.includes("Object.entries(account?.balances ?? {})"));
  assert.ok(assets.includes("formatDecimalAmount(balance.free"));
  assert.ok(!assets.includes("M2 32 C 18 30, 28 20"));
  assert.ok(!assets.includes("paperBalances"));
});

test("Earn page does not advertise hard-coded APY products", () => {
  const pages = fs.readFileSync(path.join(root, "features/pages/Pages.tsx"), "utf8");
  assert.ok(!pages.includes('rate:"5.20"'));
  assert.ok(!pages.includes('rate:"3.80"'));
  assert.ok(!pages.includes('rate:"4.50"'));
  assert.ok(!pages.includes('t("Featured products")'));
});

test("launchpool page never fabricates upcoming projects or campaign statistics", () => {
  const launchpool = fs.readFileSync(path.join(root, "features/pages/NewListingsPage.tsx"), "utf8");
  assert.ok(launchpool.includes("No verified launchpool campaigns are currently published."));
  assert.ok(!launchpool.includes("UPCOMING_PROJECTS"));
  assert.ok(!launchpool.includes("totalStaked"));
  assert.ok(!launchpool.includes("participants"));
  assert.ok(!launchpool.includes("status: \"upcoming\""));

  const dashboard = fs.readFileSync(path.join(root, "features/dashboard/Dashboard.tsx"), "utf8");
  assert.ok(!dashboard.includes("MiningButton"));
  assert.ok(!dashboard.includes("Trading competition"));
  assert.ok(!dashboard.includes("Stake for new listings and share the launchpool rewards."));
  assert.ok(dashboard.includes("Trading workspace"));
});
