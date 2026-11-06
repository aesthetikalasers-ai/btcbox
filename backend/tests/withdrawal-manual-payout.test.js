'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase', 'sql', '0027_withdrawal_manual_payout_completion_v1.sql'), 'utf8');

test('manual payout API rejects a missing TxID/reference and enforces bounded input', () => {
  assert.ok(api.includes("if (!reference) return json({ ok: false, code: 'PAYOUT_REFERENCE_REQUIRED'"));
  assert.ok(api.includes('reference.length > 160 || note.length > 300'));
  assert.ok(api.includes("PAYOUT_REFERENCE_INVALID"));
  assert.ok(api.includes("/[\\u0000-\\u001f\\u007f]/.test(reference)"));
  assert.ok(api.includes("sub === 'withdraw/mark-paid'"));
});

test('manual payout completion requires the financial cutover and configured service RPC', () => {
  assert.ok(api.includes("if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE'"));
  assert.ok(api.includes("mark_withdrawal_paid_atomic"));
  assert.ok(api.includes("p_reference: reference"));
});

test('database RPC independently rejects blank references and permits only approved withdrawals', () => {
  assert.ok(sql.includes("coalesce(btrim(p_reference),'')=''"));
  assert.ok(sql.includes("coalesce(p_reference,'') ~ '[[:cntrl:]]'"));
  assert.ok(sql.includes("IF v_w.status<>'approved' THEN"));
  assert.ok(sql.includes("withdrawal must be approved before manual payout completion"));
});

test('manual payout exact retries are idempotent and conflicting references fail', () => {
  assert.ok(sql.includes("IF v_w.status='completed' THEN"));
  assert.ok(sql.includes("coalesce(v_w.payout_reference,'')<>v_ref"));
  assert.ok(sql.includes("'duplicate',true"));
});

test('manual payout completion is audit/status-only and does not apply another ledger debit', () => {
  assert.ok(sql.includes("'withdrawal_manual_payout_completed'"));
  assert.ok(sql.includes('payout_reference',));
  assert.ok(!sql.includes('apply_financial_operation'));
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.mark_withdrawal_paid_atomic'));
  assert.ok(sql.includes('TO service_role'));
});


test('React withdrawal intent persists only non-secret request fields and retries with the same ID', () => {
  const pages = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/pages/Pages.tsx'), 'utf8');
  assert.ok(pages.includes('btcbox.withdraw.pending.v1.'));
  const intentStart = pages.indexOf('intent={version:1,request_id:window.crypto.randomUUID()');
  const intentEnd = pages.indexOf('};', intentStart);
  assert.ok(intentStart >= 0 && intentEnd > intentStart);
  const intent = pages.slice(intentStart, intentEnd);
  for (const field of ['request_id','address_id','coin','network','amount','address','created_at']) assert.ok(intent.includes(field));
  assert.ok(!intent.includes('fund_password') && !intent.includes('twofa_code'));
  assert.ok(pages.includes('window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent))'));
  assert.ok(pages.includes('request_id:intent.request_id'));
  assert.ok(pages.indexOf('window.localStorage.setItem(pendingStorageKey,JSON.stringify(intent))') < pages.indexOf('await submitWithdrawal({'));
  assert.ok(pages.includes('The withdrawal response arrived, but account history has not confirmed it.'));
  assert.ok(pages.includes('Re-enter your fund password and 2FA code'));
  assert.ok(pages.includes('reason.status!==409'));
});


test('admin withdrawal mutations preserve confirmed UI state when queue refresh fails', () => {
  const pages = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
  const start = pages.indexOf('const refreshWithdrawalQueue = async (confirmedAction: string)');
  const end = pages.indexOf('const replySupport = async', start);
  assert.ok(start >= 0 && end > start);
  const handlers = pages.slice(start, end);
  assert.match(handlers, /setWithdrawals\(current => current\.map\(item => item\.id === id \? \{ \.\.\.item, status: "approved" \} : item\)\);[\s\S]*?await refreshWithdrawalQueue\("Withdrawal approval confirmed\."\)/);
  assert.match(handlers, /setWithdrawals\(current => current\.filter\(item => item\.id !== id\)\);[\s\S]*?await refreshWithdrawalQueue\("Withdrawal rejection and refund confirmed\."\)/);
  assert.match(handlers, /setNotice\(result\.duplicate[\s\S]*?await refreshWithdrawalQueue\("Manual payout completion confirmed\."\)/);
  assert.match(handlers, /The database action is confirmed; the queue could not refresh/);
});
