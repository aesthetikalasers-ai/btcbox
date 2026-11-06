'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pages = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/pages/Pages.tsx'), 'utf8');
const start = pages.indexOf('export function SpotTradingPage()');
const end = pages.indexOf('export function ', start + 30);
const page = pages.slice(start, end > start ? end : undefined);

test('spot trading page refreshes public ticker and order book without reloading order-entry state', () => {
  assert.ok(start >= 0 && page.length > 0);
  assert.ok(page.includes('window.setInterval(refreshMarketData,15000)'));
  assert.ok(page.includes('getMarkets(controller.signal)'));
  assert.ok(page.includes('getOrderBook(symbol,controller.signal)'));
  assert.ok(page.includes('setTicker(selected)'));
  assert.ok(page.includes('setBook(bookResult.value)'));
  assert.ok(page.includes('window.clearInterval(refreshId)'));
  assert.ok(page.includes('controller.abort()'));
  assert.ok(page.includes('},[symbol]);'));
});

test('spot trading live refresh never overwrites the customer-edited limit price', () => {
  const startRefresh = page.indexOf('const refreshMarketData=');
  const endRefresh = page.indexOf('const refreshId=window.setInterval', startRefresh);
  assert.ok(startRefresh >= 0 && endRefresh > startRefresh);
  const refresh = page.slice(startRefresh, endRefresh);
  assert.ok(!refresh.includes('setPrice('));
  assert.ok(page.includes('setPrice(current=>current||String(selected.price))'));
});

test('spot trading page shows last successful market update and a stale-feed warning', () => {
  assert.ok(page.includes('marketUpdatedAt'));
  assert.ok(page.includes('Last update'));
  assert.ok(page.includes('marketFeedWarning'));
  assert.ok(page.includes('showing the last confirmed data'));
});
