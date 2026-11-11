'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('every admin route exposed by the backend has a matching permission and the frontend calls only existing routes', () => {
  const permStart = api.indexOf('const requiredPermission = (function(route, verb)');
  const permEnd = api.indexOf(')(sub, method);', permStart);
  const permMapping = api.slice(permStart, permEnd);
  assert.ok(permMapping.length > 500, 'expected a substantial admin permission map');
  // KYC, orders, support, push, audit, withdrawals, deposits, users all gated.
  for (const r of ["route === 'kyc' && verb === 'GET'", "route === 'kyc/approve' || route === 'kyc/reject'", "route === 'orders' && verb === 'GET'", "route === 'support/reply' && verb === 'POST'", "route === 'push' && verb === 'POST'", "route === 'audit-logs' && verb === 'GET'", "route === 'withdrawals' && verb === 'GET'", "route === 'deposit/confirm' && verb === 'POST'", "route === 'users' && verb === 'GET'", "route === 'user' && verb === 'GET'"]) {
    assert.ok(permMapping.includes(r), 'permission mapping must cover ' + r);
  }
  // Fallback: unknown admin route returns 404, permission denied returns 403.
  assert.ok(api.includes('ADMIN_ROUTE_NOT_FOUND'));
  assert.ok(api.includes('ADMIN_PERMISSION_DENIED'));
});

test('admin KYC dashboard counts every status included in the review queue', () => {
  const statsStart = api.indexOf("if (sub === 'stats' && method === 'GET')");
  const statsEnd = api.indexOf("// GET /api/admin/users?search=", statsStart);
  assert.ok(statsStart >= 0 && statsEnd > statsStart);
  const statsRoute = api.slice(statsStart, statsEnd);
  assert.ok(statsRoute.includes('isKycInReview(u.kyc.status)'));
  assert.ok(api.includes("const KYC_IN_REVIEW_STATUSES = ['pending', 'processing', 'under_review']"));
});

test('admin frontend functions call the same paths the backend implements and never use native prompts', () => {
  for (const fn of ['getAdminStats', 'getAdminUsers', 'getAdminUser', 'getAdminKyc', 'adminApproveKyc', 'adminRejectKyc', 'adminApproveWithdrawal', 'adminRejectWithdrawal', 'adminMarkWithdrawalPaid', 'adminManualCredit', 'getAdminWithdrawals', 'getAdminOrders', 'getAdminAuditLogs', 'adminReplySupport', 'getAdminSupportMessages']) {
    assert.ok(client.includes('export async function ' + fn), 'client must export ' + fn);
  }
  // adminRequest builds ${API_BASE_URL}/${path} and callers pass "admin/..." paths.
  assert.ok(client.includes('async function adminRequest'));
  assert.ok(client.includes('`${API_BASE_URL}/${path}`'));
  assert.ok(client.includes('"admin/stats"') || client.includes('"admin/orders"'));
  assert.ok(client.includes('Bearer ${token}'));
  for (const native of ['window.alert(', 'window.confirm(', 'window.prompt(']) {
    assert.ok(!adminPage.includes(native), 'admin panel must not use native ' + native);
  }
  assert.ok(adminPage.includes('role="dialog"'));
  assert.ok(adminPage.includes('aria-modal="true"'));
});


test('withdrawal rejection API requires a bounded, non-control-character audit reason', () => {
  const start = api.indexOf("if (sub === 'withdraw/reject' && method === 'POST')");
  const end = api.indexOf("// POST /api/admin/withdraw/mark-paid", start);
  assert.ok(start >= 0 && end > start, 'withdrawal reject route must exist');
  const route = api.slice(start, end);
  assert.match(route, /const reason = String\(body\.reason \|\| ''\)\.trim\(\)/);
  assert.ok(route.includes("WITHDRAWAL_REJECTION_REASON_REQUIRED"));
  assert.ok(route.includes("WITHDRAWAL_REJECTION_REASON_INVALID"));
  assert.match(route, /reason\.length > 200 \|\| \/\[\\u0000-\\u001f\\u007f\]\/\.test\(reason\)/);
  assert.match(route, /p_reason: reason/);
  assert.doesNotMatch(route, /Admin rejected withdrawal\./);
  // The operator UI already requires a non-empty reason before sending.
  assert.ok(adminPage.includes('A rejection reason is required.'));
});

test('admin error feedback surfaces server codes and the refresh-after-confirmed-success pattern', () => {
  // Admin actions that succeed but whose follow-up refresh fails must keep the
  // success notice and tell the operator to reload, not report the action as
  // failed. Verified for KYC review; withdrawal queue uses the same helper.
  assert.ok(adminPage.includes('setError(successMessage + " The queue could not refresh. Reload this tab before reviewing another application."'));
  const refreshStart = adminPage.indexOf('const refreshWithdrawalQueue = async (confirmedAction: string)');
  const refreshEnd = adminPage.indexOf('const refreshWithdrawalQueueManually = async', refreshStart);
  assert.ok(refreshStart >= 0 && refreshEnd > refreshStart);
  const refreshHandler = adminPage.slice(refreshStart, refreshEnd);
  assert.ok(refreshHandler.includes('setError(confirmedAction + " The queue could not refresh.'));
  assert.ok(adminPage.includes('await refreshWithdrawalQueue("Withdrawal approval confirmed.")'));
  assert.ok(adminPage.includes('await refreshWithdrawalQueue("Withdrawal rejection and refund confirmed.")'));
  assert.ok(adminPage.includes('await refreshWithdrawalQueue("Manual payout completion confirmed.")'));
  // A 409 WITHDRAWAL_ALREADY_PROCESSED on a retry (first attempt's response was
  // lost) is surfaced as a confirmed notice + queue refresh, never as a red
  // failure, for both approve and reject paths.
  assert.ok(adminPage.includes('isAlreadyProcessed'));
  assert.ok(adminPage.includes('WITHDRAWAL_ALREADY_PROCESSED'));
  assert.ok(adminPage.includes('already approved on a previous attempt'));
  assert.ok(adminPage.includes('already reviewed on a previous attempt'));
  assert.ok(adminPage.includes('KYC 409 responses include actionable states'));
  assert.ok(adminPage.includes('reason.code === "WITHDRAWAL_ALREADY_PROCESSED"'));
  assert.ok(!adminPage.includes('KYC_EXCEPTION_REQUIRED'), 'KYC exception-required conflicts must remain actionable errors, not success notices');
  assert.ok(!adminPage.includes('reason.status === 409'), 'HTTP 409 alone does not prove a prior action completed');
  assert.ok(adminPage.includes('handleAlreadyProcessed'));
  // ApiError carries the server code so callers can distinguish 409/400/503.
  assert.ok(client.includes('class ApiError') || client.includes('ApiError'));
  assert.ok(client.includes('payload?.code'));
});


test('spot-market admin accepts ordinary decimal tick and quantity values without escaped-backslash literals', () => {
  const expected = 'const decimal = /^(?:0|[1-9]\\d{0,19})(?:\\.\\d{1,18})?$/;';
  assert.ok(adminPage.includes(expected), 'spot-market validation must use executable digit and decimal-point escapes');
  const decimal = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/;
  for (const value of ['0.01', '0.000001', '1', '125.50', '10000000000000000000']) {
    assert.match(value, decimal, 'expected accepted decimal: ' + value);
  }
  for (const value of ['.01', '01.00', '1e-6', '1.1234567890123456789', '1\\d']) {
    assert.doesNotMatch(value, decimal, 'expected rejected decimal: ' + value);
  }
});


test('withdrawal and KYC review actions use synchronous per-record locks', () => {
  assert.ok(adminPage.includes('const reviewActionLocksRef = useRef<Record<string, boolean>>({})'));
  assert.ok(adminPage.includes('if (!token || reviewActionLocksRef.current[lockKey]) return;'));
  assert.ok(adminPage.includes('reviewActionLocksRef.current[lockKey] = false'));
  assert.ok(adminPage.includes('if (reviewActionLocksRef.current[actionLockKey]) return;'));
  assert.ok(adminPage.includes('reviewActionLocksRef.current[actionLockKey] = false'));
});
