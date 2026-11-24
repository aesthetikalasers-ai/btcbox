import { test } from '@playwright/test';
import fs from 'node:fs';

// Visual proof capture for the Mobile Spot Terminal polish.
// Mirrors the isolated fixtures used by `redesign.spec.ts` so the capture never
// touches a provider or a real account.
const markets = [
  {sym:'BTC',price:65000,chg:1.2,high:66000,low:64000,vol:'1000000'},
  {sym:'ETH',price:3200,chg:3.4,high:3300,low:3000,vol:'500000'},
];

test.beforeEach(async ({page}) => {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body: object = {ok:true};
    if(url.pathname==='/api/auth-client-config') body={ok:true,supabase_url:'https://btcbox-e2e.invalid',publishable_key:'synthetic-public-key',google_enabled:false,wallet_enabled:true};
    else if(url.pathname==='/api/account') return route.fulfill({status:401,json:{ok:false,need_login:true}});
    else if(url.pathname==='/api/market') body={ok:true,markets,data:Object.fromEntries(markets.map(m=>[m.sym,{ts:Math.floor(Date.now()/1000),providerTs:Math.floor(Date.now()/1000),source:'test-fixture'}]))};
    else if(url.pathname==='/api/market/pairs') body={ok:true,markets:markets.map(m=>({base_asset:m.sym,quote_asset:'USDT',enabled:true,price_tick:'0.01',quantity_step:'0.0001',min_quantity:'0.0001',min_notional:'10'}))};
    else if(url.pathname==='/api/kline') body={ok:true,klines:[{time:Date.now()-120000,open:3140,high:3220,low:3120,close:3160,volume:5},{time:Date.now()-60000,open:3160,high:3260,low:3150,close:3230,volume:6},{time:Date.now(),open:3230,high:3300,low:3190,close:3200,volume:7}],source:'test-fixture'};
    else if(url.pathname==='/api/depth') body={ok:true,bids:[['3199','1.25'],['3198','2.10'],['3197','0.85'],['3196','3.40']],asks:[['3201','1.10'],['3202','0.90'],['3203','2.60'],['3204','1.35']],ts:Math.floor(Date.now()/1000),snapshotTs:Math.floor(Date.now()/1000),source:'test-fixture'};
    else if(url.pathname==='/api/trading/status') body={ok:true,spot_order_entry_enabled:true,spot_cancel_enabled:true,supported_order_types:['limit']};
    else if(url.pathname==='/api/orders') return route.fulfill({status:401,json:{ok:false,need_login:true}});
    await route.fulfill({json:body});
  });
  await page.route('https://btcbox-e2e.invalid/**',route=>route.abort());
});

test('capture mobile spot terminal at 390x844', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/trade/ETH', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.spot-book-row', { timeout: 20000 });
  await page.waitForTimeout(1200);
  fs.mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/mobile-spot-terminal-390x844.png', fullPage: false });

  // Chart drawer open (compact 200–220px inline chart + timeframe pills).
  await page.getByRole('button', { name: 'Price chart', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/mobile-spot-chart-drawer-390x844.png', fullPage: false });
  await page.keyboard.press('Escape');

  // Full-page capture to prove the columns bottom-align with the CTA button.
  await page.screenshot({ path: 'artifacts/mobile-spot-terminal-390x844-full.png', fullPage: true });
});
