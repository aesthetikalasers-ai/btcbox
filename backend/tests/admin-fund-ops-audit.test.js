'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sqlManualDeposit = fs.readFileSync(path.join(root, 'supabase/sql/0007_financial_admin_manual_deposit_v1.sql'), 'utf8');
const sqlWithdrawalReview = fs.readFileSync(path.join(root, 'supabase/sql/0022_withdrawal_admin_review_status_v1.sql'), 'utf8');
const sqlWithdrawalApproveNoBurn = fs.readFileSync(path.join(root, 'supabase/sql/0039_withdrawal_approve_no_burn_v1.sql'), 'utf8');

function sliceRoute(marker, endMarker) {
  const start = api.indexOf(marker);
  const end = api.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, marker + ' route must exist');
  return api.slice(start, end);
}

test('manual deposit credit is atomic, idempotent and audited with actor/amount/reason/reference', () => {
  const route = sliceRoute("if (sub === 'deposit/confirm' && method === 'POST')", "// POST /api/admin/withdraw/approve");
  // Cutover gate: no legacy fallback.
  assert.ok(route.includes('financialWritesEnabled()'));
  assert.ok(route.includes('FINANCIAL_CUTOVER_INCOMPLETE'));
  // Idempotency: client request key + server-side hash over actor/user/asset/amount/reference/note.
  assert.ok(route.includes('idempotency_key'));
  assert.ok(route.includes('[A-Za-z0-9_-]{16,100}') && route.includes('.test(idempotencyKey)'));
  assert.ok(route.includes('requestHash'));
  assert.ok(route.includes('crypto.createHash(\'sha256\')'));
  // Atomic ledger RPC, no direct balance mutation.
  assert.ok(route.includes('admin_manual_deposit_atomic'));
  assert.ok(route.includes('IDEMPOTENCY_CONFLICT'));
  assert.ok(route.includes('duplicate'));
  assert.ok(!route.includes('u.balances'));
  // SQL audit insert records actor, subject, amount, asset, reference, operation id and idempotency key.
  assert.ok(sqlManualDeposit.includes("insert into public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)"));
  assert.ok(sqlManualDeposit.includes('admin_manual_deposit_confirmed'));
  assert.ok(sqlManualDeposit.includes("'amount', p_amount"));
  assert.ok(sqlManualDeposit.includes("'reference', v_reference"));
  assert.ok(sqlManualDeposit.includes("'idempotency_key'"));
  assert.ok(sqlManualDeposit.includes('confirmed_by = p_admin_id'));
});

test('withdrawal approve/reject/mark-paid are atomic RPCs with duplicate protection and canonical audit', () => {
  const approve = sliceRoute("if (sub === 'withdraw/approve' && method === 'POST')", "if (sub === 'withdraw/reject' && method === 'POST')");
  const reject = sliceRoute("if (sub === 'withdraw/reject' && method === 'POST')", "// POST /api/admin/withdraw/mark-paid");
  const markPaid = sliceRoute("if (sub === 'withdraw/mark-paid' && method === 'POST')", "if (sub === 'kyc/approve' && method === 'POST')");
  for (const [name, route] of [['approve', approve], ['reject', reject], ['mark-paid', markPaid]]) {
    assert.ok(route.includes('financialWritesEnabled()'), name + ' must enforce cutover gate');
    assert.ok(route.includes('supabaseStorageConfigured()'), name + ' must require configured financial RPC');
    assert.ok(route.includes('ADMIN_ACTOR_NOT_CONFIGURED'), name + ' must require actor identity');
    assert.ok(route.includes('duplicate'), name + ' must surface duplicate detection');
    assert.ok(!route.includes('u.withdrawals') && !route.includes('user.balances'), name + ' must not mutate legacy state directly');
  }
  assert.ok(approve.includes('review_withdrawal_atomic'));
  assert.ok(reject.includes('review_withdrawal_atomic'));
  assert.ok(markPaid.includes('mark_withdrawal_paid_atomic'));
  assert.ok(approve.includes('WITHDRAWAL_ALREADY_PROCESSED'));
  assert.ok(reject.includes('WITHDRAWAL_ALREADY_PROCESSED'));
  // review_withdrawal_atomic writes a canonical audit row with actor, subject, amount, asset, reason.
  assert.ok(sqlWithdrawalReview.includes('create or replace function public.review_withdrawal_atomic('));
  assert.ok(sqlWithdrawalReview.includes("insert into public.financial_audit_log ("));
  assert.ok(sqlWithdrawalReview.includes("p_admin_id, v_w.user_id, 'withdrawal_' || v_status"));
  assert.ok(sqlWithdrawalReview.includes("'asset', v_w.asset"));
  assert.ok(sqlWithdrawalReview.includes("'amount', v_w.amount"));
  assert.ok(sqlWithdrawalReview.includes('reviewed_by = p_admin_id'));
  // Reject requires an admin-supplied reason; approve carries a recorded reason too.
  assert.ok(reject.includes('p_reason: reason'));
  assert.ok(approve.includes('p_reason:'));
  // The final migration overrides the original review RPC: approval must leave the
  // reserved amount frozen, while rejection releases it. Payout is a separate debit.
  assert.match(sqlWithdrawalApproveNoBurn, /if p_approve then[\s\S]*?v_operation_id := null;[\s\S]*?else[\s\S]*?public\.apply_financial_operation/i);
  assert.match(sqlWithdrawalApproveNoBurn, /'withdraw_reject'[\s\S]*?v_w\.amount \+ v_w\.fee[\s\S]*?-\(v_w\.amount \+ v_w\.fee\)/);
  assert.match(sqlWithdrawalApproveNoBurn, /set status = v_status[\s\S]*reviewed_by = p_admin_id/i);
  assert.match(sqlWithdrawalApproveNoBurn, /operation_type in[\s\S]*?'withdraw_paid'/i);
  assert.match(sqlWithdrawalApproveNoBurn, /'withdraw_paid'[\s\S]*?-(v_w\.amount \+ v_w\.fee)/);
  assert.match(sqlWithdrawalApproveNoBurn, /payout_operation_id=v_operation_id/);
  assert.match(sqlWithdrawalApproveNoBurn, /'withdrawal_manual_payout_completed'/);
});

test('account freeze/unfreeze is state-guarded, audited and never double-applied', () => {
  const route = sliceRoute("if (sub === 'user/freeze' && method === 'POST')", "// POST /api/admin/user/reset-pwd");
  // State guard: already-frozen or already-active returns 409, no mutation.
  assert.ok(route.includes('ACCOUNT_STATE_UNCHANGED'));
  assert.ok(route.includes("!!u.frozen === frozen"));
  // Reason required for both directions.
  assert.ok(route.includes('ADMIN_REASON_REQUIRED'));
  // Audit event with action, target, reason, actor, then durable save.
  assert.ok(route.includes("auditAdmin(frozen ? 'user_freeze' : 'user_unfreeze'"));
  assert.ok(route.includes('await saveDB(db)'));
  assert.ok(route.includes('flushAdminAuditOutbox()'));
  // No fund balance mutation here; account freeze is a login/withdrawal flag only.
  assert.ok(!route.includes('balances'));
});

test('direct administrator balance adjustment remains disabled pending maker-checker', () => {
  const afterPermission = api.indexOf("if (sub === 'user/balance' && method === 'POST') {\n      return json({ ok: false, code: 'FINANCIAL_ADJUSTMENT_APPROVAL_REQUIRED'");
  assert.ok(afterPermission >= 0, 'direct balance adjustment must be closed before the handler body');
  assert.ok(api.includes('dual-approval adjustment queue'));
});

test('canonical financial_audit_log has indexes matching the admin audit-logs query access paths', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/sql/0032_admin_audit_log_filter_indexes_v1.sql'), 'utf8');
  // GET /api/admin/audit-logs filters by action=eq / subject_user_id=eq and
  // orders by id.desc; these indexes cover both filtered access paths.
  assert.ok(migration.includes('financial_audit_action_id_desc_idx'));
  assert.ok(migration.includes('financial_audit_subject_id_desc_idx'));
  assert.ok(migration.includes('action, id desc'));
  assert.ok(migration.includes('subject_user_id, id desc'));
  assert.ok(migration.includes('create index if not exists'));
  // Existing subject+created_at index is retained (no drop).
  const base = fs.readFileSync(path.join(root, 'supabase/sql/0002_financial_ledger_v1.sql'), 'utf8');
  assert.ok(base.includes('financial_audit_subject_time_idx'));
});
