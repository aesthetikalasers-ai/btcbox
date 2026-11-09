import { expect, test } from "@playwright/test";

test("username login keeps the authenticator challenge visible and completes sign-in", async ({ page }) => {
  let signedIn = false;
  await page.route("**/api/auth-client-config", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      supabase_url: "https://btcbox-e2e.invalid",
      publishable_key: "e2e-anon-key-not-valid-for-production",
      google_enabled: false,
      wallet_enabled: false,
    }),
  }));
  await page.route("**/api/account", route => route.fulfill({
    status: signedIn ? 200 : 401,
    contentType: "application/json",
    body: JSON.stringify(signedIn ? {
      ok: true,
      uid: "e2e-two-factor-user",
      email: "",
      username: "qa_user",
      has_login_password: true,
      balances: {},
      unpriced_assets: [],
      kyc: { status: "not_submitted" },
      twofa_enabled: true,
    } : { ok: false, need_login: true, msg: "Please sign in to continue." }),
  }));
  await page.route("**/api/login", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, require_2fa: true, temp_token: "e2e-temporary-two-factor-token" }),
  }));
  await page.route("**/api/login/2fa", async route => {
    expect(route.request().postDataJSON()).toEqual({ temp_token: "e2e-temporary-two-factor-token", code: "123456" });
    signedIn = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("https://btcbox-e2e.invalid/**", route => route.abort());

  await page.goto("/login");
  await page.getByLabel("Username").fill("qa_user");
  await page.getByLabel("Password", { exact: true }).fill("a-secure-test-password");
  await page.getByRole("button", { name: "Sign in with username" }).click();

  await expect(page.getByRole("heading", { name: "Verify your sign-in" })).toBeVisible();
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify and continue" })).toBeEnabled();
  await expect(page.getByTestId("auth-mode-switcher")).toHaveCount(0);

  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/home$/);
});
