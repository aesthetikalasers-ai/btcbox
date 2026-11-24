'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CANDIDATE_SYMBOLS, extractUsdmMarketFilters } = require('../scripts/audit-binance-usdm-market-filters');

function symbol(symbol, extra = {}) {
  return {
    symbol, contractType: 'PERPETUAL', status: 'TRADING', baseAsset: symbol.replace('USDT',''), quoteAsset: 'USDT',
    pricePrecision: 8, quantityPrecision: 8, maintMarginPercent: '2.5000', requiredMarginPercent: '5.0000',
    liquidationFee: '0.010000', marketTakeBound: '0.30',
    filters: [
      { filterType: 'PRICE_FILTER', tickSize: '0.01', minPrice: '0.01', maxPrice: '1000000' },
      { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '100000' },
      { filterType: 'MARKET_LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '100000' },
      { filterType: 'MIN_NOTIONAL', notional: '5' },
    ],
    ...extra,
  };
}

test('candidate registry is exactly 24 USDT perpetual symbols and excludes USDCUSDT', () => {
  assert.equal(CANDIDATE_SYMBOLS.length, 24);
  assert.equal(new Set(CANDIDATE_SYMBOLS).size, 24);
  assert.ok(!CANDIDATE_SYMBOLS.includes('USDCUSDT'));
});

test('extracts exact exchange filters and keeps precision fields informational only', () => {
  const report = extractUsdmMarketFilters({ serverTime: 123, symbols: [symbol('BTCUSDT')] }, ['BTCUSDT']);
  assert.equal(report.markets.length, 1);
  assert.equal(report.markets[0].price_tick, '0.01');
  assert.equal(report.markets[0].quantity_step, '0.001');
  assert.equal(report.markets[0].market_quantity_step, '0.001');
  assert.equal(report.markets[0].min_notional, '5');
  assert.equal(report.markets[0].price_precision_reference_only, 8);
  assert.deepEqual(report.invalid, []);
});

test('does not invent filters for unsupported or incomplete markets', () => {
  const stopped = symbol('BTCUSDT', { status: 'BREAK' });
  const incomplete = symbol('ETHUSDT', { filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.01' }] });
  const report = extractUsdmMarketFilters({ symbols: [stopped, incomplete] }, ['BTCUSDT','ETHUSDT','SOLUSDT']);
  assert.deepEqual(report.unsupported.map(x => x.symbol), ['BTCUSDT','SOLUSDT']);
  assert.deepEqual(report.invalid, [{ symbol: 'ETHUSDT', missing: ['quantity_step','min_quantity','market_quantity_step','market_min_quantity','min_notional'] }]);
});

test('rejects malformed exchangeInfo payloads', () => {
  assert.throws(() => extractUsdmMarketFilters({ symbols: null }), /no symbols array/);
});
