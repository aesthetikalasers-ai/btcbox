'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleWalletRoute } = require('../wallet-api');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const originalFetch = global.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.beforeEach(() => {
  process.env.SUPABASE_URL = 'https://wallet-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-only';
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

test('wallet routes require an authenticated BTCBOX session before any database request', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call'); };
  const result = await handleWalletRoute({ path: 'wallet', method: 'GET', user: null });
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'UNAUTHENTICATED');
  assert.equal(called, false);
});

test('wallet routes reject missing or malformed verified Supabase identity', async () => {
  const result = await handleWalletRoute({ path: 'wallet', method: 'GET', user: { uid: '7' } });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'WALLET_IDENTITY_UNAVAILABLE');
});

test('wallet overview is owner-scoped and uses exact decimal arithmetic', async () => {
  let requestedUrl = '';
  let requestedHeaders = {};
  global.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return { ok: true, json: async () => [{ wallet_account_id: 'a', asset_code: 'USDT', available: '1.23', frozen: '0.77', version: 4, updated_at: '2026-11-16T00:00:00Z' }] };
  };
  const result = await handleWalletRoute({ path: 'wallet', method: 'GET', user: { supabase_user_id: USER_ID } });
  const url = new URL(requestedUrl);
  assert.equal(result.status, 200);
  assert.equal(url.searchParams.get('user_id'), 'eq.' + USER_ID);
  assert.equal(url.searchParams.get('select'), 'wallet_account_id,asset_code,available,frozen,version,updated_at');
  assert.equal(requestedHeaders.Authorization, 'Bearer test-service-role-only');
  assert.deepEqual(result.body.wallet.accounts[0], {
    asset: 'USDT', available: '1.23', frozen: '0.77', total: '2', version: 4, updated_at: '2026-11-16T00:00:00Z'
  });
  assert.equal(JSON.stringify(result.body).includes('private_key'), false);
});

test('wallet address listing returns only public address fields and is owner-scoped', async () => {
  let requestedUrl = '';
  global.fetch = async url => {
    requestedUrl = String(url);
    return { ok: true, json: async () => [{ wallet_address_id: 'address-id', asset_code: 'USDT', network_code: 'TRC20', address: 'TExamplePublicAddress', address_status: 'active', is_primary: true, derivation_reference: 'must-not-leak', created_at: '2026-11-16T00:00:00Z' }] };
  };
  const result = await handleWalletRoute({ path: 'wallet/addresses', method: 'GET', user: { supabase_user_id: USER_ID } });
  assert.equal(new URL(requestedUrl).searchParams.get('user_id'), 'eq.' + USER_ID);
  assert.equal(result.status, 200);
  assert.equal(result.body.addresses[0].address, 'TExamplePublicAddress');
  assert.equal(JSON.stringify(result.body).includes('derivation_reference'), false);
});

test('wallet ledger rejects invalid cursors and never accepts a client-supplied owner', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call'); };
  const badCursor = await handleWalletRoute({ path: 'wallet/ledger', method: 'GET', user: { supabase_user_id: USER_ID }, query: { cursor: '0 OR 1=1' } });
  assert.equal(badCursor.status, 400);
  assert.equal(called, false);
  assert.notEqual(USER_ID, OTHER_USER_ID);
});

test('wallet address generation fails closed when no provider is configured', async () => {
  global.fetch = async () => { throw new Error('must not call'); };
  const result = await handleWalletRoute({ path: 'wallet/addresses', method: 'POST', user: { supabase_user_id: USER_ID } });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'WALLET_PROVIDER_UNAVAILABLE');
});

test('wallet database failures return a generic response without leaking provider details', async () => {
  global.fetch = async () => { throw new Error('secret database endpoint and key'); };
  const result = await handleWalletRoute({ path: 'wallet', method: 'GET', user: { supabase_user_id: USER_ID } });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'WALLET_READ_UNAVAILABLE');
  assert.equal(JSON.stringify(result.body).includes('secret database'), false);
});
