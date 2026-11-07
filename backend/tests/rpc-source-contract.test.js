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
  assert.doesNotMatch(diagnostic, /\\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE)\\s+(?:INTO|TABLE|FUNCTION|INDEX|SCHEMA|ON|ALL|EXECUTE)?/i,
    'production readiness diagnostic must remain read-only');
});


test('final withdrawal migration removes stale overloads and preserves service-role-only canonical RPC', () => {
  const cleanup = read('supabase/sql/0033_withdrawal_legacy_rpc_cleanup_v1.sql');
  assert.match(cleanup, /DROP FUNCTION IF EXISTS public\\.create_withdrawal_atomic\\s*\\(\\s*text,\\s*text,\\s*text,\\s*text,\\s*numeric,\\s*numeric,\\s*text,\\s*text,\\s*text\\s*\\)/i);
  assert.match(cleanup, /to_regprocedure\\(\\s*'public\\.create_withdrawal_atomic\\(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric\\)'/i);
  assert.match(cleanup, /v_overloads <> 1/);
  assert.match(cleanup, /has_function_privilege\\('service_role', v_function, 'EXECUTE'\\)/);
  assert.match(cleanup, /has_function_privilege\\('anon', v_function, 'EXECUTE'\\)/);
  assert.match(cleanup, /has_function_privilege\\('authenticated', v_function, 'EXECUTE'\\)/);
  assert.doesNotMatch(cleanup, /\\b(?:INSERT|UPDATE|DELETE)\\s+INTO\\s+public\\.(?:withdrawal_requests|financial_ledger|financial_accounts)/i,
    'withdrawal overload cleanup must not alter financial rows');
});
