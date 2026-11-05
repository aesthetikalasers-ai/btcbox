'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
function extractFunction(name, context = {}) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, name + ' must have a complete body');
  return vm.runInNewContext('(' + source.slice(start, end + 2) + ')', context);
}
const normalize = extractFunction('normalizeBtcboxUsername');
const validUsername = extractFunction('validateBtcboxUsername');
const validPassword = extractFunction('validateBtcboxLoginPassword');
const linked = extractFunction('isSupabaseIdentityLinked');
const linkedIds = extractFunction('getUserLinkedIdentityIds');

test('BTCBOX usernames are normalized consistently and validated strictly', () => {
  assert.equal(normalize('  Alice_123  '), 'alice_123');
  assert.equal(validUsername('alice_123'), true);
  assert.equal(validUsername('abc'), true);
  assert.equal(validUsername('ab'), false);
  assert.equal(validUsername('_alice'), false);
  assert.equal(validUsername('alice@example.com'), false);
  assert.equal(validUsername('alice-name'), false);
  assert.equal(validUsername('a'.repeat(25)), false);
});

test('BTCBOX login password policy rejects short, oversized and control-character values', () => {
  assert.equal(validPassword('correct horse battery'), true);
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('x'.repeat(129)), false);
  assert.equal(validPassword('safe\nunsafe-password'), false);
  assert.equal(validPassword(null), false);
});

test('Supabase identity lookup accepts legacy primary IDs and explicitly linked IDs only', () => {
  const user = { supabase_user_id: 'primary-id', supabase_user_ids: ['primary-id', 'linked-id'] };
  assert.equal(linked(user, 'primary-id'), true);
  assert.equal(linked(user, 'linked-id'), true);
  assert.equal(linked(user, 'unrelated-id'), false);
  assert.deepEqual(Array.from(linkedIds(user)), ['primary-id', 'linked-id']);
  assert.deepEqual(Array.from(linkedIds({ supabase_user_id: 'legacy-id' })), ['legacy-id']);
});

test('credential and linking routes preserve one internal account and use revision-CAS persistence', () => {
  assert.ok(source.includes("path === 'account/credentials' && method === 'POST'"));
  assert.ok(source.includes("path === 'auth/link-identity' && method === 'POST'"));
  assert.ok(source.includes("code: 'USERNAME_TAKEN'"));
  assert.ok(source.includes("code: 'IDENTITY_IN_USE'"));
  assert.ok(source.includes("code: 'REAUTH_REQUIRED'"));
  assert.ok(source.includes('user.supabase_user_ids.push(linkedId)'));
  assert.ok(source.includes('isSupabaseIdentityLinked(u, supabaseUserId)'));
  assert.ok(source.includes('p_expected_revision: Number(db._revision || 0), p_data: cleanData'));
  assert.ok(source.includes("user_id: String(user.uid)"));
});

test('username login is separate from Supabase email/password and uses generic credential failures', () => {
  assert.ok(source.includes("path === 'login' && method === 'POST'"));
  assert.ok(source.includes("code: 'INVALID_CREDENTIALS'"));
  assert.ok(source.includes('hashBtcboxLoginPassword(password, salt)'));
  assert.ok(source.includes("auth_method: 'username_password'"));
  assert.ok(source.includes('BTCBOX_PASSWORD_ITERATIONS = 600000'));
  assert.ok(source.includes('crypto.timingSafeEqual(actual, expected)'));
  assert.ok(source.includes('login_username:'));
});
