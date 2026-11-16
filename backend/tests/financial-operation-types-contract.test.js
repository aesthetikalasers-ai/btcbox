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

test('final financial operation allow-list preserves every canonical ledger operation type', () => {
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
  assert.match(finalSource, /DROP CONSTRAINT IF EXISTS financial_operations_operation_type_check/i);
  assert.match(finalSource, /ADD CONSTRAINT financial_operations_operation_type_check/i);
  assert.deepEqual([...finalAllowed].sort(), [...previouslyAllowed].sort(),
    'the final CHECK constraint must be the exact union of operation types declared by earlier canonical migrations');
  for (const required of ['withdraw_paid', 'seconds_open', 'seconds_settle', 'perp_order_reserve', 'perp_bad_debt']) {
    assert.ok(finalAllowed.has(required), 'missing financial operation type: ' + required);
  }
});
