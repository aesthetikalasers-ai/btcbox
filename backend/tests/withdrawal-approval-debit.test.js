'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0055_withdrawal_approval_debit_at_review_v1.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

test('forward migration consumes frozen principal and fee on approval', () => {
  assert.match(migration, /'withdraw_approve',\s*0,\s*-\(v_w\.amount \+ v_w\.fee\)/);
  assert.match(migration, /'withdraw-approve:' \|\| v_w\.id/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /v_w\.status NOT IN \('pending', 'pending_admin_review'\)/);
  assert.match(migration, /review_operation_id = v_operation_id/);
  assert.match(migration, /'withdrawal_' \|\| v_status/);
});

test('rejection releases exact principal and fee once', () => {
  assert.match(migration, /'withdraw_reject',\s*v_w\.amount \+ v_w\.fee,\s*-\(v_w\.amount \+ v_w\.fee\)/);
  assert.match(migration, /'withdraw-review:' \|\| v_w\.id/);
});

test('mark-paid is status and audit only, with no second financial debit', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic');
  const end = migration.indexOf('REVOKE ALL ON FUNCTION public.review_withdrawal_atomic', start);
  assert.ok(start >= 0 && end > start);
  const fn = migration.slice(start, end);
  assert.doesNotMatch(fn, /apply_financial_operation|UPDATE public\.financial_accounts|INSERT INTO public\.financial_ledger|withdraw_paid/i);
  assert.match(fn, /o\.id = v_w\.review_operation_id/);
  assert.match(fn, /o\.idempotency_key = 'withdraw-approve:' \|\| v_w\.id/);
  assert.match(fn, /HAVING count\(\*\) = 1/);
  assert.match(fn, /withdrawal approval debit not verified; manual reconciliation required/);
  assert.match(fn, /v_w\.status <> 'approved'/);
  assert.match(fn, /status = 'completed'/);
  assert.match(fn, /payout_reference = v_ref/);
  assert.match(fn, /paid_by = p_admin_id/);
  assert.match(fn, /'withdrawal_manual_payout_completed'/);
});

test('legacy approved rows without the 0055 approval debit fail closed', () => {
  assert.match(migration, /o\.id = v_w\.review_operation_id/);
  assert.match(migration, /o\.operation_type = 'withdraw_approve'/);
  assert.match(migration, /sum\(l\.frozen_delta\) = -\(v_w\.amount \+ v_w\.fee\)/);
  assert.match(migration, /manual reconciliation required/);
});

test('API uses admin-internal payout reference wording', () => {
  assert.ok(api.includes("msg: 'Internal payout reference is required.'"));
  assert.ok(!api.includes("msg: 'TxID / payout reference is required.'"));
});

test('USDC settlement is debited from the locked USDT amount, not the payout asset', () => {
  const migration56 = fs.readFileSync(path.join(root, 'supabase/sql/0056_usdc_withdrawal_settlement_in_usdt_v1.sql'), 'utf8');
  assert.match(migration56, /p_asset = 'USDC'[\s\S]*?p_settlement_asset <> 'USDT'/);
  assert.match(migration56, /p_settlement_amount IS DISTINCT FROM v_expected_settlement/);
  assert.match(migration56, /'withdraw-freeze:' \|\| p_request_id,[\s\S]*?p_settlement_asset,[\s\S]*?-p_settlement_amount,[\s\S]*?p_settlement_amount/);
  assert.match(migration56, /v_w\.settlement_asset,[\s\S]*?'withdraw_approve',[\s\S]*?0, -v_w\.settlement_amount/);
  assert.match(migration56, /v_w\.settlement_asset,[\s\S]*?'withdraw_reject',[\s\S]*?v_w\.settlement_amount, -v_w\.settlement_amount/);
  assert.match(migration56, /o\.asset = v_w\.settlement_asset/);
  assert.match(migration56, /sum\(l\.frozen_delta\) = -v_w\.settlement_amount/);
});
