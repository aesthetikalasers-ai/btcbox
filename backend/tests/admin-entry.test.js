'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const boot = fs.readFileSync(path.join(root, 'assets/js/boot.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'assets/js/app-core.js'), 'utf8');
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
  assert.match(accountView, /Promise\.allSettled\(\[apiAdapter\.adminUsers\(\),apiAdapter\.adminWithdrawals\(\)\]\)/);
  assert.match(accountView, /kyc:u\.kyc_status\|\|'unverified'/);
  assert.match(accountView, /balances:\{USDT:Number\(u\.total_usdt\)\|\|0\}/);
  assert.match(accountView, /state\.admin\.withdrawals=results\[1\]\.value\.withdrawals/);
});

test('admin console includes admin-review withdrawals and does not expose unsupported deposit or KYC queues', () => {
  assert.match(accountView, /w\.status==='pending'\|\|w\.status==='pending_admin_review'/);
  assert.match(accountView, /尚无管理员充值列表读取接口/);
  assert.match(accountView, /尚无完整的管理员 KYC 申请读取接口/);
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
