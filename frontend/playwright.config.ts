import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  timeout: 45_000,
  globalTimeout: 15 * 60_000,
  expect: { timeout: 10_000 },
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
  // CI acceptance covers touch-device phone widths and desktop terminal baselines.
  // Both projects run against the local production bundle with isolated API mocks.
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Use the production bundle: vite dev enables DEV_OPEN_ACCOUNT_PAGES and bypasses production auth gates.
  webServer: [
    {
      command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // A separate Vite dev origin is used only by source-module unit probes.
      // Route/UI acceptance continues to run against the production bundle above.
      command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
