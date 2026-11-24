'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('the retired single-open-position SQL artifacts are absent from the active source tree', () => {
  assert.equal(fs.existsSync(path.join(root, 'supabase/sql/0015_financial_seconds_one_open_position_v1.sql')), false);
  assert.equal(fs.existsSync(path.join(root, 'supabase/sql/financial_seconds_one_open_position_v1.sql')), false);
});

test('Seconds schema and active order RPC do not impose a per-user open-position uniqueness constraint', () => {
  const schema = read('supabase/sql/0014_financial_seconds_contracts_v1.sql');
  const policy = read('supabase/sql/0025_seconds_policy_versioning_v1.sql');
  assert.doesNotMatch(schema, /CREATE UNIQUE INDEX[^;]*seconds_contract_positions[^;]*user_id[^;]*status/i);
  assert.doesNotMatch(policy, /seconds_contract_positions_one_open_per_user_idx|OPEN_POSITION_EXISTS/);
  assert.match(policy, /per_user_open_exposure/);
});

test('Seconds positions API returns the complete open-position array instead of a single position', () => {
  const api = read('api-core.js');
  assert.match(api, /open:\s*Array\.isArray\(result\.open\)\s*\?\s*result\.open\s*:\s*\[\]/);
});
