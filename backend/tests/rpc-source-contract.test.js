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

test('admin membership API, public wrapper and private idempotency contract stay aligned', () => {
  const api = read('api-core.js');
  const wrapper = read('supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql');
  const privateStore = read('supabase/sql/0026_admin_rbac_private_store_v1.sql');

  const signature = wrapper.match(/create\s+or\s+replace\s+function\s+public\.admin_manage_membership_v1\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'public admin membership wrapper must exist');
  assert.deepEqual(signature[1].split(',').map((part) => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_actor_user_id', 'p_target_user_id', 'p_expected_revision', 'p_action',
    'p_permissions', 'p_reason', 'p_request_id', 'p_request_hash',
  ]);
  const call = api.match(/admin_manage_membership_v1['"]?\s*,?\s*\{([\s\S]*?)\}\s*\)\s*;/);
  assert.ok(call, 'API must call the canonical membership RPC with a named payload');
  for (const argument of [
    'p_actor_user_id', 'p_target_user_id', 'p_expected_revision', 'p_action',
    'p_permissions', 'p_reason', 'p_request_id', 'p_request_hash',
  ]) assert.match(call[1], new RegExp('\\b' + argument + '\\s*:'));

  assert.match(api, /const normalizedPermissions = \[\.\.\.permissions\]\.sort\(\)/);
  assert.match(api, /permissions:\s*normalizedPermissions/);
  assert.match(privateStore, /PRIMARY KEY\s*\(actor_user_id,request_id\)/i);
  assert.match(privateStore, /v_existing\.request_hash\s*<>\s*p_request_hash/i);
  assert.match(privateStore, /RETURN v_existing\.response \|\| jsonb_build_object\('replayed',true\)/i);
});

test('Seconds order API and canonical SQL preserve the request-hash replay contract', () => {
  const api = read('api-core.js');
  const secondsSql = read('supabase/sql/0025_seconds_policy_versioning_v1.sql');

  const signature = secondsSql.match(/create\s+or\s+replace\s+function\s+public\.submit_seconds_order_v1\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'canonical Seconds order RPC must exist');
  assert.deepEqual(signature[1].split(',').map((part) => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_position_id', 'p_user_id', 'p_symbol', 'p_direction', 'p_amount',
    'p_duration_sec', 'p_open_price', 'p_request_id', 'p_request_hash',
  ]);
  assert.match(api, /p_position_id:\s*positionId[\s\S]*?p_user_id:\s*String\(user\.uid\)[\s\S]*?p_symbol:\s*symbol[\s\S]*?p_direction:\s*direction[\s\S]*?p_amount:\s*String\(amount\)[\s\S]*?p_duration_sec:\s*durationSec[\s\S]*?p_open_price:[\s\S]*?p_request_id:\s*requestId[\s\S]*?p_request_hash:\s*requestHash/);
  assert.match(api, /JSON\.stringify\(\{ user_id: String\(user\.uid\), symbol, direction, amount: String\(amount\), duration_sec: durationSec, request_id: requestId \}\)/);
  assert.match(secondsSql, /v_existing\.open_request_hash\s*<>\s*p_request_hash/i);
  assert.match(secondsSql, /WHERE open_request_id=p_request_id/i);
  const secondsOrderBody = secondsSql.slice(signature.index).toLowerCase();
  assert.ok(
    secondsOrderBody.indexOf('where open_request_id=p_request_id') < secondsOrderBody.indexOf('select * into v_policy'),
    'idempotent replay lookup must happen before resolving the active policy within submit_seconds_order_v1'
  );
});

test('Seconds policy API hashes canonical sorted policy values before calling its RPC', () => {
  const api = read('api-core.js');
  assert.match(api, /symbols:\s*\[\.\.\.symbols\]\.sort\(\)/);
  assert.match(api, /durations_sec:\s*\[\.\.\.durations\]\.sort\(\(a,b\)=>a-b\)/);
  assert.match(api, /const requestHash = crypto\.createHash\('sha256'\)\.update\(JSON\.stringify\(normalized\)\)\.digest\('hex'\)/);
  assert.match(api, /p_expected_policy_version:\s*expectedVersion[\s\S]*?p_symbols:\s*normalized\.symbols[\s\S]*?p_durations_sec:\s*normalized\.durations_sec[\s\S]*?p_request_id:\s*requestId[\s\S]*?p_request_hash:\s*requestHash/);
});

test('Spot cancellation API and SQL preserve request identity and exact-replay behavior', () => {
  const api = read('api-core.js');
  const matchingSql = read('supabase/sql/0008_financial_matching_engine_v1.sql');

  const signature = matchingSql.match(/create\s+or\s+replace\s+function\s+public\.cancel_limit_order_matching_v1\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'canonical Spot cancellation RPC must exist');
  assert.deepEqual(signature[1].split(',').map((part) => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_user_id', 'p_order_id', 'p_client_cancel_id',
  ]);
  assert.match(api, /cancel_limit_order_matching_v1['"]\s*,\s*\{\s*p_user_id:\s*String\(user\.uid\),\s*p_order_id:\s*orderId,\s*p_client_cancel_id:\s*cancelId/);
  assert.match(matchingSql, /CREATE TABLE IF NOT EXISTS public\.financial_matching_cancel_requests/i);
  assert.match(matchingSql, /PRIMARY KEY\s*\(user_id,\s*client_cancel_id\)/i);
  assert.match(matchingSql, /v_cancel\.order_id<>p_order_id\s+OR\s+v_cancel\.request_hash<>v_request_hash/i);
  assert.match(matchingSql, /RETURN v_cancel\.response \|\| jsonb_build_object\('duplicate',true\)/i);
  assert.match(matchingSql, /INSERT INTO public\.financial_matching_cancel_requests\(user_id,client_cancel_id,order_id,request_hash,response\)/i);
});
