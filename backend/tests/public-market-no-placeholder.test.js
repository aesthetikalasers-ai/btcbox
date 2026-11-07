'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const marketView = fs.readFileSync(path.join(root, 'assets/js/views-home.js'), 'utf8');
const tradeView = fs.readFileSync(path.join(root, 'assets/js/views-trade.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'assets/js/app-core.js'), 'utf8');

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
