'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const withdrawalView = fs.readFileSync(path.join(root, 'assets/js/views-assets.js'), 'utf8');

test('withdrawal fund-password UI accepts the exact backend policy', () => {
  assert.match(api, /function validateFundPassword\(pwd\)[\s\S]*?pwd\.length < 8[\s\S]*?!\/[A-Za-z]\/\.test\(pwd\)[\s\S]*?!\/\\d\/\.test\(pwd\)[\s\S]*?\/\\s\/\.test\(pwd\)/);
  assert.match(withdrawalView, /Fund Password \(at least 8 characters, letters and numbers\)/);
  assert.match(withdrawalView, /id="wd-fundpwd"[^>]*minlength="8" maxlength="128"/);
  assert.match(withdrawalView, /fundPassword\.length<8\|\|!\/[A-Za-z]\/\.test\(fundPassword\)\|\|!\/[0-9]\/\.test\(fundPassword\)\|\|\/\\s\/\.test\(fundPassword\)/);
  assert.doesNotMatch(withdrawalView, /Fund Password \(6 digits\)|wd-fundpwd[^\n]*maxlength="6"|wd-fundpwd'\)\.value\)\)/);
});

test('withdrawal intent keeps its original request ID and never persists security credentials', () => {
  assert.match(withdrawalView, /request_id:uid\(\),coin,amount:amtRaw,address:addr,network:/);
  assert.match(withdrawalView, /request_id:withdrawalIntent\.request_id/);
  assert.match(withdrawalView, /Persist the exact idempotency key \+ immutable intent before network I\/O/);
  assert.doesNotMatch(withdrawalView, /persistPendingWithdrawal\(\{[^}]*fund_password|persistPendingWithdrawal\(\{[^}]*twofa_code/);
});
