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
  for (const operation of ['withdraw_settle','withdraw_paid','perp_order_reserve','perp_trade',
    'perp_order_cancel','perp_funding','perp_liquidation','perp_insurance_cover','perp_bad_debt']) {
    assert.ok(constrained.has(operation), 'table CHECK must accept operation type: ' + operation);
  }
  assert.ok(accepted.has('withdraw_settle'), 'legacy withdrawal settlement remains accepted');
  assert.ok(accepted.has('withdraw_paid'), 'canonical manual payout remains accepted');
  for (const operation of ['perp_order_reserve','perp_trade','perp_order_cancel','perp_funding',
    'perp_liquidation','perp_insurance_cover','perp_bad_debt']) {
    assert.ok(!accepted.has(operation), 'generic balance helper must not accept dedicated perpetual operation: ' + operation);
  }
  assert.ok(sql.includes('financial_operations_operation_type_check_v2'));
  assert.ok(sql.includes('not valid'));
  assert.ok(sql.includes('validate constraint financial_operations_operation_type_check'));
});
