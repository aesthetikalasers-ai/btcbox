import { chromium, devices } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 12"], viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { try { window.localStorage.setItem("btcbox-language", "zh-CN"); } catch {} });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto("http://localhost:4175/home", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: "C:/Users/xinAI/btcboxcdt/frontend/shot-home.png", fullPage: false });

// Logo size check
const logo = await page.evaluate(() => {
  const img = document.querySelector('header a[aria-label="BTCBOX home"] img');
  if (!img) return null;
  const r = img.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), src: img.getAttribute("src") };
});
console.log("LOGO:", JSON.stringify(logo));

// Mining button present?
const mining = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href="/new-listings"]')].find((el) => el.textContent?.includes("新币挖矿"));
  return a ? a.textContent?.replace(/\s+/g, " ").trim().slice(0, 40) : null;
});
console.log("MINING BUTTON:", mining);

await page.goto("http://localhost:4175/new-listings", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: "C:/Users/xinAI/btcboxcdt/frontend/shot-mining.png", fullPage: true });
const slides = await page.locator('[role="tablist"][aria-label] [role="tab"]').count();
console.log("CAROUSEL DOTS:", slides);
await browser.close();
