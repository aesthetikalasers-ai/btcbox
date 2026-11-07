import { expect, test } from "@playwright/test";

test("public dashboard removes confirmed quotes when the live feed becomes unavailable", async ({ page }) => {
  let marketRequests = 0;
  await page.clock.install();
  await page.route("**/api/market", async route => {
    marketRequests += 1;
    if (marketRequests === 1) {
      const now = Math.floor(Date.now() / 1000);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          markets: [{ sym: "BTC", price: 65000, chg: 1.2, high: 66000, low: 64000, vol: "1000000", source: "coinbase" }],
          data: { BTC: { ts: now, providerTs: now, source: "coinbase" } },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "MARKET_UNAVAILABLE", msg: "Market feed unavailable." }),
    });
  });
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, msg: "Historical market data is unavailable." }),
  }));

  await page.goto("/home");
  await expect(page.getByText(/65,?000\.00/)).toBeVisible();
  await page.clock.fastForward(15000);

  await expect(page.getByText("Market feed unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText(/65,?000\.00/)).toHaveCount(0);
  await expect(page.getByText("Live refresh unavailable. Showing the last confirmed market data.")).toHaveCount(0);
  expect(marketRequests).toBeGreaterThanOrEqual(2);
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
