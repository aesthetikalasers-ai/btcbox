'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pages = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('deposit history clears the previous snapshot and refreshes when the page becomes visible', () => {
  const start = pages.indexOf('export function DepositPage');
  const end = pages.indexOf('export function EarnPage', start);
  assert.ok(start >= 0 && end > start);
  const source = pages.slice(start, end);
  assert.ok(source.includes('setHistoryLoading(true);setHistoryError("");setDepositHistory([])'));
  assert.ok(source.includes('document.addEventListener("visibilitychange",refreshWhenVisible)'));
  assert.ok(source.includes('getAccount(controller.signal)'));
});

test('withdrawal balances and history are reloaded on return without retaining old account snapshots', () => {
  const start = pages.indexOf('export function WithdrawPage');
  assert.ok(start >= 0);
  const source = pages.slice(start);
  assert.ok(source.includes('setLoading(true);setError("");setAccount(null);setAddresses([]);setConfig(null)'));
  assert.ok(source.includes('document.addEventListener("visibilitychange",refreshWhenVisible)'));
  assert.ok(source.includes('getAccount(controller.signal)'));
});
