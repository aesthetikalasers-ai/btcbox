'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0008_financial_matching_engine_v1.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

test('spot cancel persists user-scoped request identity and binds it to one order', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.financial_matching_cancel_requests/i);
  assert.match(migration, /PRIMARY KEY\s*\(user_id, client_cancel_id\)/i);
  assert.match(migration, /request_hash text NOT NULL CHECK \(length\(request_hash\)=64 and request_hash !~ '\[\^0-9a-f\]'\)/i);
  const start = migration.indexOf('create or replace function public.cancel_limit_order_matching_v1');
  const end = migration.indexOf('revoke all on function public.submit_limit_order_matching_v1', start);
  assert.ok(start >= 0 && end > start, 'cancel RPC must be present before its grants');
  const fn = migration.slice(start, end);
  assert.match(fn, /pg_advisory_xact_lock\(hashtextextended\(p_user_id\|\|':'\|\|p_client_cancel_id,0\)\)/i);
  assert.match(fn, /v_cancel\.order_id<>p_order_id OR v_cancel\.request_hash<>v_request_hash/i);
  assert.match(fn, /return v_cancel\.response \|\| jsonb_build_object\('duplicate',true\)/i);
  assert.match(fn, /INSERT INTO public\.financial_matching_cancel_requests[\s\S]*?v_request_hash[\s\S]*?v_response/i);
  const replayCheck = fn.indexOf('if found then');
  const balanceMutation = fn.indexOf('update public.financial_accounts');
  assert.ok(replayCheck >= 0 && balanceMutation > replayCheck, 'exact retries must return before any balance movement');
  assert.match(fn, /IF v_order\.status='cancelled' THEN[\s\S]*?INSERT INTO public\.financial_matching_cancel_requests/i);
  assert.match(fn, /IF v_order\.status='filled' THEN RAISE EXCEPTION/i);
});

test('spot cancel API forwards a stable client cancellation ID to the transactional RPC', () => {
  const start = api.indexOf("if (path === 'order/cancel' && method === 'POST')");
  const end = api.indexOf('// ---------- GET /api/earn/products ----------', start);
  assert.ok(start >= 0 && end > start);
  const handler = api.slice(start, end);
  assert.match(handler, /client_cancel_id/);
  assert.match(handler, /matchingRpc\('cancel_limit_order_matching_v1'/);
  assert.match(handler, /p_client_cancel_id: cancelId/);
  assert.match(handler, /MATCHING_ENGINE_UNAVAILABLE/);
});
