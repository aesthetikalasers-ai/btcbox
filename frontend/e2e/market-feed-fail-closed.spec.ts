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
