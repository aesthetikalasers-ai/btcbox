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
  assert.doesNotMatch(fn, /apply_financial_operation|financial_ledger|financial_accounts|withdraw_paid/i);
  assert.match(fn, /v_w\.status <> 'approved'/);
  assert.match(fn, /status = 'completed'/);
  assert.match(fn, /payout_reference = v_ref/);
  assert.match(fn, /paid_by = p_admin_id/);
  assert.match(fn, /'withdrawal_manual_payout_completed'/);
});

test('API uses admin-internal payout reference wording', () => {
  assert.ok(api.includes("msg: 'Internal payout reference is required.'"));
  assert.ok(!api.includes("msg: 'TxID / payout reference is required.'"));
});
