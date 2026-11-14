// Temporary visual review: capture key pages at desktop + mobile widths.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const shots = [
    { path: '/home', name: 'home-desktop', w: 1440, h: 900 },
    { path: '/markets', name: 'markets-desktop', w: 1440, h: 900 },
    { path: '/trade/BTCUSDT', name: 'trade-desktop', w: 1440, h: 900 },
    { path: '/home', name: 'home-mobile', w: 390, h: 844 },
    { path: '/markets', name: 'markets-mobile', w: 390, h: 844 },
    { path: '/trade/BTCUSDT', name: 'trade-mobile', w: 390, h: 844 },
  ];
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    // Default language is Japanese for review.
    await page.addInitScript(() => localStorage.setItem('btcbox-language', 'ja'));
    await page.goto('http://127.0.0.1:5173' + s.path, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const shotPath = 'artifacts/review-' + s.name + '.png';
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log('captured', shotPath);
    await page.close();
  }
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
