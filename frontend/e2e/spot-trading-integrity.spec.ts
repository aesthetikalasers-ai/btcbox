import { expect, test } from "@playwright/test";

test("market precision helpers enforce exact tick and quantity steps", async ({ page }) => {
  await page.goto("/home");
  const result = await page.evaluate(async () => {
    const decimal = await import("/src/lib/decimal.ts");
    return {
      validPrice: decimal.isDecimalMultipleOfStep("65000.02", "0.01"),
      invalidPrice: decimal.isDecimalMultipleOfStep("65000.001", "0.01"),
      validQuantity: decimal.isDecimalMultipleOfStep("0.0015", "0.0005"),
      invalidQuantity: decimal.isDecimalMultipleOfStep("0.0012", "0.0005"),
      floor: decimal.floorDecimalToStep("0.00129", "0.0001"),
      add: decimal.addDecimalStep("65000.00", "0.01", 1),
    };
  });
  expect(result).toEqual({
    validPrice: true,
    invalidPrice: false,
    validQuantity: true,
    invalidQuantity: false,
    floor: "0.0012",
    add: "65000.01",
  });
});

test("legacy mobile prototype route redirects to the real spot terminal", async ({ page }) => {
  await page.goto("/mobile-terminal");
  await expect(page).toHaveURL(/\/trade\/BTCUSDT$/);
  await expect(page.getByText("12,450.00 USDT", { exact: true })).toHaveCount(0);
});


test("mobile chart refreshes verified candles while the drawer is expanded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  let klineRequests = 0;
  await page.route("**/api/market/pairs", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{
      base_asset: "BTC", quote_asset: "USDT", enabled: true,
      price_tick: "0.01", quantity_step: "0.000001", min_quantity: "0.000001", min_notional: "1",
      min_limit_price: null, max_limit_price: null,
    }] }),
  }));
  await page.route("**/api/market", route => {
    const now = Math.floor(Date.now() / 1000);
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        markets: [{ sym: "BTC", price: 65000, chg: 1, high: 66000, low: 64000, vol: "1000", source: "binance-vision" }],
        data: { BTC: { ts: now, providerTs: now, source: "binance-vision" } },
      }),
    });
  });
  await page.route("**/api/depth?**", route => {
    const now = Math.floor(Date.now() / 1000);
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, source: "coinbase", snapshotTs: now, bids: [["64999", "1"]], asks: [["65001", "1"]] }),
    });
  });
  await page.route("**/api/kline?**", route => {
    klineRequests += 1;
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, source: "coinbase", klines: [{
        time: Date.now() - 60000, open: 65000, high: 65100, low: 64900, close: 65010, volume: 1,
      }] }),
    });
  });
  await page.route("**/api/trading/status", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: [] }),
  }));
  await page.route("**/api/orders", route => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, msg: "Sign in to view orders." }),
  }));
  await page.route("**/api/account", route => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, msg: "Sign in to view assets." }),
  }));

  await page.goto("/trade/BTCUSDT");
  await expect.poll(() => klineRequests).toBe(1);
  await page.locator("#trade-chart-open").click();
  await expect(page.getByRole("region", { name: "Price chart" })).toBeVisible();
  await page.clock.fastForward(30000);
  await expect.poll(() => klineRequests).toBe(2);
});

test("missing provider timestamps are not replaced with the browser clock", async ({ page }) => {
  await page.route("**/api/market", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets: [{ sym: "BTC", price: 65000, chg: 1, high: 66000, low: 64000, vol: "1000", source: "provider" }],
      data: { BTC: { ts: 12345, source: "provider" } },
    }),
  }));
  await page.goto("/home");
  const timestamps = await page.evaluate(async () => {
    const rows = await (await import("/src/lib/api.ts")).getMarkets();
    return { snapshotTs: rows[0]?.snapshotTs, providerTs: rows[0]?.providerTs };
  });
  expect(timestamps).toEqual({ snapshotTs: 12345, providerTs: undefined });
});
