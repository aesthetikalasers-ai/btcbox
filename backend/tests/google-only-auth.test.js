'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Google-only auth source files remain valid JavaScript', () => {
  for (const file of ['assets/js/views-home.js', 'assets/js/boot.js', 'assets/js/app-core.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file)), file + ' must parse');
  }
});

test('public login and registration expose Google OAuth only', () => {
  const views = read('assets/js/views-home.js');
  const start = views.indexOf('VIEWS.login = function(){');
  const end = views.indexOf('VIEWS.markets = function(){', start);
  assert.ok(start >= 0 && end > start, 'login/register view block must exist');
  const authViews = views.slice(start, end);
  assert.ok(authViews.includes('google-login-btn'));
  assert.ok(authViews.includes('google-register-btn'));
  assert.ok(authViews.includes('reg-terms'), 'registration must retain Terms/Privacy consent');
  for (const forbidden of ['login-email', 'login-pwd', 'reg-email', 'reg-pwd', 'forgot-link', 'Forgot password', 'Auth.login(', 'Auth.register(']) {
    assert.ok(!authViews.includes(forbidden), 'Google-only auth view must not expose ' + forbidden);
  }
});

test('Google OAuth keeps same-origin callback, safe return target and Terms consent', () => {
  const boot = read('assets/js/boot.js');
  assert.ok(boot.includes("redirectTo:window.location.origin+window.location.pathname+'?auth_callback=1'"));
  assert.ok(boot.includes('consumeOAuthReturnTarget()'));
  assert.ok(boot.includes("const isRegister=btn.id==='google-register-btn'"));
  assert.ok(boot.includes('Please accept the Terms of Service and Privacy Policy to continue.'));
  assert.ok(!boot.includes('Please use email and password'));
  assert.ok(!boot.includes('Auth.showResetPassword'));
  assert.ok(!boot.includes('recoveryMode'));
});

test('Google OAuth session exchange preserves optional server-side 2FA challenge', () => {
  const boot = read('assets/js/boot.js');
  const core = read('assets/js/app-core.js');
  assert.ok(boot.includes('supabaseTwoFactorPending'));
  assert.ok(boot.includes('Auth.showLoginTwoFactor'));
  assert.ok(core.includes('async supabaseLogin(supabase_access_token)'));
  assert.ok(core.includes('showLoginTwoFactor(email,tempToken)'));
  assert.ok(core.includes('result.require_2fa===true && result.temp_token'));
  assert.ok(core.includes('The sign-in result could not be confirmed.'));
  assert.ok(core.includes('function clearPrivateUserState(){') && core.includes('state.accountLoaded=false;'), 'failed auth must clear private account state');
});

test('email-only client recovery handlers are not exposed by Auth helper', () => {
  const core = read('assets/js/app-core.js');
  const start = core.indexOf('const Auth = {');
  const end = core.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start, 'Auth helper must exist');
  const auth = core.slice(start, end);
  for (const forbidden of ['async login(', 'async register(', 'showRegisterSuccess(', 'showForgotPassword(', 'showResetPassword(', 'forgotPassword(']) {
    assert.ok(!auth.includes(forbidden), 'Auth helper must not expose ' + forbidden);
  }
  const adapterStart = core.indexOf('const apiAdapter = {');
  const adapterEnd = core.indexOf('\n};', adapterStart);
  assert.ok(adapterStart >= 0 && adapterEnd > adapterStart, 'API adapter must exist');
  const adapter = core.slice(adapterStart, adapterEnd);
  for (const forbidden of ['async login(', 'async register(', 'async forgotPassword(']) {
    assert.ok(!adapter.includes(forbidden), 'API adapter must not expose ' + forbidden);
  }
  assert.ok(adapter.includes('async login2fa('), 'optional Google-session 2FA endpoint must remain');
});

test('React auth client config is public-only and runs before database loading', () => {
  const core = read('api-core.js');
  const routeAt = core.indexOf("path === 'auth-client-config' && method === 'GET'");
  const dbAt = core.indexOf('let db;');
  assert.ok(routeAt >= 0 && dbAt > routeAt, 'auth client config must be handled before database loading');
  const route = core.slice(routeAt, core.indexOf("if (path === 'auth-health'", routeAt));
  assert.ok(route.includes('getPublishableKey()'));
  assert.ok(route.includes('supabase_url: authUrl'));
  assert.ok(route.includes('publishable_key: publishableKey'));
  assert.ok(!route.includes('SERVICE_ROLE') && !route.includes('SECRET_KEY'));
  assert.ok(route.includes('google_enabled: googleEnabled'));
  assert.ok(route.includes('AUTH_CLIENT_CONFIG_UNAVAILABLE'));
});


test('React Google auth uses the template flow without legacy registration consent UI', () => {
  const app = read('../frontend/src/App.tsx');
  const auth = read('../frontend/src/features/auth/AuthPages.tsx');
  const provider = read('../frontend/src/lib/auth.tsx');
  assert.ok(app.includes('path="/auth/react-callback"'));
  assert.ok(app.includes('<AuthPage mode="register" />'));
  assert.ok(auth.includes('Continue with Google'));
  assert.ok(!auth.includes('reg-terms') && !auth.includes('Terms of Service'));
  assert.ok(provider.includes('flowType: "pkce"'));
  assert.ok(provider.includes('redirectTo: window.location.origin + "/auth/react-callback"'));
  assert.ok(provider.includes('callbackParams.has("error_code")'));
  assert.ok(provider.includes('callbackParams.has("error_description")'));
  assert.ok(provider.includes('callbackParams.get("flow") === "recovery"'));
  assert.ok(provider.includes('exchangeSupabaseSession'));
  assert.ok(provider.includes('completeLogin2fa'));
  assert.ok(provider.includes('clientRef.current?.auth.signOut()'));
});

test('React public auth config fails closed when URL or public key is invalid', () => {
  const core = read('api-core.js');
  const start = core.indexOf("path === 'auth-client-config' && method === 'GET'");
  const end = core.indexOf("if (path === 'auth-health'", start);
  const route = core.slice(start, end);
  assert.ok(route.includes('if (!validAuthUrl || !publishableKey)'));
  assert.ok(route.includes('return json({ ok: false, code: \'AUTH_CLIENT_CONFIG_UNAVAILABLE\''));
  assert.ok(route.includes('process.env.SUPABASE_AUTH_URL ||'));
  assert.ok(!route.includes('SUPABASE_SERVICE_ROLE_KEY'));
});


test('React auth server endpoints retain exact POST contracts and legacy callback routing', () => {
  const core = read('api-core.js');
  const frontendApi = read('../frontend/src/lib/api.ts');
  const vercel = read('vercel.json');
  assert.doesNotThrow(() => new vm.Script(core), 'api-core.js must parse');
  assert.ok(core.includes("path === 'logout' && method === 'POST'"));
  assert.ok(core.includes("path === 'login/2fa' && method === 'POST'"));
  assert.ok(core.includes("path === 'supabase-login' || path === 'google-login'"));
  assert.ok(frontendApi.includes('method: "POST", credentials: "include"'));
  assert.ok(frontendApi.includes('supabase_access_token: accessToken'));
  assert.ok(frontendApi.includes('temp_token: tempToken, code'));
  assert.ok(frontendApi.includes('method: "POST"') && frontendApi.includes('/logout'));
  assert.ok(vercel.includes('"source": "/auth/callback"'));
  assert.ok(vercel.includes('"destination": "/auth/react-callback"'));
  assert.ok(!vercel.includes('/legacy-index.html'));
});


test('React authentication supports Supabase email and Google alongside BTCBOX credentials and optional Web3', () => {
  const backend = read('api-core.js');
  const auth = read('../frontend/src/lib/auth.tsx');
  const pages = read('../frontend/src/features/auth/AuthPages.tsx');
  const provider = read('../frontend/src/lib/auth.tsx');
  const setup = read('../frontend/src/features/auth/AccountSetupPage.tsx');
  const security = read('../frontend/src/features/account/AccountSecurityPage.tsx');
  const app = read('../frontend/src/App.tsx');
  assert.ok(backend.includes('function getSingleSupabaseAuthProvider(identity)'));
  assert.ok(backend.includes("['google', 'email', 'web3'].includes(provider)"));
  assert.ok(backend.includes('getSupabaseWalletIdentity(identity)'));
  assert.ok(backend.includes("if (!user && email) user = Object.values(db.users).find"));
  assert.ok(backend.includes("const authProviders = [authProvider]"));
  assert.ok(backend.includes('SUPABASE_IDENTITY_MISMATCH'));
  assert.ok(backend.includes("path === 'auth/link-identity' && method === 'POST'"));
  assert.ok(auth.includes('signInWithUsername'));
  assert.ok(auth.includes('setBtcboxCredentials'));
  assert.ok(auth.includes('linkSupabaseIdentity'));
  assert.ok(auth.includes('linkGoogleIdentity'));
  assert.ok(auth.includes('linkWeb3Identity'));
  assert.ok(auth.includes('signUp({'));
  assert.ok(auth.includes('resetPasswordForEmail'));
  assert.ok(auth.includes('updateUser({ password })'));
  assert.ok(auth.includes('flowType: "pkce"'));
  assert.ok(pages.includes('Sign in with username'));
  assert.ok(pages.includes('Sign in with email'));
  assert.ok(pages.includes('Register with email'));
  assert.ok(auth.includes('signInWithEmail'));
  assert.ok(auth.includes('signUpWithEmail'));
  assert.ok(pages.includes('Continue with Ethereum wallet'));
  assert.ok(pages.includes('Continue with Solana wallet'));
  assert.ok(auth.includes('eip6963:announceProvider'));
  assert.ok(auth.includes('eip6963:requestProvider'));
  assert.ok(auth.includes('getInjectedSolanaWallet'));
  assert.ok(pages.includes('Choose your Ethereum wallet'));
  assert.ok(pages.includes('phantom.app/ul/browse/'));
  assert.ok(pages.includes('go.cb-w.com/dapp?cb_url='));

  assert.ok(provider.includes('signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<'));
  assert.ok(backend.includes("authProvider === 'web3' ? !walletIdentity"));
  assert.ok(backend.includes("email: email || ''"));
  assert.ok(backend.includes("wallet_address: walletIdentity ? walletIdentity.address : ''"));
  assert.ok(pages.includes('Create account with email'));
  assert.ok(setup.includes('Set up your BTCBOX account'));
  assert.ok(setup.includes('Save BTCBOX credentials'));
  assert.ok(security.includes('Link Google'));
  assert.ok(security.includes('Link Ethereum wallet'));
  assert.ok(security.includes('Link Solana wallet'));
  assert.ok(app.includes('AccountSetupGate'));
  assert.ok(app.includes('AccountSecurityPage'));
  assert.ok(pages.includes('Choose a new password'));
  assert.ok(!pages.includes('Terms of Service'));
});


test('React auth callback is single-flight under StrictMode effect replay', () => {
  const auth = read('../frontend/src/lib/auth.tsx');
  assert.ok(auth.includes('const callbackLock = useRef(false)'));
  assert.ok(auth.includes('if (callbackLock.current) return;'));
  assert.ok(auth.includes('callbackLock.current = true;'));
  assert.ok(auth.includes('finally { callbackLock.current = false; setBusy(false); }'));
});
