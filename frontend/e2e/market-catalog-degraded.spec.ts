import { expect, test } from "@playwright/test";

test("degraded public catalogue keeps fresh quotes visible but disables all new spot orders", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const now = Math.floor(Date.now() / 1000);

  await page.route("**/api/market/pairs", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      catalog_source: "static-fallback",
      trading_enabled: false,
      markets: [{
        base_asset: "BTC",
        quote_asset: "USDT",
        enabled: true,
        trading_enabled: false,
        price_tick: "0.00000001",
        quantity_step: "0.00000001",
        min_quantity: "0.00000001",
        min_notional: "1",
      }],
    }),
  }));
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      catalog_source: "static-fallback",
      trading_enabled: false,
      markets: [{ sym: "BTC", price: 65000, chg: 1.25, high: 66000, low: 64000, vol: "1200", source: "binance-vision" }],
      data: { BTC: { ts: now, providerTs: now, source: "binance-vision" } },
    }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "binance-vision", catalog_source: "static-fallback", trading_enabled: false, klines: [] }),
  }));
  await page.route("**/api/depth?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      source: "binance-vision",
      catalog_source: "static-fallback",
      trading_enabled: false,
      snapshotTs: now,
      bids: [["64999", "1"]],
      asks: [["65001", "1"]],
    }),
  }));
  await page.route("**/api/trading/status", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, spot_order_entry_enabled: true, spot_cancel_enabled: true, supported_order_types: ["limit"] }),
  }));
  await page.route("**/api/orders", route => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, msg: "Sign in to view orders." }),
  }));
  await page.route("**/api/account", route => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, msg: "Sign in to view assets." }),
  }));

  await page.goto("/trade/BTCUSDT");

  // Quotes and the order book remain readable from public providers.
  await expect(page.getByText("65,000", { exact: false }).first()).toBeVisible();
  await expect(page.locator("#trade-depth")).toBeVisible();

  // A degraded catalogue is explicitly read-only even if the general trading
  // status endpoint says the matching engine is enabled.
  await expect(page.getByText("Trading is temporarily unavailable.", { exact: true }).first()).toBeVisible();
  // The compact trading terminal keeps the order form mounted, but the
  // degraded catalogue must make its new-order submit control read-only.
  const orderForm = page.locator("#trade-entry form");
  await expect(orderForm).toBeVisible();
  const submitButton = orderForm.locator("button[type=\"submit\"]");
  await expect(submitButton).toHaveCount(1);
  await expect(submitButton).toBeDisabled();
});
