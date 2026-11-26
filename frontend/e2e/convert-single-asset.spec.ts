import { expect, test, type Page } from "@playwright/test";

/**
 * `/convert` used to build its asset selectors from the account balances alone.
 * The balance list only contains rows the ledger has already touched, so a
 * customer whose first deposit credited a single asset saw "No asset balances are
 * currently available." and could not convert at all — the one flow that matters
 * most right after a deposit. These tests pin the balance + market-catalogue
 * union and the server-error copy that the page must surface.
 */
async function mockConversion(page: Page, options: { balances: Record<string, unknown>; quoteResponse?: Record<string, unknown>; configResponse?: Record<string, unknown> }) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/config" && options.configResponse) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.configResponse) });
      return;
    }
    if (pathname === "/api/auth-client-config") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          supabase_url: "https://btcbox-e2e.invalid",
          publishable_key: "e2e-anon-key-not-valid-for-production",
          google_enabled: false,
          wallet_enabled: false,
        }),
      });
      return;
    }
    if (pathname === "/api/account") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          uid: "conversion-fixture-user",
          email: "conversion@example.invalid",
          username: "conversion_fixture",
          has_login_password: true,
          balances: options.balances,
          totalUsdt: "1000",
          valuation_complete: true,
          unpriced_assets: [],
          kyc: { status: "not_submitted" },
          twofa_enabled: false,
        }),
      });
      return;
    }
    if (pathname === "/api/market/pairs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          markets: [{
            symbol: "BTCUSDT",
            base_asset: "BTC",
            quote_asset: "USDT",
            enabled: true,
            price_tick: "0.01",
            quantity_step: "0.000001",
            min_quantity: "0.000001",
            min_notional: "1",
            min_limit_price: null,
            max_limit_price: null,
          }],
        }),
      });
      return;
    }
    if (pathname === "/api/convert/quote") {
      const failure = options.quoteResponse || {
        ok: false,
        code: "CONVERSION_AMOUNT_TOO_SMALL",
        msg: "The converted amount is below the supported precision.",
      };
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify(failure) });
      return;
    }
    if (pathname === "/api/market") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, markets: [], data: {} }) });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "CONVERSION_QA_ISOLATED", msg: "Not part of this fixture." }),
    });
  });
  await page.route("https://btcbox-e2e.invalid/**", (route) => route.abort());
}

test("a single-asset account can still pick a destination asset", async ({ page }) => {
  // Exactly what a first USDT deposit leaves behind: one ledger row, nothing else.
  await mockConversion(page, { balances: { USDT: { free: "1000", frozen: "0", usdt: "1000", valuation_available: true } } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/convert", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Convert", exact: true })).toBeVisible();
  await expect(page.getByText("No asset balances are currently available.")).toHaveCount(0);
  await expect(page.getByLabel("From")).toHaveValue("USDT");
  await expect(page.getByLabel("To")).toHaveValue("BTC");
  await expect(page.getByRole("button", { name: "Swap assets" })).toBeEnabled();
  await expect(page.getByLabel("Amount")).toBeEditable();
});

test("a rejected quote explains the specific reason instead of a generic failure", async ({ page }) => {
  await mockConversion(page, {
    balances: {
      BTC: { free: "0.125", frozen: "0", usdt: "8125", valuation_available: true },
      USDT: { free: "2500", frozen: "0", usdt: "2500", valuation_available: true },
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/convert", { waitUntil: "domcontentloaded" });

  await page.getByLabel("Amount").fill("0.0000001");
  await page.getByRole("button", { name: "Get quote" }).click();
  await expect(page.getByRole("alert")).toHaveText("The converted amount is below the supported precision.");
});

test("a closed conversion feature is stated before the form is filled in", async ({ page }) => {
  // The page used to accept an amount, a pair and a click before answering
  // "not open yet", which wasted the whole flow and blurred a policy decision
  // with a service outage. The capability from /api/config now closes the form.
  await mockConversion(page, {
    balances: { USDT: { free: "1000", frozen: "0", usdt: "1000", valuation_available: true } },
    configResponse: { ok: true, internal_conversion_enabled: false },
  });
  const quoteRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/convert/quote")) quoteRequests.push(request.url());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/convert", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("conversion-not-open")).toBeVisible();
  await expect(page.getByText("Internal conversion is not open yet.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Get quote" })).toHaveCount(0);
  await expect(page.getByLabel("Amount")).toHaveCount(0);
  expect(quoteRequests).toHaveLength(0);
});
