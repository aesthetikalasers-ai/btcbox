'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../../frontend/src/lib/api.ts'), 'utf8');
const assetsPage = fs.readFileSync(path.resolve(root, '../../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');
const marketsPage = fs.readFileSync(path.resolve(root, '../../frontend/src/features/markets/MarketsPage.tsx'), 'utf8');
const dashboardMarkets = fs.readFileSync(path.resolve(root, '../../frontend/src/features/dashboard/components/LiveMarketsTable.tsx'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const tradeNav = fs.readFileSync(path.resolve(root, '../../frontend/src/features/trade/TradeProductNav.tsx'), 'utf8');
const tradeHub = fs.readFileSync(path.resolve(root, '../../frontend/src/features/pages/TradeHubPage.tsx'), 'utf8');
const spotPage = fs.readFileSync(path.resolve(root, '../../frontend/src/features/pages/Pages.tsx'), 'utf8');
const contractPage = fs.readFileSync(path.resolve(root, '../../frontend/src/features/pages/ContractPage.tsx'), 'utf8');
const secondsPage = fs.readFileSync(path.resolve(root, '../../frontend/src/features/pages/SecondsPage.tsx'), 'utf8');

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
  assert.ok(spotPage.includes('setPairSymbols(pairResult.value.filter(pair=>pair.quote_asset==="USDT").map(pair=>pair.base_asset+pair.quote_asset))'));
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
  assert.ok(tradeNav.includes('setHasSpotPairs(pairs.length > 0)'));
  assert.ok(tradeNav.includes('if (key === "spot" && !hasSpotPairs) return false'));
});
