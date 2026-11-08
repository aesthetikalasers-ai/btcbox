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

const getSingleSupabaseAuthProvider = extractFunction('getSingleSupabaseAuthProvider');
const isValidAuthEmail = extractFunction('isValidAuthEmail');
const getSupabaseWalletIdentity = extractFunction('getSupabaseWalletIdentity', { getSingleSupabaseAuthProvider });
const isSupabaseUserId = extractFunction('isSupabaseUserId');

test('only one server-verified Google, Email or Web3 Supabase identity is accepted', () => {
  const google = {
    app_metadata: { provider: 'google', providers: ['google'] },
    identities: [{ provider: 'google' }],
    user_metadata: { provider: 'google' }
  };
  assert.equal(getSingleSupabaseAuthProvider(google), 'google');
  assert.equal(getSingleSupabaseAuthProvider({
    app_metadata: { provider: 'web3', providers: ['web3'] },
    identities: [{ provider: 'web3', identity_data: { custom_claims: { chain: 'ethereum', address: '0x52908400098527886E0F7030069857D2E4169EE7' } } }]
  }), 'web3');
  assert.equal(getSingleSupabaseAuthProvider({
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [{ provider: 'email' }],
    user_metadata: { provider: 'google' }
  }), 'email', 'the server-verified Email provider is an enabled BTCBOX sign-in method');
  assert.equal(getSingleSupabaseAuthProvider({
    app_metadata: { provider: 'google', providers: ['google', 'email'] },
    identities: [{ provider: 'google' }, { provider: 'email' }]
  }), null, 'linked identities must be rejected until explicit linking is implemented');
  assert.equal(getSingleSupabaseAuthProvider({
    app_metadata: { provider: 'google', providers: ['google'] },
    identities: [{ provider: 'email' }]
  }), null, 'provider metadata and identity list must agree');
  assert.equal(getSingleSupabaseAuthProvider({
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: []
  }), null, 'an empty identity list must fail closed');
  assert.equal(getSingleSupabaseAuthProvider(null), null);
});

test('Google identity exchange validates a normal email address without accepting whitespace', () => {
  assert.equal(isValidAuthEmail('user@example.com'), true);
  assert.equal(isValidAuthEmail('first.last+btc@example.co'), true);
  assert.equal(isValidAuthEmail('not-an-email'), false);
  assert.equal(isValidAuthEmail('name with space@example.com'), false);
});

test('Supabase identity must include a canonical UUID user id', () => {
  assert.equal(isSupabaseUserId('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isSupabaseUserId('not-a-user-id'), false);
  assert.equal(isSupabaseUserId(''), false);
  assert.equal(isSupabaseUserId(null), false);
});

test('legacy email registration stays disabled while BTCBOX username/password login is enabled', () => {
  const registerStart = source.indexOf("if (path === 'register' && method === 'POST')");
  const loginStart = source.indexOf("if (path === 'login' && method === 'POST')");
  const supabaseStart = source.indexOf("if ((path === 'supabase-login' || path === 'google-login') && method === 'POST')");
  assert.ok(registerStart >= 0 && loginStart > registerStart && supabaseStart > loginStart);
  const register = source.slice(registerStart, loginStart);
  const login = source.slice(loginStart, supabaseStart);
  assert.match(register, /GOOGLE_ONLY_AUTH/);
  assert.match(register, /403/);
  assert.match(login, /INVALID_CREDENTIALS/);
  assert.match(login, /hashBtcboxLoginPassword/);
  assert.match(login, /login_username:/);
  assert.match(login, /auth_method: 'username_password'/);
  assert.doesNotMatch(register, /hashPassword\(/);
});

test('local account only accepts explicitly linked Supabase identity IDs', () => {
  assert.ok(source.includes("if (user && !isSupabaseIdentityLinked(user, supabaseUserId))"));
  assert.ok(source.includes("if (!user && email) user = Object.values(db.users).find"));
  assert.ok(source.includes("user.supabase_user_ids.push(linkedId)"));
  assert.ok(source.includes("code: 'IDENTITY_IN_USE'"));
  assert.ok(source.includes("'SUPABASE_IDENTITY_MISMATCH'"));
});


test('Web3 identities require one server-verified provider and validated chain address claims', () => {
  const ethereum = {
    app_metadata: { provider: 'web3', providers: ['web3'] },
    identities: [{ provider: 'web3', identity_data: { custom_claims: { chain: 'ethereum', address: '0x52908400098527886E0F7030069857D2E4169EE7' } } }]
  };
  assert.deepEqual(JSON.parse(JSON.stringify(getSupabaseWalletIdentity(ethereum))), { chain: 'ethereum', address: '0x52908400098527886e0f7030069857d2e4169ee7' });
  const solana = {
    app_metadata: { provider: 'web3', providers: ['web3'] },
    identities: [{ provider: 'web3', identity_data: { custom_claims: { chain: 'solana', address: '11111111111111111111111111111111' } } }]
  };
  assert.deepEqual(JSON.parse(JSON.stringify(getSupabaseWalletIdentity(solana))), { chain: 'solana', address: '11111111111111111111111111111111' });
  assert.equal(getSupabaseWalletIdentity({ ...ethereum, identities: [{ provider: 'web3', identity_data: { custom_claims: { chain: 'ethereum', address: 'not-an-address' } } }] }), null);
  assert.equal(getSupabaseWalletIdentity({ ...ethereum, app_metadata: { provider: 'google', providers: ['google'] } }), null);
  assert.equal(getSupabaseWalletIdentity({ ...ethereum, identities: [{ provider: 'google' }] }), null);
});


test('wallet identity comparisons canonicalize Ethereum case and preserve Solana case sensitivity', () => {
  const sameWallet = extractFunction('isSameWalletIdentity', {
    normalizeWalletIdentityAddress: extractFunction('normalizeWalletIdentityAddress')
  });
  assert.equal(sameWallet(
    { chain: 'ethereum', address: '0x52908400098527886E0F7030069857D2E4169EE7' },
    { chain: 'ethereum', address: '0x52908400098527886e0f7030069857d2e4169ee7' }
  ), true, 'EVM checksum casing must not bypass wallet uniqueness');
  assert.equal(sameWallet(
    { chain: 'solana', address: '11111111111111111111111111111111' },
    { chain: 'solana', address: '11111111111111111111111111111112' }
  ), false, 'Solana addresses remain case-sensitive');
  assert.equal(sameWallet(
    { chain: 'ethereum', address: '0xinvalid' },
    { chain: 'ethereum', address: '0xinvalid' }
  ), false, 'malformed stored wallet records must not match');
  assert.equal(sameWallet(
    { chain: 'ethereum', address: '0x52908400098527886E0F7030069857D2E4169EE7' },
    { chain: 'solana', address: '0x52908400098527886e0f7030069857d2e4169ee7' }
  ), false, 'wallets on different chains must never collide');
});


test('identity linking avoids duplicate wallet records across legacy and normalized fields', () => {
  const routeStart = source.indexOf("path === 'auth/link-identity' && method === 'POST'");
  const routeEnd = source.indexOf("// ---------- POST /api/2fa/enable ----------", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /const walletAlreadyRecorded = user\.wallet_identities\.some/);
  assert.match(route, /isSameWalletIdentity\(\{ chain: user\.wallet_chain, address: user\.wallet_address \}, walletIdentity\)/);
  assert.match(route, /if \(!walletAlreadyRecorded\)\s*\{\s*user\.wallet_identities\.push/);
  assert.match(route, /user\.auth_identities\.push\(\{ supabase_user_id: linkedId/);
});


test('first-time Supabase sign-in creates one BTCBOX account with server-verified identity and session', () => {
  const routeStart = source.indexOf("if ((path === 'supabase-login' || path === 'google-login') && method === 'POST')");
  const routeEnd = source.indexOf("// ---------- POST /api/logout ----------", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = source.slice(routeStart, routeEnd);
  const createStart = route.indexOf('if (!user) {');
  const existingStart = route.indexOf('} else {', createStart);
  assert.ok(createStart >= 0 && existingStart > createStart);
  const create = route.slice(createStart, existingStart);
  assert.match(create, /supabase_user_id: supabaseUserId/);
  assert.match(create, /supabase_user_ids: \[supabaseUserId\]/);
  assert.match(create, /auth_identities: \[\{ supabase_user_id: supabaseUserId/);
  assert.match(create, /wallet_identities: walletIdentity \? \[\{/);
  assert.match(create, /auth_providers: authProviders/);
  assert.match(create, /balances: emptyBalances\(\)/);
  assert.match(route, /db\.sessions\[token\] = \{ uid: user\.uid, email: email, created_at: Date\.now\(\), auth_method: authProvider === 'web3' \? 'supabase_web3' : authProvider === 'email' \? 'supabase_email' : 'supabase_google' \}/);
  assert.match(route, /try\s*\{\s*await saveDB\(db\);\s*\}\s*catch[\s\S]*?return json\(\{ ok: true, uid: user\.uid \}/);
  assert.match(route, /if \(authProvider === 'web3' \? !walletIdentity : \(!isValidAuthEmail\(email\) \|\| !confirmed\)\)/);
});


test('Google, Email and Web3 login persist 2FA challenges and authenticated sessions before returning success', () => {
  const routeStart = source.indexOf("if ((path === 'supabase-login' || path === 'google-login') && method === 'POST')");
  const routeEnd = source.indexOf("// ---------- POST /api/logout ----------", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = source.slice(routeStart, routeEnd);
  const frozen = route.indexOf("if (user && user.frozen)");
  const twofa = route.indexOf("if (user && user.twofa_enabled)");
  const createAccount = route.indexOf("if (!user) {");
  assert.ok(frozen >= 0 && twofa > frozen && createAccount > twofa);
  const challenge = route.slice(twofa, createAccount);
  const challengeSave = challenge.indexOf("try { await saveDB(db); }");
  const challengeReply = challenge.indexOf("return json({ ok: false, require_2fa: true, temp_token: tempToken }, 200)");
  assert.ok(challengeSave >= 0 && challengeReply > challengeSave);
  assert.match(challenge.slice(challengeSave, challengeReply), /PERSISTENCE_UNAVAILABLE/);
  const session = route.indexOf("db.sessions[token] =");
  const save = route.indexOf("try { await saveDB(db); }", session);
  const success = route.indexOf("return json({ ok: true, uid: user.uid }, 200, setCookieHeader(token))", session);
  assert.ok(session > createAccount && save > session && success > save);
  assert.match(route.slice(save, success), /PERSISTENCE_UNAVAILABLE/);
  assert.match(route, /auth_method: authProvider === 'web3' \? 'supabase_web3' : authProvider === 'email' \? 'supabase_email' : 'supabase_google'/);
});


test('Supabase provider is retained across the shared 2FA challenge exchange', () => {
  const start = source.indexOf("if ((path === 'supabase-login' || path === 'google-login') && method === 'POST')");
  const end = source.indexOf("// ---------- POST /api/logout ----------", start);
  const route = source.slice(start, end);
  assert.match(route, /auth_method: authProvider === 'web3' \? 'supabase_web3_2fa' : authProvider === 'email' \? 'supabase_email_2fa' : 'supabase_google_2fa'/);
  const challengeStart = source.indexOf("if (path === 'login/2fa' && method === 'POST')");
  const challengeEnd = source.indexOf("// ---------- GET /api/kline", challengeStart);
  const challengeRoute = source.slice(challengeStart, challengeEnd);
  assert.match(challengeRoute, /auth_method: rec\.auth_method \|\| 'username_password_2fa'/);
});
