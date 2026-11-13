import { expect, test } from '@playwright/test';

// Synthetic isolated fixtures. These tests never access a provider or a real account.
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
    else if(url.pathname==='/api/kline') body={ok:true,klines:[{time:Date.now()-60000,open:3200,high:3300,low:3000,close:3200,volume:5}],source:'test-fixture'};
    else if(url.pathname==='/api/depth') body={ok:true,bids:[[3199,1]],asks:[[3201,1]],ts:Math.floor(Date.now()/1000),snapshotTs:Math.floor(Date.now()/1000),source:'test-fixture'};
    else if(url.pathname==='/api/trading/status') body={ok:true,spot_order_entry_enabled:false,spot_cancel_enabled:false,supported_order_types:['limit']};
    else if(url.pathname==='/api/orders') return route.fulfill({status:401,json:{ok:false,need_login:true}});
    await route.fulfill({json:body});
  });
  await page.route('https://btcbox-e2e.invalid/**',route=>route.abort());
});

test('market favorites persist, sorting changes rows, and ETH opens its own pair',async({page})=>{
  await page.goto('/markets');
  const rows = () => page.getByRole('link',{name:/spot trading/}).filter({visible:true});
  await expect(rows().first()).toHaveAccessibleName('BTC spot trading');
  await page.getByLabel('Sort by').selectOption('change');
  await expect(rows().first()).toHaveAccessibleName('ETH spot trading');
  await page.getByRole('button',{name:'Favorites ETH',exact:true}).filter({visible:true}).click();
  await page.getByRole('button',{name:'Favorites',exact:true}).click();
  await expect(rows()).toHaveCount(1);
  await page.reload();
  await page.getByRole('button',{name:'Favorites',exact:true}).click();
  await expect(rows()).toHaveCount(1);
  await rows().first().click();
  await expect(page).toHaveURL(/\/trade\/ETHUSDT$/);
  await expect(page.getByRole('heading',{name:'ETHUSDT',exact:true})).toBeVisible();
  await expect(page.getByText('Quantity · ETH', {exact:true})).toBeVisible();
});

test('V211 chart drawer and interval switches preserve the edited order',async({page})=>{
  await page.goto('/trade/ETH');
  await expect(page.getByRole('heading',{name:'ETHUSDT',exact:true})).toBeVisible();
  if(page.viewportSize()!.width<1280) await page.getByRole('button',{name:'Price chart',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Price chart',exact:true})).toBeVisible();
  if(page.viewportSize()!.width<1280) await page.getByRole('button',{name:'Close',exact:true}).click();
  const price=page.getByLabel('Limit price (USDT)');
  await expect(price).toHaveValue('3200');
  await price.fill('0.1');
  await page.getByLabel('Quantity · ETH').fill('0.2');
  await expect(page.getByText('Estimated total: 0.02 USDT',{exact:true})).toBeVisible();
  if(page.viewportSize()!.width<1280) await page.getByRole('button',{name:'Price chart',exact:true}).click();
  const response=page.waitForResponse(r=>r.url().includes('/api/kline?')&&r.url().includes('interval=5m'));
  await page.getByRole('button',{name:'5m',exact:true}).click();
  await response;
  if(page.viewportSize()!.width<1280) await page.keyboard.press('Escape');
  await expect(price).toHaveValue('0.1');
  await expect(page.getByLabel('Quantity · ETH')).toHaveValue('0.2');
  await expect(page.getByRole('button',{name:'Place buy limit order'})).toBeDisabled();
});

test('official logo and compact market workspace fit narrow viewports',async({page})=>{
  for(const width of [320,360,390,430,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/home');
    await expect(page.getByRole('heading',{name:'Market overview'})).toBeVisible();
    const logo=page.getByRole('img',{name:'BTCBOX',exact:true}).filter({visible:true}).first();
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth===1113)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('combobox',{name:'Language'})).toBeVisible();
  }
});


test('configuration outage preserves protected route and offers recovery instead of a login loop',async({page})=>{
  await page.route('**/api/auth-client-config',route=>route.fulfill({status:503,json:{ok:false}}));
  await page.goto('/assets');
  await expect(page.getByText('Account verification is taking longer than expected. Your session has not been cleared.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/assets$/);
  await page.getByRole('link',{name:'View markets',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Market overview'})).toBeVisible();
});


test('slow session restoration offers recovery and accepts a late valid session',async({page})=>{
  await page.clock.install();
  let release: (()=>void) | undefined;
  let started=false;
  await page.route('**/api/account',async route=>{
    started=true;
    await new Promise<void>(resolve=>{release=resolve;});
    await route.fulfill({json:{ok:true,uid:'synthetic-late-user',email:'late@example.invalid',username:'late_user',has_login_password:true,balances:{},unpriced_assets:[],kyc:{status:'not_submitted'},twofa_enabled:false}});
  });
  await page.goto('/assets');
  await expect.poll(()=>started).toBe(true);
  await page.clock.fastForward(12001);
  await expect(page.getByText('Account verification is taking longer than expected. Your session has not been cleared.')).toBeVisible();
  // New account reads after restoration should be immediate as well.
  await page.route('**/api/account',route=>route.fulfill({json:{ok:true,uid:'synthetic-late-user',username:'late_user',has_login_password:true,balances:{},unpriced_assets:[]}}));
  release?.();
  await expect(page.getByRole('heading',{name:'Assets',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/assets$/);
  await expect(page.getByText('Account verification is taking longer than expected. Your session has not been cleared.')).toHaveCount(0);
});


test('Chinese administration preserves the customer language preference',async({page})=>{
  for (const route of ['/admin','/admin/','/ADMIN']) {
    await page.goto(route);
    await expect(page.getByRole('heading',{name:'欢迎回来',exact:true})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
  }
  expect(await page.evaluate(()=>localStorage.getItem('btcbox-language'))).toBe('en');
  await page.getByRole('link',{name:'返回 BTCBOX'}).click();
  await expect(page.getByRole('heading',{name:'Market overview'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','en-US');
});

test('V211 keeps depth left, entry right and chart in a safe-area drawer',async({page})=>{
 for(const width of [320,360,375,390,393,414,430,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto('/trade/ETH');
  const entry=page.locator('#trade-entry'), book=page.locator('#trade-depth');
  await expect(entry).toBeVisible();await expect(book).toBeVisible();
  const e=(await entry.boundingBox())!,b=(await book.boundingBox())!;
  expect(b.x+b.width).toBeLessThanOrEqual(e.x);expect(Math.abs(e.y-b.y)).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if(width<1280){
   expect(b.width/(b.width+e.width)).toBeCloseTo(.43,2);
   await expect(page.locator('#trade-chart')).toHaveCount(0);
   const trigger=page.getByRole('button',{name:'Price chart',exact:true});
   for(let i=0;i<2;i++){
    await trigger.click();const drawer=page.getByRole('dialog');await expect(drawer).toBeVisible();
    await expect(drawer.locator('canvas').first()).toBeVisible();
    const d=(await drawer.boundingBox())!;expect(d.y+d.height).toBeLessThanOrEqual(840);
    await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(trigger).toBeFocused();
   }
  }else{
   await expect(page.locator('.exchange-pairs')).toBeVisible();
   const c=(await page.locator('#trade-chart').boundingBox())!;expect(c.x+c.width).toBeLessThanOrEqual(b.x);
   await expect(page.locator('#trade-chart canvas').first()).toBeVisible();
  }
 }
});

test('spot inputs and readable depth retain real account balances across buy and sell',async({page})=>{
 await page.route('**/api/account',r=>r.fulfill({json:{ok:true,uid:'synthetic-spot-user',username:'spot_user',unpriced_assets:[],balances:{USDT:{free:'2500.05',frozen:'0'},ETH:{free:'1.25',frozen:'0'}},kyc:{status:'not_submitted'},has_login_password:true}}));
 for(const width of [320,360,375,390,393,414,430]){
  await page.setViewportSize({width,height:900});await page.goto('/trade/ETH');
  const entry=page.locator('#trade-entry');
  await expect(entry.getByText('2,500.05 USDT',{exact:true})).toBeVisible();
  await entry.getByRole('button',{name:'Sell',exact:true}).click();
  await expect(entry.getByRole('button',{name:'Sell',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(entry.getByText('1.25 ETH',{exact:true})).toBeVisible();
  await page.getByLabel('Limit price (USDT)').fill('0.1');await page.getByLabel('Quantity · ETH').fill('0.2');
  await expect(page.getByText('Estimated total: 0.02 USDT',{exact:true})).toBeVisible();
  await entry.getByRole('button',{name:'Buy',exact:true}).click();
  await expect(page.getByLabel('Limit price (USDT)')).toHaveValue('0.1');
  await expect(page.getByLabel('Quantity · ETH')).toHaveValue('0.2');
  await expect(entry.getByRole('button',{name:'Place buy limit order'})).toBeDisabled();
  const levels=page.locator('.spot-book-row');await expect(levels.first()).toBeVisible();
  expect(await levels.first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await page.getByLabel('Limit price (USDT)').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
});

test('terminal details use real depth sizes and accessible order rows at 375, 390 and 414',async({page})=>{
 await page.route('**/api/depth?**',r=>r.fulfill({json:{ok:true,source:'isolated-test',snapshotTs:Math.floor(Date.now()/1000),bids:[['3199','1'],['3198','3']],asks:[['3201','2'],['3202','6']]}}));
 await page.route('**/api/orders',r=>r.fulfill({json:{ok:true,orders:[{order_id:'isolated-order',symbol:'ETHUSDT',side:'buy',price:'3200',quantity:'2',remaining_quantity:'1',status:'open'}]}}));
 for(const width of [375,390,414]){
  await page.setViewportSize({width,height:844});await page.goto('/trade/ETH');
  const bids=page.locator('.spot-book-row[data-side="bid"]');await expect(bids).toHaveCount(2);
  expect(await bids.first().evaluate(e=>e.style.backgroundSize)).toBe('25% 100%');
  expect(await bids.last().evaluate(e=>e.style.backgroundSize)).toBe('100% 100%');
  const asks=page.locator('.spot-book-row[data-side="ask"]');
  expect(await asks.first().evaluate(e=>e.style.backgroundSize)).toBe('100% 100%');
  expect(await asks.last().evaluate(e=>e.style.backgroundSize)).toBe('25% 100%');
  expect(await bids.first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await bids.first().evaluate(e=>getComputedStyle(e).lineHeight)).toBe('24px');
  const row=page.locator('.spot-order-row');await expect(row).toContainText('ETHUSDT · Buy');
  await expect(row).toContainText('Remaining 1');await expect(row.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();
  await page.evaluate(()=>{const m=document.querySelector('main')!;m.scrollTop=m.scrollHeight;});
  const button=(await row.getByRole('button').boundingBox())!;
  const nav=(await page.getByRole('navigation',{name:'Primary navigation',exact:true}).boundingBox())!;
  expect(button.y+button.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.getByText(/CodeRabbit|Synthetic fixture|scroll capture/)).toHaveCount(0);
 }
});

test('new spot orders follow exact available balance while trading stays enabled',async({page})=>{
 await page.route('**/api/account',r=>r.fulfill({json:{ok:true,uid:'balance-check',username:'balance_user',unpriced_assets:[],balances:{USDT:{free:'1.00',frozen:'0'},ETH:{free:'0.25',frozen:'0'}},kyc:{status:'not_submitted'},has_login_password:true}}));
 await page.route('**/api/trading/status',r=>r.fulfill({json:{ok:true,spot_order_entry_enabled:true,spot_cancel_enabled:true,supported_order_types:['limit']}}));
 await page.goto('/trade/ETH');
 await page.getByLabel('Limit price (USDT)').fill('1');
 await page.getByLabel('Quantity · ETH').fill('1.000000000000000001');
 await expect(page.getByRole('button',{name:'Insufficient available balance'})).toBeDisabled();
 await page.getByLabel('Quantity · ETH').fill('1');
 await expect(page.getByRole('button',{name:'Place buy limit order'})).toBeEnabled();
 await page.getByRole('button',{name:'Sell',exact:true}).click();
 await expect(page.getByRole('button',{name:'Insufficient available balance'})).toBeDisabled();
 await page.getByLabel('Quantity · ETH').fill('0.25');
 await expect(page.getByRole('button',{name:'Place sell limit order'})).toBeEnabled();
});

test('all preserved locales show truthful service availability without development promises',async({page})=>{
 for(const locale of ['ja','en','zh-CN','es','vi','pt','it','de']){
  await page.addInitScript(value=>localStorage.setItem('btcbox-language',value),locale);
  await page.goto('/trade-hub');
  await expect(page.locator('main')).not.toContainText(/Coming soon|近日対応予定|即将推出|Próximamente|Sắp ra mắt|Prossimamente|Em breve|Demnächst verfügbar|CodeRabbit|Synthetic fixture|scroll capture|API integration pending/i);
  await expect(page.locator('main')).toContainText(/Contract|契約|合约|Contrato|Contratto|Kontrakt/i);
 }
});


test('spot terminal removes the market sub-toolbar and shows exactly four ask and bid levels', async ({page}) => {
  await page.route('**/api/depth?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      snapshotTs: Math.floor(Date.now() / 1000),
      source: 'isolated-four-level-fixture',
      asks: [['3201.01','0.4'],['3201.02','0.5'],['3201.03','0.6'],['3201.04','0.7'],['3201.05','0.8'],['3202.01','0.9']],
      bids: [['3199.99','0.4'],['3199.98','0.5'],['3199.97','0.6'],['3199.96','0.7'],['3199.95','0.8'],['3198.99','0.9']],
    }),
  }));
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/trade/ETH');
    await expect(page.getByRole('heading', {name:'ETHUSDT', exact:true})).toBeVisible();
    await expect(page.locator('.spot-toolbar')).toHaveCount(0);
    await expect(page.locator('#trade-depth .spot-book-row[data-side="ask"]')).toHaveCount(4);
    await expect(page.locator('#trade-depth .spot-book-row[data-side="bid"]')).toHaveCount(4);
    await expect(page.locator('#trade-entry')).toBeVisible();
    const row = page.locator('#trade-depth .spot-book-row').first();
    await expect(row).toBeVisible();
    expect(await row.evaluate(el => parseFloat(getComputedStyle(el).lineHeight))).toBe(24);
  }
});

test('spot mobile trading controls keep the chart, book precision, order tabs and limit-only contract clear', async ({page}) => {
  await page.route('**/api/depth?**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      snapshotTs: Math.floor(Date.now() / 1000),
      source: 'isolated-depth-precision-fixture',
      asks: [['3201.01','0.4'],['3201.02','0.5'],['3201.03','0.6'],['3201.04','0.7'],['3201.05','0.8'],['3202.01','0.9']],
      bids: [['3199.99','0.4'],['3199.98','0.5'],['3199.97','0.6'],['3199.96','0.7'],['3199.95','0.8'],['3198.99','0.9']],
    }),
  }));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/trade/ETH');
  await expect(page.getByRole('heading',{name:'ETHUSDT',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Price chart',exact:true})).toBeVisible();
  await expect(page.locator('.spot-shortcuts')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#trade-depth .spot-book-row[data-side="ask"]')).toHaveCount(4);
  await expect(page.locator('#trade-depth .spot-book-row[data-side="bid"]')).toHaveCount(4);

  const precision=page.getByLabel('Depth precision');
  await expect(precision).toHaveValue('0.01');
  await precision.selectOption('1');
  await expect(page.locator('#trade-depth .spot-book-row[data-side="ask"]')).toHaveCount(2);
  await expect(page.locator('#trade-depth .spot-book-row[data-side="bid"]')).toHaveCount(2);
  await precision.selectOption('0.01');
  await expect(page.locator('#trade-depth .spot-book-row[data-side="ask"]')).toHaveCount(4);

  await page.getByRole('button',{name:'Bids only'}).click();
  await expect(page.locator('#trade-depth .spot-book-row[data-side="ask"]').first()).toBeHidden();
  await expect(page.locator('#trade-depth .spot-book-row[data-side="bid"]').first()).toBeVisible();
  await page.getByRole('button',{name:'Asks only'}).click();
  await expect(page.locator('#trade-depth .spot-book-row[data-side="ask"]').first()).toBeVisible();
  await expect(page.locator('#trade-depth .spot-book-row[data-side="bid"]').first()).toBeHidden();
  await page.getByRole('button',{name:'Both sides'}).click();
  await expect(page.locator('#trade-depth .spot-book-row[data-side="bid"]')).toHaveCount(4);

  const orderType=page.getByLabel('Order type');
  await expect(orderType).toHaveValue('limit');
  await orderType.selectOption('market');
  await expect(orderType).toHaveValue('market');
  await expect(page.getByText('Market orders are unavailable under the current trading contract. Switch to limit order to continue.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Place buy limit order'})).toBeDisabled();
  await orderType.selectOption('limit');
  const price=page.getByLabel('Limit price (USDT)');
  await price.fill('3200');
  await page.getByRole('button',{name:'Increase price'}).click();
  await expect(price).toHaveValue('3200.01');
  await page.getByRole('button',{name:'Decrease price'}).click();
  await expect(price).toHaveValue('3200.00');

  await expect(page.getByRole('tab',{name:'Open orders (0)'})).toBeVisible();
  await page.getByRole('tab',{name:'Current assets'}).click();
  await expect(page.getByText('Available · ETH',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Order history'})).toHaveAttribute('href','/orders');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
