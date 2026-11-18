import { chromium, devices } from "@playwright/test";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 12"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { window.localStorage.setItem("btcbox-language", "zh-CN"); } catch {} });
const page = await ctx.newPage();
await page.goto("http://localhost:4175/contract", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: "C:/Users/xinAI/btcboxcdt/frontend/probe-book2.png" });
await browser.close();
