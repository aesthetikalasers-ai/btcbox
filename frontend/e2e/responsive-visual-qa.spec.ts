import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const widths = [320, 360, 375, 390, 430, 768, 1024, 1440];
const routes = [
  { path: "/login", heading: "Welcome back" },
  { path: "/register", heading: "Create your BTCBOX account" },
  { path: "/home", heading: /Welcome back to your market\.|Explore the market\. Trade with confidence\./ },
  { path: "/markets", heading: "Market overview" },
  { path: "/trade/BTCUSDT", heading: "BTCUSDT" },
  { path: "/trade-hub", heading: "Choose your trading mode" },
  { path: "/assets", heading: "Assets" },
  { path: "/me", heading: "My account" },
  { path: "/settings", heading: "Account security" },
  { path: "/support", heading: "Customer support" },
  { path: "/orders", heading: "Orders" },
  { path: "/deposit", heading: "Deposit" },
  { path: "/withdraw", heading: "Withdraw" },
  { path: "/earn", heading: "Earn" },
  { path: "/kyc", heading: "Identity verification" },
];

for (const route of routes) {
test(`responsive visual QA ${route.path} fits every viewport`, async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(test.info().project.name !== "desktop-chromium", "The desktop Chromium project iterates the full viewport matrix.");
  const output = path.resolve(process.cwd(), "test-results/visual-qa");
  fs.mkdirSync(output, { recursive: true });

  await page.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/auth-client-config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true, supabase_url: "https://btcbox-e2e.invalid",
        publishable_key: "e2e-anon-key-not-valid-for-production", google_enabled: false, wallet_enabled: false,
      }) });
      return;
    }
    if (pathname === "/api/account") {
      const currentPath = new URL(page.url()).pathname;
      if (["/login", "/register"].includes(currentPath)) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, need_login: true }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          ok: true, uid: "visual-qa-user", email: "visual@example.invalid", username: "visual_qa",
          has_login_password: true, balances: {}, totalUsdt: "0", valuation_complete: true,
          unpriced_assets: [], kyc: { status: "not_submitted" }, twofa_enabled: false,
        }) });
      }
      return;
    }
    if (pathname === "/api/market") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, markets: [], data: {} }) });
      return;
    }
    if (pathname === "/api/market/pairs") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, markets: [] }) });
      return;
    }
    if (pathname === "/api/kline") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, klines: [] }) });
      return;
    }
    if (pathname === "/api/support/messages") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, messages: [] }) });
      return;
    }
    if (pathname === "/api/orders") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, orders: [] }) });
      return;
    }
    if (pathname === "/api/deposit") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" }) });
      return;
    }
    if (pathname === "/api/addresses") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, addresses: [{
        id: "visual-address-1", type: "crypto", coin: "USDT", network: "TRC20", address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
      }] }) });
      return;
    }
    if (pathname === "/api/addresses/select") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, coin: "USDT", network: "TRC20", address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" }) });
      return;
    }
    if (pathname === "/api/withdrawal/config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, actions_enabled: true, fees: { USDT: "1" }, allowed_networks: { USDT: ["TRC20"] } }) });
      return;
    }
    if (pathname === "/api/earn/products") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, actions_enabled: true, products: [
        { product_id: "usdt-flex", asset: "USDT", product_type: "demand", apy_percent: 4.2, term_days: 0, early_fee_percent: 0, amount_scale: 2 },
        { product_id: "btc-fixed-30", asset: "BTC", product_type: "fixed", apy_percent: 2.8, term_days: 30, early_fee_percent: 1, amount_scale: 6 },
      ] }) });
      return;
    }
    if (pathname === "/api/trading/status") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true, spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: [],
      }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
      ok: false, code: "VISUAL_QA_ISOLATED", msg: "This service is temporarily unavailable.",
    }) });
  });
  await page.route("https://btcbox-e2e.invalid/**", route => route.abort());

    const routePath = route.path;
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(routePath, { waitUntil: "domcontentloaded" });
      await expect(page.locator("#root")).not.toBeEmpty();
      expect(new URL(page.url()).pathname).toBe(routePath);
      await expect(page.getByRole("heading", { name: route.heading, ...(typeof route.heading === "string" ? { exact: true } : {}) })).toBeVisible({ timeout: 15000 });
      if (!["/login", "/register"].includes(routePath) && width <= 480) {
        await expect(page.getByRole("link", { name: "BTCBOX home" }).getByRole("img", { name: "BTCBOX" })).toBeVisible();
      }
      if (routePath === "/markets") await expect(page.getByRole("heading", { name: "Explore the market. Trade with confidence.", exact: true })).toHaveCount(0);
      if (routePath === "/markets") await expect(page.getByText("No markets enabled", { exact: true })).toBeVisible();
      if (routePath === "/trade-hub") await expect(page.getByTestId("spot-availability")).toHaveText("Unavailable");
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.document, `${routePath} at ${width}px has document horizontal overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(width);
      expect(dimensions.body, `${routePath} at ${width}px has body horizontal overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(width);
      const slug = routePath.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
      await page.screenshot({ path: path.join(output, `${slug}-${width}.png`), fullPage: true, animations: "disabled" });
    }
});
}
