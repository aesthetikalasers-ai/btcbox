'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');

test('TOTP verifier returns the matched time-step and rejects malformed codes', () => {
  assert.match(source, /function totpMatchStep\\(secret, code\\)/);
  assert.match(source, /if \\(typeof code !== 'string' \\|\\| !\\/\\^\\\\d\\{6\\}\\$\\/);
  assert.match(source, /if \\(expected === code\\) return step/);
});

test('TOTP consumption rejects a previously consumed step and persists its counter', () => {
  assert.match(source, /function consumeTotpStep\\(user, code\\)/);
  assert.match(source, /const previous = user\\.twofa_last_used_step/);
  assert.match(source, /step <= previous/);
  assert.match(source, /user\\.twofa_last_used_step = step/);
});

test('all protected TOTP routes consume a one-time step rather than boolean verification', () => {
  assert.doesNotMatch(source, /!totpVerify\\(/);
  assert.ok((source.match(/consumeTotpStep\\(/g) || []).length >= 9);
});

test('withdrawal persists the consumed TOTP step before any financial cutover or RPC', () => {
  const start = source.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = source.indexOf('// ----------', start + 20);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  const consume = route.indexOf('consumeTotpStep(');
  const persist = route.indexOf('await saveDB(db)', consume);
  const cutover = route.indexOf('financialWritesEnabled()', consume);
  assert.ok(consume >= 0 && persist > consume && cutover > persist);
});

test('new TOTP enrollment clears an old secret counter; disable clears it with the secret', () => {
  assert.match(source, /user\\.twofa_secret = genTotpSecret\\(\\); delete user\\.twofa_last_used_step/);
  assert.match(source, /user\\.twofa_secret = '';[\\s\\S]{0,120}delete user\\.twofa_last_used_step/);
});
