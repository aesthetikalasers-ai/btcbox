'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const sqlDirectory = path.join(root, 'supabase', 'sql');
const finalMigrationName = '0042_financial_operation_type_allowlist_reconciliation_v1.sql';
const operationTypeCheck = /check\s*\(\s*operation_type\s+in\s*\(([\s\S]*?)\)\s*\)/gi;

function extractOperationTypes(source) {
  const types = new Set();
  for (const match of source.matchAll(operationTypeCheck)) {
    for (const value of match[1].matchAll(/'([a-z_]+)'/g)) types.add(value[1]);
  }
  return types;
}

test('final financial operation allow-list is the exact union of canonical migration contracts', () => {
  const migrationFiles = fs.readdirSync(sqlDirectory)
    .filter((file) => file.endsWith('.sql') && file !== finalMigrationName)
    .sort();
  const previouslyAllowed = new Set();
  for (const file of migrationFiles) {
    const source = fs.readFileSync(path.join(sqlDirectory, file), 'utf8');
    for (const value of extractOperationTypes(source)) previouslyAllowed.add(value);
  }

  const finalSource = fs.readFileSync(path.join(sqlDirectory, finalMigrationName), 'utf8');
  const finalAllowed = extractOperationTypes(finalSource);
  assert.match(finalSource, /DROP CONSTRAINT IF EXISTS financial_operations_operation_type_check\s*,\s*ADD CONSTRAINT financial_operations_operation_type_check/i);
  assert.deepEqual([...finalAllowed].sort(), [...previouslyAllowed].sort(),
    'the final CHECK constraint must preserve the exact union of operation types declared by earlier canonical migrations');
  const required = [
    'deposit_credit', 'withdraw_freeze', 'withdraw_approve', 'withdraw_reject',
    'withdraw_paid', 'earn_subscribe', 'earn_redeem', 'admin_adjustment',
    'spot_trade', 'spot_order_reserve', 'spot_order_cancel', 'seconds_open',
    'seconds_settle', 'migration_opening_balance', 'perp_order_reserve',
    'perp_trade', 'perp_order_cancel', 'perp_funding', 'perp_liquidation',
    'perp_insurance_cover', 'perp_bad_debt'
  ];
  assert.deepEqual([...finalAllowed].sort(), [...required].sort());
  assert.equal((finalSource.match(/^ALTER TABLE /gim) || []).length, 1,
    'constraint replacement must be one atomic ALTER TABLE statement');
  assert.doesNotMatch(finalSource, /INSERT\s+INTO|UPDATE\s+public\.financial_operations|DELETE\s+FROM|CREATE\s+(?:OR REPLACE\s+)?FUNCTION/i,
    'allow-list reconciliation must not move balances, write ledger rows, or change RPCs');
});
