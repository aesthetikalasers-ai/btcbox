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

test('chart is visible on mobile and interval switches preserve the edited order',async({page})=>{
  await page.goto('/trade/ETH');
  await expect(page.getByRole('heading',{name:'ETHUSDT',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Price chart',exact:true})).toBeVisible();
  const price=page.getByLabel('Limit price (USDT)');
  await expect(price).toHaveValue('3200');
  await price.fill('0.1');
  await page.getByLabel('Quantity · ETH').fill('0.2');
  await expect(page.getByText('Estimated total: 0.02 USDT',{exact:true})).toBeVisible();
  const response=page.waitForResponse(r=>r.url().includes('/api/kline?')&&r.url().includes('interval=5m'));
  await page.getByRole('button',{name:'5m',exact:true}).click();
  await response;
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
