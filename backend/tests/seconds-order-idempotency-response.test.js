'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0025_seconds_policy_versioning_v1.sql'), 'utf8');

test('seconds order RPC returns the persisted opening price on both new orders and idempotent replay', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1');
  const end = migration.indexOf('CREATE OR REPLACE FUNCTION public.settle_seconds_position_v1', start);
  assert.ok(start >= 0 && end > start);
  const orderRpc = migration.slice(start, end);
  assert.match(orderRpc, /'duplicate',true[\s\S]*?'open_price',v_existing\.open_price/);
  assert.match(orderRpc, /'duplicate',false[\s\S]*?'open_price',p_open_price/);
});

test('seconds order API displays the database-confirmed opening price instead of a fresh feed sample on replay', () => {
  const start = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const end = api.indexOf('// ---------- POST /api/seconds/settle ----------', start);
  assert.ok(start >= 0 && end > start);
  const handler = api.slice(start, end);
  assert.match(handler, /const storedOpenPrice = Number\(result\.open_price\)/);
  assert.match(handler, /open_price: storedOpenPrice/);
  assert.match(handler, /result\.duplicate \? 'stored_reference' : ref\.source/);
  assert.doesNotMatch(handler, /open_price: ref\.price/);
});

test('seconds order replay is attempted without a feed price, while new orders fail closed without one', () => {
  const start = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const end = api.indexOf('// ---------- POST /api/seconds/settle ----------', start);
  const handler = api.slice(start, end);
  assert.match(handler, /catch \(_\) \{ \/\* replay lookup may still succeed \*\/ \}/);
  assert.match(handler, /p_open_price: ref \? String\(ref\.price\) : null/);
  assert.match(handler, /result\.code === 'REFERENCE_PRICE_REQUIRED' && !ref/);
  const rpcStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1');
  const rpcEnd = migration.indexOf('CREATE OR REPLACE FUNCTION public.settle_seconds_position_v1', rpcStart);
  const rpc = migration.slice(rpcStart, rpcEnd);
  assert.ok(rpc.indexOf('WHERE open_request_id=p_request_id FOR UPDATE') < rpc.indexOf('IF p_open_price IS NULL OR p_open_price<=0'));
  assert.match(rpc, /'code','REFERENCE_PRICE_REQUIRED'/);
});
