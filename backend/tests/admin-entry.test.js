'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const boot = fs.readFileSync(path.join(root, 'assets/js/boot.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app-core.js'), 'utf8');
const apiCore = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');

test('dedicated /admin URL defaults to the admin route before SPA boot', () => {
  assert.ok(boot.includes("if(!location.hash) location.hash = /^\\/admin(?:\\.html)?\\/?$/.test(location.pathname) ? '#/admin' : '#/home';"));
  assert.ok(admin.includes('/assets/js/boot.js'));
});

test('admin route is reachable without a customer session but still uses Basic Auth APIs', () => {
  assert.ok(app.includes("const GUEST_PUBLIC_ROUTES = new Set(['home','markets','trade','tradehub','kline','seconds','help','404','admin']);"));
  assert.ok(app.includes("const HIDE_NAV = {login:true,register:true,kline:true,admin:true};"));
  assert.ok(app.includes("if(isAdmin && state.adminAuth) headers['Authorization']='Basic '+state.adminAuth;"));
});


const accountView = fs.readFileSync(path.join(root, 'assets/js/views-account.js'), 'utf8');

test('admin console hydrates only supported read APIs and maps canonical user fields', () => {
  assert.ok(accountView.includes('Promise.allSettled([apiAdapter.adminUsers(),apiAdapter.adminWithdrawals(),apiAdapter.adminKyc()])'));
  assert.match(accountView, /kyc:u\.kyc_status\|\|'unverified'/);
  assert.match(accountView, /balances:\{USDT:Number\(u\.total_usdt\)\|\|0\}/);
  assert.match(accountView, /state\.admin\.withdrawals=results\[1\]\.value\.withdrawals/);
});

test('admin console includes admin-review withdrawals and keeps unsupported deposit queue disabled', () => {
  assert.match(accountView, /w\\.status==='pending'\\|\\|w\\.status==='pending_admin_review'/);
  assert.match(accountView, /尚无管理员充值列表读取接口/);
});

test('KYC queue is read through a redacted admin endpoint and rendered from API data', () => {
  const kycRoute = apiCore.slice(apiCore.indexOf("sub === 'kyc' && method === 'GET'"), apiCore.indexOf("// GET /api/admin/user?uid="));
  assert.ok(kycRoute.includes("id_type: String(u.kyc.id_type || '')"));
  assert.ok(kycRoute.includes("submitted_at: String(u.kyc.submitted_at || '')"));
  assert.doesNotMatch(kycRoute, /id_number|password_hash|twofa_secret|recovery_codes/);
  assert.ok(app.includes("async adminKyc(){ return adminFetch('/admin/kyc'); }"));
  assert.ok(accountView.includes("apiAdapter.adminKyc()"));
  assert.ok(accountView.includes("state.admin.kycs=results[2].value.kycs"));
  assert.ok(!accountView.includes("KYC 审核暂不可用"));
});

test('admin audit history is paginated, field-allowlisted, and rendered with escaped content', () => {
  const start = apiCore.indexOf("if (sub === 'audit-logs' && method === 'GET')");
  const end = apiCore.indexOf("// GET /api/admin/config", start);
  assert.ok(start >= 0 && end > start);
  const route = apiCore.slice(start, end);
  assert.ok(route.includes("source: 'btcbox_state'"));
  assert.ok(route.includes("completeness: 'state_document_retention_limited'"));
  assert.ok(route.includes("AUDIT_CURSOR_NOT_FOUND"));
  assert.ok(route.includes("postgres_sync_status"));
  assert.ok(route.includes("[wallet address]"));
  assert.ok(app.includes("adminAuditLogs(params)"));
  assert.ok(accountView.includes('data-atab="audit"'));
  assert.ok(accountView.includes("apiAdapter.adminAuditLogs("));
  assert.ok(accountView.includes("escapeHtml(entry.detail||'—')"));
  assert.ok(accountView.includes("audit-more"));
  assert.ok(accountView.includes("PostgreSQL 完整财务审计历史"));
});

test('admin console warns when business state is saved but audit delivery is pending', () => {
  assert.match(accountView, /result\.audit_sync_pending===true/);
  assert.match(accountView, /审计日志仍待同步。请勿重复执行该操作/);
});

test('admin data failures can be retried from any admin tab without parallel duplicate loads', () => {
  assert.match(accountView, /var adminDataLoading=false;/);
  assert.match(accountView, /if\(adminDataLoading\) return;/);
  assert.match(accountView, /if\(adminDataErrors\.length\)loadAdminData\(\)/);
});
