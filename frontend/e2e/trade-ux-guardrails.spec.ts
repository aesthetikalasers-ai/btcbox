import { expect, test, type Page } from "@playwright/test";

/**
 * Guardrails for the trading-surface fixes that are purely presentational:
 *
 * 1. No `[BTCBOX i18n]` warning may be emitted by a market list. Tickers and pair
 *    codes used to be passed to `t()`, flooding the console on every trade screen
 *    and hiding real missing copy.
 * 2. The 24h volume is formatted compactly (1.30B), not with six decimals.
 * 3. A refused market order offers a one-click switch back to a limit order.
 * 4. The perpetual book aggregates duplicate provider levels and no longer prints
 *    a redundant "≈ $" line under the mid price.
 */

const SNAPSHOT_TS = Math.floor(Date.now() / 1000);

async function mockApis(page: Page, options: { price: string; vol: string; asks: Array<[string, string]>; bids: Array<[string, string]> }) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (pathname === "/api/auth-client-config") {
      return json({ ok: true, supabase_url: "https://btcbox-e2e.invalid", publishable_key: "e2e-anon-key-not-valid-for-production", google_enabled: false, wallet_enabled: false });
    }
    if (pathname === "/api/config") {
      return json({ ok: true, internal_conversion_enabled: false, spot_market_orders_enabled: false, referral_program_enabled: false });
    }
    if (pathname === "/api/account") {
      return json({
        ok: true, uid: "guardrails-user", email: "guardrails@example.invalid", username: "guardrails",
        has_login_password: true,
        balances: { USDT: { free: "1554", frozen: "0", usdt: "1554", valuation_available: true } },
        totalUsdt: "1554", valuation_complete: true, unpriced_assets: [],
        kyc: { status: "approved" }, twofa_enabled: false,
      });
    }
    if (pathname === "/api/market/pairs") {
      return json({ ok: true, markets: [{
        symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", enabled: true, trading_enabled: true,
        price_tick: "0.0001", quantity_step: "0.01", min_quantity: "0.01", min_notional: "1",
        min_limit_price: null, max_limit_price: null,
      }] });
    }
    if (pathname === "/api/market") {
      const snapshot = { price: options.price, chg: 1.25, high: options.price, low: options.price, vol: options.vol, ts: SNAPSHOT_TS, providerTs: SNAPSHOT_TS, source: "coinbase" };
      const row = { sym: "BTC", name: "Bitcoin", ...snapshot };
      return json({ ok: true, markets: [row], data: { BTC: snapshot }, source: "coinbase" });
    }
    if (pathname === "/api/depth") {
      return json({ ok: true, source: "coinbase", snapshotTs: SNAPSHOT_TS, bids: options.bids, asks: options.asks });
    }
    if (pathname === "/api/trading/status") {
      return json({ ok: true, spot_order_entry_enabled: true, spot_cancel_enabled: true, supported_order_types: ["limit"] });
    }
    if (pathname === "/api/orders") return json({ ok: true, orders: [], has_more: false, next_cursor: null });
    if (pathname === "/api/kline") return json({ ok: true, klines: [] });
    if (pathname === "/api/fx/usdt-usd") return json({ ok: true, rate: 1 });
    if (pathname === "/api/perpetual/markets") {
      return json({ ok: true, markets: [{
        symbol: "HOTUSDT", base_asset: "HOT", quote_asset: "USDT", status: "trading", max_leverage: 50,
        price_tick: "0.0001", quantity_step: "1", min_quantity: "1", funding_interval_sec: 28800,
        funding_rate_cap: 0.0075, mark_price: options.price, index_price: options.price, min_notional: "1",
      }] });
    }
    if (pathname === "/api/perpetual/positions") return json({ ok: true, positions: [] });
    if (pathname === "/api/perpetual/orders") return json({ ok: true, orders: [], has_more: false, next_cursor: null });
    if (pathname === "/api/perpetual/funding") return json({ ok: true, funding: [] });
    if (pathname === "/api/referral/profile" || pathname === "/api/referral/commissions") {
      // Closed programme: a capability answer, never a 404.
      return json({ ok: false, available: false, code: "REFERRAL_NOT_ENABLED", msg: "Referral rewards are not open yet." }, 501);
    }
    return json({ ok: false, code: "GUARDRAILS_ISOLATED", msg: "Not part of this fixture." }, 503);
  });
  await page.route("https://btcbox-e2e.invalid/**", (route) => route.abort());
}

function collectI18nWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("[BTCBOX i18n]")) warnings.push(message.text());
  });
  return warnings;
}

const ASKS: Array<[string, string]> = [["0.1500", "10"], ["0.1500", "5"], ["0.1600", "7"]];
const BIDS: Array<[string, string]> = [["0.1400", "12"], ["0.1400", "3"], ["0.1300", "9"]];

test("spot terminal formats volume and stays free of i18n noise", async ({ page }) => {
  const warnings = collectI18nWarnings(page);
  await mockApis(page, { price: "0.15", vol: "1301845540.465216", asks: ASKS, bids: BIDS });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("1.3B").first()).toBeVisible();
  await expect(page.getByText("1,301,845,540.465216")).toHaveCount(0);
  expect(warnings).toEqual([]);
});

test("a blocked market order offers a one-click switch to a limit order", async ({ page }) => {
  await mockApis(page, { price: "0.15", vol: "1301845540.465216", asks: ASKS, bids: BIDS });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });

  const orderTypeSelect = page.getByRole("combobox", { name: "Order type" }).first();
  if (await orderTypeSelect.isVisible()) {
    await orderTypeSelect.selectOption("market");
  } else {
    await page.getByRole("button", { name: "Market order", exact: true }).first().click();
  }

  await expect(page.getByText("Market orders are disabled for this market").first()).toBeVisible();
  await page.getByRole("button", { name: "Switch to limit order" }).first().click();
  await expect(page.getByLabel("Limit price (USDT)").first()).toBeVisible();
});

test("perpetual book merges duplicate levels instead of repeating a price", async ({ page }) => {
  await mockApis(page, { price: "0.15", vol: "1301845540.465216", asks: ASKS, bids: BIDS });
  await page.setViewportSize({ width: 440, height: 956 });
  await page.goto("/contract", { waitUntil: "domcontentloaded" });

  const workspace = page.getByTestId("perp-mobile-workspace");
  await expect(workspace).toBeVisible();

  // Three raw ask rows collapse to two buckets: the duplicate 0.1500 pair merges
  // into one 15.00000 size instead of printing the same price twice.
  await expect(workspace.locator('[data-side="ask"]')).toHaveCount(2);
  await expect(workspace.locator('[data-side="ask"]').last()).toContainText("15");
  // No redundant dollar line under the mid price on a USDT-quoted contract.
  await expect(workspace).not.toContainText("≈");
});
