import { expect, test } from "@playwright/test";

const AUTH_CONFIG = {
  ok: true,
  supabase_url: "https://btcbox-e2e.invalid",
  publishable_key: "e2e-anon-key-not-valid-for-production",
  google_enabled: true,
  wallet_enabled: false,
};

test("standalone Admin Google sign-in stores /admin before starting OAuth", async ({ page }) => {
  await page.route("**/api/auth-client-config", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(AUTH_CONFIG),
  }));
  await page.route("**/api/account", route => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ ok: false, need_login: true, msg: "Please sign in to continue." }),
  }));
  let savedReturnTo: string | null = null;
  page.on("console", message => {
    const prefix = "BTCBOX_OAUTH_RETURN_TO:";
    if (message.text().startsWith(prefix)) savedReturnTo = message.text().slice(prefix.length);
  });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === window.sessionStorage && key === "btcbox:oauth:return-to") {
        console.log("BTCBOX_OAUTH_RETURN_TO:" + value);
      }
      return originalSetItem.call(this, key, value);
    };
  });
  await page.route("https://btcbox-e2e.invalid/**", route => route.abort());

  await page.goto("/admin");
  const google = page.getByRole("button", { name: "Google", exact: true });
  await expect(google).toBeEnabled();
  await google.click();
  await expect.poll(() => savedReturnTo).toBe("/admin");
});

test("OAuth callback consumes the saved Admin destination after Supabase session restoration", async ({ page }) => {
  await page.route("**/api/auth-client-config", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(AUTH_CONFIG),
  }));
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
    sessionStorage.setItem("btcbox:oauth:return-to", "/admin");
  });
  let accountReads = 0;
  await page.route("**/api/account", route => {
    accountReads += 1;
    if (accountReads === 1) {
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, need_login: true }) });
    }
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, uid: "e2e-admin-001", email: "admin@example.invalid", username: "admin", has_login_password: true, restriction: null, balances: {}, unpriced_assets: [] }),
    });
  });
  await page.route("**/api/supabase-login", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }),
  }));
  await page.route("**/api/admin/session", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, user_id: "e2e-admin-001", status: "active", is_super_admin: true, permissions: [] }),
  }));

  await page.goto("/auth/react-callback");
  await expect(page).toHaveURL(url => new URL(url).pathname === "/admin");
  await expect(page.locator("h1")).toContainText("控制台");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("btcbox:oauth:return-to"))).toBeNull();
});
