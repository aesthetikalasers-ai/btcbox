'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const apiTypes = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const snapshotSql = fs.readFileSync(path.join(root, 'supabase/sql/0011_financial_read_api_earn_v1.sql'), 'utf8');

test('admin user detail removes raw finance histories before permission-scoped projection', () => {
  const start = api.indexOf("if (sub === 'user' && method === 'GET')");
  const end = api.indexOf('// Stage the audit event', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  for (const field of ['deposits', 'withdrawals', 'earn_records', 'support_messages']) {
    assert.ok(route.includes('delete safeUser.' + field), field + ' must not leak through users.read');
  }
  assert.ok(route.includes("hasAdminPermission(adminMembership, 'deposits.read')"));
  assert.ok(route.includes('delete safeUser.balances'));
  assert.ok(route.includes('delete safeUser.financial_balance_source'));
  assert.ok(route.includes("hasAdminPermission(adminMembership, 'withdrawals.read')"));
});

test('canonical user detail reuses one PostgreSQL account snapshot and scopes each history by permission', () => {
  const start = api.indexOf("if (sub === 'user' && method === 'GET')");
  const end = api.indexOf('// Stage the audit event', start);
  const route = api.slice(start, end);
  assert.ok(route.includes('readFinancialAccountSnapshot(String(u.uid))'));
  assert.ok(route.includes('safeUser.balances = normalized.balances || {}'));
  assert.ok(route.includes("safeUser.financial_balance_source = 'postgres_financial_ledger'"));
  assert.ok(route.includes("safeUser.financial_balance_source = 'legacy_state_retention_limited'"));
  assert.ok(route.includes('safeUser.deposit_history = normalized.deposits.slice(0, 20)'));
  assert.ok(route.includes('safeUser.withdrawal_history = normalized.withdrawals.slice(0, 20)'));
  assert.ok(route.includes("safeUser.deposit_history_source = 'postgres_financial_ledger'"));
  assert.ok(route.includes("safeUser.withdrawal_history_source = 'postgres_financial_ledger'"));
  assert.ok(route.includes("safeUser.deposit_history_source = 'legacy_state_retention_limited'"));
  assert.ok(route.includes("safeUser.withdrawal_history_source = 'legacy_state_retention_limited'"));
  assert.ok(snapshotSql.includes("'deposits', v_deposits"));
  assert.ok(snapshotSql.includes("'withdrawals', v_withdrawals"));
});

test('admin UI displays deposit history source, amount, status, network, reference and timestamp', () => {
  assert.ok(apiTypes.includes('deposit_history?: DepositRecord[]'));
  assert.ok(apiTypes.includes('deposit_history_source?: "postgres_financial_ledger" | "legacy_state_retention_limited"'));
  assert.ok(admin.includes('hasPermission("deposits.read") ? <section'));
  assert.ok(admin.includes('Deposit history'));
  assert.ok(admin.includes('Balances: PostgreSQL ledger'));
  assert.ok(admin.includes('Balances: legacy state · limited'));
  assert.ok(admin.includes('Source: PostgreSQL ledger'));
  assert.ok(admin.includes('Source: legacy state · limited'));
  assert.ok(admin.includes('item.coin} · {item.network || "—"}'));
  assert.ok(admin.includes('item.reference || item.txid || "—"'));
  assert.ok(admin.includes('formatDate(item.time, numberLocale)'));
});

test('deposit history UI never exposes it to a user without deposits.read', () => {
  const start = admin.indexOf('hasPermission("deposits.read") ? <section');
  const end = admin.indexOf('</section> : null}', start);
  assert.ok(start >= 0 && end > start);
  const panel = admin.slice(start, end);
  assert.ok(panel.includes('selectedUser.deposit_history'));
  assert.ok(panel.includes('Source: PostgreSQL ledger'));
});

test('admin user detail never exposes Supabase Auth UUIDs or linked provider identity records', () => {
  const start = api.indexOf("if (sub === 'user' && method === 'GET')");
  const end = api.indexOf('// Stage the audit event', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  for (const field of ['supabase_user_id', 'supabase_user_ids', 'auth_identities', 'auth_providers']) {
    assert.ok(route.includes('delete safeUser.' + field), field + ' must not leak through users.read');
  }
  assert.ok(!admin.includes('selectedUser.supabase_user_id'));
  assert.ok(!admin.includes('selectedUser.supabase_user_ids'));
  assert.ok(!admin.includes('selectedUser.auth_identities'));
});

test('account balances and their source are withheld unless the caller has deposits.read', () => {
  const start = api.indexOf("if (sub === 'user' && method === 'GET')");
  const end = api.indexOf('// Stage the audit event', start);
  const route = api.slice(start, end);
  assert.match(route, /if \(canReadDeposits\)\s*\{\s*safeUser\.balances = normalized\.balances \|\| \{\};\s*safeUser\.financial_balance_source = 'postgres_financial_ledger';/);
  assert.match(route, /if \(canReadDeposits\)\s*\{\s*safeUser\.financial_balance_source = 'legacy_state_retention_limited';\s*safeUser\.balances = u\.balances \|\| \{\};/);
  assert.ok(!route.includes('safeUser.balances = normalized.balances || {};\n          safeUser.financial_balance_source'));
  assert.ok(admin.includes('Balance details require the deposits.read permission.'));
  assert.match(admin, /hasPermission\("deposits.read"\) \? <Badge/);
});

test('admin user search only returns financial balance aggregates to financial_audit.read', () => {
  const start = api.indexOf("if (sub === 'users' && method === 'GET')");
  const end = api.indexOf("// GET /api/admin/kyc", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("hasAdminPermission(adminMembership, 'financial_audit.read')"));
  assert.ok(route.includes('if (canReadFinancialAudit && financialPostgresReadsEnabled())'));
  assert.ok(route.includes('if (canReadFinancialAudit) {'));
  assert.ok(route.includes('record.total_usdt = totalUsdt(balances, livePriceCache.prices)'));
  assert.ok(!route.includes('return { uid: u.uid, email: u.email || \'\', admin_auth_user_id:'));
});
