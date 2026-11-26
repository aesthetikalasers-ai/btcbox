import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixedWidths = [768, 1024, 1279, 1280, 1366, 1440, 1920];
const mobileWidths = [320, 360, 375, 390, 414, 430, 600];
const continuityWidths = [
  320, 360, 375, 390, 414, 430, 480, 540, 600, 680, 767, 768, 820, 860,
  899, 900, 960, 1023, 1024, 1100, 1180, 1279, 1280, 1366, 1440, 1536,
  1680, 1920,
];
const routes = [
  { path: "/login", heading: "Welcome back" },
  { path: "/register", heading: "Create your BTCBOX account" },
  { path: "/home", heading: "Digital asset exchange" },
  { path: "/markets", heading: "Markets" },
  { path: "/trade/BTCUSDT", heading: "BTCUSDT" },
  { path: "/trade-hub", heading: "Choose your trading mode" },
  { path: "/assets", heading: "Assets" },
  { path: "/funds", heading: "Funds" },
  { path: "/me", heading: "My account" },
  { path: "/settings", heading: "Security settings" },
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
            balances: {
              BTC: { free: "0.125", frozen: "0.025", usdt: "8125", valuation_available: true },
              ETH: { free: "1.5", frozen: "0.1", usdt: "4800", valuation_available: true },
              USDT: { free: "2500", frozen: "100", usdt: "2600", valuation_available: true },
            },
            totalUsdt: "15525",
            valuation_complete: true,
            unpriced_assets: [],
            kyc: { status: "not_submitted" },
            twofa_enabled: false,
          }),
        });
      }
      return;
    }
    if (pathname === "/api/deposit" && route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, address: "TQ9xE2EVisualFixtureAddress000000000000" }),
      });
      return;
    }
    if (pathname === "/api/addresses" && route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          addresses: [{
            id: "visual-qa-withdrawal-address",
            type: "crypto",
            coin: "USDT",
            network: "TRC20",
            address: "TQ9xE2EVisualFixtureAddress000000000000",
            blocked: false,
            unbound: false,
          }],
        }),
      });
      return;
    }
    if (pathname === "/api/addresses/select") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          address: "TQ9xE2EVisualFixtureAddress000000000000",
          coin: "USDT",
          network: "TRC20",
        }),
      });
      return;
    }
    if (pathname === "/api/withdrawal/config") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          actions_enabled: true,
          fees: { USDT: "1", USDC: "1" },
          allowed_networks: { USDT: ["TRC20"], USDC: ["ERC20"] },
          usdc_usdt_rate: "1",
        }),
      });
      return;
    }
    if (pathname === "/api/withdrawal/history") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, withdrawals: [], has_more: false, next_cursor: null }),
      });
      return;
    }
    if (pathname === "/api/perpetual/markets") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, markets: [{ symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", status: "trading", max_leverage: 100, price_tick: "0.01", quantity_step: "0.000001", min_quantity: "0.000001", funding_interval_sec: 28800, funding_rate_cap: 0.0075, mark_price: "65000", index_price: "65000" }] }) });
      return;
    }
    if (pathname === "/api/perpetual/positions") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, positions: [] }),
      });
      return;
    }
    if (pathname === "/api/perpetual/orders") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, orders: [] }),
      });
      return;
    }
    if (pathname === "/api/perpetual/funding") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, funding: [] }),
      });
      return;
    }
    if (pathname === "/api/depth") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          source: "visual-qa",
          snapshotTs: Math.floor(Date.now() / 1000),
          bids: [["64999.00", "0.25"], ["64998.00", "0.40"]],
          asks: [["65001.00", "0.20"], ["65002.00", "0.35"]],
        }),
      });
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

async function installInteractiveTradeApiMocks(page: Page) {
  const now = Math.floor(Date.now() / 1000);
  const bases = [
    { base_asset: "BTC", quote_asset: "USDT", enabled: true },
    { base_asset: "ETH", quote_asset: "USDT", enabled: true },
    { base_asset: "SOL", quote_asset: "USDT", enabled: true },
  ];
  const markets = [
    { sym: "BTC", price: 65000, chg: 1.2, high: 66000, low: 64000, vol: "100", source: "e2e" },
    { sym: "ETH", price: 3200, chg: 0.8, high: 3300, low: 3100, vol: "200", source: "e2e" },
    { sym: "SOL", price: 150, chg: -0.4, high: 155, low: 145, vol: "300", source: "e2e" },
  ];
  const pairRules = bases.map((pair) => ({
    ...pair,
    price_tick: "0.01",
    quantity_step: "0.000001",
    min_quantity: "0.000001",
    min_notional: "1",
    min_limit_price: null,
    max_limit_price: null,
  }));
  await page.route("**/api/market/pairs", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, markets: pairRules, source: "e2e" }),
  }));
  await page.route("**/api/market", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      markets,
      data: Object.fromEntries(markets.map((market) => [market.sym, {
        ts: now,
        providerTs: now,
        source: "e2e",
      }])),
    }),
  }));
  await page.route(/\/api\/depth(?:\?.*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      source: "e2e",
      snapshotTs: now,
      providerTs: now,
      asks: [["65001.00", "0.20"], ["65002.00", "0.35"]],
      bids: [["64999.00", "0.25"], ["64998.00", "0.40"]],
    }),
  }));
  // Chart rendering checks require verified candle data. The isolated
  // visual fixture intentionally returns empty klines; override it here for
  // interactive trading QA so lightweight-charts can mount a real canvas.
  await page.route("**/api/kline**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      source: "e2e",
      klines: [
        { time: now - 7200, open: 64900, high: 65020, low: 64880, close: 64980, volume: 12, source: "e2e" },
        { time: now - 3600, open: 64980, high: 65080, low: 64950, close: 65030, volume: 18, source: "e2e" },
        { time: now, open: 65030, high: 65100, low: 65000, close: 65060, volume: 15, source: "e2e" },
      ],
    }),
  }));
  await page.route("**/api/trading/status**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      spot_order_entry_enabled: true,
      spot_cancel_enabled: true,
      supported_order_types: ["limit", "market"],
    }),
  }));
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
  if (route.path === "/trade/BTCUSDT" && width >= 1280) {
    // The locked desktop terminal intentionally hides the duplicate page H1;
    // the ticker header's market selector is its visible pair identifier.
    await expect(page.locator(".term-top-pair")).toBeVisible({ timeout: 15000 });
  } else {
    await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible({ timeout: 15000 });
  }

  if (["/home", "/markets", "/trade/BTCUSDT", "/assets", "/me"].includes(route.path)) {
    const mobileNavigation = page.locator(".bf-bottom-nav");
    const desktopProducts = page.locator('header nav[aria-label="Trade products"]');
    const desktopAssets = page.locator('header:has(nav[aria-label="Trade products"]) a[href="/assets"][aria-label="Assets"]');
    if (width < 768) {
      await expect(mobileNavigation, "Phone pages must use the five-item bottom navigation.").toBeVisible();
      await expect(desktopProducts, "Desktop product navigation must stay hidden on phones.").toBeHidden();
    } else {
      await expect(mobileNavigation, "The bottom navigation must not duplicate desktop navigation.").toBeHidden();
      await expect(desktopProducts, "Desktop product navigation must appear from 768px.").toBeVisible();
      await expect(desktopAssets.first(), "Assets must remain directly reachable from the desktop header.").toBeVisible();
    }
  }

  // Standalone history pages intentionally use their own compact secondary
  // navigation instead of the application shell. Only shell routes own the
  // BTCBOX home logo.
  if (["/home", "/markets", "/trade/BTCUSDT", "/trade-hub", "/assets", "/me", "/settings", "/support", "/earn", "/kyc", "/contract", "/seconds"].includes(route.path) && width <= 480) {
    await expect(
      page.getByRole("link", { name: "BTCBOX home" }).getByRole("img", { name: "BTCBOX" }),
    ).toBeVisible();
  }
  if (["/funds", "/deposit", "/withdraw"].includes(route.path)) {
    await expect(page.locator(".bf-bottom-nav"), "Funds workflows must hide the global mobile tab bar.").toBeHidden();
    await expect(page.getByRole("link", { name: "BTCBOX home" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
  }

  if (route.path === "/markets") {
    await expect(page.getByRole("heading", {
      name: "Explore the market. Trade with confidence.",
      exact: true,
    })).toHaveCount(0);
  }
  if (route.path === "/home") {
    // The market feed can be live, unavailable, or preview-backed; the quick
    // access block is stable and is the home layout region this check targets.
    await expect(page.getByRole("region", { name: "Quick access" })).toBeVisible();
  }
  if (route.path === "/markets") {
    await expect(page.getByText("No market pairs are currently available.", { exact: true })).toBeVisible();
  }
  if (route.path === "/assets") {
    const list = page.getByTestId("asset-balance-list");
    await expect(list).toBeVisible();
    await expect(list.locator(":scope > div > div")).toHaveCount(3);
    for (const coin of ["BTC", "ETH", "USDT"]) await expect(list.getByText(coin, { exact: true })).toBeVisible();
    const style = await list.evaluate((element) => {
      const css = getComputedStyle(element);
      return { borderWidth: css.borderTopWidth, background: css.backgroundColor, shadow: css.boxShadow, radius: css.borderRadius };
    });
    expect(style.borderWidth, "Asset rows must not be wrapped in a visible card border.").toBe("0px");
    expect(style.background, "Asset list must blend into the page background.").toBe("rgba(0, 0, 0, 0)");
    expect(style.shadow, "Asset list must not cast a card shadow.").toBe("none");
    expect(style.radius, "Asset list must not have a card radius.").toBe("0px");
  }
  if (route.path === "/trade/BTCUSDT") {
    await expect(page.getByText(/^(Latest trades|Recent trades)$/i)).toHaveCount(0);
  }
  if (route.path === "/contract" && width >= 1280) {
    const terminal = page.getByTestId("perp-desktop-terminal");
    await expect(terminal, "Desktop perpetual terminal must use the spot-style three-panel workspace.").toBeVisible();
    await expect(page.getByTestId("perp-mobile-workspace")).toBeHidden();
    const panels = terminal.locator(":scope > section");
    await expect(panels).toHaveCount(3);
    const [chartBox, bookBox, entryBox, columns] = await Promise.all([
      panels.nth(0).boundingBox(),
      panels.nth(1).boundingBox(),
      panels.nth(2).boundingBox(),
      terminal.evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length),
    ]);
    expect(chartBox, "Perpetual chart must have a rendered layout box.").not.toBeNull();
    expect(bookBox, "Perpetual order book must have a rendered layout box.").not.toBeNull();
    expect(entryBox, "Perpetual order entry must have a rendered layout box.").not.toBeNull();
    expect(columns, "Perpetual desktop must keep chart, order book and order entry in three columns.").toBe(3);
    expect(chartBox!.x).toBeLessThan(bookBox!.x);
    expect(bookBox!.x).toBeLessThan(entryBox!.x);
    expect(chartBox!.width).toBeGreaterThan(300);
    expect(bookBox!.width).toBeGreaterThanOrEqual(240);
    expect(entryBox!.width).toBeGreaterThanOrEqual(280);
    const chartCanvas = panels.nth(0).locator("canvas").first();
    await expect.poll(async () => {
      const box = await chartCanvas.boundingBox();
      return box ? box.width * box.height : 0;
    }, { message: "Desktop perpetual chart canvas must have non-zero dimensions." }).toBeGreaterThan(0);
  }

  if (route.path === "/contract" && width < 1280) {
    const workspace = page.getByTestId("perp-mobile-workspace");
    await expect(workspace).toBeVisible();
    const entry = workspace.locator(":scope > div").first();
    const book = workspace.locator(":scope > div").nth(1);
    await expect(entry).toBeVisible();
    await expect(book).toBeVisible();
    const [entryBox, bookBox] = await Promise.all([entry.boundingBox(), book.boundingBox()]);
    expect(entryBox).not.toBeNull();
    expect(bookBox).not.toBeNull();
    const entryShare = entryBox!.width / (entryBox!.width + bookBox!.width);
    expect(Math.abs(entryShare - 0.5), "Perpetual responsive columns must be balanced at approximately 50:50.").toBeLessThanOrEqual(0.015);
    expect(Math.abs(entryBox!.y - bookBox!.y), "Perpetual entry and depth must stay on the same row.").toBeLessThanOrEqual(8);
    expect(Math.abs((entryBox!.y + entryBox!.height) - (bookBox!.y + bookBox!.height)), "Perpetual entry and depth columns must finish at the same bottom edge.").toBeLessThanOrEqual(2);
    if (width >= 600) {
      const workspaceBox = await workspace.boundingBox();
      expect(workspaceBox, "Perpetual tablet workspace must have a layout box.").not.toBeNull();
      expect(workspaceBox!.width, "Perpetual tablet must use available page width, not a 430px phone container.").toBeGreaterThan(width * 0.85);
    }
    await expect(workspace.getByTestId("perp-leverage-pills")).toBeVisible();
    const chartDrawer = page.locator(".trade-drawer-root");
    await expect(chartDrawer, "Perpetual chart drawer must remain available below 1024px.").toBeVisible();
    if (width >= 600) {
      const drawerBox = await chartDrawer.locator(".trade-drawer-panel").boundingBox();
      expect(drawerBox, "Tablet chart drawer must have a layout box.").not.toBeNull();
      expect(drawerBox!.width, "Tablet chart drawer must use the available page width.").toBeGreaterThan(width * 0.85);
    }
    await chartDrawer.getByRole("button", { name: "Expand chart" }).click();
    await expect(chartDrawer.getByRole("button", { name: "Collapse chart" }).first()).toBeVisible();
    const chartBody = chartDrawer.locator(".trade-drawer-panel > .relative.min-h-0.flex-1");
    await expect(chartBody, "Expanded perpetual chart body must be visible.").toBeVisible();
    await expect.poll(async () => {
      const box = await chartBody.boundingBox();
      return box ? box.width * box.height : 0;
    }, { message: "Expanded perpetual chart container must have non-zero width and height." }).toBeGreaterThan(0);
    const chartCanvas = chartBody.locator("canvas").first();
    await expect.poll(
      () => chartBody.locator("canvas").count(),
      { message: "Perpetual lightweight-charts must mount a canvas inside the expanded drawer." },
    ).toBeGreaterThan(0);
    await expect.poll(async () => {
      const box = await chartCanvas.boundingBox();
      return box ? box.width * box.height : 0;
    }, { message: "Perpetual chart canvas must have non-zero rendered dimensions." }).toBeGreaterThan(0);
    await chartDrawer.getByRole("button", { name: "Collapse chart" }).first().click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Order book is temporarily unavailable.", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^(Latest trades|Recent trades)$/i)).toHaveCount(0);
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

  if (route.path === "/trade/BTCUSDT" && width >= 768 && width < 1280) {
    // Tablet compact mode moves the chart to its drawer; no empty chart track
    // may remain ahead of the visible order book and order-entry columns.
    const workspace = page.locator(".exchange-workspace");
    const orderbook = workspace.locator(":scope > .exchange-depth");
    const orderForm = workspace.locator(":scope > .exchange-entry");
    const orders = workspace.locator(":scope > .exchange-orders");
    await expect(orderbook).toBeVisible();
    await expect(orderForm).toBeVisible();
    await expect(orders).toBeVisible();
    const [bookBox, formBox, ordersBox, columns] = await Promise.all([
      orderbook.boundingBox(),
      orderForm.boundingBox(),
      orders.boundingBox(),
      workspace.evaluate((element) => {
        const template = getComputedStyle(element).gridTemplateColumns.trim();
        return template.match(/minmax\([^)]*\)|fit-content\([^)]*\)|\S+/g)?.length ?? 0;
      }),
    ]);
    expect(columns, "Tablet compact workspace must use two columns, not reserve an empty chart track.").toBe(2);
    expect(bookBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    expect(ordersBox).not.toBeNull();
    const bookShare = bookBox!.width / (bookBox!.width + formBox!.width);
    expect(Math.abs(bookShare - 0.5), "Rendered tablet columns must be approximately 50:50.").toBeLessThanOrEqual(0.015);
    expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(bookBox!.x + 2);
    expect(Math.abs(bookBox!.y - formBox!.y)).toBeLessThanOrEqual(8);
    if (width < 1024) await expect(page.locator(".trade-drawer-root")).toBeVisible();
    else await expect(page.locator(".trade-drawer-root")).toHaveCount(0);
    expect(ordersBox!.y).toBeGreaterThanOrEqual(Math.max(bookBox!.y + bookBox!.height, formBox!.y + formBox!.height) - 1);
    const chartTrigger = page.locator("#trade-chart-open");
    await expect(chartTrigger).toBeVisible();
    if (width < 1024) {
      const chartDrawer = page.locator(".trade-drawer-root");
      await expect(chartDrawer, "Spot chart drawer must be visible below 1024px.").toBeVisible();
      await chartDrawer.getByRole("button", { name: "Expand chart" }).click();
      await expect(chartDrawer.getByRole("button", { name: "Collapse chart" }).first()).toBeVisible();
      await chartDrawer.getByRole("button", { name: "Collapse chart" }).first().click();
    } else {
      const bodyOverflowBeforeOpen = await page.locator("body").evaluate((node) => (node as HTMLElement).style.overflow);
      await chartTrigger.click();
      const chartDialog = page.locator(".spot-chart-drawer");
      await expect(chartDialog, "Compact desktop chart trigger must open the chart panel.").toBeVisible();
      const chartSurface = chartDialog.locator(".trade-candles");
      await expect(chartSurface).toBeVisible();
      await expect.poll(async () => {
        const box = await chartSurface.boundingBox();
        return box ? box.width * box.height : 0;
      }, { message: "The opened chart surface must have non-zero width and height." }).toBeGreaterThan(0);
      await expect.poll(
        () => chartSurface.locator("canvas").count(),
        { message: "lightweight-charts must mount its canvas inside the visible chart surface." },
      ).toBeGreaterThan(0);
      const chartCanvas = chartSurface.locator("canvas").first();
      await expect.poll(async () => {
        const box = await chartCanvas.boundingBox();
        return box ? box.width * box.height : 0;
      }, { message: "The chart canvas must have non-zero rendered dimensions." }).toBeGreaterThan(0);
      await chartDialog.getByRole("button", { name: "Close chart" }).click();
      await expect(chartDialog).toHaveCount(0);
      await expect(chartTrigger, "Closing the chart must restore focus to its trigger.").toBeFocused();
      await expect.poll(
        () => page.locator("body").evaluate((node) => (node as HTMLElement).style.overflow),
        { message: "Closing the chart must restore the background scroll lock state." },
      ).toBe(bodyOverflowBeforeOpen);
      // Reopen, then dismiss through the backdrop to cover both close paths.
      await chartTrigger.click();
      await expect(chartDialog).toBeVisible();
      await expect.poll(async () => {
        const box = await chartDialog.locator(".trade-candles").boundingBox();
        return box ? box.width * box.height : 0;
      }).toBeGreaterThan(0);
      await chartDialog.locator(".trade-candles").waitFor({ state: "visible" });
      await page.locator(".spot-chart-overlay").click({ position: { x: 8, y: 8 } });
      await expect(chartDialog).toHaveCount(0);
      await expect(chartTrigger, "Backdrop dismissal must restore focus to the chart trigger.").toBeFocused();
      await expect.poll(
        () => page.locator("body").evaluate((node) => (node as HTMLElement).style.overflow),
      ).toBe(bodyOverflowBeforeOpen);
    }
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
    const askRows = orderbook.locator('.spot-book-row[data-side="ask"]');
    const bidRows = orderbook.locator('.spot-book-row[data-side="bid"]');
    await expect(askRows).toHaveCount(2);
    await expect(bidRows).toHaveCount(2);
    // The clickable row carries its visible price in its first price cell.
    // Assert that cell rather than a non-existent row title, so the screenshot
    // gate proves that usable ask and bid prices were actually rendered.
    // Asks are shown best-to-worst in the terminal's visual order, which is
    // the reverse of the fixture payload. Check both levels to guard the
    // fixture while retaining that trader-facing order.
    await expect(askRows.first().locator("span").first()).toHaveAttribute("title", "65002.00");
    await expect(askRows.last().locator("span").first()).toHaveAttribute("title", "65001.00");
    await expect(bidRows.first().locator("span").first()).toHaveAttribute("title", "64999.00");
    await expect(page.locator(".spot-mobile-tabs")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buy", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Sell", exact: true }).first()).toBeVisible();

    const sideButtons = orderForm.locator(".spot-entry-head .spot-side button");
    await expect(sideButtons).toHaveCount(2);
    for (const button of await sideButtons.all()) {
      const buttonBox = await button.boundingBox();
      expect(buttonBox?.height ?? 0, "Phone Buy/Sell controls must meet a 44px touch target.").toBeGreaterThanOrEqual(44);
    }
    const formControlFontSizes = await orderForm.locator(".spot-order-type select, input").evaluateAll(
      (elements) => elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    );
    expect(
      formControlFontSizes.length ? Math.min(...formControlFontSizes) : 0,
      "Phone order inputs and selects must use at least 16px text to avoid iOS focus zoom.",
    ).toBeGreaterThanOrEqual(16);

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
    const [bookToolbarBox, precisionBox, precisionSelectBox, viewBox] = await Promise.all([
      orderbook.locator(".spot-book-toolbar--top").boundingBox(),
      orderbook.locator(".spot-book-toolbar--top label").boundingBox(),
      orderbook.locator(".spot-book-toolbar--top select").boundingBox(),
      orderbook.locator(".spot-book-toolbar--top .spot-book-view").boundingBox(),
    ]);
    expect(bookToolbarBox).not.toBeNull();
    expect(precisionBox).not.toBeNull();
    expect(precisionSelectBox).not.toBeNull();
    expect(viewBox).not.toBeNull();
    expect(precisionSelectBox!.width, "Phone depth precision must remain readable.").toBeGreaterThanOrEqual(52);
    expect(precisionBox!.x).toBeGreaterThanOrEqual(bookToolbarBox!.x - 1);
    expect(viewBox!.x + viewBox!.width).toBeLessThanOrEqual(bookToolbarBox!.x + bookToolbarBox!.width + 1);
    expect(precisionBox!.x + precisionBox!.width).toBeLessThanOrEqual(viewBox!.x + 1);
    expect(formBox!.width, "Phone order entry must retain usable width.").toBeGreaterThan(120);
    expect(bookBox!.width, "Phone order book must retain usable width.").toBeGreaterThan(100);
    const formShare = formBox!.width / (formBox!.width + bookBox!.width);
    const expectedFormShare = width < 360 ? 0.55 : 0.5;
    expect(Math.abs(formShare - expectedFormShare), "Rendered phone columns must be balanced, with a narrow-phone allowance.").toBeLessThanOrEqual(0.015);
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

    const buySide = sideButtons.nth(0);
    const sellSide = sideButtons.nth(1);
    await buySide.click();
    await expect(buySide).toHaveAttribute("aria-pressed", "true");
    await expect(sellSide).toHaveAttribute("aria-pressed", "false");
    await expect(orderForm.locator(".spot-submit")).toContainText("Buy BTC");
    await sellSide.click();
    await expect(sellSide).toHaveAttribute("aria-pressed", "true");
    await expect(buySide).toHaveAttribute("aria-pressed", "false");
    await expect(orderForm.locator(".spot-submit")).toContainText("Sell BTC");

    const chartTrigger = page.locator("#trade-chart-open");
    await expect(chartTrigger, "Phone spot trading must expose the chart drawer trigger.").toBeVisible();
    await chartTrigger.click();
    const chartRegion = page.getByRole("region", { name: "Price chart" });
    await expect(chartRegion, "The mobile K-line drawer must be mounted.").toBeVisible();
    const drawerPanel = page.locator(".trade-drawer-panel");
    await expect.poll(
      async () => (await drawerPanel.boundingBox())?.height ?? 0,
      { message: "The K-line drawer must expand after the trigger is pressed.", timeout: 5000 },
    ).toBeGreaterThan(44);
    const chartViewport = drawerPanel.locator(":scope > .relative").last();
    await expect.poll(async () => {
      const box = await chartViewport.boundingBox();
      return box ? box.width * box.height : 0;
    }, { message: "The expanded mobile chart container must have non-zero dimensions." }).toBeGreaterThan(0);
    const drawerCanvas = drawerPanel.locator("canvas").first();
    await expect.poll(() => drawerPanel.locator("canvas").count(), {
      message: "lightweight-charts must mount a canvas in the expanded mobile drawer.",
    }).toBeGreaterThan(0);
    await expect.poll(async () => {
      const box = await drawerCanvas.boundingBox();
      return box ? box.width * box.height : 0;
    }, { message: "The mobile chart canvas must have non-zero rendered dimensions." }).toBeGreaterThan(0);
    await chartRegion.getByRole("button", { name: "Collapse chart" }).first().click();
    await expect.poll(
      async () => (await drawerPanel.boundingBox())?.height ?? Number.POSITIVE_INFINITY,
      { message: "The K-line drawer must collapse cleanly.", timeout: 5000 },
    ).toBeLessThanOrEqual(50);
    await chartRegion.getByRole("button", { name: "Expand chart" }).click();
    await expect.poll(
      async () => (await drawerPanel.boundingBox())?.height ?? 0,
      { message: "The K-line drawer must reopen without stale state.", timeout: 5000 },
    ).toBeGreaterThan(44);
    await expect.poll(() => drawerPanel.locator("canvas").count()).toBeGreaterThan(0);
    await chartRegion.getByRole("button", { name: "Collapse chart" }).first().click();
    await expect.poll(
      async () => (await drawerPanel.boundingBox())?.height ?? Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(50);
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
    // Trade screenshots must use a deterministic live-like market fixture;
    // empty visual-only market mocks made the order book look broken.
    if (route.path === "/trade/BTCUSDT") {
      await installInteractiveTradeApiMocks(page);
    }

    if (isMobileProject) {
      const touchPoints = await page.evaluate(() => navigator.maxTouchPoints);
      expect(touchPoints, "The mobile project must retain real touch emulation.").toBeGreaterThan(0);
    }

    for (const width of widths) {
      await assertPageAtWidth(page, route, width, output, projectName);
    }
  });
}

test("funds workflows render usable deposit and withdrawal states", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await installVisualApiMocks(page);

  await page.goto("/deposit", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Deposit" })).toBeVisible();
  await expect(page.getByLabel("Asset")).toHaveValue("USDT");
  await expect(page.getByLabel("Network")).toHaveValue("TRC20");
  await expect(page.getByText("TQ9xE2EVisualFixtureAddress000000000000")).toBeVisible();
  const copyButton = page.getByRole("button", { name: "Copy address" });
  await expect(copyButton).toBeEnabled();
  await copyButton.click();
  await expect(page.getByRole("status").filter({ hasText: "Deposit address copied." })).toBeVisible();

  await page.goto("/withdraw", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Withdraw" })).toBeVisible();
  await expect(page.getByLabel("Withdrawal address")).toBeVisible();
  await expect(page.getByText("Selected destination: USDT · TRC20")).toBeVisible();
  await expect(page.getByText("Available", { exact: true })).toBeVisible();
  await expect(page.getByText("Withdrawal fee", { exact: true })).toBeVisible();
  const amount = page.getByLabel(/Amount/);
  await amount.fill("10");
  await expect(page.getByText("9 USDT", { exact: true })).toBeVisible();
  await page.getByLabel("Fund password").fill("visual-only-password");
  await expect(page.getByRole("button", { name: "Submit withdrawal" })).toBeEnabled();
  // The visual fixture must never submit a financial operation.
});

test("trade interaction QA mobile spot market selection and order-book handoff", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile-chromium", "Trade interaction QA runs in the mobile touch project.");
  await page.setViewportSize({ width: 390, height: 844 });
  await installVisualApiMocks(page);
  await installInteractiveTradeApiMocks(page);
  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });

  const askRow = page.locator('.exchange-depth .spot-book-row[data-side="ask"]').last();
  const bidRow = page.locator('.exchange-depth .spot-book-row[data-side="bid"]').first();
  await expect(askRow).toBeVisible();
  await expect(bidRow).toBeVisible();
  const priceInput = page.getByRole("textbox", { name: "Limit price (USDT)" });
  const buySide = page.locator(".spot-entry-head .spot-side button").nth(0);
  const sellSide = page.locator(".spot-entry-head .spot-side button").nth(1);

  const askPrice = await askRow.locator("span").first().getAttribute("title");
  const selectedAskPrice = askPrice ?? "";
  expect(selectedAskPrice).toMatch(/^6500[12]\.00$/);
  await askRow.click();
  await expect(priceInput).toHaveValue(selectedAskPrice);
  await expect(buySide).toHaveAttribute("aria-pressed", "true");
  await expect(sellSide).toHaveAttribute("aria-pressed", "false");

  const bidPrice = await bidRow.locator("span").first().getAttribute("title");
  const selectedBidPrice = bidPrice ?? "";
  expect(selectedBidPrice).toMatch(/^6499[89]\.00$/);
  await bidRow.click();
  await expect(priceInput).toHaveValue(selectedBidPrice);
  await expect(sellSide).toHaveAttribute("aria-pressed", "true");
  await expect(buySide).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Select market" }).click();
  const dialog = page.getByRole("dialog", { name: "Select market" });
  const options = dialog.locator(".term-pair-option");
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toContainText("BTC/USDT");
  await expect(options.nth(1)).toContainText("ETH/USDT");
  await expect(options.nth(2)).toContainText("SOL/USDT");
  const listedPrices = await options.locator(".term-pair-option__price").allTextContents();
  expect(new Set(listedPrices).size, "Each market option must show its own ticker price, not the active pair price.").toBe(3);
  await expect(options.first().locator(".term-pair-option__volume")).toContainText("USDT");

  const solOption = options.filter({ hasText: "SOL/USDT" });
  const solFavorite = solOption.locator(".term-pair-option__favorite");
  await solFavorite.click();
  await expect(solFavorite).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("tab", { name: "Favorites" }).click();
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("SOL/USDT");
  await dialog.getByRole("tab", { name: "All" }).click();
  await expect(options).toHaveCount(3);

  const search = dialog.getByRole("searchbox", { name: "Search BTCBOX" });
  await search.fill("ETH");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("ETH/USDT");
  await search.fill("");
  await options.filter({ hasText: "SOL/USDT" }).locator(".term-pair-option__select").click();
  await expect(page).toHaveURL(/\/trade\/SOLUSDT$/);
});

test("trade interaction QA desktop order-book side and price handoff", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop-chromium", "Desktop order-book interaction QA runs in desktop Chromium.");
  await page.setViewportSize({ width: 1366, height: 900 });
  await installVisualApiMocks(page);
  await installInteractiveTradeApiMocks(page);
  await page.goto("/trade/BTCUSDT", { waitUntil: "domcontentloaded" });

  const askRow = page.locator('.term-col--book .spot-book-row[data-side="ask"]').last();
  const bidRow = page.locator('.term-col--book .spot-book-row[data-side="bid"]').first();
  await expect(askRow).toBeVisible();
  await expect(bidRow).toBeVisible();
  const priceInput = page.getByRole("textbox", { name: "Limit price (USDT)" });
  const sideTabs = page.locator('.term-form [role="tab"]');
  const buyTab = sideTabs.nth(0);
  const sellTab = sideTabs.nth(1);

  const askPrice = (await askRow.getAttribute("title") ?? "").split(" · ")[0];
  expect(askPrice).toMatch(/^6500[12]\.00$/);
  await askRow.click();
  await expect(priceInput).toHaveValue(String(Number(askPrice)));
  // A market refresh runs every five seconds. The selected book price must remain manual.
  await page.waitForTimeout(5500);
  await expect(priceInput).toHaveValue(String(Number(askPrice)));
  await expect(buyTab).toHaveAttribute("aria-selected", "true");
  await expect(sellTab).toHaveAttribute("aria-selected", "false");

  const bidPrice = (await bidRow.getAttribute("title") ?? "").split(" · ")[0];
  expect(bidPrice).toMatch(/^6499[89]\.00$/);
  await bidRow.click();
  await expect(priceInput).toHaveValue(String(Number(bidPrice)));
  await expect(sellTab).toHaveAttribute("aria-selected", "true");
  await expect(buyTab).toHaveAttribute("aria-selected", "false");
});

// Dense width sampling checks that layouts transition continuously rather than
// passing only at the seven required snapshot widths. These are desktop-browser
// viewport sweeps; independent touch-device coverage is provided above.
for (const route of routes.filter((item) => [
  "/home", "/markets", "/trade/BTCUSDT", "/trade-hub", "/assets", "/funds", "/deposit", "/withdraw", "/contract",
].includes(item.path))) {
  test("continuous responsive sweep " + route.path, async ({ page }) => {
    test.setTimeout(300_000);
    test.skip(test.info().project.name !== "desktop-chromium", "Dense width sweep runs in desktop Chromium.");
    const output = path.resolve(process.cwd(), "test-results/visual-qa");
    fs.mkdirSync(path.join(output, "continuous"), { recursive: true });
    await installVisualApiMocks(page);
    // The continuous spot sweep also opens the compact chart at 1024–1279px;
    // provide verified candles there instead of the empty visual-only fixture.
    if (route.path === "/trade/BTCUSDT") {
      await installInteractiveTradeApiMocks(page);
    }
    for (const width of continuityWidths) {
      await assertPageAtWidth(page, route, width, output, "continuous");
    }
  });
}
