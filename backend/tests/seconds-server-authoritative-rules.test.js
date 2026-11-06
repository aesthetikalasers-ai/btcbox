'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const initialMigration = fs.readFileSync(path.join(root, 'supabase/sql/0014_financial_seconds_contracts_v1.sql'), 'utf8');
const settlementMigration = fs.readFileSync(path.join(root, 'supabase/sql/0024_seconds_settlement_idempotency_v1.sql'), 'utf8');

test('seconds order boundaries are enforced by the server, not accepted from client policy fields', () => {
  assert.match(api, /const SECONDS_ALLOWED_SYMBOLS = new Set\(\['BTC', 'ETH', 'SOL', 'BNB'\]\)/);
  assert.match(api, /const SECONDS_ALLOWED_DURATIONS = new Set\(\[30, 60, 300, 900\]\)/);
  assert.match(api, /compareMoney\(amount, '1000000000000'\) > 0/);
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
});

test('settlement price and payout policy remain server/database authoritative', () => {
  const start = api.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const end = api.indexOf("// ---------- GET /api/seconds/positions ----------", start);
  assert.ok(start >= 0 && end > start, 'seconds settlement handler must exist');
  const handler = api.slice(start, end);
  assert.match(handler, /fetchSecondsReferencePrice\(symbol\)/);
  assert.match(handler, /p_settle_price: String\(settleRef\.price\)/);
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
