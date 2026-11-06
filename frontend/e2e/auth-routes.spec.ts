import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep the browser suite isolated from real Supabase identities and hosted data.
  await page.route("**/api/auth-client-config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        supabase_url: "https://btcbox-e2e.invalid",
        publishable_key: "e2e-anon-key-not-valid-for-production",
        google_enabled: false,
      }),
    });
  });

  await page.route("**/api/account", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        need_login: true,
        msg: "Please sign in to continue.",
      }),
    });
  });

  await page.route("https://btcbox-e2e.invalid/**", (route) => route.abort());
});

test("login route renders username and email sign-in", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("BTCBOX username", { exact: true })).toBeVisible();
  await expect(page.getByText("Continue with email")).toBeVisible();
});

test("registration route renders account creation form", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
  await expect(page.getByText("Register with email")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
});

test("unauthenticated customer is redirected from a protected route", async ({ page }) => {
  await page.goto("/withdraw");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("administrator route requires a verified administrator identity", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL("http://127.0.0.1:4173/admin");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("Continue with email")).toBeVisible();
});

test("assets, orders and KYC remain behind the authenticated account gate", async ({ page }) => {
  for (const path of ["/assets", "/orders", "/kyc"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
});

test("account overview stays signed out after the auth session bootstrap check", async ({ page }) => {
  const privateAccountRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/account") privateAccountRequests.push(request.method());
  });

  await page.goto("/me");

  await expect(page.getByText("Sign in to continue")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  // AuthProvider performs one read-only account probe to restore an existing cookie session.
  // That bootstrap GET is expected while signed out; no write endpoint is involved.
  expect(privateAccountRequests).toEqual(["GET"]);
});

const authenticatedAccountFixture = {
  ok: true,
  uid: "e2e-user-001",
  email: "qa-user@example.invalid",
  username: "qa_user",
  has_login_password: true,
  balances: {
    USDT: { free: "125.50", frozen: "10.00", usdt: "125.50", valuation_available: true },
    BTC: { free: "0.002", frozen: "0", valuation_available: false },
  },
  totalUsdt: "125.50",
  valuation_complete: false,
  unpriced_assets: ["BTC"],
  kyc: { status: "not_submitted" },
  twofa_enabled: false,
};

test("authenticated assets page renders only the mocked account balances", async ({ page }) => {
  await page.route("**/api/account", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(authenticatedAccountFixture) });
  });

  await page.goto("/assets");

  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  // The individual balances remain visible, but an incomplete valuation must not be shown as a total.
  await expect(page.getByText("125.5", { exact: true })).toBeVisible();
  await expect(page.getByText("USDT", { exact: true })).toBeVisible();
  await expect(page.getByText("0.002", { exact: true })).toBeVisible();
  await expect(page.getByText("125.5 USDT", { exact: true })).toHaveCount(0);
});

test("authenticated order history renders read-only mocked order rows", async ({ page }) => {
  await page.route("**/api/account", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(authenticatedAccountFixture) });
  });
  await page.route("**/api/orders", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ ok: false }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        orders: [{
          order_id: "E2E-ORDER-001",
          symbol: "BTC/USDT",
          side: "buy",
          type: "limit",
          price: "65000.00",
          quantity: "0.001",
          status: "open",
          created_at: "2026-11-06T10:00:00Z",
        }],
      }),
    });
  });

  await page.goto("/orders");

  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();
  await expect(page.getByText("E2E-ORDER-001")).toBeVisible();
  await expect(page.getByText("BTC/USDT")).toBeVisible();
  await expect(page.getByText("65000.00")).toBeVisible();
  await expect(page.getByText("open", { exact: true })).toBeVisible();
});
