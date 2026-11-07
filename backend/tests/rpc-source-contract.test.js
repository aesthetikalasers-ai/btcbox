'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('every active backend PostgREST RPC call has a canonical SQL function definition', () => {
  const api = read('api-core.js');
  const adminAuth = read('admin-auth.js');
  const activeCalls = new Set([
    ...[...api.matchAll(/\/rest\/v1\/rpc\/([a-z][a-z0-9_]+)/g)].map((match) => match[1]),
    ...[...api.matchAll(/matchingRpc\(\s*['"]([a-z][a-z0-9_]+)/g)].map((match) => match[1]),
    ...[...adminAuth.matchAll(/\/rest\/v1\/rpc\/([a-z][a-z0-9_]+)/g)].map((match) => match[1]),
  ]);

  const sqlDirectory = path.join(root, 'supabase', 'sql');
  const sqlFiles = fs.readdirSync(sqlDirectory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .map((name) => fs.readFileSync(path.join(sqlDirectory, name), 'utf8'));
  const sqlSource = sqlFiles.join('\n');
  const declared = new Set(
    [...sqlSource.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public|private)\.([a-z][a-z0-9_]+)/gi)]
      .map((match) => match[1].toLowerCase())
  );

  const missing = [...activeCalls].filter((name) => !declared.has(name)).sort();
  assert.deepEqual(missing, [], 'active API calls without a canonical SQL definition');
  assert.ok(activeCalls.size >= 20, 'RPC inventory unexpectedly shrank; review route/source coverage');
});

test('withdrawal creation API and canonical SQL agree on the 11-argument fee-snapshot contract', () => {
  const api = read('api-core.js');
  const withdrawalMigration = read('supabase/sql/0029_withdrawal_fee_quote_idempotency_v1.sql');
  assert.match(api, /p_expected_fee\s*:/, 'API must send the server-quoted expected fee');
  const signature = withdrawalMigration.match(
    /create\s+function\s+public\.create_withdrawal_atomic\s*\(([\s\S]*?)\)\s*returns/i
  );
  assert.ok(signature, 'canonical migration must define create_withdrawal_atomic');
  const argumentCount = signature[1].split(',').length;
  assert.equal(argumentCount, 11, 'withdrawal SQL signature must include require-review and expected-fee arguments');
  assert.match(signature[1], /p_require_admin_review\s+boolean/i);
  assert.match(signature[1], /p_expected_fee\s+numeric/i);
});


test('read-only production readiness diagnostic covers critical live schema drift', () => {
  const diagnostic = read('supabase/diagnostics/production-schema-readiness.sql');
  for (const token of [
    "('public','withdrawal_requests','require_admin_review','boolean')",
    "('public','withdrawal_requests','request_hash','text')",
    "('public','withdrawal_requests','payout_reference','text')",
    "('public','withdrawal_requests','payout_note','text')",
    "('public','withdrawal_requests','paid_by','text')",
    "('public','withdrawal_requests','paid_at','timestamp with time zone')",
    "('public','financial_audit_log','event_id','text')",
    'withdrawal_requests_status_check',
    'LEGACY_OVERLOAD_PRESENT',
    'overload_count <> 1',
    "('public','seconds_contract_positions','policy_id','uuid')",
    "('public','seconds_contract_positions','policy_version','bigint')",
    "('public','seconds_contract_positions','payout_bps_snapshot','integer')",
    "('public','seconds_contract_positions','policy_snapshot','jsonb')",
    'seconds_contract_positions_duration_sec_positive',
    'seconds_contract_positions_duration_sec_check',
    'financial_audit_action_id_desc_idx',
    'financial_audit_subject_id_desc_idx',
  ]) {
    assert.ok(diagnostic.includes(token), 'diagnostic must cover ' + token);
  }
  const forbiddenMutations = ['INSERT INTO', 'UPDATE ', 'DELETE FROM', 'ALTER TABLE', 'DROP FUNCTION', 'CREATE TABLE', 'GRANT ', 'REVOKE '];
  for (const statement of forbiddenMutations) {
    assert.ok(!diagnostic.toUpperCase().includes(statement), 'diagnostic must not contain mutation statement: ' + statement);
  }
});

test('final withdrawal migration removes stale overloads and preserves service-role-only canonical RPC', () => {
  const cleanup = read('supabase/sql/0033_withdrawal_legacy_rpc_cleanup_v1.sql');
  assert.ok(cleanup.includes('DROP FUNCTION IF EXISTS public.create_withdrawal_atomic('));
  assert.ok(cleanup.includes('text, text, text, text, numeric, numeric, text, text, text\n)'));
  assert.ok(cleanup.includes('text, text, text, text, numeric, numeric, text, text, text, boolean\n)'));
  assert.ok(cleanup.includes("'public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric)'"));
  assert.ok(cleanup.includes('v_overloads <> 1'));
  assert.ok(cleanup.includes("has_function_privilege('service_role', v_function, 'EXECUTE')"));
  assert.ok(cleanup.includes("has_function_privilege('anon', v_function, 'EXECUTE')"));
  assert.ok(cleanup.includes("has_function_privilege('authenticated', v_function, 'EXECUTE')"));
  assert.ok(!cleanup.includes('UPDATE public.withdrawal_requests'));
  assert.ok(!cleanup.includes('DELETE FROM public.financial_ledger'));
  assert.ok(!cleanup.includes('UPDATE public.financial_accounts'));
});


test('production data inventory reports counts and state shape without exposing user payloads', () => {
  const inventory = read('supabase/diagnostics/production-data-inventory.sql');
  for (const token of ['TABLE_COUNT', 'USER_SUMMARY', 'STATE_KEY', 'jsonb_object_keys', 'users_with_btcbox_login_password', 'users_with_nonzero_balance']) {
    assert.ok(inventory.includes(token), 'inventory must include ' + token);
  }
  for (const sensitiveProjection of [
    'user_key AS object_name',
    'user_data AS detail',
    "data -> 'users' AS detail",
    "data -> 'sessions' AS detail",
  ]) {
    assert.ok(!inventory.includes(sensitiveProjection), 'inventory must not project sensitive payload: ' + sensitiveProjection);
  }
  const forbiddenMutations = ['INSERT INTO', 'UPDATE ', 'DELETE FROM', 'ALTER TABLE', 'DROP FUNCTION', 'CREATE TABLE', 'GRANT ', 'REVOKE '];
  for (const statement of forbiddenMutations) {
    assert.ok(!inventory.toUpperCase().includes(statement), 'inventory must remain read-only: ' + statement);
  }
});
