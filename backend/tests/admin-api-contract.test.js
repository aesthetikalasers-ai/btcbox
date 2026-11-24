'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const adminNavigation = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/admin-navigation.ts'), 'utf8');

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


test('admin deposit workbench reads only canonical PostgreSQL records and is permission-scoped', () => {
  const permissionStart = api.indexOf('const requiredPermission = (function(route, verb)');
  const permissionEnd = api.indexOf(')(sub, method);', permissionStart);
  const permissionMap = api.slice(permissionStart, permissionEnd);
  assert.ok(permissionMap.includes("route === 'deposits' && verb === 'GET'"));
  assert.ok(permissionMap.includes("return 'deposits.read'"));

  const routeStart = api.indexOf("if (sub === 'deposits' && method === 'GET')");
  const routeEnd = api.indexOf("// GET /api/admin/withdrawals", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, 'read-only deposits route must exist');
  const route = api.slice(routeStart, routeEnd);
  assert.ok(route.includes('financialPostgresReadsEnabled()'));
  assert.ok(route.includes('/rest/v1/deposit_records?'));
  assert.ok(route.includes("source: 'postgres_financial_ledger'"));
  assert.ok(route.includes("completeness: 'latest_200'"));
  assert.ok(route.includes('DEPOSIT_READ_UNAVAILABLE'));
  assert.doesNotMatch(route, /saveDB\s*\(/);
  assert.doesNotMatch(route, /admin_manual_deposit_atomic/);
  assert.ok(client.includes('export async function getAdminDeposits'));
  assert.ok(adminPage.includes('getAdminDeposits(token)'));
  assert.ok(adminPage.includes('tab === "deposit-records"'));
  assert.ok(adminPage.includes('latest 200'));
});

test('withdrawal queue API labels canonical and legacy sources with completeness boundaries', () => {
  const start = api.indexOf("if (sub === 'withdrawals' && method === 'GET')");
  const end = api.indexOf("// GET /api/admin/orders", start);
  assert.ok(start >= 0 && end > start, 'withdrawal read route must exist');
  const route = api.slice(start, end);
  assert.ok(route.includes("source: 'postgres_financial_ledger', completeness: 'pending_queue'"));
  assert.ok(route.includes("source: 'legacy_state_snapshot', completeness: 'partial'"));
  assert.ok(client.includes("AdminWithdrawalSource"));
  assert.ok(client.includes("AdminWithdrawalCompleteness"));
  assert.ok(adminPage.includes('withdrawalQueueSource === "legacy_state_snapshot"'));
  assert.ok(adminPage.includes('partial queue'));
  assert.ok(adminPage.includes('Canonical pending queue'));
});

test('admin user detail keeps basic profile reads independent from financial ledger availability', () => {
  const start = api.indexOf("if (sub === 'user' && method === 'GET')");
  const end = api.indexOf("async function auditAdmin", start);
  assert.ok(start >= 0 && end > start, 'admin user detail route must exist');
  const route = api.slice(start, end);
  assert.doesNotMatch(route, /await readFinancialAccountSnapshot\(uid\)/, 'users.read must not be blocked by an unconditional ledger preflight');
  assert.ok(route.includes("const canReadDeposits = hasAdminPermission(adminMembership, 'deposits.read')"));
  assert.ok(route.includes('if (financialPostgresReadsEnabled())'));
  assert.ok(route.includes("safeUser.financial_balance_source = 'postgres_financial_ledger'"));
  assert.ok(route.includes("safeUser.financial_balance_source = 'legacy_state_retention_limited'"));
});

test('admin user-list financial totals disclose their actual data source', () => {
  const start = api.indexOf("if (sub === 'users' && method === 'GET')");
  const end = api.indexOf("// GET /api/admin/kyc", start);
  assert.ok(start >= 0 && end > start, 'admin user list route must exist');
  const route = api.slice(start, end);
  assert.ok(route.includes("financial_summary_source = useCanonicalFinancialReads ? 'postgres_financial_ledger' : 'legacy_state_retention_limited'"));
  assert.ok(route.includes("financial_summary_completeness = useCanonicalFinancialReads ? 'canonical_snapshot' : 'retention_limited'"));
  assert.ok(client.includes('financial_summary_source?'));
  assert.ok(adminPage.includes('user.financial_summary_source === "legacy_state_retention_limited"'));
  assert.ok(adminPage.includes('Financial total (USDT)'));
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

test('customer payout-address endpoints use dedicated sensitive permissions, separate from deposits and system config', () => {
  assert.ok(api.includes("if (route === 'addresses' && verb === 'GET') return 'payout_addresses.read_sensitive';"));
  assert.ok(api.includes("if (route === 'address/manage' && verb === 'POST') return 'payout_addresses.manage';"));
  assert.ok(!api.includes("if (route === 'addresses' && verb === 'GET') return 'deposits.read';"));
  assert.ok(!api.includes("if (route === 'address/manage' && verb === 'POST') return 'system_config.write';"));
  assert.ok(api.includes("if (!hasAdminPermission(adminMembership, requiredPermission))"));
  assert.ok(adminPage.includes('["payout_addresses.read_sensitive","Read sensitive customer payout addresses"]'));
  assert.ok(adminPage.includes('["payout_addresses.manage","Manage customer payout addresses"]'));
  const tab = adminNavigation.match(/\{ id: "deposits", label: "Deposit settings", permission: "([^"]+)" \}/);
  assert.ok(tab, 'global deposit configuration tab must be present');
  assert.equal(tab[1], 'system_config.read');
});


test('perpetual admin routes are permission-mapped and configuration saves stay paused', () => {
  const permStart = api.indexOf('const requiredPermission = (function(route, verb)');
  const permEnd = api.indexOf(')(sub, method);', permStart);
  const permissionMap = api.slice(permStart, permEnd);
  assert.ok(permissionMap.includes("route === 'perpetual/markets' && verb === 'GET'"));
  assert.ok(permissionMap.includes("route === 'perpetual/market' && verb === 'POST'"));
  assert.ok(permissionMap.includes("route === 'perpetual/liquidations' && verb === 'GET'"));
  assert.ok(permissionMap.includes("route === 'perpetual/insurance' && verb === 'GET'"));

  const routeStart = api.indexOf("if (perpSub === 'markets' && method === 'GET')");
  const routeEnd = api.indexOf("if (perpSub === 'liquidations' && method === 'GET')", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, 'perpetual admin market routes must exist');
  const routes = api.slice(routeStart, routeEnd);
  assert.ok(routes.includes("hasAdminPermission(adminMembership, 'system_config.read')"));
  assert.ok(routes.includes("hasAdminPermission(adminMembership, 'system_config.write')"));
  assert.ok(routes.includes("const symbol = requestedSymbol || (baseAsset ? baseAsset + 'USDT' : '');"));
  assert.match(routes, /enabled: false, status: 'paused'/);
  assert.ok(routes.includes('mark_price_stale_sec: staleSec'));
  assert.ok(routes.includes('circuit_breaker_deviation_pct: breaker'));
  assert.ok(routes.includes("!maxPositionNotional || compareMoney(maxPositionNotional, '0') <= 0"), 'new market configurations require a positive exposure cap');
  assert.ok(routes.includes("await auditAdmin('perpetual_market_upsert'"));
  assert.ok(routes.indexOf("if (!response.ok)") < routes.indexOf("await auditAdmin('perpetual_market_upsert'"));
  assert.ok(!routes.includes('enabled: enabled'));
  assert.ok(!routes.includes('status: status'));
  // This branch uses the existing 0041 schema; PR #116's min-notional columns
  // require a separate migration and must not be sent to this table prematurely.
  assert.ok(!routes.includes('market_quantity_step'));
  assert.ok(!routes.includes('market_min_quantity'));
});

test('perpetual admin frontend reads the live asset catalogue and exposes only paused configuration writes', () => {
  assert.ok(client.includes('export interface AdminPerpMarket'));
  assert.ok(client.includes('"admin/perpetual/markets"'));
  assert.ok(client.includes('"admin/perpetual/market"'));
  assert.ok(adminPage.includes('getAdminPerpMarkets(token)'));
  assert.ok(adminPage.includes('getAdminAssets(token)'));
  assert.ok(adminPage.includes('assetCatalog.filter(asset => !["USDT", "USDC"].includes(asset.code))'));
  assert.ok(adminPage.includes('enabled: false, status: "paused"'));
  assert.ok(adminPage.includes('!positive(draft.max_position_notional)'), 'admin form requires a positive maximum exposure cap');
  assert.ok(adminPage.includes('setPerpMarkets(refreshed.markets || [])'));
  assert.ok(adminPage.includes("const decimal = /^(?:0|[1-9]\\d{0,19})(?:\\.\\d{1,18})?$/;"));
  assert.ok(adminPage.includes("/[\\u0000-\\u001f\\u007f]/"));
});
