'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('legacy static auth support files remain valid JavaScript', () => {
  for (const file of ['assets/js/views-home.js', 'assets/js/boot.js', 'assets/js/app-core.js']) {
    assert.doesNotThrow(() => new vm.Script(read(file)), file + ' must parse');
  }
});

test('React registration offers confirmed email signup alongside Google and wallet; legacy username/email sign-in remains available', () => {
  const authPage = fs.readFileSync(path.resolve(root, '..', 'frontend/src/features/auth/AuthPages.tsx'), 'utf8');
  assert.ok(authPage.includes('signInWithUsername'));
  assert.ok(authPage.includes('Google'));
  assert.ok(authPage.includes('Wallet'));
  assert.ok(authPage.includes('Connect Ethereum wallet'));
  assert.ok(authPage.includes('Connect Solana wallet'));
  assert.ok(authPage.includes('signInWithEmail'));
  assert.ok(authPage.includes('signUpWithEmail'));
  assert.ok(authPage.includes('Create account with email'));
  assert.ok(authPage.includes('requestPasswordReset'));
  assert.ok(authPage.includes('Forgot password?'));
  assert.ok(authPage.includes('completePasswordRecovery'));
  assert.ok(authPage.includes('Username or email'));
});

test('legacy static Google OAuth callback retains same-origin return-target safeguards', () => {
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
  assert.ok(route.includes('wallet_enabled: walletEnabled'));
  assert.ok(route.includes('AUTH_CLIENT_CONFIG_UNAVAILABLE'));
});


test('React Supabase email confirmation and Google OAuth use the isolated template callback without legacy consent UI', () => {
  const app = read('../frontend/src/App.tsx');
  const auth = read('../frontend/src/features/auth/AuthPages.tsx');
  const provider = read('../frontend/src/lib/auth.tsx');
  assert.ok(app.includes('path="/auth/react-callback"'));
  assert.ok(app.includes('<AuthPage mode="register" />'));
  assert.ok(auth.includes('Google'));
  assert.ok(!auth.includes('reg-terms') && !auth.includes('Terms of Service'));
  assert.ok(provider.includes('flowType: "pkce"'));
  assert.ok(provider.includes('redirectTo: window.location.origin + "/auth/react-callback?intent=" + intent'));
  assert.ok(provider.includes('callbackParams.has("error_code")'));
  assert.ok(provider.includes('callbackParams.has("error_description")'));
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

test('OAuth callback does not retry a consumed code and keeps provisioning errors visible', () => {
  const callback = read('../frontend/src/features/auth/AuthPages.tsx');
  assert.ok(callback.includes('const oauthAttempted = useRef(false)'));
  assert.ok(callback.includes('if (!oauthAttempted.current && status !== "loading"'));
  assert.ok(callback.includes('oauthAttempted.current = true;'));
  assert.ok(callback.includes('callbackIntent === "register" ? "/register" : "/login"'));
  assert.ok(!callback.includes('window.setTimeout'), 'callback errors must remain visible until the user acts');
});

test('auth entry exposes a side-by-side sign-in/register choice and truthfully gates wallet access', () => {
  const page = read('../frontend/src/features/auth/AuthPages.tsx');
  const provider = read('../frontend/src/lib/auth.tsx');
  const api = read('../frontend/src/lib/api.ts');
  assert.ok(page.includes('data-testid="auth-mode-switcher"'));
  assert.ok(page.includes('data-testid="auth-mobile-shell"'));
  assert.ok(!page.includes('max-w-[1120px]'));
  assert.ok(!page.includes('lg:grid-cols-[minmax(0,1.05fr)'));
  assert.ok(page.includes('walletEnabled'));
  assert.ok(page.includes('Wallet sign-in is temporarily unavailable.'));
  assert.ok(page.includes('value="zh-CN"'));
  assert.ok(api.includes('wallet_enabled: boolean | null'));
  assert.ok(provider.includes('setWalletEnabled(config.wallet_enabled !== false)'));
  assert.ok(provider.includes('"/auth/react-callback?intent=" + intent'));
});


test('Web3 provider probe checks all Supabase error fields without accepting unrelated failures', () => {
  const core = read('api-core.js');
  assert.ok(core.includes('[data.msg, data.message, data.error_description, data.error]'));
  assert.ok(core.includes('[data.code, data.error_code]'));
  assert.ok(core.includes(".toLowerCase().replace(/^\\d{3}:\\s*/, '')"));
  assert.ok(core.includes("errorCodes.includes('validation_failed') && messages.some(message => /^message is too short$/.test(message))"));
  assert.ok(core.includes("errorCodes.includes('captcha_failed') || messages.some(message => /captcha/.test(message))"));
  assert.ok(core.includes("messages.some(message => /web3 provider is disabled|provider is disabled/.test(message))"));
  assert.ok(!core.includes("too short).*(message|signature)"));
});
test('React auth preserves legacy email sign-in and Google registration alongside username and wallet paths', () => {
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
  assert.ok(auth.includes('linkGoogleIdentity'));
  assert.ok(auth.includes('linkWeb3Identity'));
  assert.ok(auth.includes('signInWithEmail') && auth.includes('signUpWithEmail'));
  assert.ok(auth.includes('emailRedirectTo: window.location.origin + "/auth/react-callback?intent=register"'));
  assert.ok(backend.includes('function getSupabaseLoginProvider(identity)'));
  assert.ok(backend.includes('const authProvider = getSupabaseLoginProvider(identity);'));
  assert.ok(auth.includes('requestPasswordReset') && auth.includes('completePasswordRecovery'));
  assert.ok(auth.includes('flowType: "pkce"'));
  for (const required of ['Username or email', 'Google', 'Connect Ethereum wallet', 'Connect Solana wallet']) assert.ok(pages.includes(required), 'auth page must expose ' + required);
  assert.ok(!pages.includes('No email registration is required'));
  assert.ok(auth.includes('eip6963:announceProvider'));
  assert.ok(auth.includes('eip6963:requestProvider'));
  assert.ok(auth.includes('getInjectedSolanaWallet'));
  assert.ok(provider.includes('signInWithWeb3({ chain, statement, ...(wallet ? { wallet } : {}) } as Parameters<'));
  assert.ok(backend.includes("authProvider === 'web3' ? !walletIdentity"));
  assert.ok(backend.includes("email: email || ''"));
  assert.ok(backend.includes("wallet_address: walletIdentity ? walletIdentity.address : ''"));
  assert.ok(pages.includes('Create your BTCBOX account'));
  assert.ok(setup.includes('Set up your BTCBOX account'));
  assert.ok(setup.includes('Save BTCBOX credentials'));
  assert.ok(security.includes('Link Google'));
  assert.ok(security.includes('Link Ethereum wallet'));
  assert.ok(security.includes('Link Solana wallet'));
  assert.ok(security.includes('Email login password'));
  assert.ok(security.includes('Set or change'));
  assert.ok(!security.includes('account?.has_login_password ? t("Set") : t("Not set")'), 'Supabase email password status must not reuse BTCBOX password metadata');
  assert.ok(provider.includes('client.auth.updateUser({ password })'));
  assert.ok(provider.includes('signedIn.user.id !== data.user.id'), 'email password must remain on the same Supabase user');
  assert.ok(app.includes('AccountSetupGate'));
  assert.ok(app.includes('AccountSecurityPage'));
  assert.ok(!pages.includes('Terms of Service'));
});
test('React auth callback is single-flight under StrictMode effect replay', () => {
  const auth = read('../frontend/src/lib/auth.tsx');
  assert.ok(auth.includes('const callbackLock = useRef(false)'));
  assert.ok(auth.includes('if (callbackLock.current) return;'));
  assert.ok(auth.includes('callbackLock.current = true;'));
  assert.ok(auth.includes('finally { callbackLock.current = false; setBusy(false); }'));
});

test('public market page exposes live market categories without changing order execution paths', () => {
  const page = read('../frontend/src/features/markets/MarketsPage.tsx');
  const api = read('../frontend/src/lib/api.ts');
  assert.ok(page.includes('data-testid="public-market-page"'));
  assert.ok(page.includes('["hot", "Hot"]'));
  assert.ok(page.includes('["gainers", "Gainers"]'));
  assert.ok(page.includes('getMarkets(controller.signal)'));
  assert.ok(page.includes('setSort("volume")'));
  assert.ok(api.includes('export async function getMarkets'));
});

test('Google and wallet sign-ups enter BTCBOX without mandatory username/password onboarding', () => {
  const app = read('../frontend/src/App.tsx');
  assert.ok(app.includes('Provider-authenticated users enter BTCBOX immediately'));
  assert.ok(!app.includes('needsCredentials &&'));
  assert.ok(app.includes('path="/account-setup" element={<Navigate to="/me" replace />}'));
  assert.ok(!app.includes('<AccountSetupPage'));
});
