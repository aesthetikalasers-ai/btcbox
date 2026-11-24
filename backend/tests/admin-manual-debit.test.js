'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0045_admin_manual_debit_negative_balance_v1.sql'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const panel = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/ManualDebitPanel.tsx'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('manual debit accepts signed available deltas without an operator reason field', () => {
  const start = api.indexOf("if (sub === 'user/balance' && method === 'POST')");
  const end = api.indexOf('// POST /api/admin/user/freeze', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("deltaInput.startsWith('-')"));
  assert.ok(route.includes("const isManualDebit = mode === 'adjust' && deltaNegative"));
  assert.ok(route.includes("const reason = isManualDebit ? 'admin_manual_debit'"));
  assert.ok(route.includes('admin_adjustment_atomic'));
  assert.ok(route.includes('p_reason: reason'));
  assert.ok(route.includes("if (!isManualDebit && reason.length < 5)"));
});

test('admin balance reads preserve negative available balances while frozen balances stay non-negative', () => {
  const start = api.indexOf('async function readAdminAccountBalances');
  const end = api.indexOf('async function ', start + 30);
  assert.ok(start >= 0 && end > start);
  const reader = api.slice(start, end);
  assert.ok(reader.includes('Number.isFinite(b.free)'));
  assert.ok(reader.includes('b.frozen < 0'));
  assert.ok(!reader.includes('b.free < 0'));
});

test('negative available balance is narrowly enabled for marked manual debit only', () => {
  assert.ok(migration.includes('DROP CONSTRAINT IF EXISTS financial_accounts_available_check'));
  assert.ok(migration.includes('DROP CONSTRAINT IF EXISTS financial_ledger_available_after_check'));
  assert.ok(migration.includes("p_operation_type = 'admin_adjustment'"));
  assert.ok(migration.includes("p_metadata->>'reason' = 'admin_manual_debit'"));
  assert.ok(migration.includes('p_frozen_delta = 0'));
  assert.ok(migration.includes("p_operation_type = 'deposit_credit'"));
  assert.ok(migration.includes('v_frozen + p_frozen_delta < 0'));
});

test('manual debit UI has no reason field and uses a stable idempotency key', () => {
  assert.ok(panel.includes('adminAdjustUserBalance'));
  assert.ok(panel.includes('window.localStorage.setItem'));
  assert.ok(panel.includes('window.crypto.randomUUID()'));
  assert.ok(panel.includes('request_id: nextRequestId'));
  assert.ok(panel.includes('delta: "-" + normalizedAmount'));
  assert.ok(!panel.includes('reason:'));
  assert.ok(adminPage.includes('ManualDebitPanel'));
  assert.ok(adminPage.includes('financial_adjustment.request'));
  assert.ok(client.includes('admin/user/balance'));
});
