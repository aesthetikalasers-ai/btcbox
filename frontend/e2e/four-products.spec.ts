import { expect, test } from "@playwright/test";

// Phase 4: four-product center red-line + mobile 2x2 grid.
// Customer requirement: exactly Spot / Seconds / Contract / Earn; no Futures;
// product grid must be two columns at every viewport (never single-column stack).

async function mockTradeHub(page: import("@playwright/test").Page) {
  await page.route("**/api/auth-client-config", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, supabase_url: "https://btcbox-e2e.invalid", publishable_key: "e2e-anon-key-not-valid-for-production", google_enabled: false, wallet_enabled: false }),
  }));
  await page.route("**/api/market/pairs", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{ base_asset: "BTC", quote_asset: "USDT", enabled: true, price_tick: "0.01", quantity_step: "0.00001", min_quantity: "0.00001", min_notional: "5" }] }),
  }));
  await page.route("**/api/trading/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, spot_order_entry_enabled: true }) }));
  await page.route("**/api/seconds/policy", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, policy: { policy_id: "p1", policy_version: 1, actions_enabled: true }, actions_enabled: true }) }));
  await page.route("**/api/earn/products", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [], actions_enabled: true }) }));
  await page.route("**/api/perpetual/markets", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, markets: [{ symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", status: "trading", max_leverage: 10, price_tick: "0.01", quantity_step: "0.00001", min_quantity: "0.00001", funding_interval_sec: 28800, funding_rate_cap: 0.0075 }] }) }));
}

test("trade chooser shows exactly four products and no Futures entry", async ({ page }) => {
  await mockTradeHub(page);
  await page.goto("/trade-hub");
  await expect(page.getByRole("heading", { name: "Choose your trading mode" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spot", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seconds", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Earn", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contract", exact: true })).toBeVisible();
  // Exactly four product-card titles in the chooser grid.
  const productTitles = page.locator("main").getByRole("heading", { name: /^(Spot|Seconds|Earn|Contract)$/ });
  await expect(productTitles).toHaveCount(4);
  // No fifth product / forbidden Futures label anywhere on the page.
  await expect(page.getByText("Futures", { exact: true })).toHaveCount(0);
});

test("mobile viewport renders the product grid as two columns (2x2, never single column)", async ({ page }) => {
  await mockTradeHub(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/trade-hub");
  const grid = page.locator("div.grid").filter({ has: page.getByRole("heading", { name: "Spot", exact: true }) });
  await expect(grid).toBeVisible();
  const columns = await grid.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
  });
  expect(columns, "product grid must use two columns at 375px width").toBe(2);
});
