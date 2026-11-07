'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const marketView = fs.readFileSync(path.join(root, 'assets/js/views-home.js'), 'utf8');
const tradeView = fs.readFileSync(path.join(root, 'assets/js/views-trade.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'assets/js/app-core.js'), 'utf8');
const customerPages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');
const liveMarketsTable = fs.readFileSync(path.resolve(root, '../frontend/src/features/dashboard/components/LiveMarketsTable.tsx'), 'utf8');
const ordersPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/orders/OrdersPage.tsx'), 'utf8');
const topbar = fs.readFileSync(path.resolve(root, '../frontend/src/components/layout/Topbar.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.resolve(root, '../frontend/src/components/layout/Sidebar.tsx'), 'utf8');

test('public market list renders only positive quotes from an available feed', () => {
  assert.match(marketView, /PAIRS\.filter\(sym=>!state\.marketUnavailable&&market\[sym\]&&Number\(market\[sym\]\.price\)>0\)/);
  assert.match(marketView, /Market data temporarily unavailable/);
  assert.match(marketView, /Live prices will appear when the market feed is available/);
});

test('home market cards and pair count exclude unavailable or empty quotes', () => {
  assert.match(marketView, /const ready=PAIRS\.filter\(sym=>!state\.marketUnavailable&&market\[sym\]&&Number\(market\[sym\]\.price\)>0\)/);
  assert.match(marketView, /home-market-content/);
  assert.match(marketView, /home-market-pair-count/);
});

test('trade header never formats zero as a live market quote', () => {
  assert.match(tradeView, /marketPriceText\(s,base\)/);
  assert.match(tradeView, /Number\(s\.high\)>0\?fmtPrice\(s\.high,base\):'—'/);
  assert.match(tradeView, /Number\(s\.low\)>0\?fmtPrice\(s\.low,base\):'—'/);
});

test('failed or empty provider refresh clears quotes and paints unavailable values', () => {
  assert.match(core, /const accepted=r&&r\.ok&&\(r\.data\|\|r\.markets\)\?applyMarket\(r\):0/);
  assert.match(core, /state\.marketUnavailable=true;clearMarketQuotes\(\);updateLivePriceEls\(\)/);
  assert.match(core, /el\.textContent='—'/);
});

test('customer-facing pages do not advertise simulated orders or sample order history', () => {
  assert.doesNotMatch(customerPages, /No sample or simulated orders are shown/i);
  assert.doesNotMatch(customerPages, /Orders are never simulated in the browser/i);
  assert.match(customerPages, /No orders are available for this account yet/);
  assert.doesNotMatch(customerPages, /Integration pending|This page is scaffolded|in this preview/i);
  assert.doesNotMatch(ordersPage, /No sample orders are generated/i);
});

test('Vite dashboard does not keep stale quotes visible after a refresh error', () => {
  assert.match(liveMarketsTable, /const displayMarkets = error \? \[\] : markets/);
  assert.doesNotMatch(liveMarketsTable, /Showing the last confirmed market data/);
  assert.match(liveMarketsTable, /error && displayMarkets\.length === 0/);
});

test('order book cache is cleared when the live depth feed fails', () => {
  assert.match(core, /else if\(state\.depthCache&&state\.depthCache\.sym===sym\)/);
  assert.match(core, /state\.depthCache=null/);
});

test('customer navigation contains no preview or API-verification banners', () => {
  assert.doesNotMatch(topbar, /Preview/);
  assert.doesNotMatch(sidebar, /Preview · API verification pending/);
});
