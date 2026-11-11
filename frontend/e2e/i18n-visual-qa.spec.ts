import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const activeLocales = [
  { code: "en", htmlLang: "en-US" },
  { code: "ja", htmlLang: "ja-JP" },
  { code: "zh-CN", htmlLang: "zh-CN" },
  { code: "es", htmlLang: "es-ES" },
  { code: "de", htmlLang: "de-DE" },
  { code: "it", htmlLang: "it-IT" },
  { code: "pt", htmlLang: "pt-PT" },
];
const localeRoutes = [
  { path: "/login", headingKey: "Welcome back" },
  { path: "/home", headingKey: "Market overview" },
  { path: "/trade-hub", headingKey: "Choose your trading mode" },
  { path: "/assets", headingKey: "Assets" },
  { path: "/deposit", headingKey: "Deposit" },
  { path: "/withdraw", headingKey: "Withdraw" },
  { path: "/earn", headingKey: "Earn" },
  { path: "/kyc", headingKey: "Identity verification" },
  { path: "/contract", headingKey: "Perpetual" },
  { path: "/seconds", headingKey: "Seconds contracts" },
  { path: "/trade/BTCUSDT", heading: "BTCUSDT" },
];

for (const locale of activeLocales) {
  for (const routeInfo of localeRoutes) {
    test("language rendering " + locale.code + " on " + routeInfo.path, async ({ page }) => {
      const dictionaryPath = path.resolve(process.cwd(), "src/lib/locales", locale.code + ".json");
      const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, "utf8")) as Record<string, string>;
      const expectedHeading = routeInfo.heading ?? dictionary[routeInfo.headingKey!];
      expect(expectedHeading, "The locale must translate " + (routeInfo.headingKey ?? routeInfo.heading) + ".").toBeTruthy();

      await page.addInitScript((language) => {
        window.localStorage.setItem("btcbox-language", language);
      }, locale.code);

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
          const isAuthPage = ["/login", "/register"].includes(new URL(page.url()).pathname);
          await route.fulfill({
            status: isAuthPage ? 401 : 200,
            contentType: "application/json",
            body: JSON.stringify(isAuthPage
              ? { ok: false, need_login: true }
              : {
                  ok: true,
                  uid: "i18n-visual-qa-user",
                  email: "i18n@example.invalid",
                  username: "i18n_visual_qa",
                  has_login_password: true,
                  balances: {},
                  totalUsdt: "0",
                  valuation_complete: true,
                  unpriced_assets: [],
                  kyc: { status: "not_submitted" },
                  twofa_enabled: false,
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
          body: JSON.stringify({ ok: false, code: "I18N_VISUAL_QA_ISOLATED" }),
        });
      });
      await page.route("https://btcbox-e2e.invalid/**", (route) => route.abort());

      const widths = test.info().project.name === "mobile-chromium" ? [320, 360, 375, 390, 430] : [1366];
      const output = path.resolve(process.cwd(), "test-results/i18n-visual-qa");
      fs.mkdirSync(output, { recursive: true });

      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(routeInfo.path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute("lang", locale.htmlLang);
        await expect(page.getByRole("heading", { name: expectedHeading, exact: true })).toBeVisible({
          timeout: 20000,
        });
        const dimensions = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        expect(dimensions.document, locale.code + " " + routeInfo.path + " overflows at " + width + "px").toBeLessThanOrEqual(width);
        expect(dimensions.body, locale.code + " " + routeInfo.path + " body overflows at " + width + "px").toBeLessThanOrEqual(width);

        const boundaryViolations = await page.evaluate(() => {
          const selectors = ["main", "header", "h1", ".trade-top", ".trade-top > *", ".ob-card", ".form-card", "[data-testid]"];
          const elements = Array.from(new Set(selectors.flatMap((selector) =>
            Array.from(document.querySelectorAll<HTMLElement>(selector)),
          )));
          return elements.flatMap((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || rect.width === 0 || rect.height === 0) return [];
            if (rect.left < -1 || rect.right > window.innerWidth + 1) {
              return [{ tag: element.tagName.toLowerCase(), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }];
            }
            return [];
          });
        });
        expect(boundaryViolations, locale.code + " " + routeInfo.path + " has visible elements outside the viewport at " + width + "px").toEqual([]);

        await page.screenshot({
          path: path.join(output, locale.code + "-" + routeInfo.path.replace(/[^a-z0-9]+/gi, "-") + "-" + width + "-" + test.info().project.name + ".png"),
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }
}
