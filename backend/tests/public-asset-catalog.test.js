'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const assetsPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');
const marketsPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/markets/MarketsPage.tsx'), 'utf8');
const dashboardMarkets = fs.readFileSync(path.resolve(root, '../frontend/src/features/dashboard/components/LiveMarketsTable.tsx'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const tradeNav = fs.readFileSync(path.resolve(root, '../frontend/src/features/trade/TradeProductNav.tsx'), 'utf8');
const tradeHub = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/TradeHubPage.tsx'), 'utf8');
const spotPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');
const contractPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/ContractPage.tsx'), 'utf8');
const secondsPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/SecondsPage.tsx'), 'utf8');
const dashboardPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/dashboard/Dashboard.tsx'), 'utf8');
const publicMarketFilter = fs.readFileSync(path.resolve(root, '../frontend/src/lib/publicAssetMarkets.ts'), 'utf8');
const tokenIcon = fs.readFileSync(path.resolve(root, '../frontend/src/components/ui/TokenIcon.tsx'), 'utf8');
const localTokenIconFiles = fs.readdirSync(path.resolve(root, '../frontend/public/token-icons')).filter((file) => file.endsWith('.svg'));
const marketData = fs.readFileSync(path.resolve(root, '../frontend/src/lib/marketData.ts'), 'utf8');
const frontendPackage = JSON.parse(fs.readFileSync(path.resolve(root, '../frontend/package.json'), 'utf8'));

test('public asset catalogue exposes only display metadata and never wallet or account data', () => {
  const start = api.indexOf("if (path === 'assets' && method === 'GET')");
  const end = api.indexOf('// ---------- GET /api/config ----------', start);
  assert.ok(start >= 0 && end > start, 'public asset catalogue route must exist');
  const route = api.slice(start, end);
  for (const field of ['code: asset.code', 'name: asset.name', 'display_name: asset.display_name',
    'display_precision: asset.display_precision', 'enabled: asset.enabled', 'visible: asset.visible', 'spot_enabled: asset.spot_enabled', 'perpetual_enabled: asset.perpetual_enabled', 'seconds_enabled: asset.seconds_enabled', 'earn_enabled: asset.earn_enabled', 'sort_order: asset.sort_order']) {
    assert.ok(route.includes(field), 'public metadata missing ' + field);
  }
  assert.ok(!route.includes('deposit_addresses'));
  assert.ok(!route.includes('withdrawal_fees'));
  assert.ok(!route.includes('balances'));
});

test('disabled assets are excluded from public spot markets and limit-order submission', () => {
  const start = api.indexOf('async function readSpotMarketCatalog(state)');
  const end = api.indexOf('// Keep this list aligned', start);
  assert.ok(start >= 0 && end > start);
  const reader = api.slice(start, end);
  assert.ok(reader.includes('normalizeAdminAssetCatalog(state && state.asset_catalog)'));
  assert.ok(reader.includes('enabled: market.enabled && enabledAssets.has(market.base_asset) && enabledAssets.has(market.quote_asset)'));
  const orderStart = api.indexOf("if (path === 'order' && method === 'POST')");
  const orderEnd = api.indexOf("if (path === 'order/cancel' && method === 'POST')", orderStart);
  const order = api.slice(orderStart, orderEnd);
  const gate = order.indexOf('readSpotMarketCatalog(db)');
  const submit = order.indexOf("matchingRpc('submit_limit_order_matching_v1'");
  assert.ok(gate > 0 && submit > gate, 'asset and market state must be checked before matching RPC');
  assert.ok(order.includes("code: 'ASSET_OR_MARKET_DISABLED'"));
});

test('wallet asset display follows configured names, precision metadata, visibility and sort order without hiding funds', () => {
  assert.ok(client.includes('getPublicAssetCatalog'));
  assert.ok(client.includes('valid.length !== 26'));
  assert.ok(assetsPage.includes('getPublicAssetCatalog(controller.signal)'));
  assert.ok(assetsPage.includes('config.enabled && config.visible'));
  assert.ok(assetsPage.includes('hasFunds || !config'));
  assert.ok(assetsPage.includes('hasNonZeroAmount(balance.free) || hasNonZeroAmount(balance.frozen)'));
  assert.ok(assetsPage.includes(String.raw`/^-?\d+(?:\.\d+)?$/`));
  assert.ok(assetsPage.includes('left.sort_order - right.sort_order'));
  assert.ok(assetsPage.includes('assetConfig?.display_name || assetConfig?.name'));
  assert.ok(assetsPage.includes('assetConfig?.display_precision ?? 8'));
  assert.ok(assetsPage.includes('formatConfiguredAssetAmount(balance.free, numberLocale, displayPrecision)'));
  assert.ok(assetsPage.includes('formatConfiguredAssetAmount(balance.frozen, numberLocale, displayPrecision)'));
  assert.ok(assetsPage.includes('hasEnabledSpotPair'));
  assert.ok(assetsPage.includes('pair.enabled'));
  assert.ok(marketsPage.includes('getPublicAssetCatalog(controller.signal)'));
  assert.ok(marketsPage.includes('assetNames[assetCodeFromMarketSymbol(market.sym)] || getAssetName(market.sym)'));
  assert.ok(marketsPage.includes('!configuredName.toUpperCase().includes(needle)'));
  assert.ok(marketsPage.includes('[markets, assetCatalog, query, filter, favorites, sort, assetNames]'));
  assert.ok(marketsPage.includes('assetNames={assetNames}'));
  assert.ok(dashboardMarkets.includes('getPublicAssetCatalog(controller.signal)'));
  assert.ok(dashboardMarkets.includes('assetNames[assetCodeFromMarketSymbol(item.sym)] || names[assetCodeFromMarketSymbol(item.sym)] || getAssetName(item.sym)'));
  assert.ok(marketsPage.includes('assetCatalog.length > 0 && (!assetConfig || !assetConfig.enabled || !assetConfig.visible || !assetConfig.spot_enabled)'));
  assert.ok(marketsPage.includes('[markets, assetCatalog, query, filter, favorites, sort, assetNames]'));
  assert.ok(dashboardMarkets.includes('assetCatalog.length > 0 && (!assetConfig || !assetConfig.enabled || !assetConfig.visible || !assetConfig.spot_enabled)'));
  assert.ok(dashboardMarkets.includes('[displayMarkets, assetCatalog, query, favoritesOnly, favorites, sort, assetNames]'));
});


test('asset module flags independently gate new product entry while preserving exit paths', () => {
  for (const flag of ['spot_enabled','perpetual_enabled','seconds_enabled','earn_enabled']) {
    assert.ok(api.includes(flag + ': typeof item.' + flag + ' === \'boolean\' ? item.' + flag + ' : fallback.' + flag));
  }
  assert.ok(api.includes("filter(function (asset) { return asset.enabled && asset.spot_enabled; })"));
  assert.ok(api.includes('function isAssetVisible(state, code)'));
  assert.ok(api.includes('market.enabled && isAssetVisible(db, market.base_asset) && isAssetVisible(db, market.quote_asset)'));
  assert.ok(api.includes('market.enabled && isAssetVisible(db, market.base_asset) && isAssetVisible(db, market.quote_asset) && market.quote_asset === \'USDT\''));
  assert.ok(api.includes("policy.symbols.filter(symbol => isAssetModuleEnabled(db, symbol, 'seconds_enabled') && isAssetVisible(db, symbol))"));
  assert.ok(api.includes("if (!isAssetModuleEnabled(db, symbol, 'seconds_enabled'))"));
  assert.ok(api.includes("isAssetModuleEnabled(db, market.base_asset, 'perpetual_enabled') && isAssetModuleEnabled(db, market.quote_asset, 'perpetual_enabled') && isAssetVisible(db, market.base_asset) && isAssetVisible(db, market.quote_asset)"));
  assert.ok(api.includes("if (!reduceOnly) {"));
  assert.ok(api.includes("rows.filter(item => isAssetModuleEnabled(db, item.asset, 'earn_enabled') && isAssetVisible(db, item.asset))"));
  assert.ok(api.includes("if (!isAssetModuleEnabled(db, asset, 'earn_enabled'))"));
  const redeemStart = api.indexOf("if (action === 'redeem')");
  assert.ok(redeemStart > 0);
  assert.ok(!api.slice(redeemStart, api.indexOf("return json({ ok: false, msg: 'Unknown operation.'", redeemStart)).includes('ASSET_MODULE_DISABLED'));
  assert.ok(admin.includes('asset.code+" spot enabled"'));
  assert.ok(admin.includes('asset.code+" perpetual enabled"'));
  assert.ok(admin.includes('asset.code+" seconds enabled"'));
  assert.ok(admin.includes('asset.code+" earn enabled"'));
  assert.ok(client.includes('typeof asset.spot_enabled === "boolean"'));
  assert.ok(client.includes('typeof asset.perpetual_enabled === "boolean"'));
  assert.ok(client.includes('typeof asset.seconds_enabled === "boolean"'));
  assert.ok(client.includes('typeof asset.earn_enabled === "boolean"'));
  assert.ok(assetsPage.includes('assetConfig.earn_enabled'));
  assert.ok(assetsPage.includes('assetCatalog.some(asset => asset.enabled && asset.visible && asset.earn_enabled)'));
  assert.ok(assetsPage.includes('assetConfig?.enabled && assetConfig.visible && assetConfig.earn_enabled'));
});

test('trade product navigation follows public asset visibility and module switches', () => {
  assert.ok(tradeNav.includes('getPublicAssetCatalog(controller.signal)'));
  assert.ok(tradeNav.includes('asset.enabled && asset.visible'));
  assert.ok(tradeNav.includes('asset.spot_enabled'));
  assert.ok(tradeNav.includes('asset.perpetual_enabled'));
  assert.ok(tradeNav.includes('asset.seconds_enabled'));
  assert.ok(tradeNav.includes('asset.earn_enabled'));
  assert.ok(tradeNav.includes('asset.code === "USDT"'));
  assert.ok(tradeNav.includes('quoteAsset.spot_enabled'));
  assert.ok(tradeNav.includes('quoteAsset.perpetual_enabled'));
  assert.ok(tradeNav.includes('["BTC", "ETH", "SOL", "BNB"].includes(asset.code)'));
  assert.ok(tradeNav.includes('PRODUCTS.filter'));
  assert.ok(tradeNav.includes('availableProducts.map'));
  assert.ok(tradeNav.includes('if (availableProducts.length === 0) return null'));
});


test('trade hub only renders product cards with eligible configured assets', () => {
  assert.ok(tradeHub.includes('getPublicAssetCatalog(controller.signal)'));
  assert.ok(tradeHub.includes('const showSpot = !pairsLoading && !pairsError && spotPairs.length > 0'));
  assert.ok(tradeHub.includes('const showPerpetual = hasVisibleAssetModule("perpetual_enabled")'));
  assert.ok(tradeHub.includes('!!usdtAsset?.enabled && !!usdtAsset.visible && !!usdtAsset.perpetual_enabled'));
  assert.ok(tradeHub.includes('const showSeconds = hasVisibleAssetModule("seconds_enabled", ["BTC", "ETH", "SOL", "BNB"])'));
  assert.ok(tradeHub.includes('const showEarn = hasVisibleAssetModule("earn_enabled")'));
  for (const condition of ['{showSpot ? (','{showPerpetual ? (','{showSeconds ? (','{showEarn ? (']) {
    assert.ok(tradeHub.includes(condition), 'missing conditional product card ' + condition);
  }
});


test('direct trading routes fail closed when their configured asset markets are unavailable', () => {
  assert.ok(spotPage.includes('getSpotMarketPairs(controller.signal)'));
  assert.ok(spotPage.includes('pairResult.value.filter(pair => pair.enabled === true && pair.quote_asset === "USDT")'));
  assert.ok(spotPage.includes('enabledSpotPairs.some(pair => pair.base_asset === baseAssetCode(item.sym))'));
  assert.ok(spotPage.includes('if(!spotPairEnabled&&!pendingIntent)'));
  assert.ok(spotPage.includes('disabled={pairSymbols.length===0}'));
  assert.ok(spotPage.includes('pairSymbols.map(pair=>'));
  assert.ok(contractPage.includes('getPerpMarkets(controller.signal)'));
  assert.ok(contractPage.includes('!marketsLoading && !marketsError && markets.length === 0'));
  assert.ok(contractPage.includes('markets.length > 0 ? ('));
  assert.ok(secondsPage.includes('SECONDS_ASSETS_DISABLED'));
  assert.ok(secondsPage.includes('Seconds contracts are unavailable because no supported assets are enabled.'));
  assert.ok(secondsPage.includes('policyUnavailableMessage ?'));
});

test('trade product navigation requires an actual enabled spot pair', () => {
  assert.ok(tradeNav.includes('getSpotMarketPairs(controller.signal)'));
  assert.ok(tradeNav.includes('setFirstSpotPair(firstEnabled ? firstEnabled.base_asset + firstEnabled.quote_asset : "")'));
  assert.ok(tradeNav.includes('to: `/trade/${firstSpotPair}`'));
  assert.ok(tradeNav.includes('if (key === "spot" && !hasSpotPairs) return false'));
});


test('public market surfaces share a fail-closed asset catalogue filter', () => {
  assert.ok(publicMarketFilter.includes('if (!assets) return [];'));
  assert.ok(publicMarketFilter.includes('quote.enabled && quote.visible && quote.spot_enabled'));
  assert.ok(publicMarketFilter.includes('base.enabled && base.visible && base.spot_enabled'));
  assert.ok(marketsPage.includes('filterPublicSpotMarkets(markets, assetCatalog)'));
  assert.ok(marketsPage.includes('if (assetCatalog === null)'));
  assert.ok(dashboardMarkets.includes('filterPublicSpotMarkets(displayMarkets, assetCatalog)'));
  assert.ok(dashboardMarkets.includes('assetCatalog === null ? ('));
  assert.ok(dashboardPage.includes('filterPublicSpotMarkets(markets, assetCatalog)'));
  assert.ok(dashboardPage.includes('<BannerCarousel markets={publicMarkets}'));
});

test('homepage product shortcuts and banners follow public module availability', () => {
  assert.ok(dashboardPage.includes('hasSpot={publicMarkets.length > 0}'));
  assert.ok(dashboardPage.includes('spotTo={publicMarkets[0] ? `/trade/${pairSymbol(publicMarkets[0].sym)}` : "/markets"}'));
  assert.ok(dashboardPage.includes('hasPerpetual={hasPerpetual}'));
  assert.ok(dashboardPage.includes('hasSeconds={hasSeconds}'));
  assert.ok(dashboardPage.includes('hasEarn={hasEarn}'));
  assert.ok(dashboardPage.includes('if (slide.to === "/earn") return hasEarn'));
  assert.ok(dashboardPage.includes('if (slide.to === "/trade-hub") return hasTrading'));
});

test('token icon rendering uses packaged crypto SVGs with a non-fabricated fallback', () => {
  assert.ok(frontendPackage.dependencies['cryptocurrency-icons']);
  assert.ok(tokenIcon.includes('cryptocurrency-icons/svg/color/*.svg'));
  assert.ok(tokenIcon.includes('LOCAL_TOKEN_ICON_SYMBOLS.has(normalized)'));
  assert.ok(tokenIcon.includes('`/token-icons/${normalized}.svg`'));
  assert.ok(localTokenIconFiles.includes('near.svg'));
  assert.ok(localTokenIconFiles.includes('sui.svg'));
  const localIconBlock = tokenIcon.slice(tokenIcon.indexOf('const LOCAL_TOKEN_ICON_SYMBOLS'), tokenIcon.indexOf('const cryptoIconModules'));
  for (const file of localTokenIconFiles) assert.ok(localIconBlock.includes('"' + file.replace(/\.svg$/, '') + '"'), 'local token icon is not registered: ' + file);
  assert.ok(tokenIcon.includes('onError={() => setHasError(true)}'));
  assert.ok(tokenIcon.includes('normalizeSymbol(symbol).substring(0, 3)'));
});


test('fallback display names cover all 26 configured assets', () => {
  const codes = [...api.slice(api.indexOf('const ASSET_CATALOG_DEFAULTS = ['), api.indexOf('function normalizeAdminAssetCatalog')).matchAll(/\['([A-Z0-9]+)'/g)].map((match) => match[1]);
  assert.equal(codes.length, 26);
  const marketNames = marketData.slice(marketData.indexOf('export const ASSET_NAMES'), marketData.indexOf('};', marketData.indexOf('export const ASSET_NAMES')));
  const walletNames = assetsPage.slice(assetsPage.indexOf('const COIN_NAMES'), assetsPage.indexOf('};', assetsPage.indexOf('const COIN_NAMES')));
  for (const code of codes) {
    assert.match(marketNames, new RegExp('\\b' + code + ':'));
    assert.match(walletNames, new RegExp('\\b' + code + ':'));
  }
});


test('public kline and depth endpoints reject hidden spot assets before provider requests', () => {
  const klineStart = api.indexOf("if (path === 'kline' && method === 'GET')");
  const depthStart = api.indexOf("if (path === 'depth' && method === 'GET')");
  const authStart = api.indexOf('// ---------- 以下接口需要登录 ----------', depthStart);
  assert.ok(klineStart > 0 && depthStart > klineStart && authStart > depthStart);
  const kline = api.slice(klineStart, depthStart);
  const depth = api.slice(depthStart, authStart);
  const visibilityGate = "isAssetVisible(db, market.base_asset) && isAssetVisible(db, market.quote_asset)";
  assert.ok(kline.includes(visibilityGate), 'kline must reject hidden base or quote assets');
  assert.ok(depth.includes(visibilityGate), 'depth must reject hidden base or quote assets');
  assert.ok(kline.indexOf(visibilityGate) < kline.indexOf('timeoutFetchJson('), 'kline must gate before external provider requests');
  assert.ok(depth.indexOf(visibilityGate) < depth.indexOf('timeoutFetchJson('), 'depth must gate before external provider requests');
});


test('public asset catalog refreshes while dashboard, markets and wallet pages remain open', () => {
  const pages = [
    ['dashboard', dashboardPage],
    ['dashboard market table', dashboardMarkets],
    ['markets page', marketsPage],
    ['wallet assets page', assetsPage],
  ];
  for (const [name, source] of pages) {
    assert.ok(source.includes('window.setInterval(refresh, 30000)'), name + ' must refresh public configuration periodically');
    assert.ok(source.includes('window.addEventListener("focus", refresh)'), name + ' must refresh when the tab regains focus');
    assert.ok(source.includes('document.addEventListener("visibilitychange", refresh)'), name + ' must refresh when the page becomes visible');
    assert.ok(source.includes('window.clearInterval(poll)'), name + ' must clean up its refresh timer');
    assert.ok(source.includes('pending?.abort()'), name + ' must abort an in-flight refresh on unmount');
  }
  assert.ok(assetsPage.includes('getSpotMarketPairs(controller.signal)'), 'wallet asset page must refresh the enabled spot pair list with the asset catalogue');
  assert.ok(assetsPage.includes('Promise.allSettled(['), 'wallet asset and pair refreshes must fail independently');
});


test('open trading and Earn pages revalidate enabled catalogues without retaining disabled selections', () => {
  for (const [name, source, timerName] of [
    ['spot terminal', spotPage, 'refreshPairs'],
    ['perpetual terminal', contractPage, 'refresh'],
    ['seconds terminal', secondsPage, 'refreshPolicy'],
    ['product navigation', tradeNav, 'refresh'],
    ['Earn catalogue', spotPage, 'refreshCatalog'],
  ]) {
    assert.ok(source.includes(`window.setInterval(${timerName}, 30000)`), name + ' must periodically revalidate server configuration');
    assert.ok(source.includes('window.addEventListener("focus", ' + timerName + ')'), name + ' must refresh on focus');
    assert.ok(source.includes('document.addEventListener("visibilitychange", ' + timerName + ')'), name + ' must refresh when visible');
    assert.ok(source.includes('window.clearInterval(timer)'), name + ' must clean up its polling timer');
  }
  assert.ok(spotPage.includes('setSpotPairEnabled(!!selected)'), 'spot order entry must follow the refreshed selected pair');
  assert.ok(spotPage.includes('setSpotPairRules(selected)'), 'spot rules must be refreshed with the pair catalogue');
  assert.ok(spotPage.includes('setTicker(null);setBook(null);setCandles([])'), 'a disabled spot pair must clear its stale market snapshot');
  assert.ok(contractPage.includes('getPerpMarkets(controller.signal)'), 'perpetual markets must be fetched from the authoritative backend');
  assert.ok(contractPage.includes('setMarkets([])') && contractPage.includes('setSymbol("")'), 'disabled or unavailable perpetual markets must clear stale selection');
  assert.ok(secondsPage.includes('getSecondsPolicy(controller.signal)'), 'seconds policy must be revalidated from the backend');
  assert.ok(secondsPage.includes('setPolicy(null)'), 'unavailable seconds policy must fail closed');
  assert.ok(spotPage.includes('getEarnCatalog(controller.signal)'), 'Earn products must be reloaded from the backend');
  assert.ok(spotPage.includes('setProducts([]);setActionsEnabled(false);setSelectedProduct("")'), 'Earn must clear stale products and disable actions on catalogue failure');
});

test('favorite symbols remain stored but hidden when their public spot market is disabled', () => {
  const visibleStart = marketsPage.indexOf('const visibleMarkets = useMemo');
  const visibleEnd = marketsPage.indexOf('if (assetCatalog === null)', visibleStart);
  const visibleBlock = marketsPage.slice(visibleStart, visibleEnd);
  assert.ok(visibleBlock.includes('filterPublicSpotMarkets(markets, assetCatalog).filter'), 'favorites must be intersected with enabled public spot markets');
  assert.ok(visibleBlock.includes('if (filter === "favorites") return favorites.includes(market.sym)'), 'favorites filter must only run on already eligible markets');
  assert.ok(marketsPage.includes('window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))'), 'user favorites remain persisted independently of temporary market visibility');
});
