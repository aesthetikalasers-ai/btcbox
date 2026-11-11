import { expect, test } from "@playwright/test";

test("public dashboard shows an unavailable state and no quote values when the market feed fails", async ({ page }) => {
  await page.route("**/api/market", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, code: "MARKET_UNAVAILABLE", msg: "Market feed unavailable." }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, msg: "Historical market data is unavailable." }),
  }));

  await page.goto("/home");

  await expect(page.getByText("Preview", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Preview · API verification pending", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/TradingView Lightweight Charts™ Copyright/)).toBeVisible();
  await expect(page.getByRole("link", { name: "https://www.tradingview.com/" })).toHaveAttribute("href", "https://www.tradingview.com/");
  await expect(page.getByText(/Market feed unavailable/i).first()).toBeVisible();
  await expect(page.getByText(/65,?000\.00/)).toHaveCount(0);
  await expect(page.getByText("0.00", { exact: true })).toHaveCount(0);
});

test("public dashboard never renders zero-filled placeholder market rows", async ({ page }) => {
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [], data: {} }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "coinbase", klines: [] }),
  }));

  await page.goto("/home");

  await expect(page.getByText("No market pairs are currently available.")).toBeVisible();
  await expect(page.getByText("0.00", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/65,?000\.00/)).toHaveCount(0);
});

test("a live public market pair opens its spot trading page", async ({ page }) => {
  const currentSnapshotTs = Math.floor(Date.now() / 1000);
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets: [{ sym: "BTCUSDT", price: 65000, chg: 1.25, high: 66000, low: 64000, vol: "1200", source: "provider" }],
      data: { BTCUSDT: { ts: currentSnapshotTs, providerTs: currentSnapshotTs - 10, source: "provider" } },
    }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "provider", klines: [] }),
  }));

  await page.goto("/markets");
  const pair = page.getByRole("link", { name: "BTCUSDT spot trading" });
  await expect(pair).toBeVisible();
  await pair.click();
  await expect(page).toHaveURL(/\/trade\/BTCUSDT$/);
});


test("public dashboard hides quotes from an expired server market snapshot", async ({ page }) => {
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets: [{ sym: "BTCUSDT", price: 65000, chg: 1.25, high: 66000, low: 64000, vol: "1200", source: "provider" }],
      data: { BTCUSDT: { ts: 1, providerTs: 1, source: "provider" } },
    }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "provider", klines: [] }),
  }));

  await page.goto("/home");

  await expect(page.getByText("Snapshot stale", { exact: true })).toBeVisible();
  await expect(page.getByText(/older than 90 seconds/i)).toBeVisible();
  await expect(page.getByText("65,000.00", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "BTCUSDT spot trading" })).toHaveCount(0);
});


test("spot trading hides expired quotes and blocks new orders until a fresh snapshot arrives", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/market/pairs", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{
      base_asset: "BTC", quote_asset: "USDT", enabled: true,
      price_tick: "0.01", quantity_step: "0.000001", min_quantity: "0.000001", min_notional: "1",
    }] }),
  }));
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets: [{ sym: "BTC", price: 65000, chg: 1.25, high: 66000, low: 64000, vol: "1200", source: "provider" }],
      data: { BTC: { ts: 1, providerTs: 1, source: "provider" } },
    }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "provider", klines: [] }),
  }));
  await page.route("**/api/depth?**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "provider", snapshotTs: 1, bids: [["64999", "1"]], asks: [["65001", "1"]] }),
  }));
  await page.route("**/api/trading/status", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, spot_order_entry_enabled: true, spot_cancel_enabled: true, supported_order_types: ["limit"] }),
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

  await expect(page.getByText(/Market snapshot is older than 90 seconds/i)).toBeVisible();
  await expect(page.getByText("65,000", { exact: false })).toHaveCount(0);
  await expect(page.getByLabel("Limit price (USDT)")).toHaveValue("");
  await expect(page.getByText("64,999", { exact: false })).toHaveCount(0);
  await expect(page.getByText("65,001", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Place buy limit order" })).toBeDisabled();
  await page.getByRole("button", { name: "Order book" }).click();
  await expect(page.getByRole("dialog", { name: "Order book" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close market panel" })).toBeVisible();
  await page.getByRole("button", { name: "Close market panel" }).click();
  await expect(page.getByRole("dialog", { name: "Order book" })).toHaveCount(0);
});
