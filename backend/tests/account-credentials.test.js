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
const validSupabaseId = extractFunction('isSupabaseUserId');
const verifiedAuthTime = extractFunction('getVerifiedSupabaseAuthTime', { Buffer, isSupabaseUserId: validSupabaseId });

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

test('Supabase auth_time is parsed only from a structurally valid JWT payload', () => {
  const subject = '123e4567-e89b-12d3-a456-426614174000';
  const payload = Buffer.from(JSON.stringify({ sub: subject, auth_time: 1793898000 })).toString('base64url');
  const token = 'header.' + payload + '.signature';
  const claims = verifiedAuthTime(token);
  assert.equal(claims.auth_time, 1793898000);
  assert.equal(claims.subject, subject);
  assert.equal(verifiedAuthTime('not-a-jwt'), null);
  const noAuthTime = Buffer.from(JSON.stringify({ sub: subject, iat: 1793898000 })).toString('base64url');
  assert.equal(verifiedAuthTime('header.' + noAuthTime + '.signature'), null);
  const badSubject = Buffer.from(JSON.stringify({ sub: 'not-a-uuid', auth_time: 1793898000 })).toString('base64url');
  assert.equal(verifiedAuthTime('header.' + badSubject + '.signature'), null);
});

test('credential recovery requires a server-verified, linked, recently reauthenticated identity', () => {
  assert.ok(source.includes("path === 'account/credentials/reauth' && method === 'POST'"));
  assert.ok(source.includes("path === 'account/credentials/recover' && method === 'POST'"));
  assert.ok(source.includes("supabaseUrl + '/auth/v1/user'"));
  assert.ok(source.includes("claims.subject !== linkedId"));
  assert.ok(source.includes("nowSeconds - authTime > 5 * 60"));
  assert.ok(source.includes("!isSupabaseIdentityLinked(user, linkedId)"));
  assert.ok(source.includes("delete sessionRecord.session.credential_reauth"));
  assert.ok(source.includes("purpose: 'credential_recovery'"));
  assert.ok(source.includes("verified.purpose !== 'credential_recovery'"));
  assert.ok(source.includes("Number(verified.auth_time) > Date.now() / 1000 + 60"));
  assert.ok(source.includes("code: 'TWO_FACTOR_REQUIRED'"));
  assert.ok(source.includes("code: 'TWO_FACTOR_INVALID'"));
  assert.ok(source.includes("token !== sessionRecord.token"));
  const recoveryStart = source.indexOf("if (path === 'account/credentials/recover' && method === 'POST')");
  const recoveryEnd = source.indexOf("\n  // ---------- POST /api/account/credentials ----------", recoveryStart);
  const recoveryRoute = source.slice(recoveryStart, recoveryEnd);
  assert.ok(recoveryRoute.indexOf("delete sessionRecord.session.credential_reauth") < recoveryRoute.indexOf("await saveDB(db)"));
  assert.ok(recoveryRoute.includes("token !== sessionRecord.token"));
});

test('credential and linking routes preserve one internal account and use revision-CAS persistence', () => {
  assert.ok(source.includes("path === 'account/credentials' && method === 'POST'"));
  assert.ok(source.includes("path === 'auth/link-identity' && method === 'POST'"));
  assert.ok(source.includes("await rateCheckShared('identity_link_target', String(user.uid))"));
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

test('identity linking requires a fresh linked-source proof and a separate fresh target proof', () => {
  assert.ok(source.includes("path === 'auth/link-identity/reauth' && method === 'POST'"));
  assert.ok(source.includes("await rateCheckShared('identity_link_reauth', String(user.uid))"));
  assert.ok(source.includes("sessionRecord.session.identity_link_reauth = {"));
  assert.ok(source.includes("marker.purpose !== 'identity_link'"));
  assert.ok(source.includes("!isSupabaseIdentityLinked(user, String(marker.supabase_user_id || ''))"));
  assert.ok(source.includes("markerAge > 5 * 60 * 1000"));
  assert.ok(source.includes("targetClaims.subject !== linkedId"));
  assert.ok(source.includes("targetNowSeconds - targetAuthTime > 5 * 60"));
  assert.ok(source.includes("String(marker.supabase_user_id) === linkedId"));
  assert.ok(source.includes("delete sessionRecord.session.identity_link_reauth"));
  assert.ok(source.includes("await saveDB(db)"));
  assert.ok(source.includes("code: 'IDENTITY_IN_USE'"));
  assert.ok(source.includes("code: 'TWO_FACTOR_REQUIRED'"));
  assert.ok(source.includes("code: 'TWO_FACTOR_INVALID'"));
  const sourceStart = source.indexOf("if (path === 'auth/link-identity/reauth' && method === 'POST')");
  const targetStart = source.indexOf("if (path === 'auth/link-identity' && method === 'POST')");
  const targetEnd = source.indexOf("// ---------- POST /api/2fa/enable ----------", targetStart);
  const sourceRoute = source.slice(sourceStart, targetStart);
  const targetRoute = source.slice(targetStart, targetEnd);
  assert.ok(sourceRoute.includes("purpose: 'identity_link'"));
  assert.ok(sourceRoute.indexOf("if (user.twofa_enabled)") < sourceRoute.indexOf("sessionRecord.session.identity_link_reauth = {"));
  assert.ok(targetRoute.includes("marker.purpose !== 'identity_link'"));
  assert.ok(targetRoute.includes("!isSupabaseIdentityLinked(user, String(marker.supabase_user_id || ''))"));
  assert.ok(targetRoute.includes("targetClaims.subject !== linkedId"));
  assert.ok(targetRoute.includes("String(marker.supabase_user_id) === linkedId"));
  assert.ok(targetRoute.includes("code: 'IDENTITY_IN_USE'"));
  assert.ok(targetRoute.includes("code: 'ACCOUNT_UPDATE_CONFLICT'"));
  assert.ok(targetRoute.indexOf("delete sessionRecord.session.identity_link_reauth") < targetRoute.indexOf("await saveDB(db)"));
  assert.ok(targetRoute.includes("Date.now() / 1000 - Number(marker.auth_time) > 5 * 60"));
  assert.ok(targetRoute.includes("Number(marker.auth_time) > Date.now() / 1000 + 60"));
});

test('Supabase state persistence enforces a database-side single-winner revision CAS', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '0001_btcbox_state_cas.sql'), 'utf8');
  const saveStart = source.indexOf('async function saveDB(db)');
  const saveEnd = source.indexOf('\\n}', saveStart);
  const saveRoute = source.slice(saveStart, saveEnd);
  assert.ok(saveRoute.includes('p_expected_revision: Number(db._revision || 0)'));
  assert.ok(saveRoute.includes('if (saved !== true) throw new Error(\'Persistent storage write conflict\')'));
  assert.ok(saveRoute.indexOf('if (saved !== true)') < saveRoute.indexOf('db._revision = Number(db._revision || 0) + 1'));
  assert.ok(saveRoute.includes("if (e && e.message === 'Persistent storage write conflict') throw e"));
  assert.ok(migration.includes('where id = \'main\''));
  assert.ok(migration.includes('and revision = p_expected_revision'));
  assert.ok(migration.includes('set revision = revision + 1'));
  assert.ok(migration.includes('return inserted_count = 1'));
  assert.ok(migration.includes('on conflict (id) do nothing'));
  assert.ok(migration.includes('if p_expected_revision = 0'));
  assert.ok(migration.includes('revoke all on function public.btcbox_save_state(bigint, jsonb) from public, anon, authenticated'));
  assert.ok(migration.includes('grant execute on function public.btcbox_save_state(bigint, jsonb) to service_role'));
});


test('credential updates preserve the current session and revoke every other account session', () => {
  const start = source.indexOf("if (path === 'account/credentials' && method === 'POST')");
  const end = source.indexOf("// ---------- POST /api/auth/link-identity ----------", start);
  assert.ok(start >= 0 && end > start, 'credential update route must exist');
  const route = source.slice(start, end);
  assert.ok(route.includes('const currentSessionRecord = getSessionRecord(db, event)'));
  assert.ok(route.includes("token !== currentSessionRecord.token && session && session.uid === user.uid"));
  assert.ok(route.includes('delete db.sessions[token]'));
  assert.ok(route.indexOf('delete db.sessions[token]') < route.indexOf('await saveDB(db)'));
  assert.ok(route.includes("code: 'ACCOUNT_UPDATE_CONFLICT'"));
});

test('credential updates also revoke outstanding 2FA login challenges before persistence', () => {
  const start = source.indexOf("if (path === 'account/credentials' && method === 'POST')");
  const end = source.indexOf("// ---------- POST /api/auth/link-identity ----------", start);
  const route = source.slice(start, end);
  const revoke = route.indexOf("if (db.temp_tokens[token] && db.temp_tokens[token].uid === user.uid) delete db.temp_tokens[token]");
  const persist = route.indexOf("try { await saveDB(db); }");
  assert.ok(revoke >= 0 && persist > revoke);
  assert.ok(route.includes('Credential changes invalidate every other session'));
  assert.ok(route.includes('PERSISTENCE_UNAVAILABLE'));
});


test('account snapshot tolerates legacy users without a KYC object', () => {
  assert.ok(source.includes("kyc_level: user.kyc && user.kyc.status === 'approved' ? 2 : (user.kyc && user.kyc.status === 'pending' ? 1 : 0)"));
});


test('credential reset and credential setup invalidate both current-session reauthentication markers', () => {
  const recoveryStart = source.indexOf("if (path === 'account/credentials/recover' && method === 'POST')");
  const recoveryEnd = source.indexOf("// ---------- POST /api/account/credentials ----------", recoveryStart);
  const recoveryRoute = source.slice(recoveryStart, recoveryEnd);
  assert.ok(recoveryRoute.includes('delete sessionRecord.session.credential_reauth'));
  assert.ok(recoveryRoute.includes('delete sessionRecord.session.identity_link_reauth'));
  assert.ok(recoveryRoute.indexOf('delete sessionRecord.session.identity_link_reauth') < recoveryRoute.indexOf('await saveDB(db)'));

  const updateStart = source.indexOf("if (path === 'account/credentials' && method === 'POST')");
  const updateEnd = source.indexOf("// ---------- POST /api/auth/link-identity ----------", updateStart);
  const updateRoute = source.slice(updateStart, updateEnd);
  assert.ok(updateRoute.includes('delete currentSessionRecord.session.credential_reauth'));
  assert.ok(updateRoute.includes('delete currentSessionRecord.session.identity_link_reauth'));
  assert.ok(updateRoute.indexOf('delete currentSessionRecord.session.identity_link_reauth') < updateRoute.indexOf('await saveDB(db)'));
});


test('first credential setup is restricted to a fresh session and existing credentials require the current password', () => {
  const start = source.indexOf("if (path === 'account/credentials' && method === 'POST')");
  const end = source.indexOf("// ---------- POST /api/auth/link-identity ----------", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.ok(route.includes("const hasCredentials = !!(user.login_password_hash && user.login_password_salt && user.login_password_algo === 'pbkdf2-sha256-600000')"));
  assert.ok(route.includes("if (hasCredentials && !verifyBtcboxLoginPassword(user, currentPassword))"));
  assert.ok(route.includes("code: 'CURRENT_PASSWORD_INVALID'"));
  assert.ok(route.includes("if (!hasCredentials)"));
  assert.ok(route.includes("Date.now() - createdAt > 5 * 60 * 1000"));
  assert.ok(route.includes("!Number.isFinite(createdAt)"));
  assert.ok(route.includes("code: 'REAUTH_REQUIRED'"));
});

test('credential setup validates username, password and uniqueness before mutating account credentials', () => {
  const start = source.indexOf("if (path === 'account/credentials' && method === 'POST')");
  const end = source.indexOf("// ---------- POST /api/auth/link-identity ----------", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  const usernameValidation = route.indexOf('if (!validateBtcboxUsername(username))');
  const passwordValidation = route.indexOf('if (!validateBtcboxLoginPassword(password))');
  const duplicateCheck = route.indexOf('const duplicate = Object.values(db.users).find');
  const usernameMutation = route.indexOf('user.username = username');
  const passwordHash = route.indexOf('user.login_password_hash = hashBtcboxLoginPassword(password, user.login_password_salt)');
  assert.ok(usernameValidation >= 0 && passwordValidation > usernameValidation);
  assert.ok(duplicateCheck > passwordValidation);
  assert.ok(usernameMutation > duplicateCheck);
  assert.ok(passwordHash > usernameMutation);
  assert.ok(route.includes("normalizeBtcboxUsername(candidate.username_normalized || candidate.username) === username"));
  assert.ok(route.includes("user.login_password_algo = 'pbkdf2-sha256-600000'"));
  assert.ok(route.includes('await saveDB(db)'));
  assert.ok(route.includes("code: 'PERSISTENCE_UNAVAILABLE'"));
});
