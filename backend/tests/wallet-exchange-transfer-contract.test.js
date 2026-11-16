'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '0043_btcbox_wallet_exchange_transfer_v1.sql'), 'utf8');

test('Wallet and Exchange transfer is one server-only PostgreSQL transaction', () => {
  assert.ok(migration.includes('create or replace function public.btcbox_transfer_wallet_exchange_v1'));
  assert.ok(migration.includes('security definer'));
  assert.ok(migration.includes("set search_path = ''"));
  assert.ok(migration.includes('revoke all on function public.btcbox_transfer_wallet_exchange_v1'));
  assert.ok(migration.includes('from public, anon, authenticated'));
  assert.ok(migration.includes('to service_role'));
  assert.equal(/btcbox_apply_wallet_operation_v1|apply_financial_operation/.test(migration), false);
});

test('Transfer locks Wallet first and Exchange second for both directions', () => {
  const walletLock = migration.indexOf('from public.btcbox_wallet_accounts w');
  const exchangeLock = migration.indexOf('from public.financial_accounts e');
  assert.ok(walletLock >= 0 && exchangeLock > walletLock);
  assert.ok(migration.includes('pg_advisory_xact_lock'));
  assert.ok(migration.includes('p_supabase_user_id::text || \':\' || p_idempotency_key'));
  assert.ok(migration.includes('p_direction is null'));
  assert.ok(migration.includes('for update'));
});

test('Transfer validates verified identity, account state, asset, amount and idempotency', () => {
  assert.ok(migration.includes('p_supabase_user_id uuid'));
  assert.equal(/p_btcbox_user_id\s+text/i.test(migration), false);
  assert.ok(migration.includes('public.btcbox_auth_accounts'));
  assert.ok(migration.includes("v_user_status <> 'active'"));
  assert.ok(migration.includes("v_profile_status <> 'active'"));
  assert.ok(migration.includes('a.active = true'));
  assert.ok(migration.includes('scale(p_amount) > 18'));
  assert.ok(migration.includes('p_request_hash'));
  assert.ok(migration.includes('Transfer idempotency key payload mismatch'));
});

test('Transfer writes both account operations and both ledgers before commit', () => {
  assert.ok(migration.includes('insert into public.btcbox_wallet_operations'));
  assert.ok(migration.includes('insert into public.financial_operations'));
  assert.ok(migration.includes('insert into public.btcbox_wallet_ledger'));
  assert.ok(migration.includes('insert into public.financial_ledger'));
  assert.ok(migration.includes('insert into public.btcbox_wallet_exchange_transfers'));
  assert.ok(migration.includes("'wallet_to_exchange'"));
  assert.ok(migration.includes("'exchange_to_wallet'"));
});

test('Transfer extends operation types without changing existing financial rules', () => {
  assert.ok(migration.includes("'transfer_in','transfer_out'"));
  assert.ok(migration.includes("'wallet_transfer_in','wallet_transfer_out'"));
  assert.ok(migration.includes('btcbox_wallet_operations_operation_type_check'));
  assert.ok(migration.includes('financial_operations_operation_type_check'));
});
