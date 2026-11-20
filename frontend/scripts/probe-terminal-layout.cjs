/**
 * Layout probe: measures the desktop trading terminal at a given viewport and
 * reports geometry that must hold for the viewport-locked three-column design.
 * Usage: `node scripts/probe-terminal-layout.cjs [width] [height]`.
 */
const { chromium } = require("@playwright/test");
const mock = require("./probe-mocks.cjs");

(async () => {
  const width = Number(process.argv[2] || 1440);
  const height = Number(process.argv[3] || 900);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => window.localStorage.setItem("btcbox-language", "en"));
  await mock(page);
  await page.goto("http://127.0.0.1:4173/trade/BTCUSDT", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  const report = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const out = {};
    out.viewport = { w: window.innerWidth, h: window.innerHeight };
    out.doc = { scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth };
    out.layout = rect(document.querySelector(".term-layout"));
    const book = document.querySelector(".term-book-body");
    out.book = book ? { ...rect(book), scrollH: book.scrollHeight, clientH: book.clientHeight } : null;
    const rows = [...document.querySelectorAll(".term-book-body .spot-book-row")];
    out.bookRows = { total: rows.length, asks: rows.filter((r) => r.dataset.side === "ask").length, bids: rows.filter((r) => r.dataset.side === "bid").length };
    const chartBody = document.querySelector(".term-chart-body");
    out.chart = { body: rect(chartBody), canvas: rect(chartBody?.querySelector("canvas")) };
    const entry = document.querySelector(".term-col--entry");
    out.entry = entry ? { ...rect(entry), scrollH: entry.scrollHeight, clientH: entry.clientHeight } : null;
    const cta = document.querySelector(".term-submit");
    out.cta = cta ? { ...rect(cta), text: cta.textContent.trim() } : null;
    out.slider = rect(document.querySelector(".term-slider input[type=range]"));
    out.banner = document.querySelector(".term-banner")?.textContent.trim().slice(0, 60) ?? null;
    out.tradesTable = !!document.querySelector(".term-rt table");
    out.tabLabels = [...document.querySelectorAll(".term-bottom-tabs [role=tab]")].map((el) => el.textContent.trim());
    return out;
  });

  console.log(JSON.stringify(report, null, 1));
  await page.screenshot({ path: "test-results/term-" + width + "x" + height + ".png" });
  await browser.close();
})();