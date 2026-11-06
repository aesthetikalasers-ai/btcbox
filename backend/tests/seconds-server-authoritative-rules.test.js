'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const initialMigration = fs.readFileSync(path.join(root, 'supabase/sql/0014_financial_seconds_contracts_v1.sql'), 'utf8');
const settlementMigration = fs.readFileSync(path.join(root, 'supabase/sql/0024_seconds_settlement_idempotency_v1.sql'), 'utf8');
const policyMigration = fs.readFileSync(path.join(root, 'supabase/sql/0025_seconds_policy_versioning_v1.sql'), 'utf8');

test('seconds order boundaries are enforced by the server, not accepted from client policy fields', () => {
  assert.match(api, /const SECONDS_ALLOWED_SYMBOLS = new Set\(\['BTC', 'ETH', 'SOL', 'BNB'\]\)/);
  assert.match(api, /Number\.isSafeInteger\(durationSec\) \|\| durationSec <= 0/);
  const secondsOrderStart = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const secondsOrderEnd = api.indexOf("// ---------- POST /api/seconds/settle ----------", secondsOrderStart);
  const secondsOrderHandler = api.slice(secondsOrderStart, secondsOrderEnd);
  assert.match(secondsOrderHandler, /amount === null \|\| compareMoney\(amount, '0'\) <= 0/);
  assert.doesNotMatch(secondsOrderHandler, /1000000000000/); // The active database policy is the sole max-stake authority.
  const start = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const end = api.indexOf("// ---------- POST /api/seconds/settle ----------", start);
  assert.ok(start >= 0 && end > start, 'seconds order handler must exist');
  const handler = api.slice(start, end);
  assert.match(handler, /if \(!financialWritesEnabled\(\)\)/);
  assert.doesNotMatch(handler, /body\.(?:payout|payout_rate|win_rate|profit_rate)/i);
  assert.doesNotMatch(handler, /p_(?:payout|payout_rate|win_rate|profit_rate)\s*:/i);
  assert.match(handler, /p_amount: String\(amount\)/);
  assert.match(handler, /p_duration_sec: durationSec/);
});

test('database RPC independently constrains contract symbol, direction, duration and positive stake', () => {
  for (const sql of [initialMigration]) {
    assert.match(sql, /p_symbol NOT IN \('BTC','ETH','SOL','BNB'\)/i);
    assert.match(sql, /p_direction NOT IN \('up','down'\)/i);
    assert.match(sql, /p_duration_sec NOT IN \(30,60,300,900\)/i);
    assert.match(sql, /p_amount IS NULL OR p_amount <= 0/i);
  }
  assert.match(initialMigration, /revoke all on function public\.submit_seconds_order_v1[\s\S]*?from public, anon, authenticated/i);
  assert.match(initialMigration, /grant execute on function public\.submit_seconds_order_v1[\s\S]*?to service_role/i);
  assert.match(policyMigration, /p_duration_sec IS NULL OR p_duration_sec <= 0/i);
  assert.match(policyMigration, /p_duration_sec=ANY\(v_policy\.durations_sec\)/i);
  assert.match(policyMigration, /max_open_positions_per_user/i);
  assert.match(policyMigration, /OPEN_POSITION_COUNT_LIMIT_EXCEEDED/i);
});

test('settlement price and payout policy remain server/database authoritative', () => {
  const start = api.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const end = api.indexOf("// ---------- GET /api/seconds/positions ----------", start);
  assert.ok(start >= 0 && end > start, 'seconds settlement handler must exist');
  const handler = api.slice(start, end);
  assert.match(handler, /fetchSecondsReferencePrice\(symbol\)/);
  assert.match(handler, /p_settle_price: settleRef \\? String\\(settleRef\\.price\\) : null/);
  assert.doesNotMatch(handler, /body\.settle_price/i);
  assert.match(initialMigration, /round\(v_pos\.amount\*0\.85,18\)/);
  assert.match(settlementMigration, /round\(v_pos\.amount\*0\.85,18\)/);
  assert.doesNotMatch(initialMigration, /p_(?:payout|payout_rate|win_rate|profit_rate)/i);
  assert.doesNotMatch(settlementMigration, /p_(?:payout|payout_rate|win_rate|profit_rate)/i);
});

test('seconds financial mutations stay behind the full financial cutover gate', () => {
  const order = api.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const settle = api.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const positions = api.indexOf("if (path === 'seconds/positions' && method === 'GET')");
  assert.ok(order >= 0 && settle > order && positions > settle);
  assert.match(api.slice(order, settle), /if \(!financialWritesEnabled\(\)\)/);
  assert.match(api.slice(settle, positions), /if \(!financialWritesEnabled\(\)\)/);
});

test('reference quote timestamps reject stale, future, missing and malformed provider times', () => {
  const start = api.indexOf('function normalizeReferenceTimestamp');
  const end = api.indexOf('async function fetchSecondsReferencePrice', start);
  assert.ok(start >= 0 && end > start, 'reference timestamp normalizer must exist');
  const normalize = vm.runInNewContext(api.slice(start, end) + '\\nnormalizeReferenceTimestamp;');
  const now = 1_800_000_000_000;
  assert.equal(normalize(now - 15_000, now), Math.floor((now - 15_000) / 1000));
  assert.equal(normalize(new Date(now - 60_000).toISOString(), now), Math.floor((now - 60_000) / 1000));
  assert.equal(normalize(now - 120_001, now), null);
  assert.equal(normalize(now + 5_001, now), null);
  assert.equal(normalize('not-a-time', now), null);
  assert.equal(normalize(undefined, now), null);
  assert.equal(normalize(now / 1000, now), null);
});

test('settlement persists the validated provider quote time instead of stamping server now', () => {
  const start = api.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const end = api.indexOf("// ---------- GET /api/seconds/positions ----------", start);
  const handler = api.slice(start, end);
  assert.match(handler, /normalizeReferenceTimestamp\\(ticker && ticker\\.time\\)/);
  assert.match(handler, /normalizeReferenceTimestamp\\(payload && payload\\.time\\)/);
  assert.match(handler, /p_settle_price_ts: new Date\\(settleRef\\.ts \\* 1000\\)\\.toISOString\\(\\)/);
  assert.doesNotMatch(handler, /p_settle_price_ts: new Date\\(\\)\\.toISOString\\(\\)/);
});
