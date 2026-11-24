'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculateImpactPrices}=require('../scripts/perp-funding-rate-worker');

test('computes bid and ask VWAP across the best five distinct executable price levels',()=>{
  const result=calculateImpactPrices(
    [{price:'100',remaining_quantity:'2'},{price:'99',remaining_quantity:'2'}],
    [{price:'100.5',remaining_quantity:'1'},{price:'101',remaining_quantity:'3'}]
  );
  assert.equal(result.bid,99.5);
  assert.equal(result.ask,100.875);
});
test('rejects insufficient distinct levels, including duplicate orders at one price',()=>{
  assert.throws(()=>calculateImpactPrices(
    [{price:'100',remaining_quantity:'1'},{price:'100',remaining_quantity:'2'}],
    [{price:'101',remaining_quantity:'1'},{price:'102',remaining_quantity:'1'}]
  ),/insufficient two-level bid/);
});
test('rejects invalid quantities, crossed books and spreads wider than two percent',()=>{
  assert.throws(()=>calculateImpactPrices(
    [{price:'100',remaining_quantity:'0'},{price:'99',remaining_quantity:'1'}],
    [{price:'101',remaining_quantity:'1'},{price:'102',remaining_quantity:'1'}]
  ),/invalid bid/);
  assert.throws(()=>calculateImpactPrices(
    [{price:'102',remaining_quantity:'1'},{price:'101',remaining_quantity:'1'}],
    [{price:'100',remaining_quantity:'1'},{price:'103',remaining_quantity:'1'}]
  ),/crossed/);
  assert.throws(()=>calculateImpactPrices(
    [{price:'100',remaining_quantity:'1'},{price:'99',remaining_quantity:'1'}],
    [{price:'104',remaining_quantity:'1'},{price:'105',remaining_quantity:'1'}]
  ),/spread is too wide/);
});
