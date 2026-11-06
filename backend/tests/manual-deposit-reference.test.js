const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('manual deposit credit requires an auditable transaction reference server-side', () => {
  const backend = read('backend/api-core.js');
  const start = backend.indexOf("if (sub === 'deposit/confirm' && method === 'POST')");
  const end = backend.indexOf("// POST /api/admin/withdraw/approve", start);
  assert.ok(start >= 0 && end > start);
  const block = backend.slice(start, end);
  assert.ok(block.includes("const reference = String(body.reference || '').trim()"));
  assert.ok(block.includes("if (!reference || reference.length > 160"));
  assert.ok(block.includes("code: 'DEPOSIT_REFERENCE_REQUIRED'"));
  assert.ok(block.includes("p_reference: reference"));
  assert.ok(block.includes("p_request_hash: requestHash"));
  assert.ok(block.includes("admin_manual_deposit_atomic"));
});

test('admin manual credit UI and API require the same reference field', () => {
  const admin = read('frontend/src/features/admin/AdminPage.tsx');
  const api = read('frontend/src/lib/api.ts');
  assert.ok(admin.includes('Required TxID / receipt reference'));
  assert.ok(admin.includes('required maxLength={160}'));
  assert.ok(admin.includes('Enter the verified transaction hash or receipt reference before crediting.'));
  assert.ok(admin.includes('reference,'));
  assert.ok(api.includes('reference: string; note?: string; idempotency_key: string'));
});


test('manual deposit SQL preserves the full 160-character UI/API reference limit', () => {
  const sql = read('backend/supabase/sql/0007_financial_admin_manual_deposit_v1.sql');
  assert.ok(sql.includes("v_reference text := left(btrim(coalesce(p_reference, '')), 160)"));
  assert.ok(!sql.includes("v_reference text := left(btrim(coalesce(p_reference, '')), 120)"));
});

test('financial account snapshot reads normalized deposit history instead of legacy deposits', () => {
  const backend = read('backend/api-core.js');
  const sql = read('backend/supabase/sql/0011_financial_read_api_earn_v1.sql');
  const snapshot = backend.slice(backend.indexOf('async function readFinancialAccountSnapshot'), backend.indexOf('async function readSpotMarketCatalog'));
  assert.ok(snapshot.includes('Array.isArray(result.deposits)'));
  const accountStart = backend.indexOf("if (path === 'account' && method === 'GET')");
  const accountEnd = backend.indexOf("// ---------- GET /api/addresses", accountStart);
  const account = backend.slice(accountStart, accountEnd);
  assert.ok(account.includes('deposits: financialSnapshot ? financialSnapshot.deposits : user.deposits.slice(-20)'));
  assert.ok(sql.includes('from public.deposit_records'));
  assert.ok(sql.includes("'deposits', v_deposits"));
  assert.ok(sql.includes("'reference', coalesce(reference, '')"));
});
