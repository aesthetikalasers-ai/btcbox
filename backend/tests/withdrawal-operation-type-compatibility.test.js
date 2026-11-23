'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const sql = fs.readFileSync(path.join(root, 'backend/supabase/sql/0044_withdrawal_operation_type_compatibility_v1.sql'), 'utf8');

test('withdrawal compatibility migration keeps the full financial operation type union', () => {
  const constraint = sql.match(/check \(operation_type in \(([\s\S]*?)\)\);/i);
  const functionAllowlist = sql.match(/p_operation_type NOT IN \(([\s\S]*?)\)\s+OR p_request_hash/i);
  assert.ok(constraint, 'operation_type CHECK constraint must exist');
  assert.ok(functionAllowlist, 'apply_financial_operation allowlist must exist');
  const values = (source) => new Set(Array.from(source.matchAll(/'([a-z0-9_]+)'/g), match => match[1]));
  const constrained = values(constraint[1]);
  const accepted = values(functionAllowlist[1]);
  for (const operation of constrained) assert.ok(accepted.has(operation), 'RPC must accept constrained operation type: ' + operation);
  assert.ok(accepted.has('withdraw_settle'), 'legacy withdrawal settlement remains accepted');
  assert.ok(accepted.has('withdraw_paid'), 'canonical manual payout remains accepted');
  assert.ok(accepted.has('perp_trade'), 'perpetual ledger operations remain accepted');
});
