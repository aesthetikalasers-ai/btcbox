'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');
const page = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const client = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/api.ts'), 'utf8');
const navigation = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/admin-navigation.ts'), 'utf8');

const expected = ['USDT','USDC','BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','LINK','DOT','TRX','LTC','BCH','NEAR','UNI','ATOM','ETC','APT','ARB','OP','SUI','INJ','TIA','FIL'];

test('asset catalogue seeds all 26 ledger assets independently of market and wallet configuration', () => {
  const start = api.indexOf('const ASSET_CATALOG_DEFAULTS = [');
  const end = api.indexOf('function normalizeAdminAssetCatalog', start);
  assert.ok(start >= 0 && end > start);
  const block = api.slice(start, end);
  for (const code of expected) assert.ok(block.includes("['" + code + "'"), 'missing ' + code);
  assert.equal((block.match(/\['[A-Z0-9]+'/g) || []).length, 26);
  assert.ok(api.includes('function normalizeAdminAssetCatalog(value)'));
  assert.ok(api.includes('return json({ ok: true, assets: normalizeAdminAssetCatalog(db.asset_catalog) })'));
});

test('asset catalogue writes validate the full fixed set and persist audited display configuration', () => {
  const start = api.indexOf("if (sub === 'assets' && method === 'POST')");
  const end = api.indexOf('// Spot-market controls', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  for (const contract of [
    'body.assets.length !== ASSET_CATALOG_DEFAULTS.length', 'seen.has(code)',
    'name.length > 64', 'displayName.length > 64', 'precision < 0', 'precision > 18',
    'typeof item.enabled !== \'boolean\'', 'typeof item.visible !== \'boolean\'',
    'sortOrder > 9999', 'seen.size !== ASSET_CATALOG_DEFAULTS.length',
    'db.asset_catalog = normalized', "auditAdmin('asset_catalog_update'", 'await saveDB(db)'
  ]) assert.ok(route.includes(contract), 'missing contract: ' + contract);
});

test('admin UI exposes asset catalogue separately from spot markets and deposit configuration', () => {
  assert.ok(navigation.includes('"assets"'));
  assert.ok(navigation.includes('label: "Asset configuration"'));
  assert.ok(navigation.includes('"assets", "markets"'));
  assert.ok(page.includes('Asset configuration · 26 assets'));
  assert.ok(page.includes('display_precision'));
  assert.ok(page.includes('saveAssetCatalog'));
  assert.ok(client.includes('getAdminAssets'));
  assert.ok(client.includes('saveAdminAssets'));
});
