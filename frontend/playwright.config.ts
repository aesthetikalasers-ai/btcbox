import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["blob", { outputDir: "blob-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Existing E2E assertions use English copy. Pin the test baseline explicitly
    // so the product can safely default new visitors to Japanese without making
    // every route test depend on the browser's implicit language preference.
    storageState: {
      cookies: [],
      origins: [{
        origin: "http://127.0.0.1:4173",
        localStorage: [{ name: "btcbox-language", value: "en" }],
      }],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
