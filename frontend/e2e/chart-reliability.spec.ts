import { expect, test, type Page } from "@playwright/test";

async function mockSpotTerminal(page: Page) {
  const now = Math.floor(Date.now() / 1000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/auth-client-config", route => route.fulfill({ status: 200, json: {
    ok: true,
    supabase_url: "https://btcbox-e2e.invalid",
    publishable_key: "e2e-anon-key-not-valid-for-production",
    google_enabled: false,
    wallet_enabled: false,
  } }));
  await page.route("**/api/account", route => route.fulfill({ status: 401, json: { ok: false, need_login: true } }));
  await page.route("**/api/market/pairs", route => route.fulfill({ status: 200, json: { ok: true, markets: [{
    base_asset: "BTC", quote_asset: "USDT", enabled: true,
    price_tick: "0.01", quantity_step: "0.000001", min_quantity: "0.000001", min_notional: "1",
  }] } }));
  await page.route("**/api/market", route => route.fulfill({ status: 200, json: {
    ok: true,
    markets: [{ sym: "BTC", price: 65000, chg: 1.25, high: 66000, low: 64000, vol: "1200", source: "provider" }],
    data: { BTC: { ts: now, providerTs: now, source: "provider" } },
  } }));
  await page.route("**/api/depth?**", route => route.fulfill({ status: 200, json: {
    ok: true, source: "provider", snapshotTs: now, bids: [["64999", "1"]], asks: [["65001", "1"]],
  } }));
  await page.route("**/api/trading/status", route => route.fulfill({ status: 200, json: {
    ok: true, spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: [],
  } }));
  await page.route("**/api/orders", route => route.fulfill({ status: 401, json: { ok: false, need_login: true } }));
  await page.route("https://btcbox-e2e.invalid/**", route => route.abort());
}

const validCandles = [
  { time: 1_700_000_002_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
  { time: 1_700_000_000_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
  { time: 1_700_000_002_500, open: 10, high: 13, low: 9, close: 12, volume: 2 },
];

test("spot terminal renders a chart from verified provider candles", async ({ page }) => {
  await mockSpotTerminal(page);
  let requests = 0;
  await page.route("**/api/kline?**", route => {
    requests += 1;
    return route.fulfill({ status: 200, json: { ok: true, source: "provider", klines: validCandles } });
  });

  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "BTCUSDT", exact: true })).toBeVisible();
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByText("Chart data is temporarily unavailable.", { exact: true })).toHaveCount(0);
});

test("a hanging chart request times out and a later interval refresh recovers", async ({ page }) => {
  await page.clock.install();
  await mockSpotTerminal(page);
  let attempts = 0;
  let releasePending: (() => void) | undefined;
  await page.route("**/api/kline?**", async route => {
    attempts += 1;
    if (attempts === 1) {
      await new Promise<void>(resolve => { releasePending = resolve; });
      await route.abort().catch(() => {});
      return;
    }
    await route.fulfill({ status: 200, json: { ok: true, source: "provider", klines: validCandles } });
  });

  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await expect.poll(() => attempts).toBe(1);
  await page.clock.fastForward(8_001);
  await expect(page.getByText("Chart data is temporarily unavailable.", { exact: true })).toBeVisible();

  releasePending?.();
  await page.getByRole("button", { name: "5m", exact: true }).click();
  await expect.poll(() => attempts).toBeGreaterThan(1);
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByText("Chart data is temporarily unavailable.", { exact: true })).toHaveCount(0);
});

test("K-line outages and empty provider payloads stay unavailable instead of showing generated candles", async ({ page }) => {
  await mockSpotTerminal(page);
  let empty = false;
  await page.route("**/api/kline?**", route => empty
    ? route.fulfill({ status: 200, json: { ok: true, source: "provider", klines: [] } })
    : route.fulfill({ status: 503, json: { ok: false, code: "KLINE_DATA_UNAVAILABLE", msg: "Chart data unavailable." } }));

  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Chart data is temporarily unavailable.", { exact: true })).toBeVisible();
  empty = true;
  await page.getByRole("button", { name: "5m", exact: true }).click();
  await expect(page.getByText("Chart data is temporarily unavailable.", { exact: true })).toBeVisible();
});
