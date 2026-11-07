'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('KYC submission validates legal name, supported document type and document number on the server', () => {
  assert.ok(api.includes('function validateKycSubmission(body)'));
  assert.ok(api.includes("['passport', 'id_card', 'driver_license'].includes(idType)"));
  assert.ok(api.includes("if (path === 'kyc' && method === 'POST')"));
  assert.ok(api.includes("status: 'pending'"));
  assert.ok(api.includes('await saveDB(db)'));
});

test('KYC frontend submits authenticated data and refreshes the account status', () => {
  assert.ok(client.includes('export async function submitKyc(input:'));
  assert.ok(client.includes('${API_BASE_URL}/kyc'));
  assert.ok(pages.includes('export function KycPage()'));
  assert.ok(pages.includes('await submitKyc({name:cleanName,id_type:idType,id_number:cleanId,...image})'));
  assert.ok(pages.includes('setReload(value=>value+1)'));
  assert.ok(!pages.includes('Submission is not enabled in this frontend build.'));
});

test('administrator KYC review remains permission-gated and exposes approve/reject actions', () => {
  assert.ok(api.includes("route === 'kyc' && verb === 'GET'"));
  assert.ok(api.includes("route === 'kyc/approve' || route === 'kyc/reject'"));
  assert.ok(client.includes('adminApproveKyc'));
  assert.ok(client.includes('adminRejectKyc'));
  assert.ok(admin.includes('adminApproveKyc('));
  assert.ok(admin.includes('adminRejectKyc('));
});


test('deposit address lookup requires authentication and user-supplied amounts never create credit requests', () => {
  const start = api.indexOf("if (path === 'deposit' && method === 'POST')");
  const end = api.indexOf("if (path === 'withdrawal/config'", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("need_login: true }, 401"));
  assert.ok(route.includes('User-submitted deposit amounts are not accepted'));
  const adminCreditStart = api.indexOf("if (sub === 'deposit/confirm' && method === 'POST')");
  const adminCreditEnd = api.indexOf("if (sub === 'withdraw/approve'", adminCreditStart);
  const adminCredit = api.slice(adminCreditStart, adminCreditEnd);
  assert.ok(adminCredit.includes('parseMoneyInput(body.amount)'));
  assert.ok(adminCredit.includes("compareMoney(amountText, '1000000000000')"));
  assert.ok(!adminCredit.includes('Number(body.amount)'));
  assert.ok(route.includes('Deposit address.'));
  assert.ok(!route.includes('apply_financial_operation'));
});


test('ordinary account responses expose only a masked KYC document number', () => {
  assert.ok(api.includes('function maskIdentityNumber(value)'));
  assert.ok(api.includes('id_number: maskIdentityNumber(user.kyc && user.kyc.id_number)'));
  assert.ok(api.includes('Full KYC identifiers remain server-side and are never serialized to the user API.'));
});

test('administrator KYC queue returns a strict review-safe allowlist, never the full identity number', () => {
  const start = api.indexOf("if (sub === 'kyc' && method === 'GET')");
  const end = api.indexOf("// GET /api/admin/user?uid=", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  for (const field of ['uid:', 'email:', 'name:', 'id_type:', 'status: normalizeKycStatus(u.kyc.status)', 'submitted_at:', 'document_url,', 'document_preview_error,', 'document_uploaded:']) {
    assert.ok(route.includes(field), 'KYC review response must include ' + field);
  }
  // The review queue must include every in-review alias, not only exact 'pending',
  // otherwise legacy 'processing' / 'under_review' records are invisible to reviewers
  // while the customer-side submission guard blocks resubmission (stuck state).
  assert.ok(route.includes('isKycInReview(u.kyc.status)'));
  assert.ok(!route.includes("u.kyc.status === 'pending'"));
  assert.ok(!route.includes('id_number:'));
  assert.ok(!route.includes('password_hash'));
  assert.ok(!route.includes('twofa_secret'));
  assert.ok(route.includes('slice(0, 200)'));
});

test('KYC document previews are private, owner-scoped and short-lived', () => {
  assert.ok(api.includes("const KYC_STORAGE_BUCKET = 'kyc-documents'"));
  assert.ok(api.includes('function isOwnedKycDocumentPath(path, userId)'));
  assert.ok(api.includes('parts.length === 2 && parts[0] === userId'));
  assert.ok(api.includes('method: \'POST\''));
  assert.ok(api.includes('JSON.stringify({ expiresIn: 300 })'));
  assert.ok(api.includes("signedUrl.origin !== new URL(base).origin"));
});

test('administrator cannot approve KYC without an uploaded, reviewable document preview', () => {
  const start = admin.indexOf('{!loading && tab === "kyc"');
  const end = admin.indexOf('{!loading && tab === "audit"', start);
  assert.ok(start >= 0 && end > start, 'KYC queue must render');
  const queue = admin.slice(start, end);
  assert.match(queue, /disabled=\{busy\|\|!hasPermission\("kyc\.review"\)\|\|!item\.document_uploaded\|\|!item\.document_url\|\|!!item\.document_preview_error\}/);
  assert.ok(queue.includes('Identity document upload is required before approval.'));
  assert.ok(queue.includes('Document preview unavailable; refresh the queue before approval.'));
  // Rejection remains available to authorized reviewers even when evidence is missing.
  assert.match(queue, /variant="outline" disabled=\{busy\|\|!hasPermission\("kyc\.review"\)\} onClick=\{\(\)=>void reviewKyc\(item\.uid,false\)\}/);
});

test('confirmed KYC review is not reported as failed when the pending queue refresh fails', () => {
  const start = admin.indexOf('const reviewKyc = async (uid: string, approved: boolean)');
  const end = admin.indexOf('const replySupport = async', start);
  assert.ok(start >= 0 && end > start);
  const handler = admin.slice(start, end);
  assert.match(handler, /await adminApproveKyc[\s\S]*?setKyc\(current => current\.filter\(item => item\.uid !== uid\)\)/);
  assert.match(handler, /KYC review is confirmed; the queue could not refresh/);
  assert.match(handler, /catch \(reason\) \{[\s\S]*?KYC review was not confirmed/);
});


test('administrator rejection uses the centered in-app dialog, never a browser prompt', () => {
  assert.ok(admin.includes('setReviewDialog({ kind: "kyc", uid })'));
  assert.ok(admin.includes('setReviewDialog({ kind: "withdrawal", id })'));
  assert.ok(admin.includes('role="dialog"'));
  assert.ok(admin.includes('aria-modal="true"'));
  assert.ok(admin.includes('await adminRejectKyc(token, target.uid, reasonText)'));
  assert.ok(admin.includes('await adminRejectWithdrawal(token, target.id, reasonText)'));
  assert.ok(!admin.includes('window.prompt('));
  assert.ok(!admin.includes('window.confirm('));
  assert.ok(!admin.includes('window.alert('));
});


test('KYC resubmission is blocked for all in-review and approved status aliases, but allowed after rejection', () => {
  const { kycSubmissionBlock } = require('../api-core')._test;
  for (const status of ['pending', 'processing', 'under_review', ' APPROVED ', 'verified']) {
    const result = kycSubmissionBlock(status);
    assert.ok(result, 'submission must be blocked for ' + status);
    assert.equal(result.code, ['approved', 'verified'].includes(status.trim().toLowerCase()) ? 'KYC_ALREADY_APPROVED' : 'KYC_ALREADY_PENDING');
  }
  for (const status of ['rejected', 'failed', 'not_submitted', '', null, undefined]) {
    assert.equal(kycSubmissionBlock(status), null, 'resubmission should remain available for ' + status);
  }
});

test('KYC status aliases are normalized consistently across submission guard, review queue and approval gate', () => {
  const { normalizeKycStatus, isKycInReview, isKycApproved, KYC_IN_REVIEW_STATUSES, KYC_APPROVED_STATUSES } = require('../api-core')._test;
  assert.deepEqual(KYC_IN_REVIEW_STATUSES, ['pending', 'processing', 'under_review']);
  assert.deepEqual(KYC_APPROVED_STATUSES, ['approved', 'verified']);
  assert.equal(normalizeKycStatus('  PROCESSING '), 'processing');
  assert.equal(normalizeKycStatus(undefined), '');
  for (const s of ['pending', 'Processing', ' UNDER_REVIEW ', 'processing']) {
    assert.ok(isKycInReview(s), s + ' must be treated as in-review');
    assert.ok(!isKycApproved(s), s + ' must not be treated as approved');
  }
  for (const s of ['approved', 'Verified', ' APPROVED']) {
    assert.ok(isKycApproved(s), s + ' must be treated as approved');
    assert.ok(!isKycInReview(s), s + ' must not be treated as in-review');
  }
  for (const s of ['rejected', 'failed', 'not_submitted', '', null, undefined]) {
    assert.ok(!isKycInReview(s), s + ' must not be in-review');
    assert.ok(!isKycApproved(s), s + ' must not be approved');
  }
});

test('KYC approval accepts every in-review alias without the admin-exception override', () => {
  const start = api.indexOf("if (sub === 'kyc/approve' && method === 'POST')");
  const end = api.indexOf("// POST /api/admin/kyc/reject", start);
  assert.ok(start >= 0 && end > start, 'kyc/approve route must exist');
  const route = api.slice(start, end);
  // The non-override approval gate must use the alias-aware in-review predicate,
  // not an exact 'pending' string match, so legacy 'processing'/'under_review'
  // applications can be approved directly once they are visible in the queue.
  assert.ok(route.includes('!isKycInReview(status) && !override'));
  assert.ok(route.includes('isKycInReview(status) && !u.kyc.document_path && !override'));
  assert.ok(!route.includes("status !== 'pending' && !override"));
  assert.ok(route.includes('normalizeKycStatus(u.kyc.status)'));
  // Override still requires a reason.
  assert.ok(route.includes('ADMIN_REASON_REQUIRED'));
});

test('account kyc_level reflects approved and in-review status aliases, not only exact strings', () => {
  assert.ok(api.includes('kyc_level: user.kyc && isKycApproved(user.kyc.status) ? 2 : (user.kyc && isKycInReview(user.kyc.status) ? 1 : 0)'));
});

test('no new KYC RBAC permission was invented; only the existing kyc.read and kyc.review permissions gate KYC routes', () => {
  const start = api.indexOf('const requiredPermission = (function(route, verb)');
  const end = api.indexOf(')(sub, method);', start);
  assert.ok(start >= 0 && end > start);
  const mapping = api.slice(start, end);
  const kycPerms = mapping.match(/'kyc\.[a-z.]+'/g) || [];
  assert.deepEqual([...new Set(kycPerms)].sort(), ["'kyc.read'", "'kyc.review'"]);
  // The admin user-detail projection must continue to strip KYC evidence for
  // callers who only hold users.read; full KYC identity data is never serialized
  // through the generic user-detail route.
  const detailStart = api.indexOf("// GET /api/admin/user?uid=");
  const detailEnd = api.indexOf("// Stage the audit event", detailStart);
  const detailRoute = api.slice(detailStart, detailEnd);
  assert.ok(detailRoute.includes("safeUser.kyc = { status: String(u.kyc && u.kyc.status || 'unsubmitted') }"));
  assert.ok(detailRoute.includes('KYC evidence and full identity numbers require the separate kyc.read permission'));
});
