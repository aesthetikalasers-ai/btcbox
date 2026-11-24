'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBookDepthMidPrice, shouldUseBootstrapMark, DEFAULT_COINGECKO_IDS, canBootstrapWithSources, buildFreshSources } = require('../scripts/perp-mark-price-worker');

test('uses quantity-weighted prices across multiple executable levels', () => {
  const bids = [
    { price: '100', remaining_quantity: '2' },
    { price: '99', remaining_quantity: '2' }
  ];
  const asks = [
    { price: '100.5', remaining_quantity: '1' },
    { price: '101', remaining_quantity: '3' }
  ];
  const expectedBid = (100 * 2 + 99 * 2) / 4;
  const expectedAsk = (100.5 * 1 + 101 * 3) / 4;
  assert.equal(calculateBookDepthMidPrice(bids, asks), (expectedBid + expectedAsk) / 2);
});

test('rejects a one-level book instead of trusting a single displayed quote', () => {
  assert.throws(
    () => calculateBookDepthMidPrice(
      [{ price: '100', remaining_quantity: '1' }],
      [{ price: '101', remaining_quantity: '1' }]
    ),
    /insufficient two-level/
  );
});

test('requires distinct price levels rather than multiple orders at one quote', () => {
  assert.throws(
    () => calculateBookDepthMidPrice(
      [{ price: '100', remaining_quantity: '1' }, { price: '100', remaining_quantity: '2' }],
      [{ price: '101', remaining_quantity: '1' }, { price: '101', remaining_quantity: '2' }]
    ),
    /insufficient two-level/
  );
});

test('rejects crossed books and zero remaining quantity', () => {
  assert.throws(
    () => calculateBookDepthMidPrice(
      [{ price: '102', remaining_quantity: '1' }, { price: '101', remaining_quantity: '1' }],
      [{ price: '100', remaining_quantity: '1' }, { price: '101', remaining_quantity: '1' }]
    ),
    /crossed/
  );
  assert.throws(
    () => calculateBookDepthMidPrice(
      [{ price: '100', remaining_quantity: '0' }, { price: '99', remaining_quantity: '1' }],
      [{ price: '101', remaining_quantity: '1' }, { price: '102', remaining_quantity: '1' }]
    ),
    /invalid bid/
  );
});

test('rejects excessive spread', () => {
  assert.throws(
    () => calculateBookDepthMidPrice(
      [{ price: '100', remaining_quantity: '1' }, { price: '99', remaining_quantity: '1' }],
      [{ price: '104', remaining_quantity: '1' }, { price: '105', remaining_quantity: '1' }]
    ),
    /spread is too wide/
  );
});

test('only shallow or empty books may use the explicit bootstrap mark path', () => {
  assert.equal(shouldUseBootstrapMark(new Error('insufficient two-level bid book depth')), true);
  assert.equal(shouldUseBootstrapMark(new Error('crossed perpetual order book')), false);
  assert.equal(shouldUseBootstrapMark(new Error('perpetual order-book spread is too wide')), false);
  assert.equal(shouldUseBootstrapMark(new Error('REST GET failed: 500')), false);
});

test('bootstrap accepts two or three distinct fresh providers and rejects duplicates', () => {
  const two = [
    { source: 'binance', price: 100, ts: 100000 },
    { source: 'okx', price: 100, ts: 100000 }
  ];
  const three = [...two, { source: 'coingecko', price: 100, ts: 100000 }];
  assert.equal(canBootstrapWithSources(two), true);
  assert.equal(canBootstrapWithSources(three), true);
  assert.equal(canBootstrapWithSources([...three, { source: 'binance', price: 100, ts: 100000 }]), false);
  const maps = {
    binance: new Map([['BTCUSDT', two[0]]]),
    okx: new Map([['BTCUSDT', two[1]]]),
    coingecko: new Map([['BTCUSDT', three[2]]])
  };
  assert.equal(buildFreshSources(maps, 'BTCUSDT', 100000, 60).length, 3);
  assert.equal(buildFreshSources(maps, 'BTCUSDT', 200001, 60).length, 0);
});

test('bounded market processing preserves result order', async () => {
  const { mapWithConcurrency } = require('../scripts/perp-mark-price-worker');
  const result = await mapWithConcurrency([3, 1, 2], 2, async value => value * 2);
  assert.deepEqual(result, [6, 2, 4]);
});

test('has a provider id mapping for every BTCBOX non-USDC/USDT market candidate',()=>{
  const expected=['ADA','AVAX','BNB','BTC','DOGE','ETH','SOL','XRP','LINK','DOT','TRX','LTC','BCH','NEAR','UNI','ATOM','ETC','APT','ARB','OP','SUI','INJ','TIA','FIL'];
  for(const asset of expected) assert.ok(DEFAULT_COINGECKO_IDS[asset+'USDT'], 'missing '+asset+'USDT');
  assert.equal(Object.keys(DEFAULT_COINGECKO_IDS).length,24);
  assert.equal(DEFAULT_COINGECKO_IDS.USDCUSDT,undefined);
});
