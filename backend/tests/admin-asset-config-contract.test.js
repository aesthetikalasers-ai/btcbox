'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

function stringArray(source, expression, label) {
  const match = source.match(expression);
  assert.ok(match, label + ' must exist');
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('backend deposit-address response preserves every address configured by the admin UI', () => {
  const start = api.indexOf('function safeDepositAddresses(addresses) {');
  const end = api.indexOf('\n\nconst DEFAULT_WITHDRAWAL_FEES', start);
  assert.ok(start >= 0 && end > start, 'safeDepositAddresses helper must exist');
  const safeDepositAddresses = vm.runInNewContext('(' + api.slice(start, end).trim() + ')');
  const configured = {
    'USDT-TRC20': 'T1234567890123456789012',
    'USDT-ERC20': '0x1234567890123456789012345678901234567890',
    'USDT-BEP20': '0x2234567890123456789012345678901234567890',
    'BTC-BTC': 'bc1q12345678901234567890123456789012345678',
    'ETH-ERC20': '0x3234567890123456789012345678901234567890',
    'SOL-SOL': 'So11111111111111111111111111111111111111112',
    'BNB-BEP20': '0x4234567890123456789012345678901234567890',
    'USDC-ERC20': '0x5234567890123456789012345678901234567890'
  };
  const result = safeDepositAddresses(configured);
  const uiKeys = stringArray(admin, /const depositAddressKeys = \[([\s\S]*?)\];/, 'admin depositAddressKeys');
  for (const key of uiKeys) {
    assert.equal(result[key], configured[key], 'backend must return configured address ' + key);
  }
});

test('admin normalized balance reader accepts every configured deposit and supported spot asset', () => {
  const match = api.match(/const SUPPORTED_LEDGER_ASSETS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, 'shared ledger asset allowlist must exist');
  const supported = new Set([...match[1].matchAll(/'([A-Z0-9]+)'/g)].map(item => item[1]));
  const uiAssets = stringArray(admin, /const assets = \[([\s\S]*?)\];/, 'admin asset controls');
  const spotAssets = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'LTC', 'BCH', 'NEAR', 'UNI', 'ATOM', 'ETC'];
  for (const asset of [...uiAssets, ...spotAssets]) {
    assert.ok(supported.has(asset), 'admin balance reader must accept ' + asset);
  }
  assert.ok(api.includes('if (!SUPPORTED_LEDGER_ASSETS.has(asset))'));
});

test('admin valuation requests live prices from normalized ledger assets after the canonical balance read', () => {
  const start = api.indexOf("// GET /api/admin/users?search=");
  const end = api.indexOf("// GET /api/admin/kyc", start);
  assert.ok(start >= 0 && end > start, 'admin user list route must exist');
  const route = api.slice(start, end);
  const normalizedReadAt = route.indexOf('readAdminAccountBalances(');
  const livePriceAt = route.indexOf('getLiveUsdtPrices(priceBases)');
  assert.ok(normalizedReadAt >= 0 && livePriceAt > normalizedReadAt,
    'read canonical PostgreSQL balances before requesting their live valuation prices');
  assert.ok(route.includes('const priceBases = list.flatMap(function (u)'));
  assert.ok(route.includes('normalizedBalances ? (normalizedBalances[String(u.uid)] || {}) : (u.balances || {})'));
});

test('admin finance settings can save withdrawal fees while unconfigured deposit networks remain disabled', () => {
  const start = api.indexOf("if (sub === 'config' && method === 'POST')");
  const end = api.indexOf("if (sub === 'withdrawals' && method === 'GET')", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("if (!value) { changedKeys.push(key); continue; }"),
    'blank deposit address values must remain fail-closed but must not block other finance settings');
  assert.ok(route.includes("return json({ ok: false, msg: 'Invalid deposit address format: ' + key }, 400)"),
    'non-empty malformed addresses must still be rejected');
});
