import { expect, test } from "@playwright/test";

/**
 * Phase 1 — authentication dialog acceptance.
 *
 * These tests cover the dialog itself (open / switch / close / context kept),
 * the legacy URL compatibility, and the requirement that a normal email or
 * Google flow never touches a Web3 wallet provider.
 */

const AUTH_CONFIG = {
  ok: true,
  supabase_url: "https://btcbox-e2e.invalid",
  publishable_key: "e2e-anon-key-not-valid-for-production",
  google_enabled: true,
  wallet_enabled: true,
};

test.describe("authentication dialog", () => {
  // Pin English: the product defaults first-time visitors to Japanese.
  test.use({
    storageState: {
      cookies: [],
      origins: [{ origin: "http://127.0.0.1:4173", localStorage: [{ name: "btcbox-language", value: "en" }] }],
    },
  });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth-client-config", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(AUTH_CONFIG),
  }));
  await page.route("**/api/account", route => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, msg: "Please sign in to continue." }),
  }));
  await page.route("https://btcbox-e2e.invalid/**", route => route.abort());
});

test("top bar sign in opens the auth dialog without leaving the page", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  // Email sign-in is a first-class method and is visible immediately.
  await expect(dialog.getByLabel("Email")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign in with email" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Google" })).toBeEnabled();
  // The page underneath did not navigate away.
  expect(new URL(page.url()).pathname).toBe("/home");
});

test("dialog switches between sign in and create account in place", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Create account", exact: true }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create account with email" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/home");

  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  // Still the same in-page dialog, still no navigation.
  expect(new URL(page.url()).pathname).toBe("/home");
});

test("closing the dialog returns to the same page and keeps market context", async ({ page }) => {
  await page.goto("/markets");
  const before = page.url();
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(page.url()).toBe(before);
  // Market content is still rendered: context was preserved, not reloaded away.
  await expect(page.getByRole("main")).toBeVisible();
});

test("forgot password is reachable inside the dialog and can go back", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("button", { name: "Forgot password?" }).click();
  await expect(dialog.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(dialog.getByLabel("Email")).toBeVisible();

  await dialog.getByRole("button", { name: "Back to sign in" }).click();
  await expect(dialog.getByRole("button", { name: "Sign in with email" })).toBeVisible();
});

test("legacy /login and /register URLs open the dialog instead of a separate page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your BTCBOX account" })).toBeVisible();
});

test("email sign-in never requests a Web3 wallet connection", async ({ page }) => {
  // Fail loudly if any wallet provider request is attempted during email auth.
  await page.addInitScript(() => {
    (window as unknown as { __walletCalls: string[] }).__walletCalls = [];
    const record = (method: string) => {
      (window as unknown as { __walletCalls: string[] }).__walletCalls.push(method);
      throw new Error("wallet provider must not be used during email auth");
    };
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {
        isMetaMask: true,
        request: ({ method }: { method: string }) => record(method),
      },
    });
  });

  await page.goto("/home");
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("someone@example.com");
  await dialog.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await dialog.getByRole("button", { name: "Sign in with email" }).click();

  // Allow the (aborted) Supabase request to settle, then assert no wallet call.
  await page.waitForTimeout(1500);
  const calls = await page.evaluate(() => (window as unknown as { __walletCalls: string[] }).__walletCalls);
  expect(calls).toEqual([]);
});
});
