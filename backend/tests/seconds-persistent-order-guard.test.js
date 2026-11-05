'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/views-trading.js'), 'utf8');
const start = source.indexOf('VIEWS.seconds.afterRender = function(){');
const end = source.indexOf('/* ================= ORDERS view', start);
assert.ok(start >= 0 && end > start, 'Seconds view source must be present');
const view = source.slice(start, end);
assert.doesNotThrow(() => new vm.Script(source), 'views-trading.js must remain syntactically valid');

function helper(name, nextName) {
  const from = view.indexOf('function ' + name + '(');
  const to = view.indexOf('  function ' + nextName + '(', from);
  assert.ok(from >= 0 && to > from, name + ' helper must be present');
  return view.slice(from, to).trim();
}

test('seconds order intent is persisted before the network request and the exact key is reused', () => {
  const persistAt = view.indexOf('if(!persistPendingSecondsOrder(orderIntent))');
  const requestAt = view.indexOf('await apiAdapter.secondsOrder({symbol:orderIntent.symbol');
  assert.ok(persistAt >= 0 && requestAt > persistAt, 'persist immutable request intent before network I/O');
  assert.ok(view.includes('request_id:orderIntent.request_id'), 'send the exact persisted idempotency key');
  assert.ok(view.includes('secondsPendingIntent=readPendingSecondsOrder()'), 'restore pending intent on full reload');
  assert.ok(view.includes('if(secondsPendingIntent){toast('), 'block another submission while an intent is unresolved');
  assert.ok(view.includes('const unknown=isSecondsOrderOutcomeUnknown(r);'), 'classify uncertain outcomes explicitly');
  assert.ok(view.includes("setSecondsEntryEnabled(false,'Checking the latest contract position status.')"), 'order controls stay disabled while the initial status snapshot loads');
  assert.ok(view.includes("setSecondsEntryEnabled(false,positionsUnavailableMessage)"), 'order controls stay disabled when the backend is unavailable or cutover is incomplete');
});

test('non-JSON platform responses remain UNKNOWN while explicit pre-write rejections are definitive', () => {
  const classifySource = helper('isSecondsOrderOutcomeUnknown', 'findSecondsPositionSnapshot');
  const classify = vm.runInNewContext('(' + classifySource + ')');
  assert.equal(classify({status:404,raw:'<!doctype html><title>404</title>'}), true,
    'a Vercel platform HTML 404 is not a structured business rejection');
  assert.equal(classify({status:0,code:'NETWORK_ERROR'}), true);
  assert.equal(classify({status:503,code:'FINANCIAL_RPC_UNAVAILABLE'}), true);
  assert.equal(classify({status:503,code:'FINANCIAL_CUTOVER_INCOMPLETE'}), false);
  assert.equal(classify({status:503,code:'REFERENCE_PRICE_UNAVAILABLE'}), false);
  assert.equal(classify({status:400,code:'INVALID_AMOUNT'}), false);
});

test('pending intent reader validates schema and fails closed on corrupt or unavailable storage', () => {
  const readSource = helper('readPendingSecondsOrder', 'persistPendingSecondsOrder');
  const key = 'btcbox.seconds.pending.v1.user-1';
  const valid = {version:1,request_id:'request_123456789012',symbol:'BTC',direction:'UP',duration_sec:30,amount:'10',created_at:1700000000000};
  let stored = JSON.stringify(valid);
  const context = {
    secondsPendingStorageKey:key,
    localStorage:{getItem(){return stored;}}
  };
  const read = vm.runInNewContext('(' + readSource + ')', context);
  assert.deepEqual(JSON.parse(JSON.stringify(read())), valid);
  stored = '{broken';
  assert.equal(read().invalid, true, 'malformed JSON must lock the action');
  stored = JSON.stringify({...valid, direction:'SIDEWAYS'});
  assert.equal(read().invalid, true, 'invalid direction must lock the action');
  context.localStorage.getItem = () => { throw new Error('storage blocked'); };
  assert.equal(read().invalid, true, 'storage read failure must fail closed');
});

test('settlement SQL only reports duplicate for the exact original request ID and hash', () => {
  const sql=fs.readFileSync(path.join(root,'supabase/sql/0024_seconds_settlement_idempotency_v1.sql'),'utf8');
  const start=sql.indexOf("if v_pos.status='settled' then");
  const end=sql.indexOf('  if v_now < v_pos.settle_at then',start);
  assert.ok(start>=0&&end>start,'settled-position branch must exist');
  const branch=sql.slice(start,end);
  assert.ok(branch.includes('if v_pos.settle_request_id = p_request_id then'),'only the original request ID can replay');
  assert.ok(branch.includes('v_pos.settle_request_hash IS DISTINCT FROM p_request_hash'),'payload mismatch must conflict, including NULL mismatch');
  assert.ok(branch.includes("'duplicate',true"),'same request ID and hash returns duplicate');
  assert.ok(branch.includes("'POSITION_ALREADY_SETTLED'"),'a different request ID cannot masquerade as duplicate success');
  assert.match(sql,/security invoker set search_path = ''/,'keep the hardened invoker/search_path contract');
  assert.match(sql,/where position_id=p_position_id and user_id=p_user_id for update/,'lock the owned position row');
  assert.ok(sql.includes('insert into public.financial_operations'),'keep settlement operation recording');
  assert.ok(sql.includes('insert into public.financial_ledger'),'keep ledger settlement in the same transaction');
  assert.ok(sql.includes('revoke all on function public.settle_seconds_position_v1'),'revoke public execution');
  assert.ok(sql.includes('to service_role'),'grant execution only to service_role');
});
test('seconds order response uses the database settlement timestamp, not a client-side recomputation', () => {
  const api=fs.readFileSync(path.join(root,'api-core.js'),'utf8');
  assert.ok(api.includes('const settleAt = Number(result.settle_at);'),'read the canonical DB timestamp');
  assert.ok(api.includes('settle_at: settleAt'),'return the canonical DB timestamp');
  assert.ok(!api.includes('settle_at: Math.floor(Date.now() / 1000) + durationSec'),'do not invent a replacement timestamp');
  assert.ok(api.includes("'POSITION_ALREADY_SETTLED'"),'map an already-settled conflict to a non-success response');
});
test('settlement request IDs are persisted per user and position before network I/O', () => {
  const persistAt=view.indexOf('if(!persistPendingSecondsSettlement(settlementIntent))');
  const requestAt=view.indexOf('await apiAdapter.secondsSettle({position_id:positionId,request_id:settlementIntent.request_id');
  assert.ok(persistAt>=0&&requestAt>persistAt,'persist settlement intent before network I/O');
  assert.ok(view.includes('request_id:settlementIntent.request_id'),'retries reuse the stored settlement request ID');
  assert.ok(view.includes('readPendingSecondsSettlement(positionId)'),'reloads restore the position-scoped settlement intent');
});
test('settlement intent reader rejects corrupt storage and restores the exact request ID', () => {
  const readSource=helper('readPendingSecondsSettlement','persistPendingSecondsSettlement');
  const key='btcbox.seconds.settlement.v1.user-1.position1234567890';
  const valid={version:1,position_id:'position1234567890',request_id:'settle_123456789012',created_at:1700000000000};
  let stored=JSON.stringify(valid);
  const context={secondsSettlementStoragePrefix:'btcbox.seconds.settlement.v1.user-1.',localStorage:{getItem(){return stored;}}};
  const read=vm.runInNewContext('('+readSource+')',context);
  assert.deepEqual(JSON.parse(JSON.stringify(read(valid.position_id))),valid);
  stored='{broken';
  assert.equal(read(valid.position_id).invalid,true);
  stored=JSON.stringify({...valid,position_id:'another-position123'});
  assert.equal(read(valid.position_id).invalid,true);
  context.localStorage.getItem=()=>{throw new Error('storage blocked');};
  assert.equal(read(valid.position_id).invalid,true);
});
test('settlement intent persistence reuses the same key and fails closed on storage errors', () => {
  const persistSource=helper('persistPendingSecondsSettlement','clearPendingSecondsSettlement');
  const clearStart=view.indexOf('function clearPendingSecondsSettlement(positionId){');
  const clearEnd=view.indexOf('  let secondsPendingIntent=',clearStart);
  assert.ok(clearStart>=0&&clearEnd>clearStart,'clear helper must be present');
  const clearSource=view.slice(clearStart,clearEnd).trim();
  const values=new Map();
  const context={secondsSettlementStoragePrefix:'btcbox.seconds.settlement.v1.user-1.',localStorage:{
    setItem(k,v){values.set(k,v);},removeItem(k){values.delete(k);}
  }};
  const persist=vm.runInNewContext('('+persistSource+')',context);
  const clear=vm.runInNewContext('('+clearSource+')',context);
  const intent={version:1,position_id:'position1234567890',request_id:'settle_123456789012',created_at:1700000000000};
  assert.equal(persist(intent),true);
  const key='btcbox.seconds.settlement.v1.user-1.position1234567890';
  assert.equal(JSON.parse(values.get(key)).request_id,intent.request_id);
  assert.equal(clear(intent.position_id),true);
  assert.equal(values.has(key),false);
  persist(intent);
  context.localStorage.removeItem=()=>{throw new Error('storage removal failed');};
  assert.equal(clear(intent.position_id),false);
  assert.equal(values.has(key),true,'failed cleanup must retain the original request ID');
});
test('pending intent cleanup only clears the in-memory guard after storage removal succeeds', () => {
  const persistSource = helper('persistPendingSecondsOrder', 'clearPendingSecondsOrder');
  const clearStart = view.indexOf('function clearPendingSecondsOrder(){');
  const clearEnd = view.indexOf('  function readPendingSecondsSettlement(', clearStart);
  assert.ok(clearStart >= 0 && clearEnd > clearStart, 'clear helper must be present');
  const clearSource = view.slice(clearStart, clearEnd).trim();
  const values = new Map();
  const context = {
    secondsPendingStorageKey:'btcbox.seconds.pending.v1.user-1',
    secondsUserKey:'user-1',
    state:{_secondsOrderUnknownUserKey:'user-1'},
    secondsPendingIntent:{request_id:'request_123456789012'},
    localStorage:{
      setItem(k,v){values.set(k,v);},
      removeItem(k){values.delete(k);}
    }
  };
  const persist = vm.runInNewContext('(' + persistSource + ')', context);
  const clear = vm.runInNewContext('(' + clearSource + ')', context);
  assert.equal(persist({request_id:'request_123456789012'}), true);
  assert.equal(clear(), true);
  assert.equal(values.size, 0);
  assert.equal(context.secondsPendingIntent, null);
  assert.equal(context.state._secondsOrderUnknownUserKey, undefined);
  context.secondsPendingIntent = {request_id:'request_123456789012'};
  context.localStorage.removeItem = () => { throw new Error('quota/storage failure'); };
  assert.equal(clear(), false);
  assert.ok(context.secondsPendingIntent, 'failed removal must retain the in-memory lock');
});

test('Orders cancellation success is based on the refreshed canonical status, not the POST response alone', () => {
  const orderStart = source.indexOf('VIEWS.orders.afterRender = function(){');
  const orderView = source.slice(orderStart);
  assert.ok(orderStart >= 0, 'Orders view must be present');
  assert.ok(orderView.includes('const latestStatus=String(latest&&latest.status||\'\').toLowerCase();'),
    'read the canonical order status after cancellation');
  assert.ok(orderView.includes("if(latestStatus==='cancelled'||latestStatus==='canceled')"),
    'only canonical cancelled status may show success');
  assert.ok(orderView.includes("else if(latestStatus==='filled')"),
    'a fill race must be reported as filled, not canceled');
  assert.ok(orderView.includes('else if(isActiveOrderStatus(latestStatus))'),
    'open and partially filled orders must remain active');
  assert.ok(orderView.includes('Cancellation status is unconfirmed. Refresh your orders before taking further action.'),
    'a failed status read must not claim cancellation success');
});

test('only definitive rejection and server-confirmed position reconciliation clear the durable order intent', () => {
  assert.ok(view.includes('if(positionMatch.status===\'history\'){\n        const cleared=clearPendingSecondsOrder();'),
    'a canonical history match is a definitive reconciliation');
  assert.ok(view.includes('if(clearPendingSecondsOrder()){\n          busy=false;'),
    'a definitive API rejection may release the guard only after storage cleanup');
  assert.ok(view.includes('const clearedPending=clearPendingSecondsOrder();'),
    'a server-confirmed open position clears the pending intent');
  assert.ok(view.includes('if(unknown){\n        if(secondsUserKey)state._secondsOrderUnknownUserKey=secondsUserKey;'),
    'unknown outcomes retain the account-scoped guard');
});
