'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '../../frontend/src/features/assets/AssetsPage.tsx');
const page = fs.readFileSync(pagePath, 'utf8');

test('real asset page reads balances only from the authenticated account API', () => {
  assert.ok(page.includes('getAccount(controller.signal)'));
  assert.ok(page.includes('Object.entries(account?.balances ?? {})'));
  assert.ok(!page.includes('useTrading'));
  assert.ok(!page.includes('paperBalances'));
  assert.ok(!page.includes('getDemoAccount'));
});
