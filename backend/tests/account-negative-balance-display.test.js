'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/api.ts'), 'utf8');
const assets = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/assets/AssetsPage.tsx'), 'utf8');

test('account response validation accepts negative available balance but keeps frozen balance non-negative', () => {
  const start = api.indexOf('export async function getAccount(');
  const end = api.indexOf('export interface EarnProduct', start);
  assert.ok(start >= 0 && end > start);
  const reader = api.slice(start, end);
  assert.ok(reader.includes('const validFreeBalance ='));
  assert.ok(reader.includes('validFreeBalance((balance as AccountBalance).free)'));
  assert.ok(reader.includes('validAmount((balance as AccountBalance).frozen)'));
  assert.ok(reader.includes('/^-?(?:\\d+)(?:\\.\\d{1,18})?$/'));
});

test('asset visibility rules never hide non-zero negative or positive available balances', () => {
  assert.ok(assets.includes('const hasNonZeroAmount ='));
  assert.ok(assets.includes('value !== 0'));
  assert.ok(assets.includes('const hasFunds = hasNonZeroAmount(balance.free) || hasNonZeroAmount(balance.frozen)'));
  assert.ok(assets.includes('return hasFunds || !config || (config.enabled && config.visible)'));
});
