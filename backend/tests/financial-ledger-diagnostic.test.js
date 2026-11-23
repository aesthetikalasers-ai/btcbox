'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('0044 restores the complete withdrawal, Spot, Seconds and Perpetual operation type union', () => {
  const migration = read('supabase/sql/0044_withdrawal_operation_type_compatibility_v1.sql');
  for (const operationType of [
    'withdraw_settle', 'withdraw_paid', 'withdraw_freeze', 'withdraw_approve',
    'withdraw_reject', 'spot_trade', 'spot_order_reserve', 'spot_order_cancel',
    'seconds_open', 'seconds_settle', 'perp_order_reserve', 'perp_trade',
    'perp_order_cancel', 'perp_funding', 'perp_liquidation',
    'perp_insurance_cover', 'perp_bad_debt',
  ]) assert.ok(migration.includes("'" + operationType + "'"), 'missing operation type: ' + operationType);
  assert.match(migration, /drop constraint if exists financial_operations_operation_type_check/i);
  assert.match(migration, /add constraint financial_operations_operation_type_check/i);
  assert.match(migration, /position\('withdraw_settle' in v_definition\)/i);
  assert.match(migration, /position\('withdraw_paid' in v_definition\)/i);
  assert.match(migration, /add column if not exists payout_operation_id/i);
  assert.match(migration, /v_operation_id := v_w\.freeze_operation_id/i);
  assert.match(migration, /review_operation_id=v_operation_id/i);
  assert.match(migration, /payout_operation_id=v_operation_id/i);
  assert.match(migration, /create or replace function public\.review_withdrawal_atomic/i);
  assert.match(migration, /create or replace function public\.mark_withdrawal_paid_atomic/i);
  const migrationDdlOnly = migration.replace(/\$\$[\s\S]*?\$\$/g, '');
  assert.doesNotMatch(migrationDdlOnly, /\b(update|delete|insert)\s+into\s+public\.(financial_accounts|financial_ledger|financial_operations|withdrawal_requests)/i);
});

test('withdrawal review approval links the original freeze and payout records its operation ID', () => {
  const migration = read('supabase/sql/0039_withdrawal_approve_no_burn_v1.sql');
  assert.match(migration, /v_operation_id\s*:=\s*v_w\.freeze_operation_id/i);
  assert.match(migration, /review_operation_id\s*=\s*v_operation_id/i);
  assert.match(migration, /payout_operation_id\s*=\s*v_operation_id/i);
  assert.match(migration, /'withdraw_paid'/i);
});

test('withdrawal compatibility preflight is read-only and inspects both legacy and canonical operation types', () => {
  const preflight = read('supabase/diagnostics/withdrawal-settle-compatibility-preflight.sql');
  assert.match(preflight, /operation_type in \('withdraw_settle','withdraw_paid'\)/i);
  assert.match(preflight, /metadata_withdrawal_id/i);
  assert.match(preflight, /completed_without_linked_payout_operation/i);
  assert.doesNotMatch(preflight, /^\s*(insert|update|delete|alter|drop|create|truncate)\b/im);
});

test('Spot fill creates four reconciled ledger legs for two users and two assets', () => {
  const sql = read('supabase/sql/0008_financial_matching_engine_v1.sql');
  assert.match(sql, /insert into public\.financial_ledger\(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after\) values\s*\([\s\S]*?v_fill_id,v_buyer,p_base_asset[\s\S]*?v_fill_id,v_buyer,p_quote_asset[\s\S]*?v_fill_id,v_seller,p_base_asset[\s\S]*?v_fill_id,v_seller,p_quote_asset/i);
  const diagnostic = read('supabase/diagnostics/financial-ledger-integrity.sql');
  assert.match(diagnostic, /spot_trade_four_leg_mismatch/i);
  assert.match(diagnostic, /s\.ledger_rows<>4/i);
  assert.match(diagnostic, /s\.ledger_users<>2/i);
  assert.match(diagnostic, /s\.ledger_assets<>2/i);
  assert.match(diagnostic, /s\.base_net_delta<>0/i);
  assert.match(diagnostic, /s\.quote_net_delta<>0/i);
  assert.doesNotMatch(diagnostic, /having count\(l\.id\) <> 1/i);
});

test('diagnostic SQL remains read-only and checks withdrawal freeze, review and payout linkage', () => {
  const diagnostic = read('supabase/diagnostics/financial-ledger-integrity.sql');
  assert.match(diagnostic, /approved_withdrawal_review_not_original_freeze/i);
  assert.match(diagnostic, /completed_withdrawal_missing_payout_operation/i);
  assert.match(diagnostic, /completed_withdrawal_payout_operation_mismatch/i);
  assert.doesNotMatch(diagnostic, /^\s*(insert|update|delete|alter|drop|create|truncate)\b/im);
});
