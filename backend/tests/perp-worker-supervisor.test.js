'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SCHEDULES}=require('../scripts/perp-worker-supervisor');

test('perpetual supervisor schedules all critical workers at bounded intervals',()=>{
  const byName=Object.fromEntries(SCHEDULES.map(x=>[x.name,x]));
  assert.deepEqual(Object.keys(byName).sort(),[
    'funding-rate','funding-settlement','liquidation','mark-price'
  ]);
  assert.equal(byName['mark-price'].intervalMs,60000);
  assert.equal(byName['funding-rate'].intervalMs,15000);
  assert.equal(byName['funding-settlement'].intervalMs,5000);
  assert.equal(byName.liquidation.intervalMs,1000);
  for(const job of SCHEDULES) assert.match(job.file,/^perp-.*-worker\.js$/);
});
