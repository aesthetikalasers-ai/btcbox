'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const apiTypes = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');
const withdrawalSql = fs.readFileSync(path.join(root, 'supabase/sql/0029_withdrawal_fee_quote_idempotency_v1.sql'), 'utf8');

test('withdrawal fees are configurable in admin and the same server values are used for user quote and debit', () => {
  assert.match(api, /const DEFAULT_WITHDRAWAL_FEES = Object\.freeze\(\{[\s\S]*?USDT: '1'[\s\S]*?BTC: '0\.0001'[\s\S]*?USDC: '1'/);
  assert.ok(api.includes('fees: safeWithdrawalFees(db.withdrawal_fees)'));
  assert.ok(api.includes('const supportedFees = safeWithdrawalFees(db.withdrawal_fees)'));
  assert.ok(api.includes('const fee = supportedFees[coin]'));
  assert.ok(api.includes('body.expected_fee === undefined ? fee : parseMoneyInput(body.expected_fee)'));
  assert.ok(api.includes('p_expected_fee: String(expectedFee)'));
  assert.ok(api.includes('WITHDRAWAL_FEE_CHANGED'));
  assert.ok(pages.includes('expected_fee:String(config?.fees[intent.coin] ?? "")'));
  assert.ok(pages.includes('reason.code==="WITHDRAWAL_FEE_CHANGED"'));
  const duplicateAt = withdrawalSql.indexOf('if found then');
  const quoteCheckAt = withdrawalSql.indexOf('if p_expected_fee is distinct from p_fee then');
  assert.ok(duplicateAt >= 0 && quoteCheckAt > duplicateAt, 'idempotent replay must be checked before the current fee quote');
  assert.ok(withdrawalSql.includes("'fee', v_existing.fee"));
  assert.ok(!withdrawalSql.includes('v_existing.fee is distinct from p_fee'));
  assert.ok(!withdrawalSql.includes('v_existing.require_admin_review is distinct from p_require_admin_review'));
  assert.ok(api.includes("[String(user.uid), coin, network, String(amount), addr, requestId].join('|')"),
    'request hash must bind caller intent, not a mutable server fee');
  assert.ok(!api.includes('const supportedFees = { USDT: 1.0'));
});

test('admin fee writes validate supported assets and decimal amounts before audited persistence', () => {
  const start = api.indexOf("if (sub === 'config' && method === 'POST')");
  const end = api.indexOf("if (sub === 'withdrawals' && method === 'GET')", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  for (const contract of [
    'body.withdrawal_fees', 'DEFAULT_WITHDRAWAL_FEES', 'parseMoneyInput',
    'compareMoney(value, \'1000000000000\')', 'changedFeeKeys',
    "auditAdmin('system_config_update'", 'await saveDB(db)'
  ]) assert.ok(route.includes(contract), 'missing configurable fee persistence contract: ' + contract);
  assert.ok(api.includes('withdrawal_fees: safeWithdrawalFees(db.withdrawal_fees)'));
});

test('admin UI exposes editable fee inputs for every supported withdrawal asset', () => {
  assert.match(apiTypes, /export interface AdminConfig \{[\s\S]*?withdrawal_fees: Record<string, string>/);
  for (const coin of ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC']) {
    assert.ok(admin.includes(coin), 'missing admin fee asset ' + coin);
  }
  assert.ok(admin.includes('config.withdrawal_fees?.[coin]'));
  assert.ok(admin.includes('withdrawal_fees:{...current.withdrawal_fees,[coin]:event.target.value}'));
  assert.ok(admin.includes('saveAdminConfig(token, config)'));
});
