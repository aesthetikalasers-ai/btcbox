import { expect, test, type Page } from "@playwright/test";

/**
 * Guards the two primitives that `components/ui` relies on but that only exist as
 * CSS classes: `.field-control` (Input/Select/Textarea) and `.empty-state`
 * (EmptyState).
 *
 * Both were referenced by the components while `index.css` defined neither, so a
 * default Select rendered with no border, height or background — and because it
 * also sets `appearance-none`, with no arrow at all — while every EmptyState on
 * /contract rendered as loose text. A source-level grep cannot catch that
 * regression (the class names would still be in the TSX), so these assertions read
 * the computed styles of the production bundle.
 *
 * The mocks are intentionally minimal and local to this file: the visual QA spec's
 * helper is tuned to its own screenshots, and this test only needs an empty
 * perpetual workspace.
 */
const SURFACE_2 = "rgb(18, 22, 28)"; // --color-brand-surface-2 #12161C
const TEXT = "rgb(255, 255, 255)"; // --color-brand-text #FFFFFF
const TEXT_MUTED = "rgb(166, 176, 189)"; // --color-brand-text-muted #A6B0BD
const ACCENT = "rgb(14, 203, 129)"; // --color-brand-accent #0ECB81

async function mockEmptyPerpetualWorkspace(page: Page) {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (pathname === "/api/auth-client-config") {
      return json({ ok: true, supabase_url: "https://btcbox-e2e.invalid", publishable_key: "e2e-anon-key-not-valid-for-production", google_enabled: false, wallet_enabled: false });
    }
    if (pathname === "/api/account") {
      return json({
        ok: true, uid: "perp-primitives", email: "primitives@example.invalid", username: "primitives",
        has_login_password: true,
        balances: { USDT: { free: "5000", frozen: "0", usdt: "5000", valuation_available: true } },
        totalUsdt: "5000", valuation_complete: true, unpriced_assets: [],
        kyc: { status: "approved" }, twofa_enabled: false,
      });
    }
    if (pathname === "/api/perpetual/markets") {
      return json({ ok: true, markets: [{
        symbol: "BTCUSDT", base_asset: "BTC", quote_asset: "USDT", status: "trading", max_leverage: 100,
        price_tick: "0.01", quantity_step: "0.000001", min_quantity: "0.000001", funding_interval_sec: 28800,
        funding_rate_cap: 0.0075, mark_price: "65000", index_price: "65000", min_notional: "5",
      }] });
    }
    if (pathname === "/api/perpetual/positions") return json({ ok: true, positions: [] });
    if (pathname === "/api/perpetual/orders") return json({ ok: true, orders: [], has_more: false, next_cursor: null });
    if (pathname === "/api/perpetual/funding") return json({ ok: true, funding: [] });
    if (pathname === "/api/depth") {
      return json({
        ok: true, source: "primitives", snapshotTs: Math.floor(Date.now() / 1000),
        bids: Array.from({ length: 8 }, (_, i) => [(64999 - i).toFixed(2), "0.4"]),
        asks: Array.from({ length: 8 }, (_, i) => [(65001 + i).toFixed(2), "0.3"]),
      });
    }
    if (pathname === "/api/market") return json({ ok: true, markets: [], data: {} });
    return json({ ok: false, code: "PRIMITIVES_ISOLATED", msg: "Not part of this fixture." }, 503);
  });
  await page.route("https://btcbox-e2e.invalid/**", (route) => route.abort());
}

test("perpetual form controls and empty states keep their primitive styles", async ({ page }) => {
  await mockEmptyPerpetualWorkspace(page);

  // --- .field-control: a Select must look like a control, not bare text ---
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/contract", { waitUntil: "domcontentloaded" });
  const select = page.getByTestId("perp-mobile-workspace").getByLabel("Order type");
  await expect(select).toBeVisible();

  // Mobile stays on its own compact workspace: six visible levels per side,
  // and the desktop terminal must remain absent at phone widths.
  const mobileWorkspace = page.getByTestId("perp-mobile-workspace");
  await expect(mobileWorkspace).toBeVisible();
  await expect(page.getByTestId("perp-desktop-terminal")).toBeHidden();
  await expect(mobileWorkspace.locator('[data-side="ask"]')).toHaveCount(6);
  await expect(mobileWorkspace.locator('[data-side="bid"]')).toHaveCount(6);

  const control = await select.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      height: s.height,
      borderTopWidth: s.borderTopWidth,
      backgroundColor: s.backgroundColor,
      backgroundImage: s.backgroundImage,
      paddingRight: s.paddingRight,
    };
  });
  expect(control.height).toBe("40px");
  expect(control.borderTopWidth).toBe("1px");
  expect(control.backgroundColor).toBe(SURFACE_2);
  // appearance-none removes the native indicator, so the arrow has to be drawn.
  expect(control.backgroundImage).toContain("url(");
  // The arrow needs its reserved gutter (36px, matching the component's `pr-9`);
  // a caller using `px-*` instead of `pl-*` would erase it.
  expect(control.paddingRight).toBe("36px");

  // --- .empty-state: a styled block instead of a loose paragraph ---
  // Mobile panels use BottomPanelEmpty, so the shared primitive is asserted on the
  // desktop terminal that actually renders <EmptyState>.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopTerminal = page.getByTestId("perp-desktop-terminal");
  await expect(desktopTerminal).toBeVisible();
  await expect(page.getByTestId("perp-mobile-workspace")).toBeHidden();
  // Eight levels per side are reserved for the desktop book.
  await expect(desktopTerminal.locator(".spot-book-row")).toHaveCount(16);

  const empty = desktopTerminal.locator(".empty-state").first();
  await expect(empty).toBeVisible();
  const block = await empty.evaluate((el) => {
    const s = getComputedStyle(el);
    const icon = el.querySelector(".empty-state-icon");
    const title = el.querySelector(".empty-state-title");
    const hint = el.querySelector(".empty-state-hint");
    return {
      display: s.display,
      padding: s.padding,
      borderTopWidth: s.borderTopWidth,
      iconWidth: icon ? getComputedStyle(icon).width : "",
      iconColor: icon ? getComputedStyle(icon).color : "",
      titleColor: title ? getComputedStyle(title).color : "",
      titleSize: title ? getComputedStyle(title).fontSize : "",
      hintColor: hint ? getComputedStyle(hint).color : "",
    };
  });
  expect(block.display).toBe("flex");
  expect(block.padding).toBe("28px 16px");
  // Borderless on purpose: these render inside panels that already carry a border.
  expect(block.borderTopWidth).toBe("0px");
  expect(block.iconWidth).toBe("40px");
  expect(block.iconColor).toBe(ACCENT);
  expect(block.titleColor).toBe(TEXT);
  expect(block.titleSize).toBe("14px");
  expect(block.hintColor).toBe(TEXT_MUTED);
});

