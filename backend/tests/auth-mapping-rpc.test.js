'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
