'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'sql', '0016_financial_deposit_chain_verification_v3.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('chain deposit verifier requires a sufficiently confirmed, hashed observation', () => {
  assert.ok(sql.includes('p_confirmations < p_required_confirmations'));
  assert.ok(sql.includes('p_observed_amount IS NULL OR p_observed_amount <= 0'));
  assert.ok(sql.includes("p_request_hash <> v_hash"));
  assert.ok(sql.includes("chain observation request hash mismatch"));
});

test('chain deposit verifier locks an existing pending intent and matches its asset, network, and exact amount', () => {
  assert.ok(sql.includes('SELECT * INTO v_d FROM public.deposit_records WHERE id = p_deposit_id FOR UPDATE'));
  assert.ok(sql.includes("IF v_d.status <> 'pending' THEN RAISE EXCEPTION 'deposit is not pending'"));
  assert.ok(sql.includes('upper(v_d.asset) <> upper(p_asset) OR lower(v_d.network) <> lower(p_network)'));
  assert.ok(sql.includes('v_d.amount <> p_observed_amount'));
  assert.ok(!sql.includes('INSERT INTO public.deposit_records'));
});

test('chain deposit credit, confirmed state, and financial audit are part of the same verifier RPC', () => {
  assert.ok(sql.includes('public.apply_financial_operation('));
  assert.ok(sql.includes("SET status='confirmed', confirmed_by=p_verifier_id, confirmed_at=now(), credit_operation_id=v_op_id"));
  assert.ok(sql.includes("INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,metadata)"));
  assert.ok(sql.includes("'deposit_chain_verified_and_credited'"));
});

test('confirmed deposit retries are idempotent only for the same chain observation', () => {
  assert.ok(sql.includes("IF v_d.status = 'confirmed' THEN"));
  assert.ok(sql.includes("AND v_d.chain_observed_amount = p_observed_amount"));
  assert.ok(sql.includes("'duplicate',true"));
  assert.ok(sql.includes("confirmed deposit does not match chain observation"));
});

test('only service_role can execute chain verification and legacy manual confirmation cannot bypass it', () => {
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text) FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text) TO service_role'));
  assert.ok(sql.includes("manual deposit confirmation disabled; verified chain observation required"));
  assert.ok(sql.includes("v_d.status='confirmed' AND v_d.chain_verified_at IS NOT NULL AND v_d.credit_operation_id IS NOT NULL"));
});
