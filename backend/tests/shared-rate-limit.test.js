'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '0023_btcbox_shared_rate_limit_v1.sql'), 'utf8');

const policies = {
  login_2fa: [20, 900],
  credential_reauth: [8, 900],
  credential_recover: [5, 900],
  twofa_setup_password: [10, 900],
  twofa_setup_confirm: [10, 900],
  twofa_disable: [10, 900],
  seconds_order: [30, 300],
  seconds_settle: [60, 300],
  password_change: [10, 900],
  fund_password_change: [10, 900],
};

test('shared limiter has an explicit policy and async call site for all ten protected routes', () => {
  for (const [scope, [limit, seconds]] of Object.entries(policies)) {
    assert.match(api, new RegExp(scope + ': \\{ limit: ' + limit + ', windowSeconds: ' + seconds + ' \\}'));
    assert.ok(api.includes("await rateCheckShared('" + scope + "',"), scope + ' must use the shared limiter');
    assert.ok(migration.includes("'" + scope + "'"), scope + ' must be accepted by the database RPC');
  }
  assert.equal((api.match(/await rateCheckShared\(/g) || []).length, 10);
  assert.equal(api.includes('_rateBuckets'), false);
  assert.equal(api.includes('function rateCheck('), false);
});

test('shared limiter hashes bounded subjects and fails closed on missing configuration or RPC errors', () => {
  assert.ok(api.includes('BTCBOX_RATE_LIMIT_HMAC_SECRET'));
  assert.ok(api.includes("Buffer.byteLength(secret, 'utf8') < 32"));
  assert.ok(api.includes("crypto.createHmac('sha256', secret)"));
  assert.ok(api.includes('/rest/v1/rpc/btcbox_rate_limit_consume_v1'));
  assert.ok(api.includes('return { unavailable: true }'));
  assert.ok(api.includes('rateLimitUnavailableJson()'));
  assert.ok(api.includes("code: 'RATE_LIMIT_UNAVAILABLE'"));
});

test('database limiter uses a unique key and atomic upsert with fixed limits and bounded cleanup', () => {
  assert.ok(migration.includes('primary key (scope, key_hash, window_start)'));
  assert.ok(migration.includes('on conflict (scope, key_hash, window_start)'));
  assert.ok(migration.includes('request_count = public.btcbox_rate_limits.request_count + 1'));
  assert.ok(migration.includes("'window_seconds', v_window_seconds"));
  assert.ok(migration.includes('enable row level security'));
  assert.ok(migration.includes('to service_role'));
  assert.ok(migration.includes('limit 5000'));
  assert.ok(migration.includes("interval '48 hours'"));
});

test('identity source-target equality is rejected before account identity arrays are mutated', () => {
  const guard = api.indexOf("code: 'IDENTITY_LINK_SOURCE_TARGET_SAME'");
  const mutation = api.indexOf('user.supabase_user_ids = getUserLinkedIdentityIds(user)');
  assert.ok(guard >= 0);
  assert.ok(mutation > guard);
});
