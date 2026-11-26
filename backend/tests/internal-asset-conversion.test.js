'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const api = read('api-core.js');
const migration = read('supabase/existing-schema-upgrades/0058_internal_asset_conversion_atomic_v1.sql');
const apiModule = require(path.join(root, 'api-core.js'));

test('internal conversion is an additive manual upgrade, not a database bootstrap', () => {
  assert.match(migration, /MANUAL EXISTING-SCHEMA UPGRADE ONLY/);
  assert.match(migration, /public\.financial_accounts/);
  assert.match(migration, /public\.financial_operations/);
  assert.match(migration, /public\.financial_ledger/);
  assert.doesNotMatch(migration, /CREATE DATABASE|DROP DATABASE|DROP TABLE|TRUNCATE|DELETE FROM public\.financial_accounts/i);
  for (const name of ['bootstrap-empty-database.sh', 'docker-init-migrations.sh']) {
    assert.doesNotMatch(read('scripts/' + name), /0058_internal_asset_conversion_atomic_v1/);
  }
});

test('atomic conversion debits and credits both assets in one transaction with ordered account locks', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.apply_internal_conversion_atomic/i);
  assert.match(migration, /SECURITY INVOKER/i);
  assert.match(migration, /ORDER BY asset\s+FOR UPDATE/i);
  assert.match(migration, /available=available-p_from_amount/i);
  assert.match(migration, /available=available\+p_to_amount/i);
  assert.match(migration, /INSERT INTO public\.financial_ledger[\s\S]*?\(v_op\.id,p_user_id,p_from_asset,-p_from_amount[\s\S]*?\(v_op\.id,p_user_id,p_to_asset,p_to_amount/i);
  assert.match(migration, /'asset_conversion'/);
  assert.match(migration, /pg_get_expr\(conbin, conrelid\)/,
    'the live operation allowlist must be preserved rather than replaced with a stale hard-coded list');
  assert.match(migration, /OR operation_type = %L/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.apply_internal_conversion_atomic/i);
  assert.match(migration, /TO service_role/i);
});

test('signed conversion quote is single-use and request retries are idempotent', () => {
  assert.match(migration, /financial_conversion_quotes/);
  assert.match(migration, /ON CONFLICT \(quote_id\) DO NOTHING/);
  assert.match(migration, /conversion quote already used/);
  assert.match(migration, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
  assert.match(migration, /conversion idempotency key payload mismatch/);
  assert.match(migration, /conversion quote expired/);
  assert.match(migration, /conversion ledger invariant failed/);
});

test('conversion API validates signed user quote and invokes the atomic database function', () => {
  assert.match(api, /path === 'convert\/quote'/);
  assert.match(api, /path === 'convert'/);
  assert.match(api, /btcbox_assets\?asset_code=in\./);
  assert.match(api, /btcbox-conversion-quote-v1\|/);
  assert.match(api, /\/rest\/v1\/rpc\/apply_internal_conversion_atomic/);
  assert.match(api, /p_quote_id: quote\.quote_id/);
  assert.match(api, /p_quote_expires_at: quote\.expires_at/);
  assert.match(api, /FINANCIAL_INTERNAL_CONVERSION_ENABLED !== '1'/,
    'conversion quote and confirmation must remain disabled until explicitly enabled after review');
  assert.ok(api.includes('Internal conversion is not available yet. No assets were moved.'));
});

test('conversion output precision is floored to the destination asset decimal count', () => {
  const floor = apiModule._test.floorMoneyToDecimals;
  assert.equal(floor('1.239999', 2), '1.23');
  assert.equal(floor('0.000000019', 8), '0.00000001');
  assert.equal(floor('2.5000', 2), '2.5');
  assert.equal(floor('2.5', 0), '2');
  assert.equal(floor('1.2', 18), '1.2');
  assert.equal(floor('1.2', 19), null);
  assert.equal(floor('not-money', 8), null);
});
