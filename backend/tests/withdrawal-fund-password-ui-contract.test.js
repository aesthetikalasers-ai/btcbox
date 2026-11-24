'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const withdrawalView = fs.readFileSync(path.join(root, 'assets/js/views-assets.js'), 'utf8');
const accountView = fs.readFileSync(path.join(root, 'assets/js/views-account.js'), 'utf8');

test('fund-password setup and withdrawal UIs accept the exact backend policy', () => {
  assert.ok(api.includes('function validateFundPassword(pwd)'));
  assert.ok(api.includes('if (pwd.length < 8)'));
  assert.ok(api.includes('if (!/[A-Za-z]/.test(pwd) || !/\\d/.test(pwd))'));
  assert.ok(api.includes('if (/\\s/.test(pwd))'));

  assert.ok(withdrawalView.includes('Fund Password (at least 8 characters, letters and numbers)'));
  assert.ok(withdrawalView.includes('id="wd-fundpwd" class="auth-input" type="password" minlength="8" maxlength="128"'));
  assert.ok(withdrawalView.includes('if(fundPassword.length<8||!/[A-Za-z]/.test(fundPassword)||!/[0-9]/.test(fundPassword)||/\\s/.test(fundPassword))'));
  assert.ok(!withdrawalView.includes('Fund Password (6 digits)'));
  assert.ok(!withdrawalView.includes('id="wd-fundpwd" class="auth-input num" type="password" maxlength="6"'));
  assert.ok(!withdrawalView.includes("if(!/^\\d{6}$/.test($('#wd-fundpwd').value))"));

  assert.ok(accountView.includes('New Fund Password (at least 8 characters, letters and numbers)'));
  assert.ok(accountView.includes("id='fp-new' class='auth-input' type='password' minlength='8' maxlength='128'"));
  assert.ok(accountView.includes('newFundPassword.length<8||!/[A-Za-z]/.test(newFundPassword)||!/[0-9]/.test(newFundPassword)||/\\s/.test(newFundPassword)'));
  assert.ok(!accountView.includes('New Fund Password (6 digits)'));
  assert.ok(!accountView.includes("if(!/^\\d{6}$/.test($('#fp-new').value)"));
});

test('withdrawal intent keeps its original request ID and never persists security credentials', () => {
  assert.ok(withdrawalView.includes('request_id:uid(),coin,amount:amtRaw,address:addr,network:'));
  assert.ok(withdrawalView.includes('request_id:withdrawalIntent.request_id'));
  assert.ok(withdrawalView.includes('Persist the exact idempotency key + immutable intent before network I/O'));
  assert.ok(!/persistPendingWithdrawal\(\{[^}]*fund_password/.test(withdrawalView));
  assert.ok(!/persistPendingWithdrawal\(\{[^}]*twofa_code/.test(withdrawalView));
});
