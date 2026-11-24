'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBookDepthMidPrice } = require('../scripts/perp-mark-price-worker');

test('uses quantity-weighted prices across multiple executable levels', () => {
  const bids = [
    { price: '100', remaining_quantity: '2' },
    { price: '99', remaining_quantity: '2' }
  ];
  const asks = [
    { price: '102', remaining_quantity: '1' },
    { price: '103', remaining_quantity: '3' }
  ];
  const expectedBid = (100 * 2 + 99 * 2) / 4;
  const expectedAsk = (102 * 1 + 103 * 3) / 4;
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
