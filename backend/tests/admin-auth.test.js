'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readBearerToken, resolveAuthConfig, verifySupabaseAccessToken, loadAdminMembership, authorizeSupabaseAdmin } = require('../admin-auth');

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';
const ENV = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_AUTH_PUBLISHABLE_KEY: 'sb_publishable_test_key_123'
};
const AUTH = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3OCJ9.signature';

test('Bearer parser accepts one bounded bearer credential only', () => {
  assert.equal(readBearerToken(AUTH), AUTH.slice(7));
  for (const value of [null, '', 'Basic abc', 'Bearer a b', 'Bearer short', 'Bearer ' + 'a'.repeat(8193)]) {
    assert.equal(readBearerToken(value), null);
  }
});

test('Auth configuration rejects missing, malformed, or non-HTTPS settings', () => {
  assert.equal(resolveAuthConfig({}), null);
  assert.equal(resolveAuthConfig({ SUPABASE_URL: 'http://example.supabase.co', SUPABASE_AUTH_PUBLISHABLE_KEY: ENV.SUPABASE_AUTH_PUBLISHABLE_KEY }), null);
  assert.equal(resolveAuthConfig({ ...ENV, SUPABASE_AUTH_PUBLISHABLE_KEY: 'secret with spaces' }), null);
  assert.deepEqual(resolveAuthConfig(ENV), {
    baseUrl: 'https://example.supabase.co',
    publishableKey: ENV.SUPABASE_AUTH_PUBLISHABLE_KEY
  });
});

test('valid identity comes only from successful Supabase Auth user response', async () => {
  let request;
  const result = await verifySupabaseAccessToken({
    authorization: AUTH,
    env: ENV,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return { ok: true, status: 200, json: async () => ({ id: USER_ID, user_metadata: { is_super_admin: true } }) };
    }
  });
  assert.deepEqual(result, { ok: true, user: { id: USER_ID } });
  assert.equal(request.url, 'https://example.supabase.co/auth/v1/user');
  assert.equal(request.init.headers.apikey, ENV.SUPABASE_AUTH_PUBLISHABLE_KEY);
  assert.equal(request.init.headers.Authorization, 'Bearer ' + AUTH.slice(7));
  assert.equal(request.init.method, 'GET');
  assert.equal(Object.hasOwn(result.user, 'is_super_admin'), false);
});

test('missing or invalid bearer token never calls Auth', async () => {
  let called = false;
  const result = await verifySupabaseAccessToken({
    authorization: 'Basic nope',
    env: ENV,
    fetchImpl: async () => { called = true; throw new Error('must not run'); }
  });
  assert.deepEqual(result, { ok: false, code: 'UNAUTHENTICATED', status: 401 });
  assert.equal(called, false);
});

test('invalid, anonymous, and non-UUID Auth users fail closed', async () => {
  for (const user of [{ id: 'not-a-uuid' }, { id: USER_ID, is_anonymous: true }, null]) {
    const result = await verifySupabaseAccessToken({
      authorization: AUTH, env: ENV,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => user })
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  }
});

test('Auth 401/403 are unauthenticated; upstream failures are unavailable', async () => {
  for (const status of [401, 403]) {
    const result = await verifySupabaseAccessToken({
      authorization: AUTH, env: ENV,
      fetchImpl: async () => ({ ok: false, status })
    });
    assert.deepEqual(result, { ok: false, code: 'UNAUTHENTICATED', status: 401 });
  }
  const unavailable = await verifySupabaseAccessToken({
    authorization: AUTH, env: ENV,
    fetchImpl: async () => ({ ok: false, status: 500 })
  });
  assert.deepEqual(unavailable, { ok: false, code: 'AUTH_VERIFICATION_UNAVAILABLE', status: 503 });
});

test('network errors fail closed without leaking token details', async () => {
  const result = await verifySupabaseAccessToken({
    authorization: AUTH, env: ENV,
    fetchImpl: async () => { throw new Error('upstream failure'); }
  });
  assert.deepEqual(result, { ok: false, code: 'AUTH_VERIFICATION_UNAVAILABLE', status: 503 });
});


test('admin membership is loaded only through the service-role RPC using the verified Auth UUID', async () => {
  let request;
  const result = await loadAdminMembership({
    userId: USER_ID,
    env: { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service_role_test_key' },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return { ok: true, status: 200, json: async () => ({
        found: true, active: true, user_id: USER_ID, is_super_admin: true, revision: 1,
        permissions: ['dashboard.read', 'users.read']
      }) };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.membership.is_super_admin, true);
  assert.equal(request.url, 'https://example.supabase.co/rest/v1/rpc/admin_get_membership_v1');
  assert.equal(request.init.headers.Authorization, 'Bearer service_role_test_key');
  assert.deepEqual(JSON.parse(request.init.body), { p_actor_user_id: USER_ID });
});

test('admin membership fails closed for inactive or mismatched identities', async () => {
  for (const payload of [
    { found: false, active: false },
    { found: true, active: true, user_id: '123e4567-e89b-42d3-a456-426614174001', permissions: [] }
  ]) {
    const result = await loadAdminMembership({
      userId: USER_ID,
      env: { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service_role_test_key' },
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => payload })
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  }
});

test('Supabase administrator authorization verifies Auth first, then checks server-side membership', async () => {
  const calls = [];
  const result = await authorizeSupabaseAdmin({
    authorization: AUTH,
    env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: 'service_role_test_key' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/auth/v1/user')) {
        return { ok: true, status: 200, json: async () => ({ id: USER_ID, user_metadata: { is_super_admin: true } }) };
      }
      return { ok: true, status: 200, json: async () => ({
        found: true, active: true, user_id: USER_ID, is_super_admin: false, revision: 3,
        permissions: ['dashboard.read']
      }) };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.user.id, USER_ID);
  assert.equal(result.membership.is_super_admin, false);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://example.supabase.co/auth/v1/user',
    'https://example.supabase.co/rest/v1/rpc/admin_get_membership_v1'
  ]);
});
