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
  assert.ok(page.includes('Snapshot checked'));
  assert.ok(page.includes('marketFeedWarning'));
  assert.ok(page.includes('showing the last confirmed data'));
});

const app = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/App.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/dashboard/Dashboard.tsx'), 'utf8');
const marketTable = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/dashboard/components/LiveMarketsTable.tsx'), 'utf8');

test('spot market preview route is public while account and order APIs remain separately gated', () => {
  assert.ok(app.includes('<Route path="/trade/:symbol" element={<SpotTradingPage />} />'));
  assert.ok(!app.includes('<Route path="/trade/:symbol" element={<ProtectedAccountRoute>'));
  assert.ok(page.includes('accountResult.reason.code==="AUTH_REQUIRED"'));
  assert.ok(page.includes('getOrders(controller.signal)'));
});

test('public market overview polls at 15 seconds and prevents overlapping refreshes', () => {
  assert.ok(dashboard.includes('window.setInterval(loadMarkets, 15000)'));
  assert.ok(dashboard.includes('if (refreshing || controller.signal.aborted) return;'));
  assert.ok(dashboard.includes('refreshing = true;'));
  assert.ok(dashboard.includes('refreshing = false;'));
});

test('market table clears last confirmed prices and reports feed unavailability', () => {
  assert.ok(marketTable.includes('const displayMarkets = error ? [] : markets'));
  assert.ok(marketTable.includes('error && displayMarkets.length === 0'));
  assert.ok(!marketTable.includes('Showing the last confirmed market data.'));
  assert.ok(dashboard.includes('setMarkets([]);'));
});
const api = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/api.ts'), 'utf8');
const backend = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('market API carries per-symbol server snapshot time separately from provider event time', () => {
  assert.ok(backend.includes('const snapshotTs = Math.floor(Date.now() / 1000)'));
  assert.ok(backend.includes('ts: snapshotTs, providerTs: marketsByBase[row.sym].providerTs, source: row.source'));
  assert.ok(backend.includes("products/' + productId + '/ticker'"));
  assert.ok(backend.includes('Date.parse(ticker.time)'));
  assert.ok(backend.includes('Math.floor(providerTimeMs / 1000)'));
  assert.ok(api.includes('providerTs?: number'));
  assert.ok(api.includes('snapshotTs?: number'));
  assert.ok(api.includes('snapshotTs: Number.isFinite(snapshot?.ts)'));
});

test('spot UI labels server snapshot time and does not substitute browser receipt time', () => {
  assert.ok(page.includes('t("Snapshot checked")'));
  assert.ok(page.includes('selected.snapshotTs?selected.snapshotTs*1000:null'));
  assert.ok(!page.includes('setMarketUpdatedAt(Date.now())'));
});

const authPage = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/auth/AuthPages.tsx'), 'utf8');

test('sign-in and registration pages expose username, Google and Web3 without email auth', () => {
  assert.ok(authPage.includes('Continue with Google'));
  assert.ok(authPage.includes('signInWithGoogle'));
  assert.ok(authPage.includes('Connect Ethereum wallet'));
  assert.ok(authPage.includes('Connect Solana wallet'));
  assert.ok(authPage.includes('signInWithWeb3'));
  assert.ok(authPage.includes('Sign in with username'));
  assert.ok(!authPage.includes('Continue with email'));
  assert.ok(!authPage.includes('Register with email'));
});
