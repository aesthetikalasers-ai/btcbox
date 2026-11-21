import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/src");

test("customer app does not mount a local demo trading wallet", () => {
  const entry = fs.readFileSync(path.join(root, "main.tsx"), "utf8");
  assert.ok(entry.includes("TradingProvider"), "trading context must remain mounted");
  assert.ok(!entry.includes("TradingInitializer"), "automatic demo wallet initialization must stay disabled");
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
  assert.ok(preview.includes("if (import.meta.env.DEV) {"));
  assert.ok(preview.indexOf("if (import.meta.env.DEV) {") < preview.indexOf("demoEnabled = demoQuery"));
  assert.ok(preview.includes("export const DEMO_PREVIEW_ACTIVE = demoEnabled"));
});
