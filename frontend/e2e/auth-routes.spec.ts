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

test("login route exposes username/password, Google and wallet sign-in", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByText("Google sign-in is temporarily unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Solana wallet" })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
});

test("Google sign-in button is shown when the public auth config enables Google", async ({ page }) => {
  await page.route("**/api/auth-client-config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        supabase_url: "https://btcbox-e2e.invalid",
        publishable_key: "e2e-anon-key-not-valid-for-production",
        google_enabled: true,
      }),
    });
  });

  await page.goto("/login");

  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Solana wallet" })).toBeVisible();
});

test("registration route offers Google and wallet identity creation without email registration", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
  await expect(page.getByText(/set a BTCBOX username and password after verification/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Solana wallet" })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
});

test("unauthenticated customer is redirected from a protected route", async ({ page }) => {
  await page.goto("/withdraw");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("administrator route requires a verified administrator identity", async ({ page }) => {
  const adminRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/admin/")) adminRequests.push(request.method());
  });

  await page.goto("/admin");

  await expect(page).toHaveURL("http://127.0.0.1:4173/admin");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  // No administrator API, including the session verifier, may run without a Supabase identity.
  expect(adminRequests).toEqual([]);
});

test("assets, orders and KYC remain behind the authenticated account gate", async ({ page }) => {
  for (const path of ["/assets", "/orders", "/kyc"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
});

test("signed-out customer routes never issue financial or account mutations", async ({ page }) => {
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      mutationRequests.push(request.method() + " " + url.pathname);
    }
  });

  for (const path of ["/deposit", "/withdraw", "/assets", "/orders", "/kyc", "/seconds", "/support", "/settings", "/earn"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }

  expect(mutationRequests).toEqual([]);
});

test("spot trading preview remains public while signed-out order mutations stay blocked", async ({ page }) => {
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      mutationRequests.push(request.method() + " " + url.pathname);
    }
  });

  await page.goto("/trade/BTCUSDT");

  expect(page.url()).toContain("/trade/BTCUSDT");
  await expect(page.getByRole("heading", { name: "BTCUSDT" })).toBeVisible();
  expect(mutationRequests).toEqual([]);
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


const authenticatedKycFixture = {
  ...authenticatedAccountFixture,
  kyc: { status: "pending", name: "QA Example", id_type: "passport", id_number: "E2E-123456" },
};

test("authenticated KYC page renders the read-only pending review state", async ({ page }) => {
  await page.route("**/api/account", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(authenticatedKycFixture) });
  });

  await page.goto("/kyc");

  await expect(page.getByRole("heading", { name: "Identity verification" })).toBeVisible();
  await expect(page.getByText("Current status")).toBeVisible();
  await expect(page.getByText("pending", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("QA Example", { exact: true })).toBeVisible();
  await expect(page.getByText("••••3456", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0);
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

test("spot preview keeps provider provenance visible and fits a 320px mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.route("**/api/market/pairs", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{ base_asset: "BTC", quote_asset: "USDT", enabled: true, price_tick: "0.01", quantity_step: "0.00001", min_quantity: "0.00001", min_notional: "5" }] }),
  }));
  await page.route("**/api/market", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{ sym: "BTC", price: 65000, chg: 1.2, high: 66000, low: 64000, vol: "1000000", source: "coinbase" }], data: { BTC: { ts: Math.floor(Date.now() / 1000), providerTs: Math.floor(Date.now() / 1000), source: "coinbase" } } }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "coinbase", klines: [{ time: Date.now(), open: 64900, high: 65100, low: 64800, close: 65000, volume: 12 }] }),
  }));
  await page.route("**/api/depth?**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "bybit", snapshotTs: Math.floor(Date.now() / 1000), bids: [["64999", "1.2"]], asks: [["65001", "0.8"]] }),
  }));
  await page.route("**/api/trading/status", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, spot_order_entry_enabled: false, spot_cancel_enabled: false, supported_order_types: [] }),
  }));
  await page.route("**/api/orders", route => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, code: "AUTH_REQUIRED", msg: "Please sign in to continue." }),
  }));

  await page.goto("/trade/BTCUSDT");
  await expect(page.getByRole("heading", { name: "BTCUSDT" })).toBeVisible();
  await expect(page.getByText("Ticker: coinbase · Order book: bybit · Chart: coinbase")).toBeVisible();
  await expect(page.getByText(/Chart refresh is unavailable/)).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("username login submits BTCBOX credentials to the username endpoint and surfaces rejection", async ({ page }) => {
  let submitted: { username?: string; password?: string } | null = null;
  await page.route("**/api/login", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "INVALID_CREDENTIALS", msg: "Username or password is incorrect." }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Username").fill("qa_user");
  await page.getByLabel("Password").fill("a-secure-test-password");
  await page.getByRole("button", { name: "Sign in with username" }).click();

  await expect(page.getByRole("alert")).toContainText("Username or password is incorrect.");
  expect(submitted).toEqual({ username: "qa_user", password: "a-secure-test-password" });
});

test("first verified Google or wallet identity can set username and password on the same BTCBOX account", async ({ page }) => {
  const credentialRequests: Array<{ username?: string; password?: string; current_password?: string }> = [];
  await page.route("**/api/account", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        uid: "e2e-new-identity",
        email: "",
        username: "",
        has_login_password: false,
        balances: {},
        unpriced_assets: [],
        kyc: { status: "not_submitted" },
        twofa_enabled: false,
      }),
    });
  });
  await page.route("**/api/account/credentials", async (route) => {
    credentialRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, username: "new_user_01", has_login_password: true }),
    });
  });

  await page.goto("/account-setup");
  await expect(page.getByRole("heading", { name: "Set up your BTCBOX account" })).toBeVisible();
  await page.getByLabel("Choose a username").fill("new_user_01");
  await page.getByLabel("Create a password").fill("a-secure-test-password");
  await page.getByLabel("Confirm password").fill("a-secure-test-password");
  await page.getByRole("button", { name: "Save BTCBOX credentials" }).click();

  await expect(page).toHaveURL(/\/home$/);
  expect(credentialRequests).toEqual([{
    username: "new_user_01",
    password: "a-secure-test-password",
    current_password: "",
  }]);
});

test("OAuth callback cancellation returns a visible recovery path without creating a BTCBOX session", async ({ page }) => {
  await page.goto("/auth/react-callback?error=access_denied&error_description=Google%20sign-in%20was%20cancelled");

  await expect(page.getByText("Google sign-in was cancelled")).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login");
  await expect(page).toHaveURL(/\/auth\/react-callback\?/);
});
