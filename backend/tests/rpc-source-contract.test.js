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

  // An exact retry must replay the original withdrawal even after the fee
  // schedule or admin-review threshold changes. The advisory lock also protects
  // the absent-row first-use race across concurrent server instances.
  const lockAt = withdrawalMigration.indexOf('pg_catalog.pg_advisory_xact_lock');
  const lookupAt = withdrawalMigration.indexOf('where request_id = p_request_id');
  const replayAt = withdrawalMigration.indexOf('if found then', lookupAt);
  const currentFeeCheckAt = withdrawalMigration.indexOf('if p_expected_fee is distinct from p_fee then');
  const freezeAt = withdrawalMigration.indexOf('public.apply_financial_operation', currentFeeCheckAt);
  assert.ok(lockAt >= 0 && lockAt < lookupAt, 'withdrawal request key must be serialized before replay lookup');
  assert.ok(lookupAt < replayAt && replayAt < currentFeeCheckAt && currentFeeCheckAt < freezeAt,
    'existing requests must replay before current fee validation or any new balance freeze');
  const replayBlock = withdrawalMigration.slice(replayAt, currentFeeCheckAt);
  for (const field of ['user_id', 'asset', 'network', 'amount', 'destination', 'request_hash']) {
    assert.match(replayBlock, new RegExp('v_existing\\.' + field + '\\s+is\\s+distinct\\s+from'), 'replay must bind original ' + field);
  }
  assert.doesNotMatch(replayBlock, /v_existing\.(?:fee|require_admin_review)\s+is\s+distinct\s+from/i,
    'fee and review threshold are server snapshots and must not invalidate an exact retry');
  assert.match(api, /\[String\(user\.uid\), coin, network, String\(amount\), addr, requestId\]\.join\('\|'\)/,
    'request hash must bind user, asset, network, amount, destination and request ID without mutable fee configuration');
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
    secondsOrderBody.indexOf('where open_request_id=p_request_id') < secondsOrderBody.indexOf('into v_policy'),
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


test('Earn subscribe and redeem API payloads match canonical RPC signatures and replay hashes', () => {
  const api = read('api-core.js');
  const lifecycle = read('supabase/sql/0006_financial_earn_policy_v5.sql');
  const redemption = lifecycle;

  const subscribe = lifecycle.match(/create\s+or\s+replace\s+function\s+public\.subscribe_earn_atomic\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(subscribe, 'canonical Earn subscription RPC must exist');
  assert.deepEqual(subscribe[1].split(',').map(part => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_position_id', 'p_user_id', 'p_product_id', 'p_asset', 'p_principal', 'p_request_id', 'p_request_hash',
  ]);
  assert.match(api, /p_position_id:\s*positionId[\s\S]*?p_user_id:\s*String\(user\.uid\)[\s\S]*?p_product_id:\s*productId[\s\S]*?p_asset:\s*asset[\s\S]*?p_principal:\s*String\(amount\)[\s\S]*?p_request_id:\s*requestId[\s\S]*?p_request_hash:\s*requestHash/);
  assert.match(api, /JSON\.stringify\(\{ user_id: String\(user\.uid\), product_id: productId, asset, amount: String\(amount\), request_id: requestId \}\)/);
  assert.match(lifecycle, /request_idempotency_key\s*=\s*p_request_id/i);
  assert.match(lifecycle, /subscribe_request_hash\)[\s\S]*?p_request_hash\);/i);

  const redeem = redemption.match(/create\s+or\s+replace\s+function\s+public\.redeem_earn_atomic\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(redeem, 'canonical Earn redemption RPC must exist');
  assert.deepEqual(redeem[1].split(',').map(part => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_position_id', 'p_user_id', 'p_request_id', 'p_request_hash',
  ]);
  assert.match(api, /p_position_id:\s*positionId[\s\S]*?p_user_id:\s*String\(user\.uid\)[\s\S]*?p_request_id:\s*requestId[\s\S]*?p_request_hash:\s*requestHash/);
  assert.match(api, /JSON\.stringify\(\{ user_id: String\(user\.uid\), position_id: positionId, request_id: requestId \}\)/);
  assert.match(redemption, /redeem_request_hash\s+IS DISTINCT FROM\s+p_request_hash/i);
});

test('admin manual deposit API payload and request hash match the canonical atomic credit RPC', () => {
  const api = read('api-core.js');
  const sql = read('supabase/sql/0007_financial_admin_manual_deposit_v1.sql');
  const signature = sql.match(/create\s+or\s+replace\s+function\s+public\.admin_manual_deposit_atomic\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'canonical manual deposit RPC must exist');
  assert.deepEqual(signature[1].split(',').map(part => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_deposit_id', 'p_admin_id', 'p_user_id', 'p_asset', 'p_amount',
    'p_request_id', 'p_request_hash', 'p_reference', 'p_note',
  ]);
  assert.match(api, /p_deposit_id:\s*depositId[\s\S]*?p_admin_id:\s*adminId[\s\S]*?p_user_id:\s*uid[\s\S]*?p_asset:\s*coin[\s\S]*?p_amount:\s*amountText[\s\S]*?p_request_id:\s*idempotencyKey[\s\S]*?p_request_hash:\s*requestHash[\s\S]*?p_reference:\s*reference[\s\S]*?p_note:\s*note/);
  assert.match(api, /\[adminId, uid, coin, amountText, reference, note\]\.join\('\|'\)/);
  assert.match(sql, /concat_ws\('\|',\s*p_admin_id,\s*p_user_id,\s*p_asset,\s*p_amount::text,\s*v_reference,\s*v_note\)/i);
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/i);
});

test('Seconds settlement API and canonical SQL align on trusted quote provenance and idempotency', () => {
  const api = read('api-core.js');
  const sql = read('supabase/sql/0024_seconds_settlement_idempotency_v1.sql');
  const signature = sql.match(/create\s+or\s+replace\s+function\s+public\.settle_seconds_position_v1\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'canonical Seconds settlement RPC must exist');
  assert.deepEqual(signature[1].split(',').map(part => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_position_id', 'p_user_id', 'p_request_id', 'p_request_hash',
    'p_symbol', 'p_settle_price', 'p_settle_price_source', 'p_settle_price_ts',
  ]);
  assert.match(api, /p_position_id:\s*positionId[\s\S]*?p_user_id:\s*String\(user\.uid\)[\s\S]*?p_request_id:\s*requestId[\s\S]*?p_request_hash:\s*requestHash[\s\S]*?p_symbol:\s*symbol[\s\S]*?p_settle_price:\s*settleRef\s*\?\s*String\(settleRef\.price\)\s*:\s*null[\s\S]*?p_settle_price_source:\s*settleRef\s*\?\s*settleRef\.source\s*:\s*null[\s\S]*?p_settle_price_ts:\s*settleRef\s*\?\s*new Date\(settleRef\.ts\s*\*\s*1000\)\.toISOString\(\)\s*:\s*null/);
  assert.match(sql, /settle_request_hash\s+IS DISTINCT FROM\s+p_request_hash/i);
  assert.match(sql, /p_settle_price_source[\s\S]*?NOT IN\s*\('coinbase','bybit'\)/i);
  assert.match(sql, /p_settle_price_ts\s*<\s*v_pos\.settle_at/i);
});


test('Spot limit-order API and matching SQL preserve client idempotency and atomic reserve contract', () => {
  const api = read('api-core.js');
  const sql = read('supabase/sql/0008_financial_matching_engine_v1.sql');
  const signature = sql.match(/create\s+(?:or\s+replace\s+)?function\s+public\.submit_limit_order_matching_v1\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'canonical Spot matching submit RPC must exist');
  assert.deepEqual(signature[1].split(',').map(part => part.trim().split(/\s+/)[0].toLowerCase()), [
    'p_order_id', 'p_user_id', 'p_base_asset', 'p_quote_asset',
    'p_side', 'p_price', 'p_quantity', 'p_client_order_id',
  ]);
  assert.match(api, /clientOrderId\s*=\s*String\(body\.client_order_id\s*\|\|\s*body\.request_id\s*\|\|\s*''\)\.trim\(\)/);
  assert.ok(api.includes("if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientOrderId))"), 'Spot API requires a stable client order id');
  assert.match(api, /if\s*\(!matchingEngineEnabled\(\)\)[\s\S]{0,260}MATCHING_ENGINE_UNAVAILABLE/);
  assert.match(api, /matchingRpc\(\s*'submit_limit_order_matching_v1'\s*,\s*\{[\s\S]*?p_order_id:\s*orderId[\s\S]*?p_user_id:\s*String\(user\.uid\)[\s\S]*?p_base_asset:\s*pair\[0\][\s\S]*?p_quote_asset:\s*pair\[1\][\s\S]*?p_side:\s*side[\s\S]*?p_price:\s*price[\s\S]*?p_quantity:\s*qty[\s\S]*?p_client_order_id:\s*clientOrderId/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('spot-order:'\|\|p_user_id\|\|':'\|\|p_client_order_id,\s*0\)\)/i);
  assert.match(sql, /select\s+\*\s+into\s+v_existing[\s\S]*?where\s+user_id=p_user_id\s+and\s+client_order_id=p_client_order_id[\s\S]*?if\s+found\s+then[\s\S]*?client order id payload mismatch[\s\S]*?duplicate',true/i);
  assert.ok(sql.indexOf('client order id payload mismatch') < sql.indexOf('market disabled or unconfigured'), 'exact retries must be resolved before current market availability checks');
  assert.match(sql, /insert into public\.financial_operations\(idempotency_key,user_id,asset,operation_type,request_hash,metadata\)[\s\S]*?spot_order_reserve/);
  assert.match(sql, /update public\.financial_accounts[\s\S]*?available=available-v_reserve, frozen=frozen\+v_reserve/);
});

test('administrator audit outbox API matches the SQL RPC default-argument contract', () => {
  const api = read('api-core.js');
  const sql = read('supabase/sql/0021_admin_audit_log_append_only_v1.sql');
  const signature = sql.match(/create\s+or\s+replace\s+function\s+public\.append_admin_audit_log\s*\(([\s\S]*?)\)\s*returns/i);
  assert.ok(signature, 'append-only administrator audit RPC must exist');
  assert.match(signature[1], /p_event_id\s+text\s*,\s*p_action\s+text/i);
  assert.match(signature[1], /p_uid\s+text\s+default\s+''/i);
  assert.match(signature[1], /p_by\s+text\s+default\s+'admin'/i);
  assert.match(signature[1], /p_detail\s+text\s+default\s+''/i);
  assert.match(signature[1], /p_meta\s+jsonb\s+default\s+'\{\}'::jsonb/i);
  assert.match(api, /fetch\(base\s*\+\s*'\/rest\/v1\/rpc\/append_admin_audit_log'[\s\S]*?p_event_id:\s*String\(entry\.id\)[\s\S]*?p_action:\s*String\(entry\.action\s*\|\|\s*''\)[\s\S]*?p_uid:\s*String\(entry\.uid\s*\|\|\s*''\)[\s\S]*?p_by:\s*String\(entry\.by\s*\|\|\s*'admin'\)[\s\S]*?p_detail:\s*safeDetail/);
  assert.match(sql, /p_meta\s+is\s+null\s+or\s+jsonb_typeof\(p_meta\)\s*<>\s*'object'/i);
  assert.match(sql, /on conflict\s*\(event_id\)[\s\S]*?do nothing/i);
  assert.match(sql, /v_existing\.metadata\s+is distinct from\s+p_meta/i);
});

test('withdrawal review and manual payout preserve locked state transitions and audit without chain broadcast', () => {
  const api = read('api-core.js');
  const review = read('supabase/sql/0022_withdrawal_admin_review_status_v1.sql');
  const payout = read('supabase/sql/0027_withdrawal_manual_payout_completion_v1.sql');
  assert.ok(api.includes("'/rest/v1/rpc/review_withdrawal_atomic'"));
  assert.match(api, /p_withdrawal_id:\s*wdId[\s\S]*?p_admin_id:\s*adminId[\s\S]*?p_approve:\s*true/);
  assert.match(review, /where\s+id\s*=\s*p_withdrawal_id\s+for update/i);
  assert.match(review, /if\s+v_w\.status\s+not\s+in\s*\('pending',\s*'pending_admin_review'\)/i);
  assert.match(review, /'withdraw-review:'\s*\|\|\s*v_w\.id/i);
  assert.match(review, /insert into public\.financial_audit_log/i);
  assert.match(api, /rpc\/mark_withdrawal_paid_atomic'[\s\S]*?p_withdrawal_id:\s*wdId[\s\S]*?p_admin_id:\s*adminId[\s\S]*?p_reference:\s*reference[\s\S]*?p_note:\s*note/);
  assert.match(payout, /where\s+id\s*=\s*p_withdrawal_id\s+for update/i);
  assert.match(payout, /if\s+v_w\.status\s*=\s*'completed'[\s\S]*?payout_reference[\s\S]*?duplicate',true/i);
  assert.match(payout, /if\s+v_w\.status\s*<>\s*'approved'[\s\S]*?withdrawal must be approved/i);
  assert.match(payout, /set status='completed',[\s\S]*?payout_reference=v_ref,[\s\S]*?paid_by=p_admin_id,[\s\S]*?paid_at=clock_timestamp/i);
  assert.match(payout, /insert into public\.financial_audit_log/i);
  assert.doesNotMatch(payout, /apply_financial_operation|insert into public\.financial_ledger/i, 'manual payout completion records the external payout and must not debit the ledger a second time');
});


test('customer financial write routes consume bounded shared server-side rate limits', () => {
  const api = read('api-core.js');
  const migration = read('supabase/sql/0037_financial_write_rate_limit_scopes_v1.sql');
  const scopes = [
    ['withdraw_create', 5, 900],
    ['spot_order', 30, 300],
    ['spot_cancel', 60, 300],
    ['earn_subscribe', 10, 900],
    ['earn_redeem', 20, 900],
  ];
  for (const [scope, limit, windowSeconds] of scopes) {
    assert.match(api, new RegExp(scope + ':\\s*\\{\\s*limit:\\s*' + limit + ',\\s*windowSeconds:\\s*' + windowSeconds));
    assert.match(api, new RegExp("rateCheckShared\\('" + scope + "',\\s*String\\(user\\.uid\\)\\)"),
      scope + ' route must use the authenticated user as its rate-limit subject');
    assert.match(migration, new RegExp("when '" + scope + "' then v_limit := " + limit + '; v_window_seconds := ' + windowSeconds + ';'));
    assert.ok(migration.includes("'" + scope + "'"), scope + ' must be allowed by the persisted scope constraint');
  }
  assert.match(api, /if \(rl\.unavailable\) return rateLimitUnavailableJson\(\)/);
  assert.match(api, /if \(rl\.limited\) return rateLimitedJson\(rl\.retryAfter\)/);
});
