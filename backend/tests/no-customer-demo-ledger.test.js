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
