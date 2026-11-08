'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const depositSql = fs.readFileSync(path.join(root, 'supabase/sql/0007_financial_admin_manual_deposit_v1.sql'), 'utf8');

test('manual credit supports every asset exposed in the admin asset selector', () => {
  const supported = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'];
  assert.ok(api.includes("if (!['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'].includes(coin))"));
  for (const asset of supported) {
    assert.ok(admin.includes('"' + asset + '"'), 'admin selector is missing ' + asset);
  }
  assert.ok(depositSql.includes("coalesce(p_asset, '') !~"));
  assert.ok(depositSql.includes('[A-Z0-9]{2,16}'));
  assert.ok(api.includes("route === 'deposit/confirm' && verb === 'POST'"));
});


test('asset balance display preserves decimal strings without IEEE-754 conversion', () => {
  const i18n = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/i18n.tsx'), 'utf8');
  const assets = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');
  assert.ok(i18n.includes('export function formatDecimalAmount('));
  assert.ok(i18n.includes('const match = value.trim().match(/^(-?)(\\d+)(?:\\.(\\d+))?$/);'));
  assert.ok(i18n.includes('const grouped = integer.replace(/\\B(?=(\\d{3})+(?!\\d))/g, () => group);'));
  assert.ok(i18n.includes('return (negative ? minus : "") + grouped + (fraction ? decimal + fraction : "");'));
  assert.ok(assets.includes('formatDecimalAmount(balance.free, numberLocale)'));
  assert.ok(assets.includes('formatDecimalAmount(balance.frozen, numberLocale)'));
  assert.ok(!assets.includes('Number(value ?? 0)'));
});


test('asset balances fail closed when a free/frozen field is missing', () => {
  const client = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/api.ts'), 'utf8');
  const page = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');
  assert.ok(client.includes('const validBalances = !!payload.balances'));
  assert.ok(client.includes('validAmount((balance as AccountBalance).free)'));
  assert.ok(client.includes('validAmount((balance as AccountBalance).frozen)'));
  assert.ok(client.includes('INVALID_ACCOUNT_RESPONSE'));
  assert.ok(page.includes('formatDecimalAmount(balance.free, numberLocale)'));
  assert.ok(page.includes('formatDecimalAmount(balance.frozen, numberLocale)'));
  assert.ok(!page.includes('return "0";'));
});
