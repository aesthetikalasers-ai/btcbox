'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0054_admin_manual_debit_negative_balance_v1.sql'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'scripts/bootstrap-empty-database.sh'), 'utf8');
const dockerInit = fs.readFileSync(path.join(root, 'scripts/docker-init-migrations.sh'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');

test('manual debit is explicitly marked and does not require a typed reason', () => {
  const start = api.indexOf("if (sub === 'user/balance' && method === 'POST')");
  const end = api.indexOf('// POST /api/admin/user/freeze', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("const isManualDebit = mode === 'adjust' && deltaNegative"));
  assert.ok(route.includes("const reason = isManualDebit ? 'admin_manual_debit'"));
  assert.ok(route.includes("if (!isManualDebit && reason.length < 5)"));
  assert.ok(route.includes('admin_adjustment_atomic'));
  assert.ok(route.includes('p_reason: reason'));
});

test('admin account reads retain negative available balances but reject negative frozen balances', () => {
  const start = api.indexOf('async function readAdminAccountBalances');
  const end = api.indexOf('async function ', start + 30);
  assert.ok(start >= 0 && end > start);
  const reader = api.slice(start, end);
  assert.ok(reader.includes('Number.isFinite(b.free)'));
  assert.ok(reader.includes('Number.isFinite(b.frozen)'));
  assert.ok(!reader.includes('b.free < 0'));
  assert.ok(reader.includes('b.frozen < 0'));
});

test('negative available balance is narrowly guarded by the manual-debit marker', () => {
  assert.ok(migration.startsWith('-- 0054_admin_manual_debit_negative_balance_v1.sql'));
  assert.ok(migration.includes('DROP CONSTRAINT IF EXISTS financial_accounts_available_check'));
  assert.ok(migration.includes('DROP CONSTRAINT IF EXISTS financial_ledger_available_after_check'));
  assert.ok(migration.includes("p_metadata->>'reason' = 'admin_manual_debit'"));
  assert.ok(migration.includes("p_operation_type = 'deposit_credit'"));
  assert.ok(migration.includes('p_frozen_delta = 0'));
  assert.ok(migration.includes('v_frozen + p_frozen_delta < 0'));
  assert.ok(migration.includes("set_config('btcbox.financial_operation_id'"));
  assert.ok(migration.includes('financial_accounts_negative_balance_guard'));
  assert.ok(migration.includes('financial_ledger_negative_balance_guard'));
  assert.ok(migration.includes('v_deposit_offset := OLD.available < 0 AND NEW.available > OLD.available'));
  assert.equal((migration.match(/AS \$\$/g) || []).length, 3);
  assert.equal((migration.match(/^\$\$;$/gm) || []).length, 3);
});

test('fresh database bootstrap scripts preserve the current migration sequence and match exactly', () => {
  const files = (source) => {
    const match = source.match(/FILES=\(\n([\s\S]*?)\n\)/);
    assert.ok(match, 'migration allowlist must exist');
    return [...match[1].matchAll(/^\s+([0-9]{4}_[^\s]+)$/gm)].map(item => item[1]);
  };
  const bootstrapFiles = files(bootstrap);
  const dockerFiles = files(dockerInit);
  assert.deepEqual(dockerFiles, bootstrapFiles);
  assert.ok(bootstrapFiles.includes('0053_perpetual_two_source_live_mark_v1.sql'));
  assert.equal(bootstrapFiles.at(-1), '0054_admin_manual_debit_negative_balance_v1.sql');
});

test('the existing admin adjustment UI submits debit as a signed idempotent ledger operation', () => {
  assert.ok(adminPage.includes('adjustMode === "debit" ? "-" + amount : amount'));
  assert.ok(adminPage.includes('window.crypto.randomUUID()'));
  assert.ok(adminPage.includes('window.localStorage.setItem(storageKey'));
  assert.ok(adminPage.includes('adminAdjustBalance(token'));
  assert.ok(client.includes('"admin/user/balance"'));
});
