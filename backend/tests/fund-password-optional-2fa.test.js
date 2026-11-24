const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const api = fs.readFileSync(path.join(root, 'backend/api-core.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'frontend/src/features/account/FundPasswordPage.tsx'), 'utf8');

test('fund-password changes do not require 2FA; use password or recent OAuth sign-in proof', () => {
  const start = api.indexOf("if (path === 'settings/fundpwd' && method === 'POST')");
  const end = api.indexOf("// ---------- POST /api/settings/2fa", start);
  assert.ok(start >= 0 && end > start, 'fund-password route exists');
  const route = api.slice(start, end);
  assert.match(route, /hasLocalPassword/);
  assert.match(route, /verifyBtcboxLoginPassword\(user, currentPassword\)/);
  assert.match(route, /RECENT_REAUTH_REQUIRED/);
  assert.match(route, /5 \* 60 \* 1000/);
  assert.doesNotMatch(route, /TWOFA_REQUIRED|TWOFA_INVALID|twofa_code|user\.twofa_enabled/);
  assert.match(api, /fundpwd_reauth_mode: user\.login_password_hash && user\.login_password_salt \? 'password' : 'recent_signin'/);
});

test('fund-password page does not gate OAuth users or render a mandatory authenticator field', () => {
  assert.match(page, /const requiresCurrentPassword = account\?\.has_login_password !== false/);
  assert.match(page, /requiresCurrentPassword && <label/);
  assert.doesNotMatch(page, /requiresTwoFactor|twoFactorCode|Authenticator code|enable two-factor authentication before setting/i);
});

test('withdrawal only requests a 2FA code when the account has voluntarily enabled it', () => {
  const pages = fs.readFileSync(path.join(root, 'frontend/src/features/pages/Pages.tsx'), 'utf8');
  assert.match(pages, /\(\!account\?\.twofa_enabled\|\|\/\^\\d\{6\}\$\/\.test\(twofaCode\)\)/);
  assert.match(pages, /account\?\.twofa_enabled\?<label[\s\S]*Two-factor code/);
  const start = api.indexOf("if (path === 'withdraw' && method === 'POST')");
  assert.ok(start >= 0, 'withdrawal API route exists');
  const route = api.slice(start, start + 14000);
  assert.match(route, /if \(user\.twofa_enabled && !\/\^\\d\{6\}\$\//);
});
