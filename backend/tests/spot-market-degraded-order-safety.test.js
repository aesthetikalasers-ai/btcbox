'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0008_financial_matching_engine_v1.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('degraded public catalogue never grants order eligibility in the matching database', () => {
  const start = migration.indexOf('create or replace function public.submit_limit_order_matching_v1');
  const end = migration.indexOf('create or replace function public.cancel_limit_order_matching_v1', start);
  assert.ok(start >= 0 && end > start, 'submit RPC must exist');
  const fn = migration.slice(start, end);

  const marketLookup = fn.indexOf('select * into v_market from public.financial_matching_markets');
  assert.ok(marketLookup >= 0, 'new orders must load authoritative market rules');
  const marketCheck = fn.slice(marketLookup, marketLookup + 260);
  assert.match(marketCheck, /where base_asset=p_base_asset and quote_asset=p_quote_asset and enabled=true/i);
  assert.match(fn, /if not found then raise exception 'market disabled or unconfigured'/i);
});

test('pending order retries replay only the original idempotent result and cannot create a new order for a disabled pair', () => {
  const start = migration.indexOf('create or replace function public.submit_limit_order_matching_v1');
  const end = migration.indexOf('create or replace function public.cancel_limit_order_matching_v1', start);
  const fn = migration.slice(start, end);

  const replayLookup = fn.indexOf('select * into v_existing');
  const marketLookup = fn.indexOf('select * into v_market');
  assert.ok(replayLookup >= 0 && marketLookup > replayLookup, 'an exact retry is reconciled before current market state is checked');

  const replayBlock = fn.slice(replayLookup, marketLookup);
  assert.match(replayBlock, /if found then[\s\S]*?return jsonb_build_object\('ok',true,'duplicate',true/i);
  assert.doesNotMatch(replayBlock, /insert into public\.financial_matching_orders/i);
  assert.match(fn, /where base_asset=p_base_asset and quote_asset=p_quote_asset and enabled=true/i);
  assert.match(fn, /if not found then raise exception 'market disabled or unconfigured'/i);
});

test('the application keeps degraded catalogues read-only and submits every order through the matching RPC', () => {
  assert.match(pages, /if\(spotCatalogDegraded&&!pendingIntent\)/);
  assert.match(pages, /if\(!spotPairEnabled&&!pendingIntent\)/);
  assert.match(api, /matchingRpc\('submit_limit_order_matching_v1'/);
  assert.match(api, /p_base_asset: pair\[0\], p_quote_asset: pair\[1\]/);
});
