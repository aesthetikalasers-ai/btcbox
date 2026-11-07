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

  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
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

test("wallet sign-in failures remain visible and never create a BTCBOX session without a wallet provider", async ({ page }) => {
  const btcboxSessionExchanges: string[] = [];
  page.on("request", request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/supabase-login" || pathname === "/api/google-login") {
      btcboxSessionExchanges.push(pathname);
    }
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Connect Ethereum wallet" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).not.toBeEmpty();
  expect(btcboxSessionExchanges).toEqual([]);

  await page.goto("/login");
  await page.getByRole("button", { name: "Connect Solana wallet" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).not.toBeEmpty();
  expect(btcboxSessionExchanges).toEqual([]);
});

test("registration route offers Google and wallet identity creation without email registration", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await expect(page.getByText(/After verification, you will create your BTCBOX username and password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Solana wallet" })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
});

test("unauthenticated customer is redirected from a protected route", async ({ page }) => {
  await page.goto("/withdraw");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
});

test("administrator route requires a verified administrator identity", async ({ page }) => {
  const adminRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/admin/")) adminRequests.push(request.method());
  });

  await page.goto("/admin");

  await expect(page).toHaveURL("http://127.0.0.1:4173/admin");
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  // No administrator API, including the session verifier, may run without a Supabase identity.
  expect(adminRequests).toEqual([]);
});

test("assets, orders and KYC remain behind the authenticated account gate", async ({ page }) => {
  for (const path of ["/assets", "/orders", "/kyc"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
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
  await expect(page.getByText("Last price")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Limit order" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price chart" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Order book" })).toBeHidden();
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Price chart" })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.locator("div.fixed.inset-x-0.bottom-0")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Price chart" })).toBeHidden();
  await page.getByRole("button", { name: "Order book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Price chart" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Order book" })).toBeVisible();
  await expect(page.locator("div.fixed.inset-x-0.bottom-0")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order book" })).toBeHidden();
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
  let credentialsSaved = false;
  await page.route("**/api/account", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        uid: "e2e-new-identity",
        email: "",
        username: credentialsSaved ? "new_user_01" : "",
        has_login_password: credentialsSaved,
        balances: {},
        unpriced_assets: [],
        kyc: { status: "not_submitted" },
        twofa_enabled: false,
      }),
    });
  });
  await page.route("**/api/account/credentials", async (route) => {
    credentialRequests.push(route.request().postDataJSON());
    credentialsSaved = true;
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

async function installAdminE2EIdentity(page: import("@playwright/test").Page) {
  // Supabase JS persists a session under sb-<project-ref>-auth-token.
  // Seed only a synthetic E2E identity; all API traffic is intercepted below.
  await page.addInitScript(() => {
    localStorage.setItem("sb-btcbox-e2e-auth-token", JSON.stringify({
      access_token: "e2e-admin-access-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "e2e-admin-refresh-token",
      user: {
        id: "e2e-admin-001",
        aud: "authenticated",
        role: "authenticated",
        email: "admin@example.invalid",
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: {},
        created_at: "2026-11-01T00:00:00.000Z",
      },
    }));
  });
  await page.route("**/api/account", async route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(authenticatedAccountFixture),
  }));
  await page.route("**/api/admin/session", async route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      user_id: "e2e-admin-001",
      status: "active",
      is_super_admin: false,
      permissions: ["withdrawals.read", "withdrawals.review", "kyc.read", "kyc.review"],
    }),
  }));
}

test("Admin withdrawal refresh failure stays a read-only error and cannot imply a financial action", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let queueReads = 0;
  let failNextQueueRead = false;
  const adminMutations: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/admin/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      adminMutations.push(request.method() + " " + url.pathname);
    }
  });
  await page.route("**/api/admin/withdrawals", async route => {
    queueReads += 1;
    if (failNextQueueRead) {
      failNextQueueRead = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "QUEUE_UNAVAILABLE", msg: "Withdrawal review queue could not be refreshed." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, withdrawals: [{
        id: "E2E-WITHDRAWAL-001", uid: "e2e-user-001", coin: "USDT", amount: "25.00",
        fee: "1.00", network: "TRC20", address: "T-E2E-DESTINATION", status: "approved",
      }] }),
    });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Withdrawal queue" })).toBeVisible();
  await expect(page.getByText("E2E-WITHDRAWAL-001")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark paid" })).toBeDisabled();

  failNextQueueRead = true;
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(page.getByRole("alert")).toContainText("Withdrawal review queue could not be refreshed.");
  await expect(page.getByRole("alert")).not.toContainText("confirmed");
  expect(queueReads).toBeGreaterThan(1);
  expect(adminMutations).toEqual([]);
});

test("Admin KYC approval remains disabled without an uploaded document and secure preview", async ({ page }) => {
  await installAdminE2EIdentity(page);
  const adminMutations: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/admin/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      adminMutations.push(request.method() + " " + url.pathname);
    }
  });
  await page.route("**/api/admin/withdrawals", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, withdrawals: [] }),
  }));
  let kycReads = 0;
  await page.route("**/api/admin/kyc", async route => {
    kycReads += 1;
    if (kycReads > 1) {
      await route.fulfill({
        status: 503, contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "KYC_UNAVAILABLE", msg: "KYC review queue could not be refreshed." }),
      });
      return;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, kycs: [{
        uid: "e2e-user-kyc-001", email: "kyc-user@example.invalid", name: "QA KYC User",
        id_type: "passport", status: "pending", submitted_at: "2026-11-06T10:00:00.000Z",
        document_uploaded: false, document_url: undefined, document_preview_error: "Document image missing",
      }, {
        uid: "e2e-user-kyc-002", email: "preview-failed@example.invalid", name: "Preview Failed User",
        id_type: "national_id", status: "pending", submitted_at: "2026-11-06T11:00:00.000Z",
        document_uploaded: true, document_url: "https://storage.example.invalid/signed/kyc-document",
        document_preview_error: "Secure document preview could not be generated",
      }] }),
    });
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "KYC", exact: true }).click();
  await expect(page.getByRole("heading", { name: "KYC review" })).toBeVisible();
  await expect(page.getByText("QA KYC User")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Approve" }).nth(0)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Approve" }).nth(1)).toBeDisabled();
  await expect(page.getByText("Identity document upload is required before approval.")).toBeVisible();
  await expect(page.getByText("Secure document preview could not be generated")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open secure image" })).toHaveCount(0);

  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(page.getByRole("alert")).toContainText("KYC review queue could not be refreshed.");
  await expect(page.getByText("QA KYC User")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  expect(kycReads).toBeGreaterThanOrEqual(2);
  expect(adminMutations).toEqual([]);
});

test("Admin payout retry restores the exact TxID after an ambiguous response and reload", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let payoutAttempts = 0;
  let withdrawalReads = 0;
  await page.route("**/api/admin/withdrawals", async route => {
    withdrawalReads += 1;
    const completed = payoutAttempts >= 2;
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, withdrawals: [{
        id: "E2E-PAYOUT-RETRY-001", uid: "e2e-user-payout", coin: "USDT",
        amount: "25.00", fee: "1.00", network: "TRC20",
        address: "T-E2E-PAYOUT", status: completed ? "completed" : "approved",
        payout_reference: completed ? "0xE2E-PAYOUT-TX-REFERENCE" : undefined,
      }] }),
    });
  });
  await page.route("**/api/admin/withdraw/mark-paid", async route => {
    payoutAttempts += 1;
    const body = route.request().postDataJSON();
    if (payoutAttempts === 1) {
      await route.fulfill({
        status: 503, contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "UPSTREAM_UNAVAILABLE", msg: "Payout result is temporarily unavailable." }),
      });
      return;
    }
    expect(body).toMatchObject({ id: "E2E-PAYOUT-RETRY-001", reference: "0xE2E-PAYOUT-TX-REFERENCE" });
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, status: "completed", duplicate: true,
        payout_reference: "0xE2E-PAYOUT-TX-REFERENCE", paid_at: "2026-11-07T02:00:00.000Z",
      }),
    });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Withdrawal queue" })).toBeVisible();
  await page.getByPlaceholder("Required TxID / reference").fill("0xE2E-PAYOUT-TX-REFERENCE");
  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByRole("alert")).toContainText("The same reference has been saved.");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Withdrawal queue" })).toBeVisible();
  await expect(page.getByPlaceholder("Required TxID / reference")).toHaveValue("0xE2E-PAYOUT-TX-REFERENCE");
  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByRole("status")).toContainText("This payout reference was already recorded.");
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  expect(payoutAttempts).toBe(2);
  expect(withdrawalReads).toBeGreaterThanOrEqual(2);
});

test("Admin ignores an older audit page response after leaving and reopening the tab", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let auditReads = 0;
  let releaseOlder: (() => void) | null = null;
  await page.route("**/api/admin/audit-logs?**", async route => {
    auditReads += 1;
    const before = new URL(route.request().url()).searchParams.get("before");
    if (before === "9001") {
      await new Promise<void>(resolve => { releaseOlder = resolve; });
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true, source: "postgres_financial_audit_log", completeness: "postgres_canonical",
          logs: [{
            id: "E2E-AUDIT-STALE-OLDER", time: "2026-11-05T10:00:00.000Z",
            by: "e2e-admin-001", action: "manual_deposit_confirmed",
            uid: "e2e-user-stale", detail: "Stale older page response", postgres_sync_status: "synced",
          }],
          next_before: null,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, source: "postgres_financial_audit_log", completeness: "postgres_canonical",
        logs: [{
          id: auditReads === 1 ? "E2E-AUDIT-INITIAL" : "E2E-AUDIT-REOPENED",
          time: "2026-11-07T10:00:00.000Z", by: "e2e-admin-001",
          action: "manual_deposit_confirmed", uid: "e2e-user-new",
          detail: auditReads === 1 ? "Initial audit page" : "Reopened audit page",
          postgres_sync_status: "synced",
        }],
        next_before: auditReads === 1 ? "9001" : "8001",
      }),
    });
  });
  await page.route("**/api/admin/kyc", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kycs: [] }),
  }));
  await page.route("**/api/admin/withdrawals", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, withdrawals: [] }),
  }));
  await page.route("**/api/admin/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: false,
      permissions: ["withdrawals.read", "kyc.read", "financial_audit.read"],
    }),
  }));

  await page.goto("/admin");
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(page.getByText("Initial audit page")).toBeVisible();
  await page.getByRole("button", { name: "Load older records" }).click();
  await expect.poll(() => releaseOlder !== null).toBe(true);
  await page.getByRole("button", { name: "KYC", exact: true }).click();
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(page.getByText("Reopened audit page")).toBeVisible();
  releaseOlder?.();
  await expect(page.getByText("Stale older page response")).toHaveCount(0);
  await expect(page.getByText("Reopened audit page")).toBeVisible();
  expect(auditReads).toBe(3);
});

test("Admin legacy audit snapshot does not offer an unsupported cursor", async ({ page }) => {
  await installAdminE2EIdentity(page);
  await page.route("**/api/admin/audit-logs?**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, source: "btcbox_state", completeness: "state_document_retention_limited",
      logs: [{
        id: "AL1730950000abcdef", time: "2026-11-07T10:00:00.000Z",
        by: "e2e-admin-001", action: "manual_deposit_confirmed",
        uid: "e2e-user-legacy", detail: "Legacy audit fixture", postgres_sync_status: "local_only",
      }],
      next_before: "AL1730950000abcdef",
    }),
  }));
  await page.route("**/api/admin/kyc", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kycs: [] }),
  }));
  await page.route("**/api/admin/withdrawals", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, withdrawals: [] }),
  }));
  await page.route("**/api/admin/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: false,
      permissions: ["withdrawals.read", "kyc.read", "financial_audit.read"],
    }),
  }));

  await page.goto("/admin");
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(page.getByText("Legacy audit fixture")).toBeVisible();
  await expect(page.getByText("Legacy snapshot pagination is unavailable; this source is retention-limited.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load older records" })).toHaveCount(0);
});

test("Admin audit log loads older canonical pages without mixing sources", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let auditReads = 0;
  const requestedUrls: string[] = [];
  await page.route("**/api/admin/audit-logs?**", async route => {
    auditReads += 1;
    requestedUrls.push(route.request().url());
    const olderPage = new URL(route.request().url()).searchParams.has("before");
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, source: "postgres_financial_audit_log", completeness: "postgres_canonical",
        logs: olderPage ? [{
          id: "E2E-AUDIT-OLDER", time: "2026-11-06T10:00:00.000Z",
          by: "e2e-admin-001", action: "manual_deposit_confirmed",
          uid: "e2e-user-older", detail: "Older audit fixture", postgres_sync_status: "synced",
        }] : [{
          id: "E2E-AUDIT-NEWER", time: "2026-11-07T10:00:00.000Z",
          by: "e2e-admin-001", action: "manual_deposit_confirmed",
          uid: "e2e-user-newer", detail: "Newer audit fixture", postgres_sync_status: "synced",
        }],
        next_before: olderPage ? null : "9001",
      }),
    });
  });
  await page.route("**/api/admin/kyc", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kycs: [] }),
  }));
  await page.route("**/api/admin/withdrawals", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, withdrawals: [] }),
  }));
  await page.route("**/api/admin/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: false,
      permissions: ["withdrawals.read", "kyc.read", "financial_audit.read"],
    }),
  }));

  await page.goto("/admin");
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(page.getByText("Newer audit fixture")).toBeVisible();
  await expect(page.getByRole("cell", { name: "E2E-AUDIT-NEWER" })).toBeVisible();
  await expect(page.getByText("PostgreSQL canonical")).toBeVisible();
  await page.getByRole("button", { name: "Load older records" }).click();
  await expect(page.getByText("Older audit fixture")).toBeVisible();
  await expect(page.getByText("Newer audit fixture")).toBeVisible();
  await expect(page.getByText("Showing 2 records from this source snapshot.")).toBeVisible();
  await expect(page.getByText("No older records in this snapshot.")).toBeVisible();
  expect(auditReads).toBe(2);
  expect(requestedUrls[1]).toContain("before=9001");
});

test("Admin audit reload failure clears stale records and resets source confidence", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let auditReads = 0;
  let failNextAuditRead = false;
  await page.route("**/api/admin/audit-logs?**", async route => {
    auditReads += 1;
    if (!failNextAuditRead) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true, source: "postgres_financial_audit_log", completeness: "postgres_canonical",
          logs: [{
            id: "E2E-STALE-AUDIT", time: "2026-11-07T01:00:00.000Z",
            by: "e2e-admin-001", action: "manual_deposit_confirmed",
            uid: "e2e-user-001", detail: "E2E audit fixture", postgres_sync_status: "synced",
          }],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "AUDIT_UNAVAILABLE", msg: "Audit log is temporarily unavailable." }),
    });
  });
  await page.route("**/api/admin/kyc", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kycs: [] }),
  }));
  await page.route("**/api/admin/withdrawals", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, withdrawals: [] }),
  }));
  await page.route("**/api/admin/session", async route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: false,
      permissions: ["withdrawals.read", "kyc.read", "financial_audit.read"],
    }),
  }));

  await page.goto("/admin");
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Financial audit log" })).toBeVisible();
  await expect(page.getByText("E2E audit fixture")).toBeVisible();
  await expect(page.getByText("PostgreSQL canonical")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Event ID" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Operator ID" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Affected user UID" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "e2e-admin-001" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "e2e-user-001" })).toBeVisible();
  failNextAuditRead = true;

  await page.getByRole("button", { name: "KYC", exact: true }).click();
  await expect(page.getByRole("heading", { name: "KYC review" })).toBeVisible();
  await page.getByRole("button", { name: "Audit log", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("Audit log is temporarily unavailable.");
  await expect(page.getByText("E2E audit fixture")).toHaveCount(0);
  await expect(page.getByText("Source unknown")).toBeVisible();
  expect(auditReads).toBeGreaterThanOrEqual(2);
});

test("Admin queue reload failure never leaves stale withdrawal actions visible", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let queueReads = 0;
  let failNextQueueRead = false;
  await page.route("**/api/admin/withdrawals", async route => {
    queueReads += 1;
    if (failNextQueueRead) {
      failNextQueueRead = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "QUEUE_UNAVAILABLE", msg: "Withdrawal review queue could not be refreshed." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, withdrawals: [{
        id: "E2E-STALE-WITHDRAWAL", uid: "e2e-user-002", coin: "USDT", amount: "40.00",
        fee: "1.00", network: "TRC20", address: "T-E2E-STALE", status: "pending",
      }] }),
    });
  });
  await page.route("**/api/admin/kyc", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, kycs: [] }),
  }));

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Withdrawal queue" })).toBeVisible();
  await expect(page.getByText("E2E-STALE-WITHDRAWAL")).toBeVisible();

  await page.getByRole("button", { name: "KYC", exact: true }).click();
  await expect(page.getByRole("heading", { name: "KYC review" })).toBeVisible();
  failNextQueueRead = true;
  await page.getByRole("button", { name: "Withdrawals", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("Withdrawal review queue could not be refreshed.");
  await expect(page.getByText("E2E-STALE-WITHDRAWAL")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  expect(queueReads).toBeGreaterThanOrEqual(2);
});

test("trade chooser exposes the backend-enabled products and keeps unsupported futures unavailable", async ({ page }) => {
  await page.route("**/api/market/pairs", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{
      base_asset: "BTC", quote_asset: "USDT", enabled: true,
      price_tick: "0.01", quantity_step: "0.00001", min_quantity: "0.00001", min_notional: "5",
    }] }),
  }));

  await page.goto("/trade-hub");
  await expect(page.getByRole("heading", { name: "Choose your trading mode" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spot", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seconds" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BTC/USDT" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Earn", exact: true })).toBeVisible();
  await expect(page.getByText("Futures", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  const earnEntry = page.getByRole("link", { name: "Open" }).nth(2);
  await expect(earnEntry).toHaveAttribute("href", "/earn");

  // The Earn entrance is public; personal positions and any financial action remain login-gated.
  await earnEntry.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
});


test("registration experience stays clear and usable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Solana wallet" })).toBeVisible();
  await expect(page.getByText(/No email registration is required/i)).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("public preview landing page is available signed out with market data and registration entry points", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  const mutations: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      mutations.push(request.method() + " " + url.pathname);
    }
  });
  await page.route("**/api/market", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: [{ sym: "BTC", price: 65000, chg: 1.2, high: 66000, low: 64000, vol: "1000000", source: "coinbase" }], data: { BTC: { ts: Math.floor(Date.now() / 1000), providerTs: Math.floor(Date.now() / 1000), source: "coinbase" } } }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "coinbase", klines: [{ time: Date.now(), open: 64900, high: 65100, low: 64800, close: 65000, volume: 12 }] }),
  }));

  await page.goto("/home");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("nav[aria-label='Primary navigation']").last()).toBeVisible();
  await expect(page.locator("section").first().locator("[aria-label='BTCBOX Exchange']")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Explore the market. Trade with confidence." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Create account/i }).first()).toHaveAttribute("href", "/register");
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  await expect(page.getByText(/Live market feed|Connecting/)).toBeVisible();
  await expect(page.getByText(/Server snapshot/)).toBeVisible();
  await expect(page.getByText("BTC/USDT", { exact: true }).first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  expect(mutations).toEqual([]);
});


test("Admin user-detail failure clears the previously selected user's financial panel", async ({ page }) => {
  await installAdminE2EIdentity(page);
  await page.route("**/api/admin/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: false,
      permissions: ["users.read", "deposits.read", "deposits.review"],
    }),
  }));
  await page.route("**/api/admin/users**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, users: [
      { uid: "e2e-user-001", email: "first@example.invalid", frozen: false },
      { uid: "e2e-user-002", email: "second@example.invalid", frozen: false },
    ] }),
  }));
  let detailReads = 0;
  await page.route("**/api/admin/user?**", async route => {
    detailReads += 1;
    if (detailReads === 1) {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, user: {
          uid: "e2e-user-001", email: "first@example.invalid", frozen: false,
          financial_balance_source: "postgres_financial_ledger",
          deposit_history_source: "postgres_financial_ledger",
          balances: { USDT: { free: "250.00", frozen: "0", usdt: "250.00", valuation_available: true } },
          deposit_history: [{ id: "E2E-DEPOSIT-001", coin: "USDT", network: "TRC20", amount: "250.00", status: "completed", reference: "E2E-TX-FIRST", time: "2026-11-07T01:00:00.000Z" }],
        } }),
      });
      return;
    }
    await route.fulfill({
      status: 503, contentType: "application/json",
      body: JSON.stringify({ ok: false, code: "USER_DETAIL_UNAVAILABLE", msg: "User account could not be loaded." }),
    });
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Users & manual credit", exact: true }).click();
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await expect(page.getByRole("cell", { name: "first@example.invalid" })).toBeVisible();
  await expect(page.getByText("E2E-DEPOSIT-001")).toBeVisible();
  await expect(page.getByText("E2E-TX-FIRST")).toBeVisible();
  await expect(page.getByText("The account snapshot returns the 20 most recent deposits. Use the Audit log for the wider financial event trail.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "e2e-user-001" })).toBeVisible();

  await page.getByRole("button", { name: "Open", exact: true }).nth(1).click();
  await expect(page.getByRole("alert")).toContainText("User account could not be loaded.");
  await expect(page.getByText("E2E-TX-FIRST")).toHaveCount(0);
  await expect(page.getByText("Available: 250.00")).toHaveCount(0);
  await expect(page.getByText("Select a user to load their current balances.")).toBeVisible();
  expect(detailReads).toBe(2);
});


test("Admin rapid user selection ignores an older detail response", async ({ page }) => {
  await installAdminE2EIdentity(page);
  await page.route("**/api/admin/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: false,
      permissions: ["users.read", "deposits.read", "deposits.review"],
    }),
  }));
  await page.route("**/api/admin/users**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, users: [
      { uid: "e2e-user-slow", email: "slow@example.invalid", frozen: false },
      { uid: "e2e-user-fast", email: "fast@example.invalid", frozen: false },
    ] }),
  }));
  let detailReads = 0;
  let releaseSlow: (() => void) | null = null;
  await page.route("**/api/admin/user?**", async route => {
    detailReads += 1;
    if (detailReads === 1) {
      await new Promise<void>(resolve => { releaseSlow = resolve; });
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, user: {
          uid: "e2e-user-slow", email: "slow@example.invalid", frozen: false,
          financial_balance_source: "postgres_financial_ledger",
          balances: { USDT: { free: "111.00", frozen: "0", usdt: "111.00", valuation_available: true } },
        } }),
      });
      return;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, user: {
        uid: "e2e-user-fast", email: "fast@example.invalid", frozen: false,
        financial_balance_source: "postgres_financial_ledger",
        balances: { USDT: { free: "222.00", frozen: "0", usdt: "222.00", valuation_available: true } },
      } }),
    });
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Users & manual credit", exact: true }).click();
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await expect.poll(() => detailReads).toBe(1);
  await page.getByRole("button", { name: "Open", exact: true }).nth(1).click();
  await expect(page.getByRole("cell", { name: "fast@example.invalid" })).toBeVisible();
  await expect(page.getByText("Available: 222.00")).toBeVisible();

  if (!releaseSlow) throw new Error("The first user detail request did not start.");
  releaseSlow();
  await expect(page.getByRole("cell", { name: "fast@example.invalid" })).toBeVisible();
  await expect(page.getByText("Available: 222.00")).toBeVisible();
  // The earlier user remains in the directory; only the selected detail panel must stay on the newer user.
  await expect(page.getByRole("cell", { name: "slow@example.invalid" })).toBeVisible();
  await expect(page.getByText("Available: 111.00")).toHaveCount(0);
  expect(detailReads).toBe(2);
});

test("public preview distinguishes server snapshot time from upstream provider time", async ({ page }) => {
  const now = Math.floor(Date.now() / 1000);
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets: [{ sym: "BTC", price: 65000, chg: 1.2, high: 66000, low: 64000, vol: "1000000", source: "coinbase" }],
      data: { BTC: { ts: now, providerTs: now - 90, source: "coinbase" } },
    }),
  }));

  await page.goto("/home");

  await expect(page.getByText(/Server snapshot ·/)).toBeVisible();
  await expect(page.getByText(/Provider snapshot · coinbase · .* · [0-9]+s ago/)).toBeVisible();
});

test("Admin ignores a withdrawal queue response from a tab opened earlier", async ({ page }) => {
  await installAdminE2EIdentity(page);
  let withdrawalReads = 0;
  let releaseOlder: (() => void) | null = null;
  await page.route("**/api/admin/withdrawals", async route => {
    withdrawalReads += 1;
    if (withdrawalReads === 1) {
      await new Promise<void>(resolve => { releaseOlder = resolve; });
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, withdrawals: [{
          id: "E2E-WITHDRAWAL-STALE", uid: "e2e-old-user", coin: "USDT",
          amount: "10.00", fee: "1.00", network: "TRC20",
          address: "T-OLD", status: "approved",
        }] }),
      });
      return;
    }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, withdrawals: [{
        id: "E2E-WITHDRAWAL-CURRENT", uid: "e2e-current-user", coin: "USDT",
        amount: "20.00", fee: "1.00", network: "TRC20",
        address: "T-CURRENT", status: "approved",
      }] }),
    });
  });
  await page.route("**/api/admin/kyc", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, kycs: [] }),
  }));

  await page.goto("/admin");
  await expect.poll(() => releaseOlder !== null).toBe(true);
  await page.getByRole("button", { name: "KYC", exact: true }).click();
  await expect(page.getByRole("heading", { name: "KYC review" })).toBeVisible();
  await page.getByRole("button", { name: "Withdrawals", exact: true }).click();
  await expect(page.getByText("E2E-WITHDRAWAL-CURRENT")).toBeVisible();
  releaseOlder?.();
  await expect(page.getByText("E2E-WITHDRAWAL-STALE")).toHaveCount(0);
  await expect(page.getByText("E2E-WITHDRAWAL-CURRENT")).toBeVisible();
  expect(withdrawalReads).toBeGreaterThanOrEqual(2);
});


test("registration layout adapts from mobile to desktop without losing the identity choices", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 780 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Ethereum wallet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect Solana wallet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(page.getByLabel(/email/i)).toHaveCount(0);
    await expect(page.getByLabel("Username")).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `registration overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport);
    if (viewport.width >= 1024) {
      await expect(page.getByRole("heading", { name: "A clearer way to enter the digital asset market." })).toBeVisible();
    }
  }
});

test("public market preview remains responsive across mobile, tablet and desktop widths", async ({ page }) => {
  await page.route("**/api/market", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets: [{ sym: "BTC", price: 65000, chg: 1.2, high: 66000, low: 64000, vol: "1000000", source: "coinbase" }],
      data: { BTC: { ts: Math.floor(Date.now() / 1000), providerTs: Math.floor(Date.now() / 1000), source: "coinbase" } },
    }),
  }));
  await page.route("**/api/kline?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, source: "coinbase", klines: [{ time: Date.now(), open: 64900, high: 65100, low: 64800, close: 65000, volume: 12 }] }),
  }));

  for (const viewport of [
    { width: 320, height: 780 },
    { width: 375, height: 812 },
    { width: 768, height: 900 },
    { width: 1024, height: 900 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Explore the market. Trade with confidence." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
    await expect(page.locator("p:visible").filter({ hasText: "BTC/USDT" }).first()).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `public preview overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
});
