'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '0042_btcbox_auth_mapping_registration_v1.sql'), 'utf8');

test('Supabase auth mapping RPC is explicitly gated and never uses client identity fields', () => {
  assert.ok(source.includes("process.env.BTCBOX_AUTH_MAPPING_RPC_ENABLED !== '1'"));
  assert.ok(source.includes("'/rest/v1/rpc/btcbox_register_auth_account_v1'"));
  assert.ok(source.includes('p_supabase_user_id: supabaseUserId'));
  assert.ok(source.includes('p_btcbox_user_id: btcboxUserId'));
  assert.ok(source.includes('p_provider_subject: supabaseUserId'));
  assert.ok(source.includes('headers: supabaseHeaders()'));
  assert.ok(source.includes("code: 'AUTH_ACCOUNT_MAPPING_UNAVAILABLE'"));
});

test('existing accounts persist identity mapping before the 2FA early return', () => {
  const loginStart = source.indexOf("const supabaseUserId = String(identity && identity.id || '').trim();");
  const twoFactorStart = source.indexOf('if (user && user.twofa_enabled)', loginStart);
  const mappingStart = source.indexOf('persistSupabaseAuthMapping(user, identity, authProvider, walletIdentity)', loginStart);
  assert.ok(loginStart >= 0 && mappingStart > loginStart && twoFactorStart > mappingStart);
});

test('new account mapping is attempted only after the internal BTCBOX state is saved', () => {
  const saveStart = source.indexOf('try { await saveDB(db); }', source.indexOf('if (!authMappingPersisted)'));
  const mappingStart = source.indexOf('await persistSupabaseAuthMapping(user, identity, authProvider, walletIdentity)', saveStart);
  assert.ok(saveStart >= 0 && mappingStart > saveStart);
});

test('registration RPC creates the internal account and both mappings in one transaction', () => {
  assert.ok(migration.includes('insert into public.btcbox_users (user_id, status)'));
  assert.ok(migration.includes("values (p_btcbox_user_id, 'active')"));
  assert.ok(migration.includes('public.link_btcbox_auth_account'));
  assert.ok(migration.includes('public.register_btcbox_auth_identity'));
  assert.ok(migration.includes("raise exception using errcode = 'P0001'"));
  assert.ok(migration.includes('for update'));
  assert.ok(migration.includes('set search_path ='));
});

test('registration RPC does not grant public access or write plaintext credentials', () => {
  assert.ok(migration.includes('revoke all on function public.btcbox_register_auth_account_v1'));
  assert.ok(migration.includes('from public, anon, authenticated'));
  assert.ok(migration.includes('to service_role'));
  assert.equal(/plain_password|password_hash|seed_phrase|private_key/i.test(migration), false);
});

function extractMappingFunction(context) {
  const start = source.indexOf('async function persistSupabaseAuthMapping(');
  assert.ok(start >= 0);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start);
  return vm.runInNewContext('(' + source.slice(start, end + 2) + ')', context);
}

test('mapping helper sends only verified server identity and uses the service-role RPC', async () => {
  let requestUrl = '';
  let requestOptions = null;
  const helper = extractMappingFunction({
    supabaseStorageConfigured: () => true,
    isSupabaseUserId: value => value === '11111111-1111-4111-8111-111111111111',
    supabaseHeaders: () => ({ apikey: 'server-only', Authorization: 'Bearer server-only' }),
    process: { env: { SUPABASE_URL: 'https://project.supabase.co/' } },
    fetch: async (url, options) => {
      requestUrl = String(url);
      requestOptions = options;
      return { ok: true, json: async () => true };
    },
    AbortSignal
  });
  const ok = await helper(
    { uid: '42' },
    { id: '11111111-1111-4111-8111-111111111111', email: 'User@Example.com' },
    'google',
    null
  );
  assert.equal(ok, true);
  assert.equal(requestUrl, 'https://project.supabase.co/rest/v1/rpc/btcbox_register_auth_account_v1');
  assert.equal(requestOptions.headers.Authorization, 'Bearer server-only');
  assert.deepEqual(JSON.parse(requestOptions.body), {
    p_supabase_user_id: '11111111-1111-4111-8111-111111111111',
    p_btcbox_user_id: '42',
    p_provider: 'google',
    p_provider_subject: '11111111-1111-4111-8111-111111111111',
    p_email: 'user@example.com',
    p_wallet_chain: null,
    p_wallet_address: null
  });
});

test('mapping helper rejects invalid identifiers and non-true RPC results', async () => {
  let calls = 0;
  const context = {
    supabaseStorageConfigured: () => true,
    isSupabaseUserId: value => value === '11111111-1111-4111-8111-111111111111',
    supabaseHeaders: () => ({}),
    process: { env: { SUPABASE_URL: 'https://project.supabase.co' } },
    fetch: async () => { calls += 1; return { ok: true, json: async () => false }; },
    AbortSignal
  };
  const helper = extractMappingFunction(context);
  assert.equal(await helper({ uid: 'not-numeric' }, { id: '11111111-1111-4111-8111-111111111111' }, 'email', null), false);
  assert.equal(calls, 0);
  assert.equal(await helper({ uid: '42' }, { id: '11111111-1111-4111-8111-111111111111' }, 'email', null), false);
  assert.equal(calls, 1);
});

test('web3 mapping carries only the validated public wallet identity', async () => {
  let body = null;
  const helper = extractMappingFunction({
    supabaseStorageConfigured: () => true,
    isSupabaseUserId: () => true,
    supabaseHeaders: () => ({}),
    process: { env: { SUPABASE_URL: 'https://project.supabase.co' } },
    fetch: async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => true }; },
    AbortSignal
  });
  assert.equal(await helper(
    { uid: '9' },
    { id: '22222222-2222-4222-8222-222222222222', email: '' },
    'web3',
    { chain: 'ethereum', address: '0x' + 'a'.repeat(40) }
  ), true);
  assert.equal(body.p_wallet_chain, 'ethereum');
  assert.equal(body.p_wallet_address, '0x' + 'a'.repeat(40));
});
