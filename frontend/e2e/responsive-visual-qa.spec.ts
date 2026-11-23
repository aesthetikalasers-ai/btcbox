import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixedWidths = [375, 390, 430, 768, 1366, 1440, 1920];
const mobileWidths = [320, 360, 375, 390, 430];
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
  { path: "/deposit", heading: "Deposit" },
  { path: "/withdraw", heading: "Withdraw" },
  { path: "/earn", heading: "Earn" },
  { path: "/kyc", heading: "Identity verification" },
  { path: "/contract", heading: "Perpetual" },
  { path: "/seconds", heading: "Seconds contracts" },
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
  if (route.path === "/trade/BTCUSDT" && width >= 1280) {
    // Wide desktop uses the dedicated terminal: market rail + chart/orders +
    // order book + order entry. The three trading work areas must all remain
    // independently visible and ordered left-to-right.
    const terminal = page.locator(".spot-terminal--pro");
    const layout = terminal.locator(".term-layout");
    const chartColumn = layout.locator(":scope > .term-col--main");
    const bookColumn = layout.locator(":scope > .term-col--book");
    const entryColumn = layout.locator(":scope > .term-col--entry");
    await expect(terminal).toBeVisible();
    await expect(chartColumn).toBeVisible();
    await expect(bookColumn).toBeVisible();
    await expect(entryColumn).toBeVisible();
    const [layoutBox, chartBox, bookBox, entryBox, columnCount] = await Promise.all([
      layout.boundingBox(),
      chartColumn.boundingBox(),
      bookColumn.boundingBox(),
      entryColumn.boundingBox(),
      layout.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length),
    ]);
    expect(layoutBox, "Desktop terminal grid must have a layout box.").not.toBeNull();
    expect(chartBox, "Desktop chart column must have a layout box.").not.toBeNull();
    expect(bookBox, "Desktop order book column must have a layout box.").not.toBeNull();
    expect(entryBox, "Desktop order entry column must have a layout box.").not.toBeNull();
    expect(columnCount, "Desktop terminal must retain its market rail and three trading areas.").toBe(4);
    expect(chartBox!.x).toBeLessThan(bookBox!.x);
    expect(bookBox!.x).toBeLessThan(entryBox!.x);
    expect(chartBox!.width).toBeGreaterThan(300);
    expect(bookBox!.width).toBeGreaterThanOrEqual(240);
    expect(entryBox!.width).toBeGreaterThanOrEqual(280);
  }

  if (route.path === "/trade/BTCUSDT" && width < 768) {
    // Phone trading deliberately keeps the order form and order book visible
    // together. The orders panel spans the full row below both columns.
    const workspace = page.locator(".exchange-workspace");
    const orderbook = workspace.locator(":scope > .exchange-depth");
    const orderForm = workspace.locator(":scope > .exchange-entry");
    const orders = workspace.locator(":scope > .exchange-orders");
    await expect(orderForm).toBeVisible();
    await expect(orderbook).toBeVisible();
    await expect(orders).toBeVisible();
    await expect(page.locator(".spot-mobile-tabs")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buy", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Sell", exact: true }).first()).toBeVisible();

    const [workspaceBox, formBox, bookBox, ordersBox] = await Promise.all([
      workspace.boundingBox(),
      orderForm.boundingBox(),
      orderbook.boundingBox(),
      orders.boundingBox(),
    ]);
    expect(workspaceBox, "Phone trading workspace must have a layout box.").not.toBeNull();
    expect(formBox, "Phone order entry must have a layout box.").not.toBeNull();
    expect(bookBox, "Phone order book must have a layout box.").not.toBeNull();
    expect(ordersBox, "Phone orders panel must have a layout box.").not.toBeNull();
    expect(formBox!.width, "Phone order entry must retain usable width.").toBeGreaterThan(120);
    expect(bookBox!.width, "Phone order book must retain usable width.").toBeGreaterThan(100);
    expect(formBox!.x + formBox!.width, "Order entry must occupy the left column.").toBeLessThanOrEqual(bookBox!.x + 2);
    expect(Math.abs(formBox!.y - bookBox!.y), "Order entry and order book must share the same row.").toBeLessThanOrEqual(8);
    expect(
      ordersBox!.y,
      "Open orders must sit below both trading columns.",
    ).toBeGreaterThanOrEqual(Math.max(formBox!.y + formBox!.height, bookBox!.y + bookBox!.height) - 1);
    expect(
      ordersBox!.width,
      "Open orders must span the trading workspace.",
    ).toBeGreaterThan(workspaceBox!.width - 16);

    const chartTrigger = page.locator("#trade-chart-open");
    await expect(chartTrigger, "Phone spot trading must expose the chart drawer trigger.").toBeVisible();
    await chartTrigger.click();
    const chartRegion = page.getByRole("region", { name: "Price chart" });
    await expect(chartRegion, "The mobile K-line drawer must be mounted.").toBeVisible();
    const drawerPanel = page.locator(".trade-drawer-panel");
    const expandedBox = await drawerPanel.boundingBox();
    expect(expandedBox, "The K-line drawer must expand after the trigger is pressed.").not.toBeNull();
    expect(expandedBox!.height, "The K-line drawer must expand beyond its collapsed bar.").toBeGreaterThan(44);
    await chartRegion.getByRole("button", { name: "Collapse chart" }).first().click();
    const collapsedBox = await drawerPanel.boundingBox();
    expect(collapsedBox!.height, "The K-line drawer must collapse cleanly.").toBeLessThanOrEqual(50);
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

  // Inspect rendered geometry as well as scrollWidth: global overflow clipping
  // must not make an element outside the viewport look like a passing layout.
  const boundaryViolations = await page.evaluate(() => {
    const selectors = ["main", "header", "h1", ".trade-top", ".trade-top > *", ".ob-card", ".form-card", ".exchange-workspace", ".exchange-depth", ".exchange-entry", ".trade-chart-drawer", "[data-testid]"];
    const elements = Array.from(new Set(selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)),
    )));
    return elements.flatMap((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || rect.width === 0 || rect.height === 0) return [];
      if (rect.left < -1 || rect.right > window.innerWidth + 1) {
        return [{ selector: element.tagName.toLowerCase() + (element.className && typeof element.className === "string" ? "." + element.className.trim().replace(/\\s+/g, ".") : ""), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }];
      }
      return [];
    });
  });
  expect(
    boundaryViolations,
    route.path + " at " + width + "px has visible elements outside the viewport",
  ).toEqual([]);

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
