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
const api = require(path.join(root, 'api-core.js'));
const redactAdminAuditDetail = api._test.redactAdminAuditDetail;

test('admin audit detail redaction masks quoted JSON secrets and personal identifiers', () => {
  const input = '{"password":"Super Secret Phrase","token":"abc123","id_number":"A1234567","email":"operator@example.com","wallet":"0x' + 'a'.repeat(40) + '"}';
  const output = redactAdminAuditDetail(input);
  assert.ok(output.includes('"password":"[redacted]"'));
  assert.ok(output.includes('"token":"[redacted]"'));
  assert.ok(output.includes('"id_number":"[redacted]"'));
  assert.ok(!output.includes('Super Secret Phrase'));
  assert.ok(!output.includes('abc123'));
  assert.ok(!output.includes('A1234567'));
  assert.ok(!output.includes('operator@example.com'));
  assert.ok(!output.includes('0x' + 'a'.repeat(40)));
  assert.ok(output.includes('[email]'));
  assert.ok(output.includes('[wallet address]'));
});

test('admin audit detail redaction also masks unquoted key-value secrets and TRON addresses', () => {
  const tron = 'T' + '1'.repeat(33);
  const output = redactAdminAuditDetail('private_key=priv-secret recovery_code: 123456 email admin@example.com wallet ' + tron);
  assert.ok(!output.includes('priv-secret'));
  assert.ok(!output.includes('123456'));
  assert.ok(!output.includes('admin@example.com'));
  assert.ok(!output.includes(tron));
  assert.ok(output.includes('private_key="[redacted]"'));
  assert.ok(output.includes('recovery_code: "[redacted]"'));
  assert.ok(output.includes('[email]'));
  assert.ok(output.includes('[wallet address]'));
});


test('admin audit detail redaction handles escaped quotes and plural credential fields', () => {
  const escaped = '{"password":"left ' + '\\' + '"quoted' + '\\' + '" tail","recovery_codes":"R1 R2","api_key":"key-123"}';
  const output = redactAdminAuditDetail(escaped);
  assert.ok(output.includes('"password":"[redacted]"'));
  assert.ok(output.includes('"recovery_codes":"[redacted]"'));
  assert.ok(output.includes('"api_key":"[redacted]"'));
  assert.ok(!output.includes('left '));
  assert.ok(!output.includes('quoted'));
  assert.ok(!output.includes('R1 R2'));
  assert.ok(!output.includes('key-123'));
});

test('dedicated /admin URL defaults to the admin route before SPA boot', () => {
  assert.ok(boot.includes("if(!location.hash) location.hash = /^\\/admin(?:\\.html)?\\/?$/.test(location.pathname) ? '#/admin' : '#/home';"));
  assert.ok(admin.includes('/assets/js/boot.js'));
});

test('admin route uses verified Supabase Auth identity and server-side role permissions without a customer cookie', () => {
  assert.ok(app.includes("const GUEST_PUBLIC_ROUTES = new Set(['home','markets','trade','tradehub','kline','seconds','help','404','admin']);"));
  assert.ok(app.includes("const HIDE_NAV = {login:true,register:true,kline:true,admin:true};"));
  assert.ok(app.includes("if(isAdmin && opts.adminAccessToken) headers['Authorization']='Bearer '+opts.adminAccessToken;"));
  assert.ok(app.includes('window.supabaseClient.auth.signInWithPassword'));
  assert.ok(app.includes('async function getAdminAccessToken()'));
  assert.ok(apiCore.includes("require('./admin-auth')"));
  assert.ok(apiCore.includes('verifySupabaseAccessToken'));
  assert.ok(apiCore.includes('admin_get_membership_v1'));
  assert.ok(apiCore.includes('hasAdminPermission'));
  assert.ok(apiCore.includes('ADMIN_PERMISSION_DENIED'));
  assert.ok(!apiCore.includes('WWW-Authenticate: Basic realm="BTCBOX Admin"'));
});


const accountView = fs.readFileSync(path.join(root, 'assets/js/views-account.js'), 'utf8');

test('admin console hydrates only supported read APIs and maps canonical user fields', () => {
  assert.ok(accountView.includes('Promise.allSettled([apiAdapter.adminUsers(),apiAdapter.adminWithdrawals(),apiAdapter.adminKyc()])'));
  assert.match(accountView, /kyc:u\.kyc_status\|\|'unverified'/);
  assert.match(accountView, /balances:\{USDT:Number\(u\.total_usdt\)\|\|0\}/);
  assert.match(accountView, /state\.admin\.withdrawals=results\[1\]\.value\.withdrawals/);
});

test('admin console supports manual credit by selected user and does not create pending deposit orders', () => {
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
  assert.ok(accountView.includes("escapeHtml(k.email||'—')"));
  assert.ok(accountView.includes("escapeHtml(k.submitted_at||'—')"));
  assert.ok(accountView.includes("当前版本的 KYC 申请不收集证件照片"));
  assert.ok(accountView.includes("不代表已完成证件影像或身份真实性核验"));
  assert.ok(accountView.includes('class="ak-approve"'));
  assert.ok(accountView.includes('class="ak-reject"'));
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
  assert.ok(apiCore.includes("redactAdminAuditDetail"));
  assert.ok(apiCore.includes("'[wallet address]'"));
  assert.ok(apiCore.includes("'[email]'"));
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

test('KYC rejection collects an operator-provided reason instead of recording a hardcoded reason', () => {
  assert.match(accountView, /function promptAdminReason\(title, summaryHTML\)/);
  assert.match(accountView, /驳回原因（必填）/);
  assert.match(accountView, /reason\.slice\(0,300\)/);
  assert.match(accountView, /adminRejectKyc\(\{uid:b\.dataset\.uid,reason:reason\}\)/);
  assert.doesNotMatch(accountView, /adminRejectKyc\(\{uid:b\.dataset\.uid,reason:'Document unclear'\}\)/);
});

test('KYC API adapter never invents a rejection reason when the operator supplies none', () => {
  assert.ok(app.includes("async adminRejectKyc(p){ return adminFetch('/admin/kyc/reject',{method:'POST',body:{uid:p.uid, reason:p.reason}}); }"));
  assert.doesNotMatch(app, /adminRejectKyc\(p\)[^\\n]*Rejected by admin/);
});

test('KYC approval and rejection persist reviewer, timestamp, decision reason, and audit outbox event', () => {
  const approveStart = apiCore.indexOf("if (sub === 'kyc/approve' && method === 'POST')");
  const rejectStart = apiCore.indexOf("if (sub === 'kyc/reject' && method === 'POST')", approveStart);
  const pushStart = apiCore.indexOf("// POST /api/admin/push", rejectStart);
  assert.ok(approveStart >= 0 && rejectStart > approveStart && pushStart > rejectStart);
  const approve = apiCore.slice(approveStart, rejectStart);
  const reject = apiCore.slice(rejectStart, pushStart);
  for (const route of [approve, reject]) {
    assert.ok(route.includes("u.kyc.reviewed_by = adminUserId"));
    assert.ok(route.includes("u.kyc.reviewed_at = nowStr()"));
    assert.ok(route.includes("await auditAdmin("));
    assert.ok(route.includes("await saveDB(db)"));
    assert.ok(route.includes("await flushAdminAuditOutbox()"));
    assert.ok(route.includes("audit_sync_pending: auditFlush.pending"));
  }
  assert.ok(approve.includes("u.kyc.review_reason = override ? reason"));
  assert.ok(reject.includes("u.kyc.reject_reason = reason"));
  assert.ok(reject.includes("await auditAdmin('kyc_reject', u.uid, reason, adminUserId)"));
});


test('admin console exposes authenticated editing for supported deposit addresses and announcement config', () => {
  assert.ok(accountView.includes('data-atab="config">系统配置</div>'));
  assert.ok(accountView.includes('apiAdapter.adminConfig()'));
  assert.ok(accountView.includes('apiAdapter.adminConfig(payload)'));
  assert.ok(accountView.includes('admin-config-save'));
  assert.ok(accountView.includes('escapeHtml(adminConfigData.deposit_addresses[item[0]]||\'\')'));
  assert.ok(accountView.includes('maxlength="2000"'));
  assert.ok(app.includes("async adminConfig(p){ if(p && typeof p==='object' && !(p instanceof Event)) return adminFetch('/admin/config',{method:'POST',body:p}); return adminFetch('/admin/config'); }"));
  const configStart = apiCore.indexOf("if (sub === 'config' && method === 'GET')");
  const configEnd = apiCore.indexOf("// GET /api/admin/withdrawals", configStart);
  assert.ok(configStart >= 0 && configEnd > configStart);
  const configRoute = apiCore.slice(configStart, configEnd);
  assert.ok(configRoute.includes('allowedDepositKeys'));
  assert.ok(configRoute.includes('Unsupported deposit network configuration found.'));
  assert.ok(configRoute.includes('Invalid deposit address format: '));
  assert.ok(configRoute.includes('announcement_updated'));
});


test('admin console exposes read-only order and support inbox views with escaped API fields', () => {
  assert.ok(accountView.includes('data-atab="orders">订单查询</div>'));
  assert.ok(accountView.includes('data-atab="support">客服消息</div>'));
  assert.ok(accountView.includes('apiAdapter.adminOrders()'));
  assert.ok(accountView.includes('apiAdapter.adminSupportMessages()'));
  assert.ok(accountView.includes("adminOrdersSource==='legacy_state'"));
  assert.ok(accountView.includes("escapeHtml(o.email||'—')"));
  assert.ok(accountView.includes("escapeHtml(m.content||'')"));
  assert.ok(accountView.includes('只读收件箱'));
  assert.ok(app.includes("async adminOrders(){ return adminFetch('/admin/orders'); }"));
  assert.ok(app.includes("async adminSupportMessages(){ return adminFetch('/admin/support/messages'); }"));
  const orderStart = apiCore.indexOf("if (sub === 'orders' && method === 'GET')");
  const supportStart = apiCore.indexOf("if (sub === 'support/messages' && method === 'GET')");
  assert.ok(orderStart >= 0 && supportStart > orderStart);
  assert.ok(apiCore.slice(orderStart, supportStart).includes("source: 'legacy_state'"));
  assert.ok(apiCore.slice(supportStart).includes('list.slice(0, 100)'));
});
