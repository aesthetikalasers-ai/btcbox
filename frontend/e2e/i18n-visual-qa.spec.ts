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

for (const locale of activeLocales) {
  test("language rendering " + locale.code + " updates copy and document language", async ({ page }) => {
    const dictionaryPath = path.resolve(process.cwd(), "src/lib/locales", locale.code + ".json");
    const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, "utf8")) as Record<string, string>;
    const expectedHeading = dictionary["Welcome back"];
    expect(expectedHeading, "The locale must translate the login heading.").toBeTruthy();

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
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, need_login: true }),
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

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", locale.htmlLang);
    await expect(page.getByRole("heading", { name: expectedHeading, exact: true })).toBeVisible({
      timeout: 20000,
    });
    const output = path.resolve(process.cwd(), "test-results/i18n-visual-qa");
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({
      path: path.join(output, locale.code + "-" + test.info().project.name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  });
}
