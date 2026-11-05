'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');

test('TOTP verifier returns a matched time-step and validates six-digit input', () => {
  assert.ok(source.includes('function totpMatchStep(secret, code)'));
  assert.ok(source.includes("if (typeof code !== 'string' || !/^\\d{6}$/.test(code)) return null;"));
  assert.ok(source.includes('if (expected === code) return step;'));
});

test('TOTP consumption rejects a previously consumed step and stores the new counter', () => {
  assert.ok(source.includes('function consumeTotpStep(user, code)'));
  assert.ok(source.includes('const previous = user.twofa_last_used_step;'));
  assert.ok(source.includes('step <= previous'));
  assert.ok(source.includes('user.twofa_last_used_step = step;'));
});

test('protected routes consume one-time steps instead of accepting boolean verification', () => {
  assert.equal(source.includes('!totpVerify('), false);
  assert.ok((source.match(/consumeTotpStep\\(/g) || []).length >= 9);
});

test('withdrawal persists the consumed TOTP step before financial cutover or RPC', () => {
  const start = source.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = source.indexOf('// ----------', start + 20);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  const consume = route.indexOf('consumeTotpStep(');
  const persist = route.indexOf('await saveDB(db)', consume);
  const cutover = route.indexOf('financialWritesEnabled()', consume);
  assert.ok(consume >= 0 && persist > consume && cutover > persist);
});

test('new enrollment clears an old counter and disabling 2FA clears the counter with its secret', () => {
  assert.ok(source.includes('user.twofa_secret = genTotpSecret(); delete user.twofa_last_used_step;'));
  assert.ok(source.includes("user.twofa_secret = ''; // Rotate the secret on next enrollment; do not retain a disabled factor.\n    delete user.twofa_last_used_step;"));
});
