import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixedWidths = [375, 390, 430, 768, 1366, 1440, 1920];
const mobileWidths = [375, 390, 430];
const continuityWidths = [
  320, 360, 375, 390, 414, 430, 480, 540, 600, 640, 680, 720,
  768, 820, 860, 899, 900, 960, 1024, 1100, 1180, 1280, 1366,
  1440, 1536, 1680, 1920,
];
const routes = [
  { path: "/login", heading: "Welcome back" },
  { path: "/register", heading: "Create your BTCBOX account" },
  { path: "/home", heading: "Market overview" },
  { path: "/markets", heading: "Market overview" },
  { path: "/trade/BTCUSDT", heading: "BTCUSDT" },
  { path: "/trade-hub", heading: "Choose your trading mode" },
  { path: "/assets", heading: "Assets" },
  { path: "/me", heading: "My account" },
  { path: "/settings", heading: "Account security" },
  { path: "/support", heading: "Customer support" },
  { path: "/orders", heading: "Orders" },
];

async function installVisualApiMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
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
      const currentPath = new URL(page.url()).pathname;
      if (["/login", "/register"].includes(currentPath)) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, need_login: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            uid: "visual-qa-user",
            email: "visual@example.invalid",
            username: "visual_qa",
            has_login_password: true,
            balances: {},
            totalUsdt: "0",
            valuation_complete: true,
            unpriced_assets: [],
            kyc: { status: "not_submitted" },
            twofa_enabled: false,
          }),
        });
      }
      return;
    }
    if (pathname === "/api/market" || pathname === "/api/market/pairs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, markets: [], data: {} }),
      });
      return;
    }
    if (pathname === "/api/kline") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, klines: [] }),
      });
      return;
    }
    if (pathname === "/api/support/messages") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, messages: [] }),
      });
      return;
    }
    if (pathname === "/api/orders") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, orders: [] }),
      });
      return;
    }
    if (pathname === "/api/trading/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          spot_order_entry_enabled: false,
          spot_cancel_enabled: false,
          supported_order_types: [],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "VISUAL_QA_ISOLATED",
        msg: "This service is temporarily unavailable.",
      }),
    });
  });
  await page.route("https://btcbox-e2e.invalid/**", (route) => route.abort());
}

async function assertPageAtWidth(
  page: Page,
  route: (typeof routes)[number],
  width: number,
  output: string,
  projectName: string,
) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).not.toBeEmpty();
  expect(new URL(page.url()).pathname).toBe(route.path);
  await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible({ timeout: 15000 });

  if (!["/login", "/register"].includes(route.path) && width <= 480) {
    await expect(
      page.getByRole("link", { name: "BTCBOX home" }).getByRole("img", { name: "BTCBOX" }),
    ).toBeVisible();
  }
  if (route.path === "/markets") {
    await expect(page.getByRole("heading", {
      name: "Explore the market. Trade with confidence.",
      exact: true,
    })).toHaveCount(0);
  }
  if (route.path === "/home" || route.path === "/markets") {
    await expect(page.getByText("No markets enabled", { exact: true })).toBeVisible();
  }
  if (route.path === "/trade-hub") {
    await expect(page.getByTestId("spot-availability")).toHaveText("Unavailable");
  }

  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(
    dimensions.document,
    route.path + " at " + width + "px has document horizontal overflow: " + JSON.stringify(dimensions),
  ).toBeLessThanOrEqual(width);
  expect(
    dimensions.body,
    route.path + " at " + width + "px has body horizontal overflow: " + JSON.stringify(dimensions),
  ).toBeLessThanOrEqual(width);

  const slug = route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
  await page.screenshot({
    path: path.join(output, projectName, slug + "-" + width + ".png"),
    fullPage: true,
    animations: "disabled",
  });
}

for (const route of routes) {
  test("responsive visual QA " + route.path + " at V1.0 widths", async ({ page }) => {
    test.setTimeout(240_000);
    const projectName = test.info().project.name;
    const isMobileProject = projectName === "mobile-chromium";
    const widths = isMobileProject ? mobileWidths : fixedWidths;
    const output = path.resolve(process.cwd(), "test-results/visual-qa");
    fs.mkdirSync(path.join(output, projectName), { recursive: true });
    await installVisualApiMocks(page);

    if (isMobileProject) {
      const touchPoints = await page.evaluate(() => navigator.maxTouchPoints);
      expect(touchPoints, "The mobile project must retain real touch emulation.").toBeGreaterThan(0);
    }

    for (const width of widths) {
      await assertPageAtWidth(page, route, width, output, projectName);
    }
  });
}

// Dense width sampling checks that layouts transition continuously rather than
// passing only at the seven required snapshot widths. These are desktop-browser
// viewport sweeps; independent touch-device coverage is provided above.
for (const route of routes.filter((item) => [
  "/home", "/markets", "/trade/BTCUSDT", "/trade-hub",
].includes(item.path))) {
  test("continuous responsive sweep " + route.path, async ({ page }) => {
    test.setTimeout(300_000);
    test.skip(test.info().project.name !== "desktop-chromium", "Dense width sweep runs in desktop Chromium.");
    const output = path.resolve(process.cwd(), "test-results/visual-qa");
    fs.mkdirSync(path.join(output, "continuous"), { recursive: true });
    await installVisualApiMocks(page);
    for (const width of continuityWidths) {
      await assertPageAtWidth(page, route, width, output, "continuous");
    }
  });
}
