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

test("account overview offers sign-in without requesting private account data", async ({ page }) => {
  const privateAccountRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/account") privateAccountRequests.push(request.method());
  });

  await page.goto("/me");

  await expect(page.getByText("Sign in to continue")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  expect(privateAccountRequests).toEqual([]);
});
