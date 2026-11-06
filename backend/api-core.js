// BTCBOX shared API handler for Vercel Node Functions.
// Persistent state and financial records require Supabase; no Netlify Blobs fallback.
const crypto = require('crypto');
const { authorizeSupabaseAdmin } = require('./admin-auth');
const { hasAdminPermission } = require('./admin-rbac');

const SESSION_COOKIE = 'session_token';
const PBKDF2_ITER = 100000;
const PBKDF2_KEYLEN = 32;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_PRICE_CACHE_MS = 15000;
let livePriceCache = { expiresAt: 0, prices: {} };

// ===== 数据层（失败时关闭；不使用陈旧缓存处理可变数据）=====
// Legacy JSON/Blobs writes cannot resolve 跨实例并发读-改-写竞争; they are retired.
// 注意：Netlify Blobs 不是事务型数据库。每次请求重新读取可以避免本实例
// 的 TTL 缓存覆盖较新的数据，但无法解决跨实例并发读-改-写竞争。生产资金
// 业务仍需迁移到支持事务/唯一约束的数据库后才能开放真实资金操作。
function supabaseStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY));
}
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
}
// Publishable/anon key 读取：trim 空白并校验格式，防止 env 值被换行/空格污染。
// 合法格式：sb_publishable_ 开头（新格式）或 eyJ 开头（JWT 旧格式），不含任何空白字符。
// 校验失败返回空串并告警，绝不把污染值返回给前端或用于 Auth 初始化。
const PUBLISHABLE_KEY_RE = /^(sb_publishable_|eyJ)[A-Za-z0-9._\-]+$/;
function getPublishableKey() {
  const raw = String(process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_ANON_KEY || '').trim();
  if (!raw) return '';
  if (/\s/.test(raw) || !PUBLISHABLE_KEY_RE.test(raw)) {
    console.warn('[publishable-key] invalid format or whitespace detected; returning empty (fail-closed).');
    return '';
  }
  return raw;
}
// Detect whether Google OAuth is enabled in the Supabase Auth project by reading
// GoTrue's public /auth/v1/settings. Cached briefly so every auth-health /
// supabase-login call does not pay an extra round trip. Returns true / false, or
// null if the status cannot be determined (settings endpoint unreachable).
let _googleProviderCache = { value: null, expiresAt: 0 };
// Accept only one server-verified Supabase identity. Mixed/linked identities are
// deliberately rejected until an explicit, audited account-linking flow exists.
function getSingleSupabaseAuthProvider(identity) {
  if (!identity || typeof identity !== 'object') return null;
  const appMetadata = identity.app_metadata && typeof identity.app_metadata === 'object' ? identity.app_metadata : {};
  const provider = String(appMetadata.provider || '').toLowerCase();
  const providers = Array.isArray(appMetadata.providers) ? appMetadata.providers.map(p => String(p || '').toLowerCase()) : [];
  const identities = Array.isArray(identity.identities) ? identity.identities : [];
  if (!['google', 'email', 'web3'].includes(provider) || providers.length !== 1 || providers[0] !== provider) return null;
  if (identities.length !== 1 || !identities[0] || String(identities[0].provider || '').toLowerCase() !== provider) return null;
  return provider;
}
function getSupabaseWalletIdentity(identity) {
  if (!identity || typeof identity !== 'object' || getSingleSupabaseAuthProvider(identity) !== 'web3') return null;
  const walletIdentity = Array.isArray(identity.identities) ? identity.identities[0] : null;
  const identityData = walletIdentity && walletIdentity.identity_data && typeof walletIdentity.identity_data === 'object' ? walletIdentity.identity_data : {};
  const claims = identityData.custom_claims && typeof identityData.custom_claims === 'object' ? identityData.custom_claims : {};
  const chain = String(claims.chain || '').toLowerCase();
  const address = String(claims.address || '').trim();
  if (chain === 'ethereum' && /^0x[a-fA-F0-9]{40}$/.test(address)) return { chain, address: address.toLowerCase() };
  if (chain === 'solana' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return { chain, address };
  return null;
}
function normalizeWalletIdentityAddress(chain, address) {
  const network = String(chain || '').toLowerCase();
  const value = String(address || '').trim();
  if (network === 'ethereum' && /^0x[a-fA-F0-9]{40}$/.test(value)) return value.toLowerCase();
  if (network === 'solana' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return value;
  return null;
}
function isSameWalletIdentity(left, right) {
  if (!left || !right) return false;
  const leftChain = String(left.chain || '').toLowerCase();
  const rightChain = String(right.chain || '').toLowerCase();
  if (!leftChain || leftChain !== rightChain) return false;
  const leftAddress = normalizeWalletIdentityAddress(leftChain, left.address);
  const rightAddress = normalizeWalletIdentityAddress(rightChain, right.address);
  return !!leftAddress && leftAddress === rightAddress;
}

function isPositivePostgresBigintString(value) {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) &&
    (value.length < 19 || value <= '9223372036854775807');
}

function redactAdminAuditDetail(value) {
  return String(value || '').slice(0, 300)
    .replace(/(["']?(?:password|passwd|(?:access|refresh|auth|session)[_ -]?token|[a-z0-9]+[_ -]token|token|authorization|bearer|secret|client[_ -]?secret|(?:service[_ -]?role|api|private)[_ -]?key|seed[_ -]?phrase|mnemonic|recovery[_ -]?codes?|id[_ -]?number|otp|totp[_ -]?secret)["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,}\s]+)/ig, '$1"[redacted]"')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[email]')
    .replace(/0x[a-fA-F0-9]{40}/g, '[wallet address]')
    .replace(/T[1-9A-HJ-NP-Za-km-z]{33}/g, '[wallet address]')
    .slice(0, 300);
}

function isValidAuthEmail(value) {
  return typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
function isSupabaseUserId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Read auth_time from a JWT only after the exact token has been accepted by
// Supabase's /auth/v1/user endpoint. The external verification authenticates
// the signed claims; this helper deliberately performs no local trust decision.
function getVerifiedSupabaseAuthTime(accessToken) {
  if (typeof accessToken !== 'string') return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const value = Number(payload && payload.auth_time);
    const subject = String(payload && payload.sub || '');
    if (!Number.isFinite(value) || value <= 0 || !isSupabaseUserId(subject)) return null;
    return { auth_time: value, subject: subject };
  } catch (_) {
    return null;
  }
}

// BTCBOX credentials are independent of Supabase email/password. Passwords are
// stored only as PBKDF2-HMAC-SHA256 hashes with a per-account random salt.
const BTCBOX_PASSWORD_ITERATIONS = 600000;
const BTCBOX_PASSWORD_KEYLEN = 32;
const BTCBOX_PASSWORD_DUMMY_SALT = 'btcbox-username-login-dummy-salt-v1';
function normalizeBtcboxUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function validateBtcboxUsername(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_]{2,23}$/.test(value);
}
function validateBtcboxLoginPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128 && !/[\x00-\x1f\x7f]/.test(value);
}
function hashBtcboxLoginPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, BTCBOX_PASSWORD_ITERATIONS, BTCBOX_PASSWORD_KEYLEN, 'sha256').toString('hex');
}
function verifyBtcboxLoginPassword(user, supplied) {
  if (!user || typeof supplied !== 'string' || !user.login_password_hash || !user.login_password_salt ||
      user.login_password_algo !== 'pbkdf2-sha256-600000') return false;
  const actual = Buffer.from(hashBtcboxLoginPassword(supplied, user.login_password_salt), 'hex');
  const expected = Buffer.from(String(user.login_password_hash), 'hex');
  return actual.length === expected.length && actual.length === BTCBOX_PASSWORD_KEYLEN && crypto.timingSafeEqual(actual, expected);
}
function isSupabaseIdentityLinked(user, supabaseUserId) {
  return !!user && (String(user.supabase_user_id || '') === supabaseUserId ||
    (Array.isArray(user.supabase_user_ids) && user.supabase_user_ids.includes(supabaseUserId)));
}
function getUserLinkedIdentityIds(user) {
  return Array.from(new Set([String(user && user.supabase_user_id || ''), ...(
    Array.isArray(user && user.supabase_user_ids) ? user.supabase_user_ids : []
  )].filter(Boolean)));
}


async function detectGoogleProviderEnabled() {
  const now = Date.now();
  if (_googleProviderCache.value !== null && _googleProviderCache.expiresAt > now) return _googleProviderCache.value;
  const authUrl = String(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const authKey = getPublishableKey();
  if (!authUrl || !authKey) {
    _googleProviderCache = { value: false, expiresAt: now + 60 * 1000 };
    return false;
  }
  try {
    const res = await fetch(authUrl + '/auth/v1/settings', {
      method: 'GET',
      headers: { 'apikey': authKey, 'Authorization': 'Bearer ' + authKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) throw new Error('settings http ' + res.status);
    const data = await res.json();
    const enabled = !!(data && data.external && data.external.google);
    _googleProviderCache = { value: enabled, expiresAt: now + 60 * 1000 };
    return enabled;
  } catch (e) {
    // Keep the last known value; if never known, report null (unknown) and retry soon.
    const prev = _googleProviderCache.value;
    _googleProviderCache = { value: prev, expiresAt: now + 15 * 1000 };
    return prev;
  }
}
// ===== CORS（SPA 与后端跨域必需）=====
// 带 credentials 时 Access-Control-Allow-Origin 不能用 *，必须反射具体 Origin。
// _currentEvent 在 handleRequest 入口赋值，供 json() 合并 CORS 头使用。
let _currentEvent = null;
// CORS allowlist. 默认仅生产域名；localhost 仅在 CONTEXT=dev 时加入。
// Cross-origin requests with credentials are only allowed from origins
// explicitly listed in CORS_ALLOWED_ORIGINS (comma-separated). Unlisted
// origins receive no Access-Control-Allow-Origin header, so the browser blocks
// response reading. Same-origin requests never send an Origin header and are unaffected.
const DEFAULT_CORS_ALLOWED_ORIGINS = 'https://btcboxcdt.vercel.app';
const DEV_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:8000'];
let _corsAllowedOrigins = null;
function corsAllowedOrigins() {
  if (_corsAllowedOrigins === null) {
    const raw = process.env.CORS_ALLOWED_ORIGINS || DEFAULT_CORS_ALLOWED_ORIGINS;
    _corsAllowedOrigins = new Set(String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean));
    // CONTEXT 默认 production（dev 需显式设置）；仅 dev 追加本地开发地址。
    if (process.env.CONTEXT === 'dev') DEV_CORS_ORIGINS.forEach(function (o) { _corsAllowedOrigins.add(o); });
  }
  return _corsAllowedOrigins;
}
function corsHeaders(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin || '';
  const base = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && corsAllowedOrigins().has(origin)) {
    base['Access-Control-Allow-Origin'] = origin;
    base['Access-Control-Allow-Credentials'] = 'true';
  }
  return base;
}

// Partial financial cutover is deliberately blocked: a write-RPC flag alone must never enable it.
// User/admin balance and history reads still use btcbox_state, so switching writes
// to the normalized ledger without an explicit full-cutover approval would split
// financial authority and show stale balances/history. Keep the default fail-closed.
// Financial write/matching gates are explicit opt-in. Unset, empty, malformed,
// or any value other than the exact string '1' keeps the capability disabled.
// Do not set these flags to '1' until isolated PostgreSQL migrations, ledger
// reconciliation, symbol rules, fees, and end-to-end acceptance have passed.
// supabaseStorageConfigured() remains a hard prerequisite in all write paths.
// Flags: FINANCIAL_POSTGRES_RPC_ENABLED, FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED,
// FINANCIAL_POSTGRES_READS_ENABLED, FINANCIAL_MATCHING_ENGINE_ENABLED.
function manualDepositRpcEnabled() {
  return process.env.FINANCIAL_POSTGRES_RPC_ENABLED === '1' &&
    process.env.FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED === '1';
}

function financialPostgresReadsEnabled() {
  return manualDepositRpcEnabled() && process.env.FINANCIAL_POSTGRES_READS_ENABLED === '1';
}

function financialWritesEnabled() {
  return financialPostgresReadsEnabled() && supabaseStorageConfigured();
}

function matchingEngineEnabled() {
  return process.env.FINANCIAL_MATCHING_ENGINE_ENABLED === '1' &&
    manualDepositRpcEnabled() && financialPostgresReadsEnabled() && supabaseStorageConfigured();
}

function matchingEngineRequested() {
  return process.env.FINANCIAL_MATCHING_ENGINE_ENABLED === '1';
}

function matchingPairFromSymbol(symbol) {
  const pairs = { BTCUSDT: ['BTC','USDT'], ETHUSDT: ['ETH','USDT'], SOLUSDT: ['SOL','USDT'],
    BNBUSDT: ['BNB','USDT'], XRPUSDT: ['XRP','USDT'], DOGEUSDT: ['DOGE','USDT'],
    ADAUSDT: ['ADA','USDT'], AVAXUSDT: ['AVAX','USDT'], LINKUSDT: ['LINK','USDT'],
    DOTUSDT: ['DOT','USDT'], TRXUSDT: ['TRX','USDT'], LTCUSDT: ['LTC','USDT'],
    BCHUSDT: ['BCH','USDT'], NEARUSDT: ['NEAR','USDT'], UNIUSDT: ['UNI','USDT'],
    ATOMUSDT: ['ATOM','USDT'], ETCUSDT: ['ETC','USDT'] };
  return pairs[symbol] || null;
}

async function matchingRpc(name, payload) {
  if (!matchingEngineEnabled()) throw new Error('Matching engine cutover is not approved');
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: supabaseHeaders(), body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.ok !== true) {
    const error = new Error('Matching RPC failed');
    error.status = response.status; error.result = result; throw error;
  }
  return result;
}

// Seconds-contract reference price. The server always fetches the open/settle
// price itself from the same trusted feeds as /api/market; client-supplied
// prices are never trusted for balance-affecting operations.
const SECONDS_ALLOWED_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'BNB']);
const SECONDS_ALLOWED_DURATIONS = new Set([30, 60, 300, 900]);
async function fetchSecondsReferencePrice(symbol) {
  if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) throw new Error('symbol unsupported');
  const fetchJson = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error('price provider HTTP ' + response.status);
    return response.json();
  };
  try {
    const ticker = await fetchJson('https://api.exchange.coinbase.com/products/' + symbol + '-USDT/ticker');
    const price = Number(ticker && ticker.price);
    if (Number.isFinite(price) && price > 0) return { price: price, source: 'coinbase', ts: Math.floor(Date.now() / 1000) };
  } catch (_) { /* fall through to Bybit */ }
  try {
    const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + symbol + 'USDT');
    const list = payload && payload.result && payload.result.list;
    const ticker = Array.isArray(list) && list[0];
    const price = Number(ticker && ticker.lastPrice);
    if (Number.isFinite(price) && price > 0) return { price: price, source: 'bybit', ts: Math.floor(Date.now() / 1000) };
  } catch (_) { /* fall through */ }
  throw new Error('reference price unavailable');
}

async function readFinancialAccountSnapshot(userId) {
  if (!supabaseStorageConfigured()) throw new Error('Financial database unavailable');
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/read_financial_account_snapshot_v1', {
    method: 'POST', headers: supabaseHeaders(),
    body: JSON.stringify({ p_user_id: String(userId) })
  });
  if (!response.ok) throw new Error('Financial account read failed');
  const result = await response.json();
  if (!result || result.ok !== true || !result.balances || !Array.isArray(result.withdrawals) || !Array.isArray(result.earn_records)) {
    throw new Error('Financial account response invalid');
  }
  return result;
}

async function readAdminAccountBalances(userIds) {
  if (!supabaseStorageConfigured()) throw new Error('Financial database unavailable');
  if (!Array.isArray(userIds) || userIds.length > 200 || userIds.some(function (id) { return typeof id !== 'string' || !id || id.length > 128; })) {
    throw new Error('Admin account identity list invalid');
  }
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/read_admin_account_balances_v1', {
    method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_user_ids: userIds })
  });
  if (!response.ok) throw new Error('Admin account balance read failed');
  const result = await response.json();
  if (!result || result.ok !== true || !result.accounts || typeof result.accounts !== 'object' || Array.isArray(result.accounts)) {
    throw new Error('Admin account balance response invalid');
  }
  for (const uid of Object.keys(result.accounts)) {
    const assets = result.accounts[uid];
    if (!userIds.includes(uid) || !assets || typeof assets !== 'object' || Array.isArray(assets)) throw new Error('Admin account balance response invalid');
    for (const asset of Object.keys(assets)) {
      // This UI currently supports only these ledger assets. Reject unexpected
      // asset keys rather than silently passing malformed/unsupported balances
      // into valuation and admin controls.
      if (!['USDT', 'BTC', 'ETH', 'SOL'].includes(asset)) throw new Error('Admin account balance response invalid');
      const b = assets[asset];
      if (!b || !Number.isFinite(b.free) || !Number.isFinite(b.frozen) || b.free < 0 || b.frozen < 0) throw new Error('Admin account balance response invalid');
    }
  }
  // A user with no normalized account rows is a valid zero-balance account, not
  // a reason to leak stale legacy balances into a normalized-read response.
  // Return the same predictable asset shape the frontend expects.
  const normalized = {};
  for (const uid of userIds) normalized[uid] = Object.assign(emptyBalances(), result.accounts[uid] || {});
  return normalized;
}

async function readAdminWithdrawalSnapshot() {
  if (!supabaseStorageConfigured()) throw new Error('Financial database unavailable');
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/rpc/read_admin_withdrawal_snapshot_v1', {
    method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({})
  });
  if (!response.ok) throw new Error('Admin withdrawal read failed');
  const result = await response.json();
  if (!result || result.ok !== true || !Array.isArray(result.withdrawals) ||
      !Number.isSafeInteger(result.pending_count) || result.pending_count < 0 ||
      !Number.isSafeInteger(result.pending_admin_review_count) || result.pending_admin_review_count < 0 ||
      result.pending_admin_review_count > result.pending_count) {
    throw new Error('Admin withdrawal response invalid');
  }
  return result;
}
async function readAdminAuditLogPage(params) {
  if (!supabaseStorageConfigured()) throw new Error('Canonical administrator audit storage unavailable');
  const limit = params.limit;
  const query = new URLSearchParams({
    select: 'id::text,actor_id,subject_user_id,action,reason,created_at',
    order: 'id.desc',
    limit: String(limit + 1)
  });
  if (params.before) query.set('id', 'lt.' + params.before);
  if (params.action) query.set('action', 'eq.' + params.action);
  if (params.uid) query.set('subject_user_id', 'eq.' + params.uid);
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  const response = await fetch(base + '/rest/v1/financial_audit_log?' + query.toString(), {
    method: 'GET', headers: supabaseHeaders()
  });
  if (!response.ok) throw new Error('Canonical administrator audit read failed');
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.some(function (row) {
    return !row || !isPositivePostgresBigintString(row.id) ||
      typeof row.action !== 'string' || typeof row.created_at !== 'string';
  })) throw new Error('Canonical administrator audit response invalid');
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(function (row) {
    return {
      id: String(row.id),
      action: String(row.action).slice(0, 100),
      uid: String(row.subject_user_id || '').slice(0, 100),
      by: String(row.actor_id || '').slice(0, 80),
      time: String(row.created_at).slice(0, 40),
      detail: redactAdminAuditDetail(row.reason || ''),
      postgres_sync_status: 'synced'
    };
  });
  return {
    logs: page,
    next_before: hasMore && page.length ? page[page.length - 1].id : null
  };
}
function attachRevision(db, revision) {
  Object.defineProperty(db, '_revision', { value: Number(revision || 0), writable: true, configurable: true, enumerable: false });
  return db;
}
async function loadDB() {
  try {
    if (supabaseStorageConfigured()) {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const response = await fetch(base + '/rest/v1/btcbox_state?select=revision,data&id=eq.main', { headers: supabaseHeaders() });
      if (!response.ok) throw new Error('Supabase state read failed');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Supabase state response invalid');
      if (rows.length > 1) throw new Error('Supabase state row is not unique');
      if (rows.length === 1 && rows[0] && rows[0].data && rows[0].data.users) {
        const data = JSON.parse(JSON.stringify(rows[0].data));
        mergeDepositAddresses(data);
        return attachRevision(data, rows[0].revision);
      }
      // Fail closed: never treat an empty Supabase table as a fresh exchange database.
      // This prevents accidental balance/history loss if secrets are configured before import.
      throw new Error('Supabase state is not initialized');
    }
    // Netlify Blobs has been retired. All persistent state must use Supabase.
    throw new Error('Supabase storage is required');
  } catch (e) {
    // Do not continue with a stale in-memory snapshot if persistent storage is unavailable.
    throw new Error('Persistent storage unavailable');
  }
}

async function saveDB(db) {
  try {
    if (supabaseStorageConfigured()) {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const cleanData = JSON.parse(JSON.stringify(db)); // _revision is intentionally non-enumerable
      const response = await fetch(base + '/rest/v1/rpc/btcbox_save_state', {
        method: 'POST', headers: supabaseHeaders(),
        body: JSON.stringify({ p_expected_revision: Number(db._revision || 0), p_data: cleanData })
      });
      if (!response.ok) throw new Error('Supabase state write failed');
      const saved = await response.json();
      if (saved !== true) throw new Error('Persistent storage write conflict');
      db._revision = Number(db._revision || 0) + 1;
      return;
    }
    // Netlify Blobs has been retired. All persistent state must use Supabase.
    throw new Error('Supabase storage is required');
  } catch (e) {
    if (e && e.message === 'Persistent storage write conflict') throw e;
    throw new Error('Persistent storage write failed');
  }
}

// ===== 充值地址：仅从环境变量读取，fail-closed（绝不回退硬编码地址）=====
// 环境变量缺失或格式不匹配时返回空串，前端该币种充值显示"维护中"。
// 地址格式校验：0x 开头必须是 EVM 链（ETH/ERC20/BEP20），base58 必须是 SOL/TRX/BTC。
// 注意链归属标签：DEPOSIT_BNB（用户标注为 BNA）、DEPOSIT_SOL（用户标注为 SOLO）——请运营确认链归属后再配置。
const DEPOSIT_ADDRESS_PATTERNS = {
  "USDT-TRC20": /^T[1-9A-HJ-NP-Za-km-z]{33}$/,                        // TRON base58
  "USDT-ERC20": /^0x[a-fA-F0-9]{40}$/,                                 // EVM
  "USDT-BEP20": /^0x[a-fA-F0-9]{40}$/,                                 // EVM (BSC)
  "BTC-BTC": /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/, // Bitcoin bech32/P2PKH/P2SH
  "ETH-ERC20": /^0x[a-fA-F0-9]{40}$/,                                  // EVM
  "SOL-SOL": /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,                          // Solana base58（链归属请运营确认：用户标注 SOLO）
  "BNB-BEP20": /^0x[a-fA-F0-9]{40}$/,                                  // EVM (BSC)（链归属请运营确认：用户标注 BNA）
  "USDC-ERC20": /^0x[a-fA-F0-9]{40}$/,                                 // EVM（与 ETH 同地址）
};
const DEPOSIT_ADDRESS_ENV_KEYS = {
  "USDT-TRC20": "DEPOSIT_USDT_TRC20",
  "USDT-ERC20": "DEPOSIT_USDT_ERC20",
  "USDT-BEP20": "DEPOSIT_USDT_BEP20",
  "BTC-BTC": "DEPOSIT_BTC",
  "ETH-ERC20": "DEPOSIT_ETH",
  "SOL-SOL": "DEPOSIT_SOL",
  "BNB-BEP20": "DEPOSIT_BNB",
  "USDC-ERC20": "DEPOSIT_USDC_ERC20",
};
function depositAddressFromEnv(networkKey) {
  const envKey = DEPOSIT_ADDRESS_ENV_KEYS[networkKey];
  const raw = envKey ? String(process.env[envKey] || '').trim() : '';
  if (!raw) return ''; // fail-closed：未配置 → 维护中
  const pattern = DEPOSIT_ADDRESS_PATTERNS[networkKey];
  if (pattern && !pattern.test(raw)) {
    console.warn('[deposit-address] format mismatch for ' + networkKey + ' (env ' + envKey + '); showing maintenance (fail-closed).');
    return ''; // 格式不匹配 → 维护中，绝不展示错误链地址
  }
  return raw;
}
function defaultDB() {
  return {
    users: {},
    sessions: {},
    next_uid: 16588,
    deposit_addresses: {
      "USDT-TRC20": depositAddressFromEnv("USDT-TRC20"),
      "USDT-ERC20": depositAddressFromEnv("USDT-ERC20"),
      "USDT-BEP20": depositAddressFromEnv("USDT-BEP20"),
      "BTC-BTC": depositAddressFromEnv("BTC-BTC"),
      "ETH-ERC20": depositAddressFromEnv("ETH-ERC20"),
      "SOL-SOL": depositAddressFromEnv("SOL-SOL"),
      "BNB-BEP20": depositAddressFromEnv("BNB-BEP20"),
      "USDC-ERC20": depositAddressFromEnv("USDC-ERC20"),
    },
    captcha: {},
  };
}
// Fill any missing deposit-address keys from env so the deposit page always
// shows the configured addresses even when the stored row has an empty map.
// 缺失的键以空串填充（fail-closed，前端显示维护中），绝不回退硬编码地址。
function mergeDepositAddresses(db) {
  const defaults = defaultDB().deposit_addresses;
  db.deposit_addresses = db.deposit_addresses || {};
  Object.keys(defaults).forEach(function (k) {
    if (!db.deposit_addresses[k]) db.deposit_addresses[k] = defaults[k];
  });
}

// ===== 工具函数 =====
function hashPassword(pwd, salt) {
  return crypto.pbkdf2Sync(pwd, salt, PBKDF2_ITER, PBKDF2_KEYLEN, 'sha256').toString('hex');
}
function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function hashFundPassword(pwd, salt) {
  return crypto.pbkdf2Sync(String(pwd), salt, PBKDF2_ITER, PBKDF2_KEYLEN, 'sha256').toString('hex');
}
function verifyFundPassword(user, supplied) {
  if (!user || typeof supplied !== 'string') return false;
  // Financial routes must not mutate legacy state as a side effect of a balance
  // operation. Legacy plaintext records must be replaced through the authenticated
  // security-settings flow before they can authorize a withdrawal.
  if (!user.fund_password_hash || !user.fund_password_salt) return false;
  const actual = Buffer.from(hashFundPassword(supplied, user.fund_password_salt), 'hex');
  const expected = Buffer.from(String(user.fund_password_hash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }
function nowStr() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
// ===== 持久化共享限流：跨 serverless 实例的数据库原子计数 =====
const RATE_LIMIT_POLICIES = Object.freeze({
  login_2fa: { limit: 20, windowSeconds: 900 },
  credential_reauth: { limit: 8, windowSeconds: 900 },
  identity_link_reauth: { limit: 8, windowSeconds: 900 },
  identity_link_target: { limit: 10, windowSeconds: 900 },
  credential_recover: { limit: 5, windowSeconds: 900 },
  twofa_setup_password: { limit: 10, windowSeconds: 900 },
  twofa_setup_confirm: { limit: 10, windowSeconds: 900 },
  twofa_disable: { limit: 10, windowSeconds: 900 },
  seconds_order: { limit: 30, windowSeconds: 300 },
  seconds_settle: { limit: 60, windowSeconds: 300 },
  password_change: { limit: 10, windowSeconds: 900 },
  fund_password_change: { limit: 10, windowSeconds: 900 }
});
async function rateCheckShared(scope, subject) {
  const policy = RATE_LIMIT_POLICIES[scope];
  const secret = String(process.env.BTCBOX_RATE_LIMIT_HMAC_SECRET || '');
  if (!policy || Buffer.byteLength(secret, 'utf8') < 32 ||
      typeof subject !== 'string' || !subject || subject.length > 256 ||
      !supabaseStorageConfigured()) return { unavailable: true };
  const keyHash = crypto.createHmac('sha256', secret)
    .update('btcbox-rate-limit-v1|' + scope + '|' + subject, 'utf8').digest('hex');
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  try {
    const response = await fetch(base + '/rest/v1/rpc/btcbox_rate_limit_consume_v1', {
      method: 'POST', headers: supabaseHeaders(),
      body: JSON.stringify({ p_scope: scope, p_key_hash: keyHash }),
      signal: AbortSignal.timeout(4000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== 'object' || Array.isArray(result) ||
        result.ok !== true || typeof result.allowed !== 'boolean' || result.limit !== policy.limit ||
        !Number.isSafeInteger(result.count) || result.count < 1 || result.count > 1000000 ||
        !Number.isSafeInteger(result.remaining) || result.remaining !== Math.max(0, policy.limit - result.count) ||
        !Number.isSafeInteger(result.retry_after_seconds) || result.retry_after_seconds < 1 ||
        result.retry_after_seconds > policy.windowSeconds ||
        result.window_seconds !== policy.windowSeconds ||
        !Number.isSafeInteger(result.window_start) || result.window_start < 0 ||
        result.window_start % policy.windowSeconds !== 0 ||
        (result.allowed && result.count > policy.limit) || (!result.allowed && result.count <= policy.limit)) {
      return { unavailable: true };
    }
    return { limited: !result.allowed, retryAfter: result.retry_after_seconds };
  } catch (_) {
    return { unavailable: true };
  }
}
function rateLimitUnavailableJson() {
  return json({ ok: false, code: 'RATE_LIMIT_UNAVAILABLE', msg: 'Security checks are temporarily unavailable. Please try again later.' }, 503);
}
function rateLimitedJson(retryAfter) {
  return json({ ok: false, code: 'RATE_LIMITED', msg: 'Too many requests. Please try again later.', retry_after: retryAfter }, 429, { 'Retry-After': String(retryAfter) });
}

// ===== 资金密码强度（≥8 位，必须同时含字母和数字）=====
function validateFundPassword(pwd) {
  if (typeof pwd !== 'string') return { ok: false, msg: 'Fund password is required.' };
  if (pwd.length < 8) return { ok: false, msg: 'Fund password must be at least 8 characters.' };
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return { ok: false, msg: 'Fund password must contain both letters and digits.' };
  if (/\s/.test(pwd)) return { ok: false, msg: 'Fund password must not contain whitespace.' };
  return { ok: true };
}
// ===== 管理员密码强度（≥12 位，必须含大小写字母+数字+符号）；弱密码拒绝启动 =====
function validateAdminPasswordStrength(pass) {
  if (typeof pass !== 'string' || pass.length < 12) return false;
  if (!/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/\d/.test(pass) || !/[^A-Za-z0-9]/.test(pass)) return false;
  const weakList = ['admin123', 'password', 'changeme', 'admin123456', 'Admin123!', 'P@ssw0rd123'];
  if (weakList.indexOf(pass.toLowerCase()) >= 0) return false;
  return true;
}
// 启动时（冷启动模块加载）校验 ADMIN_PASS 强度；弱密码直接抛错拒绝启动。
// 未设置 ADMIN_PASS 时管理后台不可用但不阻止启动。
(function adminPassStartupCheck() {
  const p = process.env.ADMIN_PASS;
  if (p && !validateAdminPasswordStrength(p)) {
    console.error('[admin-auth] startup blocked: ADMIN_PASS is too weak (require >=12 chars with upper/lower case, digit and symbol). Refusing to start.');
    throw new Error('ADMIN_PASS_TOO_WEAK');
  }
})();

// ===== 持久化安全计数器（纯函数，操作普通 counters 对象；由调用方写入 btcbox_state 持久化）=====
// 关键路径（登录/资金密码/admin）的失败计数持久化到 btcbox_state.security_counters，
// 跨 serverless 实例共享，避免内存 Map 在冷启动后清零导致暴力破解绕过。
// counters 形如 { "fundpwd_lock:<uid>": {count, locked_until}, "admin_fail:<ip>": {count, locked_until}, "login_fail:<uid>": {count, locked_until} }
function secCounterIsLocked(counters, key, now) {
  const c = counters && counters[key];
  if (c && c.locked_until && c.locked_until > now) return { locked: true, retryAfter: Math.ceil((c.locked_until - now) / 1000) };
  return { locked: false };
}
function secCounterRecordFailure(counters, key, maxFailures, lockMs, now) {
  if (!counters[key] || (counters[key].locked_until && counters[key].locked_until <= now)) counters[key] = { count: 0, locked_until: 0 };
  const c = counters[key];
  c.count = (c.count || 0) + 1;
  if (c.count >= maxFailures) { c.locked_until = now + lockMs; c.count = maxFailures; }
  return c;
}
function secCounterReset(counters, key) { if (counters && counters[key]) delete counters[key]; }

// ===== 提现白名单+冷却校验（纯函数）=====
// ①提现地址必须在用户已绑定地址列表内（未绑定→拒绝）；②新绑定地址冷却期内禁止提现。
// bound_at 取地址记录的 created_at（格式 'YYYY-MM-DD HH:MM:SS'）。
function withdrawalAddressCheck(user, addr, coin, network, now, cooldownMs) {
  const list = Array.isArray(user && user.addresses) ? user.addresses : [];
  const bound = list.find(function (a) { return a && a.type === 'crypto' && a.address === addr && a.coin === coin && a.network === network; });
  if (!bound) return { allowed: false, code: 'ADDRESS_NOT_BOUND', msg: 'Withdrawal address must be added and verified in your address book first.' };
  if (bound.blocked || bound.unbound) return { allowed: false, code: 'ADDRESS_BLOCKED', msg: 'This withdrawal address is not available.' };
  const boundAt = Date.parse(String(bound.created_at || '').replace(' ', 'T') + 'Z');
  if (Number.isFinite(boundAt) && (now - boundAt) < cooldownMs) {
    const hours = Math.ceil((cooldownMs - (now - boundAt)) / 3600000);
    return { allowed: false, code: 'ADDRESS_COOLDOWN', msg: 'Newly bound withdrawal address is in cooldown. Please try again in about ' + hours + ' hour(s).' };
  }
  return { allowed: true, bound: bound };
}
// 首次提现（历史无成功提现）或大额（USDT 等值超阈值）→ 强制人工审核 pending_admin_review。
function withdrawalRequiresAdminReview(user, coin, amount, usdtValue, thresholdUsdt) {
  const history = Array.isArray(user && user.withdrawals) ? user.withdrawals : [];
  const hasSuccess = history.some(function (w) { return w && (w.status === 'completed' || w.status === 'success' || w.status === 'approved' || w.status === 'broadcast'); });
  if (!hasSuccess) return true;
  if (Number.isFinite(usdtValue) && usdtValue > thresholdUsdt) return true;
  return false;
}
// 估算提现金额的 USDT 等值；价格不可用时返回 null（调用方应保守视为大额，强制审核）。
function estimateUsdtValue(coin, amount, prices) {
  // Review-threshold estimate only; authoritative ledger amounts remain decimal strings.
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return null;
  if (coin === 'USDT' || coin === 'USDC') return numericAmount;
  const p = prices && prices[coin + 'USDT'];
  if (p && Number.isFinite(Number(p))) return numericAmount * Number(p);
  return null;
}
// All API status messages are natively English. User-authored content and data
// fields are intentionally left untouched. The response boundary no longer needs
// a CJK normalization pass; json() serializes the object as-is.
function normalizeApiMessages(value) {
  return value;
}
function json(obj, status, headers) {
  const normalized = normalizeApiMessages(obj);
  return {
    statusCode: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' }, corsHeaders(_currentEvent), headers || {}),
    body: JSON.stringify(normalized),
  };
}
function parseCookies(event) {
  const out = {};
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  raw.split(';').forEach(function (s) {
    const p = s.trim().split('=');
    if (p.length === 2) out[p[0]] = p[1];
  });
  return out;
}
function setCookieHeader(token, maxAge) {
  const secure = process.env.CONTEXT === 'dev' ? '' : '; Secure';
  return { 'Set-Cookie': SESSION_COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax' + secure + '; Max-Age=' + (maxAge || 86400 * 7) };
}
function clearCookieHeader() {
  const secure = process.env.CONTEXT === 'dev' ? '' : '; Secure';
  return { 'Set-Cookie': SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax' + secure + '; Max-Age=0' };
}
function getSessionRecord(db, event) {
  const cookies = parseCookies(event);
  const token = cookies[SESSION_COOKIE];
  const session = token && db.sessions[token];
  if (!session) return null;
  const createdAt = Number(session.created_at);
  if (!Number.isFinite(createdAt) || createdAt <= 0 || createdAt > Date.now() + 60 * 1000 || Date.now() - createdAt > SESSION_MAX_AGE_MS) return null;
  const user = db.users[session.uid] || null;
  return user ? { token: token, session: session, user: user } : null;
}
function getUser(db, event) {
  const record = getSessionRecord(db, event);
  return record ? record.user : null;
}
function emptyBalances() {
  return {
    USDT: { free: 0, frozen: 0 },
    BTC: { free: 0, frozen: 0 },
    ETH: { free: 0, frozen: 0 },
    SOL: { free: 0, frozen: 0 },
    BNB: { free: 0, frozen: 0 },
    USDC: { free: 0, frozen: 0 },
  };
}
function safeDepositAddresses(addresses) {
  const source = addresses && typeof addresses === 'object' && !Array.isArray(addresses) ? addresses : {};
  const result = {};
  const legacyKeys = { 'BTC-BTC': 'BTC-Bitcoin', 'SOL-SOL': 'SOL-Solana' };
  for (const key of ['USDT-TRC20', 'USDT-ERC20', 'USDT-BEP20', 'BTC-BTC', 'ETH-ERC20', 'SOL-SOL']) {
    const legacyKey = legacyKeys[key];
    let raw = source[key];
    if ((typeof raw !== 'string' || !raw.trim()) && legacyKey) raw = source[legacyKey];
    const value = typeof raw === 'string' ? raw.trim() : '';
    result[key] = value && !/PLACEHOLDER/i.test(value) ? value : '';
  }
  return result;
}
function totalUsdt(balances, prices) {
  let total = balances.USDT ? (balances.USDT.free + balances.USDT.frozen) : 0;
  const p = prices && typeof prices === 'object' ? prices : {};
  Object.keys(balances || {}).forEach(function (coin) {
    if (coin === 'USDT') return;
    const balance = balances[coin];
    const price = Number(p[coin]);
    // Never invent a valuation from hard-coded historical prices.
    if (balance && Number.isFinite(price) && price > 0) total += (Number(balance.free || 0) + Number(balance.frozen || 0)) * price;
  });
  return total;
}

async function getLiveUsdtPrices(requestedBases) {
  const bases = Array.from(new Set((requestedBases || []).filter(x => /^[A-Z0-9]{2,12}$/.test(x) && x !== 'USDT'))).sort();
  if (!bases.length) return {};
  const now = Date.now();
  if (livePriceCache.expiresAt > now && bases.every(base => Number.isFinite(livePriceCache.prices[base]) && livePriceCache.prices[base] > 0)) {
    return Object.fromEntries(bases.map(base => [base, livePriceCache.prices[base]]));
  }
  const prices = Object.assign({}, livePriceCache.prices);
  const fetchJson = async url => {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Live price provider unavailable');
    return response.json();
  };
  let missing = bases.slice();
  try {
    const products = await fetchJson('https://api.exchange.coinbase.com/products');
    if (!Array.isArray(products)) throw new Error('Invalid Coinbase products');
    const enabled = new Set(products.filter(p => p && p.quote_currency === 'USDT' && p.status === 'online' && p.trading_disabled !== true).map(p => p.id));
    await Promise.all(bases.map(async base => {
      const product = base + '-USDT';
      if (!enabled.has(product)) return;
      try {
        const stats = await fetchJson('https://api.exchange.coinbase.com/products/' + encodeURIComponent(product) + '/stats');
        const price = Number(stats.last);
        if (Number.isFinite(price) && price > 0) prices[base] = price;
      } catch (_) {}
    }));
    missing = bases.filter(base => !(Number.isFinite(prices[base]) && prices[base] > 0));
  } catch (_) { missing = bases.filter(base => !(Number.isFinite(prices[base]) && prices[base] > 0)); }
  if (missing.length) {
    try {
      const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot');
      const rows = payload && payload.result && payload.result.list;
      if (Array.isArray(rows)) {
        const map = new Map(rows.filter(row => row && /USDT$/.test(row.symbol || '')).map(row => [row.symbol.slice(0, -4), Number(row.lastPrice)]));
        missing.forEach(base => { const price = map.get(base); if (Number.isFinite(price) && price > 0) prices[base] = price; });
      }
    } catch (_) {}
  }
  livePriceCache = { expiresAt: Date.now() + LIVE_PRICE_CACHE_MS, prices: prices };
  return Object.fromEntries(bases.filter(base => Number.isFinite(prices[base]) && prices[base] > 0).map(base => [base, prices[base]]));
}

// ===== TOTP (2FA) =====
function base32Decode(s) {
  const map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  for (let i = 0; i < s.length; i++) bits += map.indexOf(s[i]).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpMatchStep(secret, code) {
  try {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    let matchedStep = null;
    for (let offset = -1; offset <= 1; offset++) {
      const step = counter + offset;
      if (step < 0) continue;
      const buf = Buffer.alloc(8);
      buf.writeBigInt64BE(BigInt(step));
      const hmac = crypto.createHmac('sha1', key).update(buf).digest();
      const o = hmac[hmac.length - 1] & 0x0f;
      const binCode = ((hmac[o] & 0x7f) << 24) | (hmac[o + 1] << 16) | (hmac[o + 2] << 8) | hmac[o + 3];
      const expected = (binCode % 1000000).toString().padStart(6, '0');
      // If a rare six-digit collision matches multiple adjacent steps, consume the newest.
      if (expected === code) matchedStep = step;
    }
    return matchedStep;
  } catch (e) { }
  return null;
}
function totpVerify(secret, code) { return totpMatchStep(secret, code) !== null; }
// Persist the matched 30-second counter with the protected state change.
// State CAS makes concurrent requests using the same step mutually exclusive.
function consumeTotpStep(user, code) {
  const step = totpMatchStep(user && user.twofa_secret, code);
  if (step === null) return false;
  const previous = user.twofa_last_used_step;
  if (previous !== undefined && previous !== null && !Number.isSafeInteger(previous)) return false;
  if (Number.isSafeInteger(previous) && step <= previous) return false;
  user.twofa_last_used_step = step;
  return true;
}
// Parse user-supplied financial amounts strictly; parseFloat('1abc') must never become 1.
// Return a masked identity number for ordinary account responses.
// Full KYC identifiers remain server-side and are never serialized to the user API.
function validateKycSubmission(body) {
  const name = String(body && body.name || '').trim();
  const idType = String(body && body.id_type || 'id_card').trim();
  const idNumber = String(body && body.id_number || '').trim();
  if (name.length < 2 || name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) {
    return { ok: false, msg: 'Enter a valid full name (2–100 characters).' };
  }
  if (!['passport', 'id_card', 'driver_license'].includes(idType)) {
    return { ok: false, msg: 'Select a supported identity document type.' };
  }
  if (idNumber.length < 4 || idNumber.length > 64 || /[\x00-\x1f\x7f]/.test(idNumber)) {
    return { ok: false, msg: 'Enter a valid document number (4–64 characters).' };
  }
  return { ok: true, name, id_type: idType, id_number: idNumber };
}

function maskIdentityNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 4) return '*'.repeat(raw.length);
  return '*'.repeat(Math.max(4, raw.length - 4)) + raw.slice(-4);
}

function parseMoneyInput(value) {
  // Keep monetary values as canonical decimal strings. Never pass them through IEEE-754.
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw.length > 64 || !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw)) return null;
  const parts = raw.split('.');
  const fraction = (parts[1] || '').replace(/0+$/, '');
  return fraction ? parts[0] + '.' + fraction : parts[0];
}
function moneyScaledInteger(value, scale) {
  const parts = String(value).split('.');
  return BigInt(parts[0]) * (10n ** BigInt(scale)) + BigInt(((parts[1] || '').padEnd(scale, '0')) || '0');
}
function compareMoney(a, b) {
  const pa = String(a).split('.'), pb = String(b).split('.');
  const scale = Math.max((pa[1] || '').length, (pb[1] || '').length);
  const ai = moneyScaledInteger(a, scale), bi = moneyScaledInteger(b, scale);
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}
function addMoney(a, b) {
  const pa = String(a).split('.'), pb = String(b).split('.');
  const scale = Math.max((pa[1] || '').length, (pb[1] || '').length);
  const sum = moneyScaledInteger(a, scale) + moneyScaledInteger(b, scale);
  const digits = sum.toString().padStart(scale + 1, '0');
  if (!scale) return digits;
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return fraction ? whole + '.' + fraction : whole;
}

function genTotpSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  const random = crypto.randomBytes(16);
  for (let i = 0; i < random.length; i++) s += chars[random[i] & 31];
  return s;
}

// ===== 路由 =====
async function handleRequest(event, context) {
  _currentEvent = event;
  // Vercel catch-all receives /api/<route>; normalize to the shared route name.
  let path = event.path || '';
  path = path.replace(/^\/api\/?/, '');
  const method = event.httpMethod || 'GET';
  // CORS 预检：直接返回 204，不解析 body、不读 DB。
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(event), body: '' };
  }
  try {
  // Public, read-only deployment preflight. Reports booleans only; never returns keys or secrets.
  // Keep this before loadDB so Auth can be diagnosed even if financial persistence is unavailable.
  // Public, read-only configuration for the React Supabase Auth client.
  // This route intentionally runs before loadDB and only exposes the public anon/publishable key.
  if (path === 'auth-client-config' && method === 'GET') {
    const authUrl = String(process.env.SUPABASE_AUTH_URL || '').trim().replace(/\/+$/, '');
    const publishableKey = getPublishableKey();
    let validAuthUrl = false;
    try {
      const parsed = new URL(authUrl);
      validAuthUrl = parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
    } catch (_) { validAuthUrl = false; }
    if (!validAuthUrl || !publishableKey) {
      return json({ ok: false, code: 'AUTH_CLIENT_CONFIG_UNAVAILABLE', msg: 'Authentication is not configured.' }, 503);
    }
    const googleEnabled = await detectGoogleProviderEnabled();
    return json({
      ok: true,
      supabase_url: authUrl,
      publishable_key: publishableKey,
      google_enabled: googleEnabled
    }, 200);
  }
  if (path === 'auth-health' && method === 'GET') {
    const authUrl = String(process.env.SUPABASE_AUTH_URL || '').replace(/\/+$/, '');
    const authKey = getPublishableKey();
    const expectedAuthUrl = 'https://zlozsutefnmgwwzrlipt.supabase.co';
    const configured = Boolean(authUrl && authKey);
    const projectMatches = authUrl === expectedAuthUrl;
    const googleEnabled = configured ? await detectGoogleProviderEnabled() : false;
    return json({
      ok: configured && projectMatches,
      service: 'btcbox-auth-preflight',
      auth_environment_configured: configured,
      auth_project_matches_expected: projectMatches,
      google_enabled: googleEnabled,
      provider_enabled: googleEnabled,
      provider_enabled_note: googleEnabled === null
        ? 'Google provider status could not be determined (Supabase settings endpoint unreachable).'
        : (googleEnabled ? 'Google provider is enabled in Supabase Auth.' : 'Google provider is disabled in Supabase Auth.'),
      live_oauth_tested: googleEnabled === true
    }, configured && projectMatches ? 200 : 503);
  }
  let body = {};
  if (event.body !== undefined && event.body !== null && event.body !== '') {
    let rawBody;
    try {
      rawBody = event.isBase64Encoded
        ? Buffer.from(String(event.body), 'base64').toString('utf8')
        : String(event.body);
    } catch (e) {
      return json({ ok: false, msg: 'Invalid request format.', code: 'INVALID_REQUEST_BODY' }, 400);
    }
    // Bound parsing cost and memory use for all API endpoints.
    if (Buffer.byteLength(rawBody, 'utf8') > 1024 * 1024) {
      return json({ ok: false, msg: 'Request body too large.', code: 'REQUEST_BODY_TOO_LARGE' }, 413);
    }
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      return json({ ok: false, msg: 'Request body is not valid JSON', code: 'INVALID_JSON' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ ok: false, msg: 'Request body must be a JSON object.', code: 'INVALID_JSON_OBJECT' }, 400);
    }
  }

  let db;
  try { db = await loadDB(); } catch(e) { return json({ ok: false, msg: 'Network error. Please try again.', code: 'PERSISTENCE_UNAVAILABLE' }, 503); }
  if (!db) return json({ ok: false, msg: 'Network error. Please try again.', code: 'PERSISTENCE_UNAVAILABLE' }, 503);

  // ---------- GET /api/config ----------
  if (path === 'config' && method === 'GET') {
    return json({
      ok: true,
      google_mock_enabled: process.env.ALLOW_GOOGLE_MOCK === '1',
      site: { name: 'BTCBOX', version: 'vercel-1.0' },
      announcement: db.announcement || '',
      supabase_auth_url: String(process.env.SUPABASE_AUTH_URL || '').trim(),
      supabase_auth_publishable_key: getPublishableKey(),
    });
  }

  // ---------- POST /api/captcha ----------
  if (path === 'captcha' && method === 'POST') {
    // Never disclose a challenge answer in a public API response. This legacy
    // endpoint has no configured delivery provider, so fail closed rather than
    // pretending that a client-readable code is bot protection.
    return json({ ok: false, code: 'VERIFICATION_UNAVAILABLE', msg: 'Verification is temporarily unavailable. Please try again later.' }, 503);
  }

  // ---------- POST /api/register — disabled: BTCBOX uses Google-only Supabase identity ----------
  if (path === 'register' && method === 'POST') {
    return json({ ok: false, code: 'GOOGLE_ONLY_AUTH', msg: 'Please create your BTCBOX account with Google sign-in.' }, 403);
  }

  // ---------- POST /api/login — BTCBOX username + password ----------
  if (path === 'login' && method === 'POST') {
    const username = normalizeBtcboxUsername(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!db.security_counters) db.security_counters = {};
    const now = Date.now();
    const ipKey = 'login_ip:' + clientIp(event);
    const usernameKey = 'login_username:' + crypto.createHash('sha256').update(username || 'invalid').digest('hex');
    const ipLock = secCounterIsLocked(db.security_counters, ipKey, now);
    const usernameLock = secCounterIsLocked(db.security_counters, usernameKey, now);
    if (ipLock.locked || usernameLock.locked) return rateLimitedJson(Math.max(ipLock.retryAfter || 0, usernameLock.retryAfter || 0));
    secCounterRecordFailure(db.security_counters, ipKey, 20, 15 * 60 * 1000, now);
    secCounterRecordFailure(db.security_counters, usernameKey, 10, 15 * 60 * 1000, now);
    try { await saveDB(db); }
    catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }

    const user = validateBtcboxUsername(username)
      ? Object.values(db.users).find(function (candidate) { return normalizeBtcboxUsername(candidate.username_normalized || candidate.username) === username; })
      : null;
    // Perform the same expensive derivation for unknown usernames to reduce timing-based enumeration.
    const salt = user && user.login_password_salt ? user.login_password_salt : BTCBOX_PASSWORD_DUMMY_SALT;
    const actual = Buffer.from(hashBtcboxLoginPassword(password, salt), 'hex');
    const expected = Buffer.from(user && user.login_password_hash || '0'.repeat(BTCBOX_PASSWORD_KEYLEN * 2), 'hex');
    const passwordMatches = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    if (!user || !user.login_password_hash || !passwordMatches) {
      return json({ ok: false, code: 'INVALID_CREDENTIALS', msg: 'Username or password is incorrect.' }, 401);
    }
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    secCounterReset(db.security_counters, ipKey);
    secCounterReset(db.security_counters, usernameKey);
    if (user.twofa_enabled) {
      const tempToken = genToken();
      db.temp_tokens = db.temp_tokens || {};
      db.temp_tokens[tempToken] = { uid: user.uid, exp: Date.now() + 10 * 60 * 1000, auth_method: 'username_password_2fa' };
      try { await saveDB(db); }
      catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
      return json({ ok: false, require_2fa: true, temp_token: tempToken }, 200);
    }
    user.last_login = nowStr();
    const token = genToken();
    db.sessions[token] = { uid: user.uid, email: user.email || '', created_at: Date.now(), auth_method: 'username_password' };
    try { await saveDB(db); }
    catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
    return json({ ok: true, uid: user.uid }, 200, setCookieHeader(token));
  }

  // ---------- POST /api/supabase-login (Supabase-verified single-provider identity) ----------
  if ((path === 'supabase-login' || path === 'google-login') && method === 'POST') {
    // 登录路径持久化限流（按 IP，20 次/15 分钟），计数存 btcbox_state，跨实例共享。
    if (!db.security_counters) db.security_counters = {};
    const loginKey = 'login_ip:' + clientIp(event);
    const loginRl = secCounterIsLocked(db.security_counters, loginKey, Date.now());
    if (loginRl.locked) return rateLimitedJson(loginRl.retryAfter);
    secCounterRecordFailure(db.security_counters, loginKey, 20, 15 * 60 * 1000, Date.now());
    try { await saveDB(db); } catch (e) { console.warn('[login-rl] persist failed:', e.message); return json({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
    const accessToken = typeof body.supabase_access_token === 'string' ? body.supabase_access_token : '';
    const supabaseUrl = String(process.env.SUPABASE_AUTH_URL || '').replace(/\/$/, '');
    const supabaseKey = getPublishableKey();
    if (!supabaseUrl || !supabaseKey) {
      return json({ ok: false, msg: 'Authentication service is not configured on the server.' }, 503);
    }
    if (!accessToken || accessToken.length > 16384) {
      return json({ ok: false, msg: 'Invalid session. Please sign in again.' }, 401);
    }
    let identity;
    try {
      const verifyResponse = await fetch(supabaseUrl + '/auth/v1/user', {
        method: 'GET',
        headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
      });
      if (!verifyResponse.ok) return json({ ok: false, msg: 'Session verification failed. Please try again.' }, 401);
      identity = await verifyResponse.json();
    } catch (e) {
      return json({ ok: false, msg: 'Authentication service temporarily unavailable. Please try again later.' }, 503);
    }
    const email = String(identity && identity.email || '').trim().toLowerCase();
    const supabaseUserId = String(identity && identity.id || '').trim();
    if (!isSupabaseUserId(supabaseUserId)) {
      return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The verified account identity could not be confirmed. Please sign in again.' }, 403);
    }
    const authProvider = getSingleSupabaseAuthProvider(identity);
    if (!authProvider) {
      return json({ ok: false, code: 'AUTH_PROVIDER_NOT_ALLOWED', msg: 'This account uses multiple or unsupported sign-in methods. Please contact support.' }, 403);
    }
    const walletIdentity = authProvider === 'web3' ? getSupabaseWalletIdentity(identity) : null;
    const confirmed = !!(identity && (identity.email_confirmed_at || identity.confirmed_at));
    if (authProvider === 'web3' ? !walletIdentity : (!isValidAuthEmail(email) || !confirmed)) {
      return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The verified sign-in identity could not be confirmed. Please sign in again.' }, 403);
    }
    if (authProvider === 'google' && await detectGoogleProviderEnabled() !== true) {
      return json({ ok: false, code: 'GOOGLE_PROVIDER_UNAVAILABLE', msg: 'Google sign-in is temporarily unavailable. Please try again later.' }, 503);
    }
    const authProviders = [authProvider];
    // Resolve the internal account by the server-verified Supabase UUID first.
    // Wallet identities have no email; never synthesize one or link by wallet metadata.
    let user = Object.values(db.users).find(function (u) { return isSupabaseIdentityLinked(u, supabaseUserId); });
    if (!user && email) user = Object.values(db.users).find(function (u) { return String(u.email || '').trim().toLowerCase() === email; });
    if (user && !isSupabaseIdentityLinked(user, supabaseUserId)) {
      return json({ ok: false, code: 'SUPABASE_IDENTITY_MISMATCH', msg: 'This identity is already associated with another BTCBOX account. Please contact support.' }, 409);
    }
    if (walletIdentity) {
      const walletOwner = Object.values(db.users).find(function (candidate) {
        const wallets = Array.isArray(candidate.wallet_identities) ? candidate.wallet_identities : [];
        return wallets.some(function (item) { return isSameWalletIdentity(item, walletIdentity); }) ||
          isSameWalletIdentity({ chain: candidate.wallet_chain, address: candidate.wallet_address }, walletIdentity);
      });
      if (walletOwner && (!user || walletOwner.uid !== user.uid)) {
        return json({ ok: false, code: 'IDENTITY_IN_USE', msg: 'This wallet is already associated with another BTCBOX account.' }, 409);
      }
    }
    if (user && user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    // Preserve the existing account's second factor for all Supabase sign-ins.
    // The temporary token can only be exchanged through /api/login/2fa and never creates a session by itself.
    if (user && user.twofa_enabled) {
      const tempToken = genToken();
      db.temp_tokens = db.temp_tokens || {};
      db.temp_tokens[tempToken] = { uid: user.uid, exp: Date.now() + 10 * 60 * 1000, auth_method: authProvider === 'web3' ? 'supabase_web3_2fa' : 'supabase_google_2fa' };
      secCounterReset(db.security_counters, loginKey);
      try { await saveDB(db); }
      catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
      return json({ ok: false, require_2fa: true, temp_token: tempToken }, 200);
    }
    if (!user) {
      const uid = String(db.next_uid++);
      const salt = genSalt();
      user = {
        uid: uid, email: email || '', email_verified: authProvider !== 'web3', supabase_user_id: supabaseUserId,
        supabase_user_ids: [supabaseUserId],
        auth_identities: [{ supabase_user_id: supabaseUserId, provider: authProvider,
          email: email || '', wallet_address: walletIdentity ? walletIdentity.address : '', wallet_chain: walletIdentity ? walletIdentity.chain : '', linked_at: nowStr() }],
        wallet_identities: walletIdentity ? [{ address: walletIdentity.address, chain: walletIdentity.chain, supabase_user_id: supabaseUserId, linked_at: nowStr() }] : [],
        auth_providers: authProviders,
        wallet_address: walletIdentity ? walletIdentity.address : '', wallet_chain: walletIdentity ? walletIdentity.chain : '', addresses: [], address_audit: [],
        password_hash: hashPassword(genToken(), salt), salt: salt,
        fund_password: '', twofa_secret: '', twofa_enabled: false,
        kyc: { status: 'unsubmitted', name: '', id_type: 'id_card', id_number: '', submitted_at: '' },
        balances: emptyBalances(), orders: [], deposits: [], withdrawals: [], earn_records: [], support_messages: [],
        created_at: nowStr(), last_login: nowStr(),
      };
      db.users[uid] = user;
    } else {
      if (email) user.email_verified = true;
      user.supabase_user_ids = getUserLinkedIdentityIds(user);
      if (!user.supabase_user_ids.includes(supabaseUserId)) user.supabase_user_ids.push(supabaseUserId);
      user.auth_identities = Array.isArray(user.auth_identities) ? user.auth_identities : [];
      if (!user.auth_identities.some(function (item) { return item && item.supabase_user_id === supabaseUserId; })) {
        user.auth_identities.push({ supabase_user_id: supabaseUserId, provider: authProvider, email: email || '',
          wallet_address: walletIdentity ? walletIdentity.address : '', wallet_chain: walletIdentity ? walletIdentity.chain : '', linked_at: nowStr() });
      }
      if (walletIdentity) {
        user.wallet_identities = Array.isArray(user.wallet_identities) ? user.wallet_identities : [];
        if (!user.wallet_identities.some(function (item) { return isSameWalletIdentity(item, walletIdentity); })) {
          user.wallet_identities.push({ address: walletIdentity.address, chain: walletIdentity.chain, supabase_user_id: supabaseUserId, linked_at: nowStr() });
        }
        if (!user.wallet_address) { user.wallet_address = walletIdentity.address; user.wallet_chain = walletIdentity.chain; }
      }
      user.auth_providers = Array.from(new Set([].concat(user.auth_providers || [], authProviders)));
    }
    user.last_login = nowStr();
    const token = genToken();
    db.sessions[token] = { uid: user.uid, email: email, created_at: Date.now(), auth_method: authProvider === 'web3' ? 'supabase_web3' : 'supabase_google' };
    secCounterReset(db.security_counters, loginKey);
    try { await saveDB(db); }
    catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
    return json({ ok: true, uid: user.uid }, 200, setCookieHeader(token));
  }

  // ---------- POST /api/logout ----------
  if (path === 'logout' && method === 'POST') {
    const cookies = parseCookies(event);
    const token = cookies[SESSION_COOKIE];
    if (token) delete db.sessions[token];
    await saveDB(db);
    return json({ ok: true }, 200, clearCookieHeader());
  }

  // ---------- POST /api/login/2fa（两步验证第二步） ----------
  if (path === 'login/2fa' && method === 'POST') {
    const tt = body.temp_token || '';
    const code = body.code || '';
    db.temp_tokens = db.temp_tokens || {};
    const rec = typeof tt === 'string' && tt ? db.temp_tokens[tt] : null;
    const expiresAt = Number(rec && rec.exp);
    if (!rec || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      if (rec) {
        delete db.temp_tokens[tt];
        try { await saveDB(db); }
        catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
      }
      return json({ ok: false, code: 'TWOFA_CHALLENGE_EXPIRED', msg: 'Session expired. Please sign in again.' }, 401);
    }
    const u2 = db.users[rec.uid];
    if (!u2) {
      delete db.temp_tokens[tt];
      try { await saveDB(db); }
      catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
      return json({ ok: false, code: 'USER_NOT_FOUND', msg: 'User not found.' }, 401);
    }
    if (!u2.twofa_enabled || !u2.twofa_secret) {
      delete db.temp_tokens[tt];
      try { await saveDB(db); }
      catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
      return json({ ok: false, code: 'TWOFA_NOT_ENABLED', msg: 'Two-factor authentication is no longer enabled. Please sign in again.' }, 401);
    }
    if (u2.frozen) {
      delete db.temp_tokens[tt];
      try { await saveDB(db); }
      catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
      return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    }
    { const rl = await rateCheckShared('login_2fa', String(u2.uid)); if (rl.unavailable) return rateLimitUnavailableJson(); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!consumeTotpStep(u2, String(code))) return json({ ok: false, msg: 'Invalid or already-used 2FA code.' });
    delete db.temp_tokens[tt];
    u2.last_login = nowStr();
    const token2 = genToken();
    db.sessions[token2] = { uid: u2.uid, email: u2.email, created_at: Date.now(), auth_method: rec.auth_method || 'username_password_2fa' };
    try { await saveDB(db); }
    catch (_) { return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Authentication is temporarily unavailable. Please try again.' }, 503); }
    return json({ ok: true }, 200, setCookieHeader(token2));
  }

  // ---------- GET /api/kline (Coinbase primary, Bybit fallback) ----------
  if (path === 'kline' && method === 'GET') {
    const symbol = ((event.queryStringParameters && event.queryStringParameters.symbol) || 'BTCUSDT').toUpperCase();
    const interval = (event.queryStringParameters && event.queryStringParameters.interval) || '1m';
    if (!/^[A-Z0-9]{5,20}$/.test(symbol) || !symbol.endsWith('USDT') || symbol.length <= 4 || !['1m','3m','5m','15m','30m','1h','2h','4h','1d'].includes(interval)) return json({ ok: false, msg: 'Invalid USDT symbol or interval' }, 400);
    const base = symbol.slice(0, -4);
    const coinbaseGranularity = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[interval];
    const timeoutFetchJson = async url => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('market provider HTTP ' + res.status);
      return res.json();
    };
    if (coinbaseGranularity) {
      try {
        const rows = await timeoutFetchJson('https://api.exchange.coinbase.com/products/' + encodeURIComponent(base + '-USDT') + '/candles?granularity=' + coinbaseGranularity);
        if (!Array.isArray(rows)) throw new Error('invalid Coinbase candles');
        const raw = rows.filter(k => Array.isArray(k) && k.length >= 6 && k.slice(0, 6).every(v => Number.isFinite(Number(v))))
          .map(k => [Number(k[0]) * 1000, Number(k[3]), Number(k[2]), Number(k[1]), Number(k[4]), Number(k[5])])
          .sort((a, b) => a[0] - b[0]);
        if (raw.length) return json({ ok: true, source: 'coinbase', klines: raw.map(k => ({ time: k[0], open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5] })), data: raw });
      } catch (_) { /* Try Bybit below; never synthesize candle values. */ }
    }
    try {
      const intervalBybit = { '1m':'1', '3m':'3', '5m':'5', '15m':'15', '30m':'30', '1h':'60', '2h':'120', '4h':'240', '1d':'D' }[interval];
      const payload = await timeoutFetchJson('https://api.bybit.com/v5/market/kline?category=spot&symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(intervalBybit) + '&limit=300');
      const rows = payload && payload.result && payload.result.list;
      if (!Array.isArray(rows)) throw new Error('invalid Bybit candles');
      const raw = rows.filter(k => Array.isArray(k) && k.length >= 6 && k.slice(0, 6).every(v => Number.isFinite(Number(v))))
        .map(k => [Number(k[0]), Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4]), Number(k[5])])
        .sort((a, b) => a[0] - b[0]);
      if (!raw.length) throw new Error('empty Bybit candles');
      return json({ ok: true, source: 'bybit', klines: raw.map(k => ({ time: k[0], open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5] })), data: raw });
    } catch (_) { return json({ ok: false, code: 'KLINE_DATA_UNAVAILABLE', msg: 'K-line data unavailable.', klines: [], data: [] }, 503); }
  }

  // ---------- GET /api/depth (Coinbase primary, Bybit fallback) ----------
  if (path === 'depth' && method === 'GET') {
    const symbol = ((event.queryStringParameters && event.queryStringParameters.symbol) || 'BTCUSDT').toUpperCase();
    if (!/^[A-Z0-9]{5,20}$/.test(symbol) || !symbol.endsWith('USDT') || symbol.length <= 4) return json({ ok: false, msg: 'Invalid USDT symbol' }, 400);
    const base = symbol.slice(0, -4);
    const timeoutFetchJson = async url => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('market provider HTTP ' + res.status);
      return res.json();
    };
    try {
      const book = await timeoutFetchJson('https://api.exchange.coinbase.com/products/' + encodeURIComponent(base + '-USDT') + '/book?level=2');
      if (!Array.isArray(book.bids) || !Array.isArray(book.asks)) throw new Error('invalid Coinbase order book');
      return json({ ok: true, source: 'coinbase', bids: book.bids.slice(0, 20).map(x => [String(x[0]), String(x[1])]), asks: book.asks.slice(0, 20).map(x => [String(x[0]), String(x[1])]) });
    } catch (_) {
      try {
        const payload = await timeoutFetchJson('https://api.bybit.com/v5/market/orderbook?category=spot&symbol=' + encodeURIComponent(symbol) + '&limit=20');
        const book = payload && payload.result;
        if (!book || !Array.isArray(book.b) || !Array.isArray(book.a)) throw new Error('invalid Bybit order book');
        return json({ ok: true, source: 'bybit', bids: book.b.slice(0, 20), asks: book.a.slice(0, 20) });
      } catch (_) { return json({ ok: false, code: 'DEPTH_DATA_UNAVAILABLE', msg: 'Order book data unavailable.', bids: [], asks: [] }, 503); }
    }
  }

  // ---------- 以下接口需要登录 ----------
  const user = getUser(db, event);

  // ---------- POST /api/auth/link-identity/reauth ----------
  // Freshly prove control of an identity already linked to this BTCBOX account.
  if (path === 'auth/link-identity/reauth' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    const sessionRecord = getSessionRecord(db, event);
    if (!sessionRecord || sessionRecord.user.uid !== user.uid) return json({ ok: false, msg: 'Please sign in again.', need_login: true }, 401);
    const reauthLimit = await rateCheckShared('identity_link_reauth', String(user.uid));
    if (reauthLimit.unavailable) return rateLimitUnavailableJson();
    if (reauthLimit.limited) return rateLimitedJson(reauthLimit.retryAfter);
    const accessToken = typeof body.supabase_access_token === 'string' ? body.supabase_access_token : '';
    const supabaseUrl = String(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseKey = getPublishableKey();
    if (!supabaseUrl || !supabaseKey) return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', msg: 'Authentication service is not configured.' }, 503);
    if (!accessToken || accessToken.length > 16384) return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'Please verify a linked sign-in method.' }, 401);
    let identity;
    try {
      const verifyResponse = await fetch(supabaseUrl + '/auth/v1/user', {
        method: 'GET', headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
      });
      if (!verifyResponse.ok) return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The sign-in identity could not be verified.' }, 401);
      identity = await verifyResponse.json();
    } catch (_) {
      return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', msg: 'Authentication service temporarily unavailable.' }, 503);
    }
    const sourceId = String(identity && identity.id || '').trim();
    const claims = getVerifiedSupabaseAuthTime(accessToken);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authTime = claims && claims.auth_time;
    const provider = getSingleSupabaseAuthProvider(identity);
    const walletIdentity = provider === 'web3' ? getSupabaseWalletIdentity(identity) : null;
    const email = String(identity && identity.email || '').trim().toLowerCase();
    const confirmed = !!(identity && (identity.email_confirmed_at || identity.confirmed_at));
    if (!isSupabaseUserId(sourceId) || !claims || claims.subject !== sourceId ||
        !Number.isFinite(authTime) || authTime > nowSeconds + 60 || nowSeconds - authTime > 5 * 60 ||
        !['google', 'web3'].includes(provider) ||
        (provider === 'google' && (!confirmed || !isValidAuthEmail(email))) ||
        (provider === 'web3' && !walletIdentity)) {
      return json({ ok: false, code: 'RECENT_REAUTH_REQUIRED', msg: 'Please freshly verify a sign-in method already connected to this BTCBOX account.' }, 403);
    }
    if (!isSupabaseIdentityLinked(user, sourceId)) {
      return json({ ok: false, code: 'IDENTITY_NOT_LINKED', msg: 'The verified sign-in method is not connected to this BTCBOX account.' }, 403);
    }
    if (provider === 'google' && await detectGoogleProviderEnabled() !== true) {
      return json({ ok: false, code: 'GOOGLE_PROVIDER_UNAVAILABLE', msg: 'Google sign-in is temporarily unavailable.' }, 503);
    }
    if (user.twofa_enabled) {
      const code = typeof body.twofa_code === 'string' ? body.twofa_code : '';
      if (!code) return json({ ok: false, code: 'TWO_FACTOR_REQUIRED', msg: 'Enter your authenticator code to continue.' }, 403);
      if (!consumeTotpStep(user, code)) return json({ ok: false, code: 'TWO_FACTOR_INVALID', msg: 'The authenticator code is incorrect or already used.' }, 403);
    }
    sessionRecord.session.identity_link_reauth = {
      purpose: 'identity_link',
      supabase_user_id: sourceId,
      auth_time: authTime,
      verified_at: Date.now()
    };
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please retry verification.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Verification could not be saved. Please try again.' }, 503);
    }
    return json({ ok: true, expires_in_seconds: 300 });
  }

  // ---------- POST /api/account/credentials/reauth ----------
  // A recent BTCBOX cookie alone is not proof of a recent Google/wallet
  // re-authentication. Verify the linked Supabase identity and its signed auth_time.
  if (path === 'account/credentials/reauth' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    const reauthLimit = await rateCheckShared('credential_reauth', String(user.uid));
    if (reauthLimit.unavailable) return rateLimitUnavailableJson();
    if (reauthLimit.limited) return rateLimitedJson(reauthLimit.retryAfter);
    const sessionRecord = getSessionRecord(db, event);
    if (!sessionRecord || sessionRecord.user.uid !== user.uid) return json({ ok: false, msg: 'Please sign in again.', need_login: true }, 401);
    const accessToken = typeof body.supabase_access_token === 'string' ? body.supabase_access_token : '';
    const supabaseUrl = String(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseKey = getPublishableKey();
    if (!supabaseUrl || !supabaseKey) return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', msg: 'Authentication service is not configured.' }, 503);
    if (!accessToken || accessToken.length > 16384) return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'Please verify a linked sign-in method.' }, 401);
    let identity;
    try {
      const verifyResponse = await fetch(supabaseUrl + '/auth/v1/user', {
        method: 'GET', headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
      });
      if (!verifyResponse.ok) return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The sign-in identity could not be verified.' }, 401);
      identity = await verifyResponse.json();
    } catch (_) {
      return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', msg: 'Authentication service temporarily unavailable.' }, 503);
    }
    const linkedId = String(identity && identity.id || '').trim();
    const claims = getVerifiedSupabaseAuthTime(accessToken);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authTime = claims && claims.auth_time;
    const provider = getSingleSupabaseAuthProvider(identity);
    const walletIdentity = provider === 'web3' ? getSupabaseWalletIdentity(identity) : null;
    const confirmed = !!(identity && (identity.email_confirmed_at || identity.confirmed_at));
    if (!isSupabaseUserId(linkedId) || !claims || claims.subject !== linkedId ||
        !Number.isFinite(authTime) || authTime > nowSeconds + 60 || nowSeconds - authTime > 5 * 60 ||
        !['google', 'web3'].includes(provider) ||
        (provider === 'google' && (!confirmed || !isValidAuthEmail(String(identity.email || '').trim().toLowerCase()))) ||
        (provider === 'web3' && !walletIdentity)) {
      return json({ ok: false, code: 'RECENT_REAUTH_REQUIRED', msg: 'Please complete a fresh Google or wallet verification, then try again.' }, 403);
    }
    if (!isSupabaseIdentityLinked(user, linkedId)) {
      return json({ ok: false, code: 'IDENTITY_NOT_LINKED', msg: 'Verify a Google account or wallet already linked to this BTCBOX account.' }, 403);
    }
    if (user.twofa_enabled) {
      const twoFactorCode = typeof body.twofa_code === 'string' ? body.twofa_code : '';
      if (!twoFactorCode) return json({ ok: false, code: 'TWO_FACTOR_REQUIRED', msg: 'Enter your authenticator code to continue.' }, 403);
      if (!consumeTotpStep(user, twoFactorCode)) return json({ ok: false, code: 'TWO_FACTOR_INVALID', msg: 'The authenticator code is incorrect or already used.' }, 403);
    }
    sessionRecord.session.credential_reauth = {
      purpose: 'credential_recovery',
      supabase_user_id: linkedId,
      auth_time: authTime,
      verified_at: Date.now()
    };
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please retry verification.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Verification could not be saved. Please try again.' }, 503);
    }
    return json({ ok: true, recovery_window_seconds: 300 });
  }

  // ---------- POST /api/account/credentials/recover ----------
  // One short-lived server-side re-auth marker authorizes one password reset.
  if (path === 'account/credentials/recover' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    const recoverLimit = await rateCheckShared('credential_recover', String(user.uid));
    if (recoverLimit.unavailable) return rateLimitUnavailableJson();
    if (recoverLimit.limited) return rateLimitedJson(recoverLimit.retryAfter);
    const sessionRecord = getSessionRecord(db, event);
    const verified = sessionRecord && sessionRecord.session && sessionRecord.session.credential_reauth;
    const verifiedAt = Number(verified && verified.verified_at);
    const linkedId = String(verified && verified.supabase_user_id || '');
    if (!sessionRecord || sessionRecord.user.uid !== user.uid || !Number.isFinite(verifiedAt) ||
        Date.now() - verifiedAt < 0 || Date.now() - verifiedAt > 5 * 60 * 1000 ||
        !verified || verified.purpose !== 'credential_recovery' ||
        !Number.isFinite(Number(verified.auth_time)) ||
        Number(verified.auth_time) > Date.now() / 1000 + 60 ||
        Date.now() / 1000 - Number(verified.auth_time) > 5 * 60 ||
        !isSupabaseIdentityLinked(user, linkedId)) {
      return json({ ok: false, code: 'RECENT_REAUTH_REQUIRED', msg: 'Please verify a linked Google account or wallet again before resetting your password.' }, 403);
    }
    const password = typeof body.password === 'string' ? body.password : '';
    if (!validateBtcboxLoginPassword(password)) return json({ ok: false, code: 'PASSWORD_INVALID', msg: 'Password must be 12–128 characters and cannot contain control characters.' }, 400);
    const suppliedUsername = body.username === undefined || body.username === null || body.username === ''
      ? '' : normalizeBtcboxUsername(body.username);
    if (suppliedUsername && !validateBtcboxUsername(suppliedUsername)) {
      return json({ ok: false, code: 'USERNAME_INVALID', msg: 'Username must be 3–24 characters and use lowercase letters, numbers, or underscores.' }, 400);
    }
    if (!user.username && !suppliedUsername) {
      return json({ ok: false, code: 'USERNAME_REQUIRED', msg: 'Set a BTCBOX username before resetting your password.' }, 400);
    }
    if (suppliedUsername) {
      const duplicate = Object.values(db.users).find(function (candidate) {
        return candidate.uid !== user.uid && normalizeBtcboxUsername(candidate.username_normalized || candidate.username) === suppliedUsername;
      });
      if (duplicate) return json({ ok: false, code: 'USERNAME_TAKEN', msg: 'This username is already in use. Please choose another.' }, 409);
      user.username = suppliedUsername;
      user.username_normalized = suppliedUsername;
    }
    user.login_password_salt = genSalt();
    user.login_password_hash = hashBtcboxLoginPassword(password, user.login_password_salt);
    user.login_password_algo = 'pbkdf2-sha256-600000';
    user.credentials_updated_at = nowStr();
    // Password recovery revokes other BTCBOX sessions and outstanding 2FA login tokens.
    Object.keys(db.sessions || {}).forEach(function (token) {
      if (token !== sessionRecord.token && db.sessions[token] && db.sessions[token].uid === user.uid) delete db.sessions[token];
    });
    Object.keys(db.temp_tokens || {}).forEach(function (token) {
      if (db.temp_tokens[token] && db.temp_tokens[token].uid === user.uid) delete db.temp_tokens[token];
    });
    // A credential reset invalidates every account-scoped reauthentication proof.
    delete sessionRecord.session.credential_reauth;
    delete sessionRecord.session.identity_link_reauth;
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please retry.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Your password could not be saved. Please try again.' }, 503);
    }
    return json({ ok: true, username: user.username, has_login_password: true });
  }

  // ---------- POST /api/account/credentials ----------
  // Credentials belong to the existing internal account; this never creates a second user.
  if (path === 'account/credentials' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    const currentSessionRecord = getSessionRecord(db, event);
    if (!currentSessionRecord || currentSessionRecord.user.uid !== user.uid) {
      return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Your session is no longer valid. Please sign in again.' }, 403);
    }
    const username = normalizeBtcboxUsername(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
    if (!validateBtcboxUsername(username)) return json({ ok: false, code: 'USERNAME_INVALID', msg: 'Username must be 3–24 characters and use lowercase letters, numbers, or underscores.' }, 400);
    if (!validateBtcboxLoginPassword(password)) return json({ ok: false, code: 'PASSWORD_INVALID', msg: 'Password must be 12–128 characters and cannot contain control characters.' }, 400);
    const hasCredentials = !!(user.login_password_hash && user.login_password_salt && user.login_password_algo === 'pbkdf2-sha256-600000');
    if (hasCredentials && !verifyBtcboxLoginPassword(user, currentPassword)) {
      return json({ ok: false, code: 'CURRENT_PASSWORD_INVALID', msg: 'Current BTCBOX password is incorrect.' }, 403);
    }
    if (!hasCredentials) {
      const createdAt = Number(currentSessionRecord.session && currentSessionRecord.session.created_at);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > 5 * 60 * 1000) {
        return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Please sign in again before setting your BTCBOX username and password.' }, 403);
      }
    }
    const duplicate = Object.values(db.users).find(function (candidate) {
      return candidate.uid !== user.uid && normalizeBtcboxUsername(candidate.username_normalized || candidate.username) === username;
    });
    if (duplicate) return json({ ok: false, code: 'USERNAME_TAKEN', msg: 'This username is already in use. Please choose another.' }, 409);
    user.username = username;
    user.username_normalized = username;
    user.login_password_salt = genSalt();
    user.login_password_hash = hashBtcboxLoginPassword(password, user.login_password_salt);
    user.login_password_algo = 'pbkdf2-sha256-600000';
    user.credentials_updated_at = nowStr();
    // Credential changes invalidate every other session while preserving this request's session.
    Object.keys(db.sessions || {}).forEach(function (token) {
      const session = db.sessions[token];
      if (token !== currentSessionRecord.token && session && session.uid === user.uid) delete db.sessions[token];
    });
    // Even the preserved current session must not retain stale account reauthentication proofs.
    delete currentSessionRecord.session.credential_reauth;
    delete currentSessionRecord.session.identity_link_reauth;
    // A credential change also invalidates outstanding second-factor login challenges.
    Object.keys(db.temp_tokens || {}).forEach(function (token) {
      if (db.temp_tokens[token] && db.temp_tokens[token].uid === user.uid) delete db.temp_tokens[token];
    });
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please reload and try again.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Account settings could not be saved. Please try again.' }, 503);
    }
    return json({ ok: true, username: user.username, has_login_password: true });
  }

  // ---------- POST /api/auth/link-identity ----------
  // The current BTCBOX session proves control of the account; the second verified
  // Supabase access token proves control of the identity being added.
  if (path === 'auth/link-identity' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, code: 'ACCOUNT_FROZEN', msg: 'Account frozen. Please contact support.' }, 403);
    const sessionRecord = getSessionRecord(db, event);
    const marker = sessionRecord && sessionRecord.session && sessionRecord.session.identity_link_reauth;
    const markerAge = Date.now() - Number(marker && marker.verified_at);
    if (!sessionRecord || sessionRecord.user.uid !== user.uid ||
        !marker || marker.purpose !== 'identity_link' ||
        !isSupabaseIdentityLinked(user, String(marker.supabase_user_id || '')) ||
        !Number.isFinite(markerAge) || markerAge < 0 || markerAge > 5 * 60 * 1000 ||
        !Number.isFinite(Number(marker.auth_time)) ||
        Date.now() / 1000 - Number(marker.auth_time) > 5 * 60 ||
        Number(marker.auth_time) > Date.now() / 1000 + 60) {
      return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Please freshly verify a sign-in method already connected to this BTCBOX account.' }, 403);
    }
    const targetLimit = await rateCheckShared('identity_link_target', String(user.uid));
    if (targetLimit.unavailable) return rateLimitUnavailableJson();
    if (targetLimit.limited) return rateLimitedJson(targetLimit.retryAfter);
    const accessToken = typeof body.supabase_access_token === 'string' ? body.supabase_access_token : '';
    const supabaseUrl = String(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const supabaseKey = getPublishableKey();
    if (!supabaseUrl || !supabaseKey) return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', msg: 'Authentication service is not configured.' }, 503);
    if (!accessToken || accessToken.length > 16384) return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The identity to link could not be verified.' }, 401);
    let identity;
    try {
      const verifyResponse = await fetch(supabaseUrl + '/auth/v1/user', {
        method: 'GET', headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + accessToken, 'Accept': 'application/json' }
      });
      if (!verifyResponse.ok) return json({ ok: false, code: 'INVALID_SUPABASE_IDENTITY', msg: 'The identity to link could not be verified.' }, 401);
      identity = await verifyResponse.json();
    } catch (_) {
      return json({ ok: false, code: 'AUTH_SERVICE_UNAVAILABLE', msg: 'Authentication service temporarily unavailable.' }, 503);
    }
    const linkedId = String(identity && identity.id || '').trim();
    const targetClaims = getVerifiedSupabaseAuthTime(accessToken);
    const targetNowSeconds = Math.floor(Date.now() / 1000);
    const targetAuthTime = targetClaims && targetClaims.auth_time;
    const linkedEmail = String(identity && identity.email || '').trim().toLowerCase();
    const provider = getSingleSupabaseAuthProvider(identity);
    const walletIdentity = provider === 'web3' ? getSupabaseWalletIdentity(identity) : null;
    const confirmed = !!(identity && (identity.email_confirmed_at || identity.confirmed_at));
    if (!isSupabaseUserId(linkedId) || !targetClaims || targetClaims.subject !== linkedId ||
        !Number.isFinite(targetAuthTime) || targetAuthTime > targetNowSeconds + 60 ||
        targetNowSeconds - targetAuthTime > 5 * 60 ||
        !['google', 'web3'].includes(provider) ||
        (provider === 'google' && (!isValidAuthEmail(linkedEmail) || !confirmed)) ||
        (provider === 'web3' && !walletIdentity)) {
      return json({ ok: false, code: 'RECENT_TARGET_REAUTH_REQUIRED', msg: 'Please freshly verify the Google account or wallet you want to link.' }, 403);
    }
    if (String(marker.supabase_user_id) === linkedId) {
      return json({ ok: false, code: 'IDENTITY_LINK_SOURCE_TARGET_SAME', msg: 'Choose a different sign-in method to link.' }, 409);
    }
    if (provider === 'google' && await detectGoogleProviderEnabled() !== true) {
      return json({ ok: false, code: 'GOOGLE_PROVIDER_UNAVAILABLE', msg: 'Google sign-in is temporarily unavailable.' }, 503);
    }
    if (isSupabaseIdentityLinked(user, linkedId)) return json({ ok: false, code: 'IDENTITY_ALREADY_LINKED', msg: 'This identity is already linked to your BTCBOX account.' }, 409);
    const conflict = Object.values(db.users).find(function (candidate) {
      if (candidate.uid === user.uid) return false;
      if (isSupabaseIdentityLinked(candidate, linkedId)) return true;
      if (provider === 'google' && linkedEmail && String(candidate.email || '').trim().toLowerCase() === linkedEmail) return true;
      if (walletIdentity) {
        const wallets = Array.isArray(candidate.wallet_identities) ? candidate.wallet_identities : [];
        return wallets.some(function (item) { return isSameWalletIdentity(item, walletIdentity); }) ||
          isSameWalletIdentity({ chain: candidate.wallet_chain, address: candidate.wallet_address }, walletIdentity);
      }
      return false;
    });
    if (conflict) return json({ ok: false, code: 'IDENTITY_IN_USE', msg: 'This identity is already associated with another BTCBOX account. Sign in to that account instead.' }, 409);

    user.supabase_user_ids = getUserLinkedIdentityIds(user);
    user.supabase_user_ids.push(linkedId);
    user.auth_identities = Array.isArray(user.auth_identities) ? user.auth_identities : [];
    if (user.supabase_user_id && !user.auth_identities.some(function (item) { return item && item.supabase_user_id === user.supabase_user_id; })) {
      const primaryProvider = Array.isArray(user.auth_providers) && user.auth_providers.length === 1 ? user.auth_providers[0] : 'unknown';
      user.auth_identities.push({ supabase_user_id: user.supabase_user_id, provider: primaryProvider,
        email: user.email || '', wallet_address: user.wallet_address || '', wallet_chain: user.wallet_chain || '', linked_at: user.created_at || nowStr() });
    }
    user.auth_identities.push({ supabase_user_id: linkedId, provider: provider, email: linkedEmail || '',
      wallet_address: walletIdentity ? walletIdentity.address : '', wallet_chain: walletIdentity ? walletIdentity.chain : '', linked_at: nowStr() });
    if (walletIdentity) {
      user.wallet_identities = Array.isArray(user.wallet_identities) ? user.wallet_identities : [];
      const walletAlreadyRecorded = user.wallet_identities.some(function (item) {
        return isSameWalletIdentity(item, walletIdentity);
      }) || isSameWalletIdentity({ chain: user.wallet_chain, address: user.wallet_address }, walletIdentity);
      if (!walletAlreadyRecorded) {
        user.wallet_identities.push({ address: walletIdentity.address, chain: walletIdentity.chain, supabase_user_id: linkedId, linked_at: nowStr() });
      }
      if (!user.wallet_address) { user.wallet_address = walletIdentity.address; user.wallet_chain = walletIdentity.chain; }
    }
    if (provider === 'google' && !user.email) user.email = linkedEmail;
    user.auth_providers = Array.from(new Set([].concat(user.auth_providers || [], [provider])));
    delete sessionRecord.session.identity_link_reauth;
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please reload and try again.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Identity could not be linked. Please try again.' }, 503);
    }
    return json({ ok: true, linked_identities: user.auth_identities.map(function (item) {
      return { provider: item.provider || 'unknown', wallet_address: item.wallet_address || '', wallet_chain: item.wallet_chain || '', linked_at: item.linked_at || '' };
    }) });
  }

  // ---------- POST /api/2fa/enable ----------
  // Never disclose an already-enabled TOTP secret to a session-only caller.
  // Local-password accounts must re-enter that password; OAuth/magic-link accounts
  // must have signed in within the last five minutes before starting enrollment.
  if (path === '2fa/enable' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.twofa_enabled) return json({ ok: false, code: 'TWOFA_ALREADY_ENABLED', msg: 'Two-factor authentication is already enabled.' }, 409);
    if (Array.isArray(user.auth_providers) && user.auth_providers.length) {
      const sessionRecord = getSessionRecord(db, event);
      const createdAt = Number(sessionRecord && sessionRecord.session && sessionRecord.session.created_at);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > 5 * 60 * 1000) {
        return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Please sign in again before enabling two-factor authentication.' }, 403);
      }
    } else {
      { const rl = await rateCheckShared('twofa_setup_password', String(user.uid)); if (rl.unavailable) return rateLimitUnavailableJson(); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
      const currentPassword = String(body.current_password || '');
      if (!currentPassword || hashPassword(currentPassword, user.salt) !== user.password_hash) return json({ ok: false, code: 'REAUTH_FAILED', msg: 'The current login password is incorrect.' }, 403);
    }
    if (!user.twofa_secret) { user.twofa_secret = genTotpSecret(); delete user.twofa_last_used_step; }
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please reload and try again.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Two-factor setup could not be saved. Please try again.' }, 503);
    }
    return json({ ok: true, secret: user.twofa_secret, enabled: false });
  }
  // ---------- POST /api/2fa/confirm ----------
  if (path === '2fa/confirm' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.twofa_enabled) return json({ ok: false, code: 'TWOFA_ALREADY_ENABLED', msg: 'Two-factor authentication is already enabled.' }, 409);
    if (!user.twofa_secret) return json({ ok: false, code: 'TWOFA_SETUP_REQUIRED', msg: 'Please start the two-factor authentication setup first.' }, 400);
    const currentSessionRecord = getSessionRecord(db, event);
    if (!currentSessionRecord || currentSessionRecord.user.uid !== user.uid) return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Your session is no longer valid. Please sign in again.' }, 403);
    { const rl = await rateCheckShared('twofa_setup_confirm', String(user.uid)); if (rl.unavailable) return rateLimitUnavailableJson(); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!consumeTotpStep(user, String(body.code || ''))) return json({ ok: false, msg: 'Invalid or already-used verification code.' }, 403);
    user.twofa_enabled = true;
    // Enabling a second factor invalidates sessions and pending login challenges issued before enrollment.
    Object.keys(db.sessions || {}).forEach(function (token) {
      const session = db.sessions[token];
      if (token !== currentSessionRecord.token && session && session.uid === user.uid) delete db.sessions[token];
    });
    Object.keys(db.temp_tokens || {}).forEach(function (token) {
      if (db.temp_tokens[token] && db.temp_tokens[token].uid === user.uid) delete db.temp_tokens[token];
    });
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please reload and try again.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Two-factor authentication could not be enabled. Please try again.' }, 503);
    }
    return json({ ok: true, msg: 'Two-factor authentication enabled.' });
  }
  // ---------- POST /api/2fa/disable ----------
  if (path === '2fa/disable' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!user.twofa_enabled || !user.twofa_secret) return json({ ok: false, code: 'TWOFA_NOT_ENABLED', msg: 'Two-factor authentication is not enabled.' }, 409);
    const currentSessionRecord = getSessionRecord(db, event);
    if (!currentSessionRecord || currentSessionRecord.user.uid !== user.uid) return json({ ok: false, code: 'REAUTH_REQUIRED', msg: 'Your session is no longer valid. Please sign in again.' }, 403);
    { const rl = await rateCheckShared('twofa_disable', String(user.uid)); if (rl.unavailable) return rateLimitUnavailableJson(); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (!consumeTotpStep(user, String(body.code || ''))) return json({ ok: false, msg: 'Invalid or already-used verification code.' }, 403);
    user.twofa_enabled = false;
    user.twofa_secret = ''; // Rotate the secret on next enrollment; do not retain a disabled factor.
    delete user.twofa_last_used_step;
    // Removing a second factor invalidates other active sessions; retain only this verified session.
    Object.keys(db.sessions || {}).forEach(function (token) {
      const session = db.sessions[token];
      if (token !== currentSessionRecord.token && session && session.uid === user.uid) delete db.sessions[token];
    });
    // Pending second-step challenges are no longer valid after the factor is disabled.
    Object.keys(db.temp_tokens || {}).forEach(function (token) {
      if (db.temp_tokens[token] && db.temp_tokens[token].uid === user.uid) delete db.temp_tokens[token];
    });
    try { await saveDB(db); }
    catch (e) {
      if (e && e.message === 'Persistent storage write conflict') return json({ ok: false, code: 'ACCOUNT_UPDATE_CONFLICT', msg: 'Your account changed at the same time. Please reload and try again.' }, 409);
      return json({ ok: false, code: 'PERSISTENCE_UNAVAILABLE', msg: 'Two-factor authentication could not be disabled. Please try again.' }, 503);
    }
    return json({ ok: true, msg: 'Two-factor authentication disabled.' });
  }

  // ---------- GET /api/account ----------
  if (path === 'account' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    let financialSnapshot = null;
    if (financialPostgresReadsEnabled()) {
      try { financialSnapshot = await readFinancialAccountSnapshot(user.uid); }
      catch (e) { return json({ ok: false, msg: 'Financial account temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
    }
    // 兼容前端旧字段：每个币种补 amount(=free) / usdt(估值)，返回 total_usdt 别名
    const compatBalances = {};
    const accountBalances = financialSnapshot ? financialSnapshot.balances : user.balances;
    let livePrices = {};
    try { livePrices = await getLiveUsdtPrices(Object.keys(accountBalances)); } catch (_) { livePrices = {}; }
    const unpricedAssets = [];
    Object.keys(accountBalances).forEach(function (c) {
      const b = accountBalances[c];
      const price = c === 'USDT' ? 1 : (Number(livePrices[c]) || 0);
      if (c !== 'USDT' && (Number(b.free || 0) + Number(b.frozen || 0)) > 0 && price <= 0) unpricedAssets.push(c);
      compatBalances[c] = { free: b.free, frozen: b.frozen, amount: b.free, usdt: (b.free + b.frozen) * price, valuation_available: c === 'USDT' || price > 0 };
    });
    const total = totalUsdt(accountBalances, livePrices);
    return json({
      ok: true,
      uid: user.uid, email: user.email || '', username: user.username || '', has_login_password: !!user.login_password_hash,
      auth_providers: Array.isArray(user.auth_providers) ? user.auth_providers : [],
      linked_identities: (Array.isArray(user.auth_identities) ? user.auth_identities : []).map(function (item) {
        return { provider: item.provider || 'unknown', wallet_address: item.wallet_address || '', wallet_chain: item.wallet_chain || '', linked_at: item.linked_at || '' };
      }),
      wallet_address: user.wallet_address || '', wallet_chain: user.wallet_chain || '',
      // Do not serialize the full identity number to an ordinary user session.
      // Keep the existing id_number field for UI compatibility, but expose only its masked form.
      kyc: {
        status: user.kyc && user.kyc.status || 'unsubmitted',
        name: user.kyc && user.kyc.name || '',
        id_type: user.kyc && user.kyc.id_type || 'id_card',
        id_number: maskIdentityNumber(user.kyc && user.kyc.id_number),
        submitted_at: user.kyc && user.kyc.submitted_at || '',
        reviewed_at: user.kyc && user.kyc.reviewed_at || '',
        reject_reason: user.kyc && user.kyc.reject_reason || ''
      },
      kyc_level: user.kyc && user.kyc.status === 'approved' ? 2 : (user.kyc && user.kyc.status === 'pending' ? 1 : 0),
      balances: compatBalances,
      totalUsdt: total,
      total_usdt: total,
      valuation_complete: unpricedAssets.length === 0,
      unpriced_assets: unpricedAssets,
      orders: user.orders.slice(-50),
      deposits: user.deposits.slice(-20),
      withdrawals: financialSnapshot ? financialSnapshot.withdrawals : user.withdrawals.slice(-20),
      earn_records: financialSnapshot ? financialSnapshot.earn_records : user.earn_records,
      fund_password_set: !!(user.fund_password_hash || user.fund_password),
      // OAuth/magic-link accounts have no locally usable password; require an enabled
      // TOTP factor for sensitive fund-password changes instead of accepting session-only authority.
      fundpwd_reauth_mode: Array.isArray(user.auth_providers) && user.auth_providers.length ? 'twofa' : 'password',
      twofa_enabled: user.twofa_enabled,
      deposit_addresses: safeDepositAddresses(db.deposit_addresses),
      addresses: (user.addresses || []).map(function(a){ const out=Object.assign({},a); if(out.type==='crypto' && out.address) out.address=out.address.length>14?out.address.slice(0,6)+'••••••'+out.address.slice(-6):out.address; if(out.account_number) out.account_number='••••'+out.account_number.slice(-4); if(out.routing_number) out.routing_number='••••'+out.routing_number.slice(-4); return out; }),
    });
  }

  // ---------- GET /api/addresses ----------
  if (path === 'addresses' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    return json({ ok: true, addresses: (user.addresses || []).map(function(a){
      const out = Object.assign({}, a);
      if (out.type === 'bank') {
        out.account_number = out.account_number ? '••••' + out.account_number.slice(-4) : '';
        out.routing_number = out.routing_number ? '••••' + out.routing_number.slice(-4) : '';
      } else if (out.type === 'crypto') {
        out.address = out.address.length > 14 ? out.address.slice(0,6) + '••••••' + out.address.slice(-6) : out.address;
      }
      return out;
    }) });
  }

  // ---------- GET /api/addresses/select?id=... (owner-only full address for withdrawal confirmation) ----------
  if (path === 'addresses/select' && method === 'GET') {
    if (!user) return json({ok:false,msg:'Not signed in.',need_login:true},401);
    const id=(event.queryStringParameters && event.queryStringParameters.id) || '';
    const a=(user.addresses||[]).find(function(x){return x.id===id;});
    if(!a || a.type!=='crypto' || a.blocked || a.unbound) return json({ok:false,msg:'Please contact support.'},404);
    return json({ok:true,address:a.address,coin:a.coin,network:a.network});
  }

  // ---------- POST /api/addresses ----------
  if (path === 'addresses' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    const type = body.type === 'bank' ? 'bank' : 'crypto';
    const note = String(body.note || '').trim().slice(0,80);
    let record;
    if (type === 'crypto') {
      const coin = String(body.coin || '').toUpperCase();
      const network = String(body.network || '').toUpperCase();
      const address = String(body.address || '').trim();
      const allowed = { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'], BNB:['BEP20'], USDC:['ERC20'] };
      if (!allowed[coin] || allowed[coin].indexOf(network) < 0) return json({ok:false,msg:'Operation failed: coin and network do not match.'},400);
      let valid = false;
      if (coin === 'BTC') valid = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(address);
      else if (network === 'ERC20' || network === 'BEP20') valid = /^0x[a-fA-F0-9]{40}$/.test(address);
      else if (network === 'TRC20') valid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
      else if (coin === 'SOL') valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      if (!valid) return json({ok:false,msg:'Operation failed: invalid address format.'},400);
      record = { id:'A'+Date.now()+crypto.randomBytes(3).toString('hex'), type:type, coin:coin, network:network, address:address, note:note, created_at:nowStr(), flagged:false, blocked:false };
    } else {
      const holder=String(body.account_holder||'').trim().slice(0,120), bank=String(body.bank_name||'').trim().slice(0,120), account=String(body.account_number||'').replace(/\s/g,''), routing=String(body.routing_number||'').replace(/\s/g,''), swift=String(body.swift||'').trim().toUpperCase(), bankAddress=String(body.bank_address||'').trim().slice(0,240);
      if (!holder || !bank || !/^\d{4,34}$/.test(account) || !/^\d{9}$/.test(routing) || (swift && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) || !bankAddress) return json({ok:false,msg:'Operation failed: please check your bank account details.'},400);
      record={id:'A'+Date.now()+crypto.randomBytes(3).toString('hex'),type:type,account_holder:holder,bank_name:bank,account_number:account,routing_number:routing,swift:swift,bank_address:bankAddress,note:note,created_at:nowStr(),flagged:false,blocked:false};
    }
    if (!Array.isArray(user.addresses)) user.addresses=[];
    user.addresses.push(record);
    if (!Array.isArray(user.address_audit)) user.address_audit=[];
    user.address_audit.push({id:'L'+Date.now(),action:'created',address_id:record.id,by:'user',time:nowStr()});
    await saveDB(db);
    return json({ok:true,msg:'Submitted successfully.',address:{id:record.id,type:record.type,coin:record.coin,network:record.network,note:record.note,created_at:record.created_at}});
  }

  // Address book is immutable for end users; only support may change/unbind it.
  if (path.indexOf('addresses/') === 0 && method === 'DELETE' || path.indexOf('addresses/') === 0 && method === 'PATCH') {
    if (!user) return json({ok:false,msg:'Not signed in.',need_login:true},401);
    return json({ok:false,msg:'Please contact support.'},403);
  }

  // ---------- POST /api/kyc ----------
  if (path === 'kyc' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.kyc && user.kyc.status === 'approved') return json({ ok: false, code: 'KYC_ALREADY_APPROVED', msg: 'Identity verification already approved. No need to resubmit.' }, 409);
    if (user.kyc && user.kyc.status === 'pending') return json({ ok: false, code: 'KYC_ALREADY_PENDING', msg: 'Identity verification is under review. Please do not resubmit.' }, 409);
    const submission = validateKycSubmission(body);
    if (!submission.ok) return json({ ok: false, code: 'KYC_INVALID_INPUT', msg: submission.msg }, 400);
    user.kyc = {
      status: 'pending',
      name: submission.name,
      id_type: submission.id_type,
      id_number: submission.id_number,
      submitted_at: nowStr(),
    };
    await saveDB(db);
    return json({ ok: true, code: 'KYC_SUBMITTED', status: 'pending', msg: 'Identity verification submitted. Review typically completes within 1-3 business days.' });
  }

  // ---------- POST /api/deposit ----------
  if (path === 'deposit' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    const coin = body.coin || 'USDT';
    const network = body.network || 'TRC20';
    const parsedAmount = body.amount === undefined || body.amount === null || body.amount === '' ? '0' : parseMoneyInput(body.amount);
    if (parsedAmount === null) return json({ ok: false, msg: 'Invalid amount format.' }, 400);
    const amount = parsedAmount;
    // amount <= 0 时为查询地址模式，仅返回充值地址，不入账
    if (compareMoney(amount, '0') <= 0) {
      const key = coin + '-' + network;
      const legacyKey = key === 'BTC-BTC' ? 'BTC-Bitcoin' : (key === 'SOL-SOL' ? 'SOL-Solana' : '');
      const addr = db.deposit_addresses[key] || (legacyKey && db.deposit_addresses[legacyKey]) || '';
      if (!addr || /PLACEHOLDER/i.test(addr)) return json({ ok: false, msg: 'Deposit address not configured yet.' }, 503);
      return json({ ok: true, address: addr, msg: 'Deposit address.' });
    }
    // Fail closed: user-supplied requests must never credit balances without verified chain data.
    return json({ ok: false, msg: 'User-submitted deposit amounts are not accepted. BTCBOX staff verify incoming transfers and manually credit the account.' }, 403);
  }

  // ---------- GET /api/withdrawal/config ----------
  // Expose only the public withdrawal form contract and fail-closed availability.
  if (path === 'withdrawal/config' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    return json({
      ok: true,
      actions_enabled: financialWritesEnabled() && manualDepositRpcEnabled() && supabaseStorageConfigured(),
      fees: { USDT: 1.0, BTC: 0.0001, ETH: 0.001, SOL: 0.01, BNB: 0.0005, USDC: 1.0 },
      allowed_networks: { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'], BNB:['BEP20'], USDC:['ERC20'] }
    });
  }

  // ---------- POST /api/withdraw ----------
  if (path === 'withdraw' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    // Enforce account freeze on every financial write, not only at login. Existing
    // sessions remain valid after an administrator freezes an account.
    if (user.frozen) return json({ ok: false, msg: 'Account frozen. Withdrawals are not available. Please contact support.', code: 'ACCOUNT_FROZEN' }, 403);
    const coin = String(body.coin || 'USDT').trim().toUpperCase();
    const amount = parseMoneyInput(body.amount);
    const addr = String(body.address || '').trim();
    const network = String(body.network || '').toUpperCase();
    // Require a client-generated idempotency key so network retries cannot create a
    // second withdrawal for the same submit action. Persistent transactional locking
    // is still required to protect against simultaneous writes across server instances.
    const requestId = String(body.request_id || '').trim();
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) return json({ ok: false, msg: 'Invalid request ID. Please refresh and try again.' }, 400);
    // PostgreSQL is the sole idempotency authority for withdrawals. Do not consult
    // the legacy state document for a replay decision; it may be stale after cutover.
    if (!addr) return json({ ok: false, msg: 'Please enter a withdrawal address.' }, 400);
    if (amount === null || compareMoney(amount, '0') <= 0 || compareMoney(amount, '1000000000000') > 0) return json({ ok: false, msg: 'Invalid amount.' }, 400);
    const allowedNetworks = { BTC:['BTC'], ETH:['ERC20'], USDT:['TRC20','ERC20','BEP20'], SOL:['SOL'], BNB:['BEP20'], USDC:['ERC20'] };
    if (!allowedNetworks[coin] || allowedNetworks[coin].indexOf(network) < 0) return json({ok:false,msg:'Operation failed: coin and network do not match.'},400);
    let addressValid = false;
    if (coin === 'BTC') addressValid = /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(addr);
    else if (network === 'ERC20' || network === 'BEP20') addressValid = /^0x[a-fA-F0-9]{40}$/.test(addr);
    else if (network === 'TRC20') addressValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
    else if (coin === 'SOL') addressValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
    if (!addressValid) return json({ok:false,msg:'Operation failed: invalid address format.'},400);
    // 提现白名单+冷却：地址必须已绑定（未绑定→拒绝），新绑定地址冷却期内禁止提现。
    const cooldownMs = (Number(process.env.WITHDRAWAL_ADDRESS_COOLDOWN_HOURS) || 24) * 3600 * 1000;
    const addrCheck = withdrawalAddressCheck(user, addr, coin, network, Date.now(), cooldownMs);
    if (!addrCheck.allowed) return json({ ok: false, code: addrCheck.code, msg: addrCheck.msg }, 403);
    const supportedFees = { USDT: 1.0, BTC: 0.0001, ETH: 0.001, SOL: 0.01, BNB: 0.0005, USDC: 1.0 };
    if (!Object.prototype.hasOwnProperty.call(supportedFees, coin)) return json({ ok: false, msg: 'Operation failed: withdrawals for this coin are not supported.' }, 400);
    const fee = String(supportedFees[coin]);
    const totalDebit = addMoney(amount, fee);
    if (compareMoney(totalDebit, '0') <= 0) return json({ ok: false, msg: 'Invalid amount.' }, 400);
    // 首次提现 / 大额提现（USDT 等值超阈值，价格不可用时保守视为大额）→ 强制人工审核 pending_admin_review。
    const thresholdUsdt = Number(process.env.WITHDRAWAL_LARGE_THRESHOLD_USDT) || 1000;
    const usdtValue = estimateUsdtValue(coin, amount, livePriceCache.prices);
    const requireAdminReview = withdrawalRequiresAdminReview(user, coin, amount, usdtValue === null ? Infinity : usdtValue, thresholdUsdt);
    // 资金密码校验（≥8 位含字母+数字）+ 持久化错误计数锁定（5 次错误锁 15 分钟，计数存 btcbox_state）。
    const fundPassword = String(body.fund_password || '');
    const fpValid = validateFundPassword(fundPassword);
    if (!fpValid.ok) return json({ ok: false, code: 'FUND_PASSWORD_REQUIRED', msg: fpValid.msg }, 400);
    if (!db.security_counters) db.security_counters = {};
    const lockKey = 'fundpwd_lock:' + user.uid;
    const lockState = secCounterIsLocked(db.security_counters, lockKey, Date.now());
    if (lockState.locked) return json({ ok: false, code: 'FUND_PASSWORD_LOCKED', msg: 'Too many incorrect fund password attempts. Please try again later.', retry_after: lockState.retryAfter }, 429);
    if (typeof user.fund_password === 'string' && user.fund_password.length > 0 && !user.fund_password_hash) {
      return json({ ok: false, code: 'FUND_PASSWORD_UPGRADE_REQUIRED', msg: 'Legacy fund password must be reset in Security Center before withdrawal' }, 403);
    }
    if (!verifyFundPassword(user, fundPassword)) {
      secCounterRecordFailure(db.security_counters, lockKey, 5, 15 * 60 * 1000, Date.now());
      try { await saveDB(db); } catch (e) { console.warn('[fundpwd-lock] persist failed:', e.message); return json({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE', msg: 'Withdrawal security checks are temporarily unavailable. Please try again.' }, 503); }
      return json({ ok: false, code: 'FUND_PASSWORD_INVALID', msg: 'Incorrect fund password, or no fund password is set. Please set one in Security Center first.' }, 403);
    }
    secCounterReset(db.security_counters, lockKey);
    try { await saveDB(db); } catch (e) { console.warn('[fundpwd-lock] reset persist failed:', e.message); return json({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE', msg: 'Withdrawal security checks are temporarily unavailable. Please try again.' }, 503); }
    if (user.twofa_enabled && !/^\d{6}$/.test(String(body.twofa_code || ''))) return json({ ok: false, code: 'TWOFA_REQUIRED', msg: 'Two-factor authentication is enabled on this account. Please enter your 2FA code.' }, 400);
    if (user.twofa_enabled && !consumeTotpStep(user, String(body.twofa_code || ''))) return json({ ok: false, code: 'TWOFA_INVALID', msg: 'Invalid or already-used 2FA code.' }, 403);
    if (user.twofa_enabled) {
      try { await saveDB(db); }
      catch (e) { return json({ ok: false, code: 'SECURITY_STATE_UNAVAILABLE', msg: 'Withdrawal security checks are temporarily unavailable. Please try again.' }, 503); }
    }
    // 输入与安全校验全部通过后再检查资金切开关；RPC 错误 fail-closed，绝不回退 Blobs。
    if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not submitted and your balance was unchanged.' }, 503);
    const withdrawalId = 'W' + Date.now() + crypto.randomBytes(8).toString('hex');
    if (manualDepositRpcEnabled()) {
      if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Withdrawal was not submitted.' }, 503);
      const requestHash = crypto.createHash('sha256').update([String(user.uid), coin, network, String(amount), String(fee), addr, requestId].join('|')).digest('hex');
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const rpc = await fetch(base + '/rest/v1/rpc/create_withdrawal_atomic', {
          method: 'POST', headers: supabaseHeaders(),
          body: JSON.stringify({ p_withdrawal_id: withdrawalId, p_user_id: String(user.uid), p_asset: coin,
            p_network: network, p_amount: String(amount), p_fee: String(fee), p_destination: addr,
            p_request_id: requestId, p_request_hash: requestHash, p_require_admin_review: requireAdminReview })
        });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.withdrawal_id || !['pending', 'pending_admin_review', 'approved', 'rejected', 'broadcast', 'failed'].includes(result.status) || typeof result.require_admin_review !== 'boolean') {
          const insufficient = rpc.status === 400 && /insufficient funds/i.test(JSON.stringify(result));
          return json({ ok: false, code: insufficient ? 'INSUFFICIENT_FUNDS' : 'FINANCIAL_RPC_FAILED', msg: insufficient ? 'Insufficient available balance (including fees).' : 'Withdrawal request was not confirmed by the database. Please check your operation history before retrying.' }, insufficient ? 400 : 503);
        }
        return json({ ok: true, duplicate: result.duplicate === true, withdrawal_id: result.withdrawal_id, status: result.status, require_admin_review: result.require_admin_review, msg: result.duplicate === true ? 'This withdrawal request has already been received. Do not submit it again.' : (result.require_admin_review ? 'Withdrawal request submitted and flagged for admin review.' : 'Withdrawal request submitted. Funds will be sent after review.') });
      } catch (e) {
        return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Withdrawal is unconfirmed. Please check your operation history before retrying.' }, 503);
      }
    }
    return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not submitted and your balance was unchanged.' }, 503);
  }

  // ---------- GET /api/market ----------
  if (path === 'market' && method === 'GET') {
    // Coinbase is the primary source. Bybit is used only for symbols whose Coinbase
    // product/statistics are unavailable. Both sources are explicitly restricted to
    // BASE-USDT spot pairs so USDT and USD quotes are never silently mixed.
    const bases = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'MATIC', 'LTC', 'BCH', 'NEAR', 'UNI', 'ATOM', 'ETC'];
    const now = Math.floor(Date.now() / 1000);
    const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
    const fetchJson = async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('market provider HTTP ' + response.status);
      return response.json();
    };
    const normalize = (base, ticker, source) => {
      const price = Number(ticker.price);
      const high = Number(ticker.high);
      const low = Number(ticker.low);
      const chg = Number(ticker.chg);
      const vol = Number(ticker.vol);
      if (![price, high, low, chg, vol].every(Number.isFinite) || price <= 0 || high <= 0 || low <= 0 || vol < 0) return null;
      return { sym: base, price, chg, high, low, vol, ts: now, source };
    };
    const marketsByBase = {};
    let coinbaseAvailable = false;
    try {
      const products = await fetchJson('https://api.exchange.coinbase.com/products');
      if (!Array.isArray(products)) throw new Error('invalid Coinbase product list');
      const enabled = new Set(products.filter(p => p && p.quote_currency === 'USDT' && p.status === 'online' && p.trading_disabled !== true).map(p => p.id));
      const coinbaseRows = await Promise.all(bases.map(async base => {
        const productId = base + '-USDT';
        if (!enabled.has(productId)) return null;
        try {
          const stats = await fetchJson('https://api.exchange.coinbase.com/products/' + productId + '/stats');
          const price = Number(stats.last);
          const open = Number(stats.open);
          const baseVolume = Number(stats.volume);
          if (!finitePositive(price) || !finitePositive(open) || !finitePositive(stats.high) || !finitePositive(stats.low) || !Number.isFinite(baseVolume) || baseVolume < 0) return null;
          return normalize(base, { price, high: Number(stats.high), low: Number(stats.low), chg: (price - open) / open * 100, vol: baseVolume * price }, 'coinbase');
        } catch (_) { return null; }
      }));
      coinbaseRows.forEach(row => { if (row) marketsByBase[row.sym] = row; });
      coinbaseAvailable = coinbaseRows.some(Boolean);
    } catch (_) {
      // Provider failure is intentionally handled by the fallback below.
    }
    const missingBases = bases.filter(base => !marketsByBase[base]);
    if (missingBases.length) {
      try {
        const payload = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot');
        const list = payload && payload.result && payload.result.list;
        if (!Array.isArray(list)) throw new Error('invalid Bybit ticker payload');
        const bybit = new Map(list.filter(t => t && /USDT$/.test(t.symbol || '')).map(t => [t.symbol.slice(0, -4), t]));
        missingBases.forEach(base => {
          const t = bybit.get(base);
          if (!t) return;
          const price = Number(t.lastPrice), high = Number(t.highPrice24h), low = Number(t.lowPrice24h);
          const chg = Number(t.price24hPcnt) * 100, vol = Number(t.turnover24h);
          const row = normalize(base, { price, high, low, chg, vol }, 'bybit');
          if (row) marketsByBase[base] = row;
        });
      } catch (_) {
        // Keep valid Coinbase rows; do not invent prices for missing symbols.
      }
    }
    const out = bases.filter(base => marketsByBase[base]).map(base => {
      const row = marketsByBase[base];
      return { sym: row.sym, price: row.price, chg: row.chg, high: row.high, low: row.low, vol: (row.vol / 1e9).toFixed(2) + 'B', source: row.source };
    });
    const dataObj = {};
    out.forEach(row => { dataObj[row.sym] = { price: row.price, chg: row.chg, high: row.high, low: row.low, vol: marketsByBase[row.sym].vol, ts: now, source: row.source }; });
    if (!out.length) return json({ ok: false, code: 'MARKET_DATA_UNAVAILABLE', msg: 'Market data unavailable.', markets: [], data: {}, source: coinbaseAvailable ? 'coinbase_partial' : 'unavailable' }, 503);
    // Public market snapshots contain no user data. Allow short shared-cache reuse
    // so free serverless plans do not fetch every provider for every browser poll.
    // Authenticated/private/financial endpoints retain the default no-store policy.
    return json({ ok: true, markets: out, data: dataObj, source: missingBases.length ? 'coinbase_primary_bybit_fallback' : 'coinbase' }, 200, { 'Cache-Control': 'public, max-age=2, s-maxage=5, stale-while-revalidate=3' });
  }

  // ---------- POST /api/order ----------
  // Never simulate fills or mutate customer balances outside the PostgreSQL matching RPC.
  if (path === 'order' && method === 'POST') {
    // Never simulate fills or mutate customer balances outside the PostgreSQL matching RPC.
    // Never simulate fills: an unavailable or unapproved engine must fail closed.
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'Account frozen. Trading is not available. Please contact support.', code: 'ACCOUNT_FROZEN' }, 403);
    const symbol = String(body.symbol || 'BTCUSDT').toUpperCase();
    const side = String(body.side || 'buy').toLowerCase();
    const type = String(body.type || body.order_type || 'limit').toLowerCase();
    const qty = parseMoneyInput(body.qty);
    const price = parseMoneyInput(body.price === undefined || body.price === null || body.price === '' ? '0' : body.price);
    const pair = matchingPairFromSymbol(symbol);
    if (!pair) return json({ ok: false, msg: 'Operation failed: this trading pair is not supported.' }, 400);
    if (!['buy','sell'].includes(side)) return json({ ok: false, msg: 'Operation failed: invalid trade direction.' }, 400);
    // Market orders are intentionally rejected until a separately bounded market-order policy exists.
    if (type !== 'limit') return json({ ok: false, code: 'ORDER_TYPE_UNSUPPORTED', msg: 'Only limit orders are currently supported.' }, 400);
    if (qty === null || compareMoney(qty, '0') <= 0 || compareMoney(qty, '1000000000000') > 0) return json({ ok: false, msg: 'Operation failed: invalid quantity.' }, 400);
    if (price === null || compareMoney(price, '0') <= 0 || compareMoney(price, '1000000000000000') > 0) return json({ ok: false, msg: 'Operation failed: invalid limit price.' }, 400);
    const clientOrderId = String(body.client_order_id || body.request_id || '').trim();
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(clientOrderId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'Please provide a valid client_order_id (16-100 characters).' }, 400);
    if (!matchingEngineEnabled()) {
      return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Matching engine cutover is not approved. No order was created and your balance was unchanged.' }, 503);
    }
    const orderId = 'O' + crypto.randomUUID().replace(/-/g, '');
    try {
      const result = await matchingRpc('submit_limit_order_matching_v1', {
        p_order_id: orderId, p_user_id: String(user.uid), p_base_asset: pair[0], p_quote_asset: pair[1],
        p_side: side, p_price: price, p_quantity: qty, p_client_order_id: clientOrderId
      });
      return json({ ok: true, duplicate: !!result.duplicate, order_id: result.order_id || orderId,
        status: result.status, price: result.price, quantity: result.quantity,
        remaining_quantity: result.remaining_quantity, reserved_remaining: result.reserved_remaining });
    } catch (e) {
      const status = e.status === 400 ? 400 : 503;
      return json({ ok: false, code: e.status === 400 ? 'ORDER_REJECTED' : 'MATCHING_RPC_UNAVAILABLE',
        msg: e.status === 400 ? 'Order validation failed. Please check trading pair rules, available balance, and request parameters.' : 'Matching database temporarily unavailable. Order result is unconfirmed. Please check your orders before retrying.' }, status);
    }
  }

  // ---------- POST /api/order/cancel ----------
  if (path === 'order/cancel' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    const orderId = String(body.order_id || '').trim();
    const cancelId = String(body.client_cancel_id || body.request_id || '').trim();
    if (!orderId || orderId.length > 128) return json({ ok: false, code: 'INVALID_ORDER_ID', msg: 'Invalid order ID.' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(cancelId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'Please provide a valid client_cancel_id (16-100 characters).' }, 400);
    if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Matching engine cutover is not approved. Cancel was not executed.' }, 503);
    try {
      const result = await matchingRpc('cancel_limit_order_matching_v1', {
        p_user_id: String(user.uid), p_order_id: orderId, p_client_cancel_id: cancelId
      });
      return json({ ok: true, duplicate: !!result.duplicate, order_id: result.order_id || orderId, status: result.status });
    } catch (e) {
      return json({ ok: false, code: e.status === 400 ? 'CANCEL_REJECTED' : 'MATCHING_RPC_UNAVAILABLE',
        msg: e.status === 400 ? 'Cancel failed. Please check the order status.' : 'Matching database temporarily unavailable. Cancel result is unconfirmed. Please check your orders before retrying.' }, e.status === 400 ? 400 : 503);
    }
  }

  // ---------- GET /api/earn/products ----------
  // The active catalog is read from PostgreSQL; never substitute frontend seed data.
  if (path === 'earn/products' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!supabaseStorageConfigured()) return json({ ok: false, code: 'EARN_CATALOG_UNAVAILABLE', msg: 'Earn products are temporarily unavailable.' }, 503);
    try {
      const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const query = 'select=product_id,asset,product_type,apy_percent,term_days,early_fee_percent,amount_scale,active,updated_at&active=eq.true&order=asset.asc,term_days.asc';
      const response = await fetch(base + '/rest/v1/earn_product_catalog?' + query, {
        method: 'GET', headers: supabaseHeaders(), signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return json({ ok: false, code: 'EARN_CATALOG_UNAVAILABLE', msg: 'Earn products are temporarily unavailable.' }, 503);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(function (item) {
        return !item || typeof item.product_id !== 'string' || typeof item.asset !== 'string' ||
          !['demand', 'fixed'].includes(item.product_type) || !Number.isFinite(Number(item.apy_percent)) ||
          !Number.isInteger(Number(item.term_days)) || !Number.isFinite(Number(item.early_fee_percent)) ||
          !Number.isInteger(Number(item.amount_scale)) || item.active !== true;
      })) return json({ ok: false, code: 'EARN_CATALOG_INVALID', msg: 'Earn product data is invalid.' }, 503);
      return json({ ok: true, products: rows, actions_enabled: financialWritesEnabled() && supabaseStorageConfigured() });
    } catch (e) {
      return json({ ok: false, code: 'EARN_CATALOG_UNAVAILABLE', msg: 'Earn products are temporarily unavailable.' }, 503);
    }
  }

  // ---------- POST /api/earn ----------
  if (path === 'earn' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'Account frozen. Earn operations are not available. Please contact support.', code: 'ACCOUNT_FROZEN' }, 403);
    // Financial actions become usable only through the atomic PostgreSQL ledger.
    // Never fall back to the legacy Blobs wallet if configuration/RPC fails.
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Earn service cutover is incomplete. Funds were unchanged.' }, 503);
    }
    const action = String(body.action || 'subscribe');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const requestId = String(body.request_id || '').trim();
    if (action === 'subscribe') {
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid subscription request ID is required.' }, 400);
      const amount = parseMoneyInput(body.amount);
      if (amount === null || compareMoney(amount, '0') <= 0 || compareMoney(amount, '1000000000000') > 0) return json({ ok: false, msg: 'Invalid amount.' }, 400);
      const productId = String(body.product_id || 'flex_USDT');
      const products = new Set(['demand','flex_USDT','flex_BTC','flex_ETH','fixed30','fixed90','fixed180']);
      if (!products.has(productId)) return json({ ok: false, msg: 'This earn product is not supported.' }, 400);
      const asset = productId.endsWith('_BTC') ? 'BTC' : productId.endsWith('_ETH') ? 'ETH' : 'USDT';
      const positionId = 'EP' + crypto.createHash('sha256').update(String(user.uid) + '|' + requestId).digest('hex').slice(0, 32);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), product_id: productId, asset, amount: String(amount), request_id: requestId })).digest('hex');
      try {
        const rpc = await fetch(base + '/rest/v1/rpc/subscribe_earn_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_product_id: productId, p_asset: asset, p_principal: String(amount), p_request_id: requestId, p_request_hash: requestHash }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Earn subscription was not confirmed by the database. Please check your operation history before retrying.' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, record_id: result.position_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? 'This subscription request has already been processed. Do not submit it again.' : 'Subscription successful.' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Subscription result is unconfirmed. Please check your operation history.' }, 503); }
    }
    if (action === 'redeem') {
      const positionId = String(body.record_id || '').trim();
      if (!positionId || positionId.length > 128) return json({ ok: false, msg: 'Invalid record ID.' }, 400);
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid redemption request ID is required.' }, 400);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), position_id: positionId, request_id: requestId })).digest('hex');
      try {
        const rpc = await fetch(base + '/rest/v1/rpc/redeem_earn_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_request_id: requestId, p_request_hash: requestHash }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Earn redemption was not confirmed by the database. Please check your operation history before retrying.' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, record_id: result.position_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? 'This redemption request has already been processed.' : 'Redemption successful.' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Redemption result is unconfirmed. Please check your operation history.' }, 503); }
    }
    return json({ ok: false, msg: 'Unknown operation.' }, 400);
  }

  // ---------- 秒合约 Seconds Contracts ----------
  // Balance-affecting logic lives exclusively in the atomic PostgreSQL RPC.
  // Default is fail-closed (financialWritesEnabled() === false): no order is
  // created and no balance changes until the PostgreSQL cutover is approved.
  // The client never mutates BTCBOX.account.balances directly; it refreshes
  // from /api/account after each confirmed operation.

  // ---------- GET /api/seconds/policy ----------
  if (path === 'seconds/policy' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!supabaseStorageConfigured()) {
      return json({ ok: false, code: 'SECONDS_POLICY_UNAVAILABLE', msg: 'Short-term contract policy is temporarily unavailable.' }, 503);
    }
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/read_active_seconds_policy_v1', {
        method: 'POST', headers: supabaseHeaders(), body: '{}'
      });
      const result = await rpc.json().catch(() => null);
      const policy = result && result.policy;
      const validPolicy = policy && Number.isSafeInteger(Number(policy.policy_version)) && Number(policy.policy_version) > 0 &&
        Array.isArray(policy.symbols) && policy.symbols.length > 0 && policy.symbols.every((symbol) => SECONDS_ALLOWED_SYMBOLS.has(symbol)) &&
        Array.isArray(policy.durations_sec) && policy.durations_sec.length > 0 && policy.durations_sec.every((duration) => SECONDS_ALLOWED_DURATIONS.has(Number(duration))) &&
        compareMoney(policy.min_stake, '0') > 0 && compareMoney(policy.max_stake, policy.min_stake) >= 0 &&
        Number.isSafeInteger(Number(policy.payout_bps)) && Number(policy.payout_bps) >= 8500 &&
        (policy.per_user_open_exposure == null || compareMoney(policy.per_user_open_exposure, '0') > 0);
      if (!rpc.ok || !result || result.ok !== true || !validPolicy) {
        return json({ ok: false, code: 'SECONDS_POLICY_UNAVAILABLE', msg: 'Short-term contract policy is not configured or is invalid.' }, 503);
      }
      return json({ ok: true, policy, actions_enabled: financialWritesEnabled() });
    } catch (_) {
      return json({ ok: false, code: 'SECONDS_POLICY_UNAVAILABLE', msg: 'Short-term contract policy is temporarily unavailable.' }, 503);
    }
  }

  // ---------- POST /api/seconds/order ----------
  if (path === 'seconds/order' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'This account is frozen and cannot open short-term contracts.', code: 'ACCOUNT_FROZEN' }, 403);
    const rl = await rateCheckShared('seconds_order', String(user.uid));
    if (rl.unavailable) return rateLimitUnavailableJson();
    if (rl.limited) return rateLimitedJson(rl.retryAfter);
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Short-term contracts are unavailable until financial cutover is complete. No funds were frozen and no position was created.' }, 503);
    }
    const symbol = String(body.symbol || 'BTC').toUpperCase();
    const direction = String(body.direction || 'up').toLowerCase();
    const durationSec = Number(body.duration_sec || body.duration || 30);
    const amount = parseMoneyInput(body.amount);
    const requestId = String(body.request_id || '').trim();
    if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) return json({ ok: false, msg: 'This trading pair is not supported for short-term contracts.' }, 400);
    if (!['up', 'down'].includes(direction)) return json({ ok: false, msg: 'Invalid trade direction.' }, 400);
    if (!SECONDS_ALLOWED_DURATIONS.has(durationSec)) return json({ ok: false, msg: 'Invalid contract duration.' }, 400);
    if (amount === null || compareMoney(amount, '0') <= 0 || compareMoney(amount, '1000000000000') > 0) return json({ ok: false, msg: 'Invalid investment amount.' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid request ID (16-100 characters) is required.' }, 400);
    const positionId = 'SC' + crypto.createHash('sha256').update(String(user.uid) + '|' + requestId).digest('hex').slice(0, 30);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), symbol, direction, amount: String(amount), duration_sec: durationSec, request_id: requestId })).digest('hex');
    // Existing requests can be replayed from persisted state without a live feed.
    // The database still rejects a genuinely new order when no valid price exists.
    let ref = null;
    try { ref = await fetchSecondsReferencePrice(symbol); } catch (_) { /* replay lookup may still succeed */ }
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/submit_seconds_order_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_symbol: symbol, p_direction: direction, p_amount: String(amount), p_duration_sec: durationSec, p_open_price: ref ? String(ref.price) : null, p_request_id: requestId, p_request_hash: requestHash }) });
      const result = await rpc.json().catch(() => null);
      if (result && result.ok === false && result.code === 'REFERENCE_PRICE_REQUIRED' && !ref) return json({ ok: false, code: 'REFERENCE_PRICE_UNAVAILABLE', msg: 'The reference price is currently unavailable. No new order was created.' }, 503);
      if (!rpc.ok || !result || result.ok !== true || !result.position_id) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'The database did not confirm the contract order. Verify the position status before retrying.', duplicate: !!(result && result.duplicate) }, rpc.status === 400 ? 400 : 503);
      const settleAt = Number(result.settle_at);
      if (!Number.isSafeInteger(settleAt) || settleAt <= 0) return json({ ok: false, code: 'FINANCIAL_RPC_INVALID_RESPONSE', msg: 'The database response did not include a valid settlement time. The order status is unconfirmed; check your positions before retrying.' }, 503);
      const storedOpenPrice = Number(result.open_price);
      if (!Number.isFinite(storedOpenPrice) || storedOpenPrice <= 0) return json({ ok: false, code: 'FINANCIAL_RPC_INVALID_RESPONSE', msg: 'The database response did not include the confirmed opening price. Check your positions before retrying.' }, 503);
      return json({ ok: true, server_now: Date.now(), duplicate: !!result.duplicate, position_id: result.position_id, symbol: symbol, direction: direction, amount: amount, duration_sec: durationSec, open_price: storedOpenPrice, open_price_source: result.duplicate ? 'stored_reference' : ref.source, settle_at: settleAt, msg: result.duplicate ? 'This order request has already been processed. Do not submit it again.' : 'Position opened successfully. Funds have been reserved.' });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'The financial database is unavailable. The order is unconfirmed and funds were not changed.' }, 503); }
  }

  // ---------- POST /api/seconds/settle ----------
  if (path === 'seconds/settle' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (user.frozen) return json({ ok: false, msg: 'This account is frozen.', code: 'ACCOUNT_FROZEN' }, 403);
    const rl = await rateCheckShared('seconds_settle', String(user.uid));
    if (rl.unavailable) return rateLimitUnavailableJson();
    if (rl.limited) return rateLimitedJson(rl.retryAfter);
    if (!financialWritesEnabled()) {
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Short-term contracts are unavailable until financial cutover is complete. This position was not settled.' }, 503);
    }
    const positionId = String(body.position_id || '').trim();
    const requestId = String(body.request_id || '').trim();
    if (!/^[A-Za-z0-9]{10,40}$/.test(positionId)) return json({ ok: false, msg: 'Invalid position ID.' }, 400);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid request ID (16-100 characters) is required.' }, 400);
    const symbol = String(body.symbol || '').toUpperCase();
    if (!SECONDS_ALLOWED_SYMBOLS.has(symbol)) return json({ ok: false, msg: 'Invalid trading pair.' }, 400);
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ user_id: String(user.uid), position_id: positionId, symbol, request_id: requestId })).digest('hex');
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    // Sample the trusted reference feed on the server only. The client cannot
    // provide or alter the settlement price; PostgreSQL still checks maturity,
    // ownership, idempotency, and applies the ledger movement atomically.
    let settleRef;
    try { settleRef = await fetchSecondsReferencePrice(symbol); }
    catch (_) { return json({ ok: false, code: 'REFERENCE_PRICE_UNAVAILABLE', msg: 'The settlement reference price is unavailable. The position remains unsettled; please try again later.' }, 503); }
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/settle_seconds_position_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_position_id: positionId, p_user_id: String(user.uid), p_request_id: requestId, p_request_hash: requestHash, p_symbol: symbol, p_settle_price: String(settleRef.price), p_settle_price_source: settleRef.source, p_settle_price_ts: new Date().toISOString() }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) {
        const conflictCode = result && ['IDEMPOTENCY_CONFLICT','POSITION_ALREADY_SETTLED'].includes(result.code) ? result.code : '';
        const conflictMessage = conflictCode === 'POSITION_ALREADY_SETTLED'
          ? 'This position was already settled by a different request. Refresh your history; do not retry with a new request ID.'
          : 'This settlement request ID was reused with different parameters. Refresh your position history before retrying.';
        return json({ ok: false, code: conflictCode || 'FINANCIAL_RPC_FAILED',
          msg: conflictCode ? conflictMessage : (result && result.msg ? result.msg : 'The database did not confirm settlement. Please try again later.'),
          duplicate: !!(result && result.duplicate), settled: !!(result && result.settled) }, conflictCode ? 409 : (rpc.status === 400 ? 400 : 503));
      }
      return json({ ok: true, duplicate: !!result.duplicate, position_id: positionId, settled: result.settled !== false, win: result.win, tie: result.tie, pnl: result.pnl, settle_price: result.settle_price, msg: result.duplicate ? 'This settlement request has already been processed.' : (result.settled === false ? 'This position has not reached maturity and cannot be settled yet.' : 'Settlement completed.') });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'The financial database is unavailable. Settlement remains unconfirmed.' }, 503); }
  }

  // ---------- GET /api/seconds/positions ----------
  if (path === 'seconds/positions' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (!financialWritesEnabled()) {
      return json({ ok: true, server_now: Date.now(), open: [], history: [], cutover_incomplete: true, msg: 'Short-term contract data is unavailable until financial cutover is complete.' });
    }
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      const rpc = await fetch(base + '/rest/v1/rpc/read_seconds_positions_v1', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_user_id: String(user.uid) }) });
      const result = await rpc.json().catch(() => null);
      if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Failed to retrieve short-term contract positions.' }, 503);
      return json({ ok: true, server_now: Date.now(), open: Array.isArray(result.open) ? result.open : [], history: Array.isArray(result.history) ? result.history : [] });
    } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'The financial database is unavailable.' }, 503); }
  }

  // ---------- POST /api/support/chat ----------
  if (path === 'support/chat' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return json({ ok: false, msg: 'Please enter a message.' }, 400);
    if (content.length > 2000) return json({ ok: false, msg: 'Messages cannot exceed 2,000 characters.' }, 400);
    user.support_messages = Array.isArray(user.support_messages) ? user.support_messages : [];
    user.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'user', content: content, time: nowStr() });
    // Keep the conversation bounded so repeated submissions cannot grow the
    // per-user record without limit. Preserve the newest messages.
    if (user.support_messages.length > 500) user.support_messages = user.support_messages.slice(-500);
    await saveDB(db);
    return json({ ok: true, msg: 'Submitted successfully.' });
  }

  // ---------- GET /api/support/messages ----------
  if (path === 'support/messages' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    user.last_read_chat_at = nowStr(); // 拉取消息即标记已读
    await saveDB(db);
    return json({ ok: true, messages: user.support_messages.slice(-50) });
  }

  // ---------- POST /api/settings/password ----------
  if (path === 'settings/password' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    { const rl = await rateCheckShared('password_change', String(user.uid)); if (rl.unavailable) return rateLimitUnavailableJson(); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    if (Array.isArray(user.auth_providers) && user.auth_providers.length) return json({ ok: false, code: 'SUPABASE_AUTH_MANAGED', msg: 'This account is managed by Supabase Auth. Please update your sign-in credentials through the trusted Supabase Auth password recovery flow.' }, 409);
    if (!body.old_password || hashPassword(String(body.old_password), user.salt) !== user.password_hash) return json({ ok: false, code: 'REAUTH_FAILED', msg: 'The current password is incorrect.' }, 403);
    if ((body.new_password || '').length < 6) return json({ ok: false, msg: 'New password must be at least 6 characters.' }, 400);
    if (user.twofa_enabled && (!/^\d{6}$/.test(String(body.twofa_code || '')) || !consumeTotpStep(user, String(body.twofa_code || '')))) return json({ ok: false, code: 'TWOFA_REQUIRED', msg: 'Two-factor authentication is enabled on this account. Please enter your 2FA code.' }, 403);
    user.salt = genSalt();
    user.password_hash = hashPassword(body.new_password, user.salt);
    // A password change invalidates every existing session, not only the browser
    // that initiated it, so a stolen cookie cannot remain valid afterwards.
    Object.keys(db.sessions || {}).forEach(function (token) { if (db.sessions[token] && db.sessions[token].uid === user.uid) delete db.sessions[token]; });
    await saveDB(db);
    return json({ ok: true, msg: 'Password changed successfully.' }, 200, clearCookieHeader());
  }

  // ---------- POST /api/settings/fundpwd ----------
  if (path === 'settings/fundpwd' && method === 'POST') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    { const rl = await rateCheckShared('fund_password_change', String(user.uid)); if (rl.unavailable) return rateLimitUnavailableJson(); if (rl.limited) return rateLimitedJson(rl.retryAfter); }
    const pwd = String(body.fund_password || '');
    const fpValid = validateFundPassword(pwd);
    if (!fpValid.ok) return json({ ok: false, code: 'FUND_PASSWORD_FORMAT', msg: fpValid.msg }, 400);
    const code = String(body.twofa_code || '');
    if (Array.isArray(user.auth_providers) && user.auth_providers.length) {
      // Supabase OAuth/magic-link users do not have a usable local password hash.
      // Require an already-enabled TOTP factor rather than silently downgrading to session-only authorization.
      if (!user.twofa_enabled || !user.twofa_secret) return json({ ok: false, code: 'FUND_PASSWORD_REAUTH_REQUIRED', msg: 'Enable two-factor authentication before setting or changing your fund password.' }, 403);
      if (!/^\d{6}$/.test(code) || !consumeTotpStep(user, code)) return json({ ok: false, code: 'TWOFA_INVALID', msg: 'Invalid 2FA code.' }, 403);
    } else {
      const currentPassword = String(body.current_password || '');
      if (!currentPassword || hashPassword(currentPassword, user.salt) !== user.password_hash) return json({ ok: false, code: 'REAUTH_FAILED', msg: 'The current login password is incorrect.' }, 403);
      if (user.twofa_enabled && (!/^\d{6}$/.test(code) || !consumeTotpStep(user, code))) return json({ ok: false, code: 'TWOFA_INVALID', msg: 'Invalid 2FA code.' }, 403);
    }
    const fundSalt = genSalt();
    user.fund_password_salt = fundSalt;
    user.fund_password_hash = hashFundPassword(pwd, fundSalt);
    delete user.fund_password; // Never persist the six-digit fund password in plaintext.
    await saveDB(db);
    return json({ ok: true, msg: 'Fund password set successfully.' });
  }

  // ---------- POST /api/settings/2fa (retired duplicate endpoint) ----------
  if (path === 'settings/2fa' && method === 'POST') {
    return json({ ok: false, code: 'ENDPOINT_DEPRECATED', msg: 'Please use the secure two-factor authentication setup flow.' }, 410);
  }

  // ---------- GET /api/orders ----------
  if (path === 'orders' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true }, 401);
    if (matchingEngineRequested()) {
      if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Order query is unavailable until matching engine cutover is approved.' }, 503);
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const query = new URLSearchParams({ select: 'id,base_asset,quote_asset,side,price,quantity,remaining_quantity,status,client_order_id,created_at,updated_at', user_id: 'eq.' + String(user.uid), order: 'created_at.desc', limit: '50' });
        const response = await fetch(base + '/rest/v1/financial_matching_orders?' + query.toString(), { headers: supabaseHeaders() });
        const rows = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(rows)) return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503);
        const orders = rows.map(row => ({ order_id: row.id, symbol: row.base_asset + row.quote_asset, side: row.side,
          price: row.price, quantity: row.quantity, remaining_quantity: row.remaining_quantity, status: row.status,
          client_order_id: row.client_order_id, created_at: row.created_at, updated_at: row.updated_at }));
        return json({ ok: true, orders });
      } catch (e) { return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503); }
    }
    return json({ ok: true, orders: (Array.isArray(user.orders) ? user.orders : []).slice(-50) });
  }

  // ---------- GET /api/chat/unread（客服未读消息数）----------
  if (path === 'chat/unread' && method === 'GET') {
    if (!user) return json({ ok: false, msg: 'Not signed in.', need_login: true });
    const lastRead = user.last_read_chat_at || '';
    const unread = (user.support_messages || []).filter(function (m) { return m.from === 'admin' && m.time > lastRead; }).length;
    return json({ ok: true, unread: unread });
  }

  // ==================== 后台管理 API（Basic Auth） ====================
  // 管理员认证：timingSafeEqual 保留；失败计数持久化到 btcbox_state（5 次/15 分钟锁）。
  async function adminAuth() {
    const authHeader = event.headers && (event.headers.authorization || event.headers.Authorization);
    const delegated = await authorizeSupabaseAdmin({ authorization: authHeader, env: process.env });
    if (!delegated.ok) return { ok: false, status: delegated.status || 503, code: delegated.code || 'ADMIN_AUTH_UNAVAILABLE' };
    return { ok: true, userId: delegated.user.id, membership: delegated.membership };
  }
  // Durable outbox delivery: state and pending audit event are saved together.
  // PostgreSQL appends are idempotent by event ID, so a lost response or failed
  // post-append CAS can be retried without creating a duplicate audit row.
  async function flushAdminAuditOutbox() {
    if (!supabaseStorageConfigured()) return { pending: false, persistenceUnavailable: false };
    const pending = (Array.isArray(db.audit_logs) ? db.audit_logs : []).filter(function (entry) {
      return entry && entry.postgres_sync_status === 'pending';
    });
    if (!pending.length) return { pending: false, persistenceUnavailable: false };
    const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    if (!base) return { pending: true, persistenceUnavailable: false };
    let changed = false;
    // Bound each request's work; concurrent admin requests can safely retry the
    // same stable event IDs because the append RPC is idempotent.
    const batch = pending.slice(0, 10);
    await Promise.all(batch.map(async function (entry) {
      const safeDetail = redactAdminAuditDetail(entry.detail);
      if (safeDetail !== String(entry.detail || '')) {
        entry.detail = safeDetail;
        changed = true;
      }
      try {
        const response = await fetch(base + '/rest/v1/rpc/append_admin_audit_log', {
          method: 'POST', headers: supabaseHeaders(),
          body: JSON.stringify({
            p_event_id: String(entry.id),
            p_action: String(entry.action || ''),
            p_uid: String(entry.uid || ''),
            p_by: String(entry.by || 'admin'),
            p_detail: safeDetail
          }),
          signal: AbortSignal.timeout(4000)
        });
        const result = await response.json().catch(() => null);
        if (response.ok && result === true) {
          entry.postgres_sync_status = 'synced';
          entry.postgres_synced_at = nowStr();
          changed = true;
        }
      } catch (_) {
        // Keep the durable outbox entry pending; the next admin request retries it.
      }
    }));
    if (changed) {
      try { await saveDB(db); }
      catch (_) { return { pending: true, persistenceUnavailable: true }; }
    }
    return {
      pending: db.audit_logs.some(function (entry) { return entry && entry.postgres_sync_status === 'pending'; }),
      persistenceUnavailable: false
    };
  }

  if (path.startsWith('admin/')) {
    const adminAuthResult = await adminAuth();
    if (!adminAuthResult || !adminAuthResult.ok) {
      const status = adminAuthResult && adminAuthResult.status ? adminAuthResult.status : 401;
      const code = adminAuthResult && adminAuthResult.code ? adminAuthResult.code : 'ADMIN_UNAUTHENTICATED';
      const msg = status === 403 ? 'This Supabase identity is not an active BTCBOX administrator.' :
        status === 503 ? 'Administrator identity or permission store is temporarily unavailable.' :
        'A verified Supabase Auth bearer token is required.';
      return json({ ok: false, code, msg }, status);
    }
    const adminUserId = adminAuthResult.userId;
    const adminMembership = adminAuthResult.membership;
    const sub = path.slice(6);
    if (sub === 'session' && method === 'GET') {
      return json({ ok: true, user_id: adminUserId, status: adminMembership.status, is_super_admin: adminMembership.is_super_admin === true, permissions: Array.isArray(adminMembership.permissions) ? adminMembership.permissions : [] });
    }
    const requiredPermission = (function(route, verb) {
      if (route === 'stats' && verb === 'GET') return 'dashboard.read';
      if (route === 'users' && verb === 'GET') return 'users.read';
      if (route === 'user' && verb === 'GET') return 'users.read';
      if (route === 'user/freeze' && verb === 'POST') return 'users.freeze';
      if (route === 'user/balance' && verb === 'POST') return 'financial_adjustment.request';
      if ((route === 'user/reset-pwd' || route === 'user/reset-email') && verb === 'POST') return 'users.manage';
      if (route === 'kyc' && verb === 'GET') return 'kyc.read';
      if ((route === 'kyc/approve' || route === 'kyc/reject') && verb === 'POST') return 'kyc.review';
      if (route === 'deposit/confirm' && verb === 'POST') return 'deposits.review';
      if (route === 'addresses' && verb === 'GET') return 'deposits.read';
      if (route === 'address/manage' && verb === 'POST') return 'system_config.write';
      if (route === 'withdrawals' && verb === 'GET') return 'withdrawals.read';
      if (['withdraw/approve','withdraw/reject','withdraw/mark-paid'].includes(route) && verb === 'POST') return 'withdrawals.review';
      if (route === 'orders' && verb === 'GET') return 'orders.read';
      if (route === 'support/messages' && verb === 'GET') return 'support.read';
      if (route === 'support/reply' && verb === 'POST') return 'support.reply';
      if (route === 'push' && verb === 'POST') return 'announcements.manage';
      if (route === 'audit-logs' && verb === 'GET') return 'financial_audit.read';
      if (route === 'config' && verb === 'GET') return 'system_config.read';
      if (route === 'config' && verb === 'POST') return 'system_config.write';
      if (route === 'seconds-policy' && verb === 'GET') return 'seconds_policy.read';
      if (route === 'seconds-policy' && verb === 'POST') return 'seconds_policy.manage';
      return null;
    })(sub, method);
    if (!requiredPermission) return json({ ok: false, code: 'ADMIN_ROUTE_NOT_FOUND', msg: 'Administrator route not found.' }, 404);
    if (!hasAdminPermission(adminMembership, requiredPermission)) {
      return json({ ok: false, code: 'ADMIN_PERMISSION_DENIED', permission: requiredPermission, msg: 'Your administrator role does not allow this action.' }, 403);
    }
    const priorAuditFlush = await flushAdminAuditOutbox();
    if (priorAuditFlush.persistenceUnavailable) return json({ ok: false, code: 'AUDIT_OUTBOX_STATE_UNAVAILABLE', msg: 'Administrator audit delivery state could not be saved. Please retry.' }, 503);

    // GET /api/admin/stats
    if (sub === 'stats' && method === 'GET') {
      const users = Object.values(db.users);
      let pendingWd = users.reduce(function (s, u) { return s + (Array.isArray(u.withdrawals) ? u.withdrawals.filter(function (w) { return w.status === 'pending' || w.status === 'pending_admin_review' || w.status === 'approved_pending_broadcast'; }).length : 0); }, 0);
      let pendingAdminReviewWd = users.reduce(function (s, u) { return s + (Array.isArray(u.withdrawals) ? u.withdrawals.filter(function (w) { return w.status === 'pending_admin_review'; }).length : 0); }, 0);
      if (financialPostgresReadsEnabled()) {
        try { const withdrawalSnapshot = await readAdminWithdrawalSnapshot(); pendingWd = withdrawalSnapshot.pending_count; pendingAdminReviewWd = withdrawalSnapshot.pending_admin_review_count; }
        catch (e) { return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
      }
      const pendingKyc = users.filter(function (u) { return u.kyc && u.kyc.status === 'pending'; }).length;
      return json({ ok: true, total_users: users.length, pending_withdrawals: pendingWd, pending_admin_review_withdrawals: pendingAdminReviewWd, pending_kyc: pendingKyc, deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement || '' });
    }

    // GET /api/admin/users?search=
    if (sub === 'users' && method === 'GET') {
      const q = ((event.queryStringParameters && event.queryStringParameters.search) || '').toLowerCase();
      let list = Object.values(db.users);
      if (q) list = list.filter(function (u) { return String(u.email || '').toLowerCase().indexOf(q) > -1 || String(u.uid || '').toLowerCase().indexOf(q) > -1; });
      list = list.slice(0, 200);
      try { await getLiveUsdtPrices(list.flatMap(function (u) { return Object.keys(u.balances || {}); })); } catch (_) {}
      let normalizedBalances = null;
      if (financialPostgresReadsEnabled()) {
        try { normalizedBalances = await readAdminAccountBalances(list.map(function (u) { return String(u.uid); })); }
        catch (e) { return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503); }
      }
      return json({ ok: true, users: list.map(function (u) {
        const balances = normalizedBalances ? (normalizedBalances[String(u.uid)] || {}) : (u.balances || {});
        return { uid: u.uid, email: u.email || '', kyc_status: (u.kyc && u.kyc.status) || 'unverified', total_usdt: totalUsdt(balances, livePriceCache.prices), created_at: u.created_at || '', frozen: !!u.frozen, twofa: !!u.twofa_enabled };
      }) });
    }

    // GET /api/admin/kyc — return only the minimum fields needed for review.
    // Never expose id_number, auth secrets, credentials, or raw user records.
    if (sub === 'kyc' && method === 'GET') {
      const applications = Object.values(db.users || {}).filter(function (u) {
        return u && u.kyc && u.kyc.status === 'pending';
      }).map(function (u) {
        return {
          uid: String(u.uid || ''),
          email: String(u.email || ''),
          name: String(u.kyc.name || ''),
          id_type: String(u.kyc.id_type || ''),
          status: 'pending',
          submitted_at: String(u.kyc.submitted_at || '')
        };
      }).sort(function (a, b) { return a.submitted_at < b.submitted_at ? 1 : -1; }).slice(0, 200);
      return json({ ok: true, kycs: applications, source: 'btcbox_state' });
    }

    // GET /api/admin/user?uid=
    if (sub === 'user' && method === 'GET') {
      const uid = (event.queryStringParameters && event.queryStringParameters.uid) || '';
      const u = db.users[uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      // Never expose password hashes, salts, or session tokens through admin user detail APIs.
      const safeUser = JSON.parse(JSON.stringify(u));
      delete safeUser.password_hash;
      delete safeUser.salt;
      delete safeUser.fund_password_hash;
      delete safeUser.fund_password_salt;
      safeUser.fund_password = !!(u.fund_password_hash || u.fund_password);
      delete safeUser.sessions;
      delete safeUser.twofa_secret;
      delete safeUser.totp_secret;
      delete safeUser.recovery_codes;
      if (financialPostgresReadsEnabled()) {
        try {
          const normalized = await readAdminAccountBalances([String(u.uid)]);
          safeUser.balances = normalized[String(u.uid)] || {};
          safeUser.financial_balance_source = 'postgres_financial_ledger';
        } catch (e) {
          return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503);
        }
      }
      return json({ ok: true, user: safeUser });
    }

    // Stage the audit event in the same CAS document as the business mutation.
    // PostgreSQL delivery happens only after that durable state write succeeds.
    async function auditAdmin(action, uid, detail, actorId) {
      if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
      const pendingCount = db.audit_logs.filter(function (entry) {
        return entry && entry.postgres_sync_status === 'pending';
      }).length;
      // Never discard unsynced audit events or let an unavailable PostgreSQL
      // sink grow the state document without bound. The caller has not saved
      // its business mutation yet, so throwing here keeps that mutation uncommitted.
      if (pendingCount >= 5000) {
        const error = new Error('Admin audit outbox is full');
        error.code = 'ADMIN_AUDIT_OUTBOX_FULL';
        throw error;
      }
      const event = {
        id: 'AL' + Date.now() + crypto.randomBytes(8).toString('hex'),
        action: String(action),
        uid: String(uid || ''),
        by: String(actorId || 'admin'),
        time: nowStr(),
        detail: redactAdminAuditDetail(detail),
        postgres_sync_status: supabaseStorageConfigured() ? 'pending' : 'local_only'
      };
      db.audit_logs.push(event);
      const pending = db.audit_logs.filter(function (entry) { return entry && entry.postgres_sync_status === 'pending'; });
      const nonPending = db.audit_logs.filter(function (entry) { return !entry || entry.postgres_sync_status !== 'pending'; });
      const retainedLimit = Math.max(0, 5000 - pending.length);
      // slice(-0) is slice(0), which keeps every historical row. Handle a full
      // pending queue explicitly so non-pending history cannot grow unbounded.
      const retained = retainedLimit > 0 ? nonPending.slice(-retainedLimit) : [];
      db.audit_logs = retained.concat(pending).sort(function (a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
      return event.id;
    }

    // POST /api/admin/user/balance 调整余额
    if (sub === 'user/balance' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Balance was unchanged.' }, 503);
      if (manualDepositRpcEnabled()) {
        const u = db.users[body.uid];
        // In cutover mode this route must use the transactional ledger exclusively.
        // Never fall back to the legacy state document if configuration/RPC fails.
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Balance was unchanged.' }, 503);
        if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
        const coin = String(body.coin || 'USDT').trim().toUpperCase();
        const allowedCoins = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'];
        const delta = Number(body.delta);
        const mode = String(body.mode || 'adjust').trim().toLowerCase();
        const requestId = String(body.request_id || '').trim();
        const reason = String(body.reason || '').trim().slice(0, 500);
        if (!allowedCoins.includes(coin)) return json({ ok: false, msg: 'Operation failed: coin not supported.' }, 400);
        if (!['adjust', 'freeze', 'unfreeze'].includes(mode)) return json({ ok: false, msg: 'Invalid fund operation type.' }, 400);
        if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1e12 || !Number.isSafeInteger(Math.round(delta * 1e8)) || (mode !== 'adjust' && delta < 0)) return json({ ok: false, msg: 'Invalid operation amount. Freeze/unfreeze amounts must be positive.' }, 400);
        if (!/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) return json({ ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', msg: 'A valid operation ID is required. Balance was unchanged.' }, 400);
        if (reason.length < 5) return json({ ok: false, msg: 'Please provide an adjustment reason of at least 5 characters. Balance was unchanged.' }, 400);
        const adminId = adminUserId;
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Balance was unchanged.' }, 503);
        // Canonical decimal text must match PostgreSQL numeric::text when hashing the RPC payload.
        const canonicalDecimal = function (n) { return (n < 0 ? '-' : '') + Math.abs(n).toFixed(8).replace(/\.?0+$/, ''); };
        let availableDelta = delta;
        let frozenDelta = 0;
        if (mode === 'freeze') { availableDelta = -delta; frozenDelta = delta; }
        else if (mode === 'unfreeze') { availableDelta = delta; frozenDelta = -delta; }
        const availableDeltaText = canonicalDecimal(availableDelta);
        const frozenDeltaText = canonicalDecimal(frozenDelta);
        const requestHash = crypto.createHash('sha256').update([adminId, String(u.uid), coin, availableDeltaText, frozenDeltaText, reason].join('|')).digest('hex');
        try {
          const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
          const rpc = await fetch(base + '/rest/v1/rpc/admin_adjustment_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_request_id: requestId, p_admin_id: adminId, p_user_id: String(u.uid), p_asset: coin,
              p_available_delta: availableDeltaText, p_frozen_delta: frozenDeltaText, p_reason: reason, p_request_hash: requestHash })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) {
            const code = rpc.status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'FINANCIAL_RPC_FAILED';
            return json({ ok: false, code: code, msg: 'Balance adjustment was not confirmed by the database. Please check the financial operation log before retrying. Do not repeat the operation directly.' }, rpc.status === 400 ? 400 : 503);
          }
          return json({ ok: true, msg: result.duplicate ? 'This fund operation has already been processed. It was not executed again.' : (mode === 'freeze' ? 'Funds moved to frozen balance.' : mode === 'unfreeze' ? 'Frozen funds returned to available balance.' : 'Balance adjusted through the financial ledger.'), operation_id: result.operation_id, duplicate: !!result.duplicate, balances: { [coin]: { free: result.available, frozen: result.frozen } } });
        } catch (e) {
          return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Did not fall back to the legacy balance system. Please check the operation log.' }, 503);
        }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Balance was unchanged.' }, 503);
    }

    // POST /api/admin/user/freeze 冻结/解冻
    if (sub === 'user/freeze' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      const frozen = body.frozen === true;
      if (body.frozen !== true && body.frozen !== false) return json({ ok: false, code: 'INVALID_FREEZE_STATE', msg: 'Invalid account state parameter.' }, 400);
      const reason = String(body.reason || '').trim().slice(0, 200);
      if (!reason) return json({ ok: false, code: 'ADMIN_REASON_REQUIRED', msg: frozen ? 'A reason is required to freeze an account.' : 'A reason is required to unfreeze an account.' }, 400);
      if (!!u.frozen === frozen) return json({ ok: false, code: 'ACCOUNT_STATE_UNCHANGED', msg: frozen ? 'Account is already frozen.' : 'Account is already active.' }, 409);
      u.frozen = frozen;
      u.frozen_reason = frozen ? reason : '';
      await auditAdmin(frozen ? 'user_freeze' : 'user_unfreeze', u.uid, reason, adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: u.frozen ? 'Account frozen.' : 'Account unfrozen.' });
    }

    // POST /api/admin/user/reset-pwd
    if (sub === 'user/reset-pwd' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (Array.isArray(u.auth_providers) && u.auth_providers.length) return json({ ok: false, code: 'SUPABASE_AUTH_MANAGED', msg: 'This account is managed by Supabase Auth. Password cannot be reset through the local admin panel. Please use the trusted Supabase Auth management flow.' }, 409);
      const newPassword = String(body.new_password || '');
      if (newPassword.length < 12 || newPassword.length > 256) return json({ ok: false, msg: 'Admin password reset must be 12-256 characters.' }, 400);
      u.salt = genSalt();
      u.password_hash = hashPassword(newPassword, u.salt);
      Object.keys(db.sessions || {}).forEach(function (token) { if (db.sessions[token].uid === u.uid) delete db.sessions[token]; });
      await auditAdmin('user_password_reset', u.uid, 'Admin reset login password; existing sessions invalidated.', adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: 'Password has been reset. The user must sign in again.' });
    }

    // POST /api/admin/user/reset-email
    if (sub === 'user/reset-email' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (Array.isArray(u.auth_providers) && u.auth_providers.length) return json({ ok: false, code: 'SUPABASE_AUTH_MANAGED', msg: 'This account is managed by Supabase Auth. Email cannot be changed locally only. Please use the trusted Supabase Auth management flow.' }, 409);
      const newEmail = String(body.new_email || '').trim().toLowerCase();
      if (newEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return json({ ok: false, msg: 'Please enter a valid email address.' }, 400);
      const duplicate = Object.values(db.users).some(function (other) { return other.uid !== u.uid && String(other.email || '').toLowerCase() === newEmail; });
      if (duplicate) return json({ ok: false, msg: 'This email is already used by another account.' }, 409);
      const previousEmail = u.email;
      u.email = newEmail;
      await auditAdmin('user_email_change', u.uid, JSON.stringify({ from: previousEmail, to: newEmail }), adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: 'Email updated successfully.' });
    }

    // POST /api/admin/deposit/confirm — explicit administrator manual credit.
    // This is an audited admin action, not a user-facing deposit confirmation.
    if (sub === 'deposit/confirm' && method === 'POST') {
      // Admin manual credit is available only through the atomic ledger RPC after
      // the complete read/write cutover is explicitly enabled. No legacy fallback.
      if (!financialWritesEnabled()) {
        return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Manual credit was not executed.' }, 503);
      }
      const uid = String(body.uid || '').trim();
      const coin = String(body.coin || 'USDT').trim().toUpperCase();
      const amount = Number(body.amount);
      const reference = String(body.reference || '').trim().slice(0, 120);
      const note = String(body.note || '').trim().slice(0, 300);
      const idempotencyKey = String(body.idempotency_key || '').trim();
      const u = db.users[uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (!['USDT', 'BTC', 'ETH', 'SOL'].includes(coin)) return json({ ok: false, msg: 'Coin not supported.' }, 400);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !/^\d+(?:\.\d{1,12})?$/.test(String(body.amount || '').trim())) {
        return json({ ok: false, msg: 'Invalid deposit amount. Must be a valid number greater than 0.' }, 400);
      }
      if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) return json({ ok: false, msg: 'Invalid credit request ID. Please try again.' }, 400);
      const adminId = adminUserId;
      if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Manual credit was not executed.' }, 503);
      const amountText = String(body.amount).trim();
      const requestHash = crypto.createHash('sha256').update([adminId, uid, coin, amountText, reference, note].join('|')).digest('hex');
      const depositId = 'MD' + crypto.randomBytes(16).toString('hex');
      try {
        const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
        const rpc = await fetch(base + '/rest/v1/rpc/admin_manual_deposit_atomic', { method: 'POST', headers: supabaseHeaders(), body: JSON.stringify({ p_deposit_id: depositId, p_admin_id: adminId, p_user_id: uid, p_asset: coin, p_amount: amountText, p_request_id: idempotencyKey, p_request_hash: requestHash, p_reference: reference, p_note: note }) });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || !result.deposit_id) return json({ ok: false, code: rpc.status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'FINANCIAL_RPC_FAILED', msg: 'Manual credit was not confirmed by the database. Please check the financial operation log before retrying. Do not repeat the operation directly.' }, rpc.status === 400 ? 400 : 503);
        return json({ ok: true, duplicate: !!result.duplicate, deposit_id: result.deposit_id, status: result.status, operation_id: result.operation_id, msg: result.duplicate ? 'This credit request has already been processed. It was not credited again.' : 'Manual credit processed through the financial ledger.' });
      } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Credit result is unconfirmed. Please check the operation log.' }, 503); }
    }

    // POST /api/admin/withdraw/approve
    // Manual admin review only; no chain broadcast. Refuse ambiguous IDs rather than
    // accidentally approving more than one record with the same identifier.
    if (sub === 'withdraw/approve' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not reviewed and funds were unchanged.' }, 503);
      const wdId = String(body.id || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: 'Withdrawal record ID is invalid' }, 400);
      if (manualDepositRpcEnabled()) {
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Withdrawal was not reviewed.' }, 503);
        const adminId = adminUserId;
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Withdrawal was not reviewed.' }, 503);
        try {
          const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/review_withdrawal_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_approve: true, p_reason: 'Admin manually approved; on-chain broadcast not executed.' })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Withdrawal review was not confirmed by the database. Please check the operation log.' }, 503);
          if (result.status !== 'approved') return json({ ok: false, code: 'WITHDRAWAL_ALREADY_PROCESSED', status: result.status, msg: 'Withdrawal has already been processed. This operation was not executed again.' }, 409);
          return json({ ok: true, duplicate: !!result.duplicate, status: 'approved', msg: result.duplicate ? 'Withdrawal already approved, no duplicate charge' : 'Withdrawal approved, frozen amount deducted; not yet broadcast to the chain' });
        } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Please check the operation log.' }, 503); }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not reviewed and funds were unchanged.' }, 503);
    }

    if (sub === 'withdraw/reject' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not rejected or refunded and funds were unchanged.' }, 503);
      const wdId = String(body.id || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: 'Withdrawal record ID is invalid' }, 400);
      if (manualDepositRpcEnabled()) {
        if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database not configured. Withdrawal was not rejected or refunded.' }, 503);
        const adminId = adminUserId;
        if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Withdrawal was not rejected or refunded.' }, 503);
        const reason = String(body.reason || 'Admin rejected withdrawal.').trim().slice(0, 200) || 'Admin rejected withdrawal.';
        try {
          const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/review_withdrawal_atomic', {
            method: 'POST', headers: supabaseHeaders(),
            body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_approve: false, p_reason: reason })
          });
          const result = await rpc.json().catch(() => null);
          if (!rpc.ok || !result || result.ok !== true) return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Withdrawal rejection was not confirmed by the database. Please check the operation log.' }, 503);
          if (result.status !== 'rejected') return json({ ok: false, code: 'WITHDRAWAL_ALREADY_PROCESSED', status: result.status, msg: 'Withdrawal has already been processed. This refund was not executed again.' }, 409);
          return json({ ok: true, duplicate: !!result.duplicate, status: 'rejected', msg: result.duplicate ? 'Withdrawal was previously rejected. No duplicate refund was issued.' : 'Withdrawal rejected. Frozen principal and fees returned to available balance.' });
        } catch (e) { return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Please check the operation log.' }, 503); }
      }
      return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Withdrawal was not rejected or refunded and funds were unchanged.' }, 503);
    }

    // POST /api/admin/withdraw/mark-paid — staff has already sent the funds manually.
    // This is a status/audit confirmation only; it never broadcasts or debits funds.
    if (sub === 'withdraw/mark-paid' && method === 'POST') {
      if (!financialWritesEnabled()) return json({ ok: false, code: 'FINANCIAL_CUTOVER_INCOMPLETE', msg: 'Financial ledger cutover is incomplete. Payout status was not changed.' }, 503);
      const wdId = String(body.id || '').trim();
      const reference = String(body.reference || '').trim();
      const note = String(body.note || '').trim();
      if (!wdId || wdId.length > 100) return json({ ok: false, msg: 'Withdrawal record ID is invalid.' }, 400);
      if (!reference) return json({ ok: false, code: 'PAYOUT_REFERENCE_REQUIRED', msg: 'TxID / payout reference is required.' }, 400);
      if (reference.length > 160 || note.length > 300) return json({ ok: false, msg: 'Payout reference or note is too long.' }, 400);
      if (!supabaseStorageConfigured()) return json({ ok: false, code: 'FINANCIAL_RPC_NOT_CONFIGURED', msg: 'Financial database is not configured. Payout status was not changed.' }, 503);
      const adminId = adminUserId;
      if (!adminId) return json({ ok: false, code: 'ADMIN_ACTOR_NOT_CONFIGURED', msg: 'Administrator audit identity not configured. Payout status was not changed.' }, 503);
      try {
        const rpc = await fetch(process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/mark_withdrawal_paid_atomic', {
          method: 'POST', headers: supabaseHeaders(),
          body: JSON.stringify({ p_withdrawal_id: wdId, p_admin_id: adminId, p_reference: reference, p_note: note })
        });
        const result = await rpc.json().catch(() => null);
        if (!rpc.ok || !result || result.ok !== true || result.status !== 'completed') {
          return json({ ok: false, code: 'FINANCIAL_RPC_FAILED', msg: 'Manual payout completion was not confirmed. Check the withdrawal record before retrying.' }, rpc.status === 400 ? 400 : 503);
        }
        return json({ ok: true, duplicate: !!result.duplicate, withdrawal_id: result.withdrawal_id, status: result.status,
          payout_reference: result.payout_reference || '', paid_at: result.paid_at || null,
          msg: result.duplicate ? 'This withdrawal was already marked as paid.' : 'Manual payout completion recorded.' });
      } catch (e) {
        return json({ ok: false, code: 'FINANCIAL_RPC_UNAVAILABLE', msg: 'Financial database temporarily unavailable. Payout status is unconfirmed; check the withdrawal record before retrying.' }, 503);
      }
    }

    if (sub === 'kyc/approve' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (!u.kyc || typeof u.kyc !== 'object') u.kyc = {};
      const status = String(u.kyc.status || 'unsubmitted');
      const override = body.admin_override === true;
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (status !== 'pending' && !override) return json({ ok: false, code: 'KYC_EXCEPTION_REQUIRED', msg: 'Only pending applications can be approved directly. Other states require the admin exception flow with a reason.' }, 409);
      if (override && !reason) return json({ ok: false, code: 'ADMIN_REASON_REQUIRED', msg: 'A reason is required for admin exception approval.' }, 400);
      if (status === 'pending' && override && !reason) return json({ ok: false, code: 'ADMIN_REASON_REQUIRED', msg: 'A reason is required for admin exception approval.' }, 400);
      u.kyc.status = 'approved';
      u.kyc.reviewed_by = adminUserId;
      u.kyc.reviewed_at = nowStr();
      u.kyc.reject_reason = '';
      u.kyc.review_reason = override ? reason : 'Approved pending identity verification application.';
      await auditAdmin(override ? 'kyc_approve_exception' : 'kyc_approve', u.uid, override ? reason : 'Admin approved pending identity verification application.', adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: override ? 'KYC approved via admin exception; reason recorded.' : 'KYC approved.' });
    }

    // POST /api/admin/kyc/reject
    if (sub === 'kyc/reject' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
      if (!u.kyc || typeof u.kyc !== 'object') u.kyc = {};
      // Business rule: the administrator may reject/set the final status without a pending submission.
      const reason = String(body.reason || '').trim().slice(0, 300);
      if (!reason) return json({ ok: false, msg: 'Please provide a rejection reason.' }, 400);
      u.kyc.status = 'rejected';
      u.kyc.reject_reason = reason;
      u.kyc.reviewed_by = 'admin';
      u.kyc.reviewed_at = nowStr();
      await auditAdmin('kyc_reject', u.uid, reason, adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: 'KYC rejected.' });
    }

    // POST /api/admin/push 推送站内信
    if (sub === 'push' && method === 'POST') {
      const content = String(body.content || '').trim();
      if (!content || content.length > 2000) return json({ ok: false, msg: 'Message content is required and cannot exceed 2,000 characters.' }, 400);
      if (body.uid) {
        const u = db.users[body.uid];
        if (!u) return json({ ok: false, msg: 'User not found.' }, 404);
        if (!Array.isArray(u.support_messages)) u.support_messages = [];
        u.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'admin', content: content, time: nowStr() });
      } else {
        Object.values(db.users).forEach(function (u) {
          if (!Array.isArray(u.support_messages)) u.support_messages = [];
          u.support_messages.push({ id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'admin', content: content, time: nowStr() });
        });
      }
      await auditAdmin('admin_push_message', body.uid || 'all', JSON.stringify({ target: body.uid ? 'single_user' : 'all_users', length: content.length }), adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: 'Message sent.' });
    }

    // POST /api/admin/support/reply 回复客服
    if (sub === 'support/reply' && method === 'POST') {
      const u = db.users[body.uid];
      if (!u) return json({ ok: false, msg: 'User not found.' });
      if (!Array.isArray(u.support_messages)) u.support_messages = [];
      const supportMessage = { id: 'M' + Date.now() + crypto.randomBytes(3).toString('hex'), from: 'admin', content: body.content || '', time: nowStr() };
      u.support_messages.push(supportMessage);
      await auditAdmin('support_reply', u.uid, JSON.stringify({ message_id: supportMessage.id, length: String(body.content || '').length }), adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: 'Reply sent.' });
    }

    // GET /api/admin/addresses — sensitive fields visible only to authenticated admin
    if (sub === 'addresses' && method === 'GET') {
      const list=[];
      Object.values(db.users).forEach(function(u){(u.addresses||[]).forEach(function(a){list.push(Object.assign({},a,{uid:u.uid,email:u.email}));});});
      list.sort(function(a,b){return a.created_at < b.created_at ? 1 : -1;});
      return json({ok:true,addresses:list.slice(0,500)});
    }
    // POST /api/admin/address/manage — immutable for users, admin actions are audited
    if (sub === 'address/manage' && method === 'POST') {
      const target=Object.values(db.users).find(function(u){return (u.addresses||[]).some(function(a){return a.id===body.id;});});
      if(!target) return json({ok:false,msg:'Address record not found.'},404);
      const addr=target.addresses.find(function(a){return a.id===body.id;});
      const action=String(body.action||'');
      if(action==='flag') addr.flagged=!!body.value;
      else if(action==='block') addr.blocked=!!body.value;
      else if(action==='delete') target.addresses=target.addresses.filter(function(a){return a.id!==body.id;});
      else if(action==='unbind') addr.unbound=true;
      else if(action==='update') {
        if(addr.type==='crypto') {
          const newAddress=String(body.address||'').trim();
          const coin=String(body.coin||addr.coin||'').toUpperCase();
          const network=String(body.network||addr.network||'').toUpperCase();
          const allowedNetworks={BTC:['BTC'],ETH:['ERC20'],USDT:['TRC20','ERC20','BEP20'],SOL:['SOL'],BNB:['BEP20'],USDC:['ERC20']};
          if(!newAddress || !allowedNetworks[coin] || !allowedNetworks[coin].includes(network)) return json({ok:false,msg:'Operation failed.'},400);
          let valid=false;
          if(coin==='BTC') valid=/^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(newAddress);
          else if(network==='ERC20'||network==='BEP20') valid=/^0x[a-fA-F0-9]{40}$/.test(newAddress);
          else if(network==='TRC20') valid=/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(newAddress);
          else if(coin==='SOL') valid=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(newAddress);
          if(!valid) return json({ok:false,msg:'Operation failed.'},400);
          addr.address=newAddress; addr.coin=coin; addr.network=network; addr.unbound=false;
        } else {
          const fields=['account_holder','bank_name','account_number','routing_number','swift','bank_address','note'];
          fields.forEach(function(k){if(typeof body[k]==='string') addr[k]=body[k].trim();});
          if(body.account_number!==undefined && !/^\d{4,34}$/.test(String(body.account_number).replace(/\s/g,''))) return json({ok:false,msg:'Operation failed.'},400);
          if(body.routing_number!==undefined && !/^\d{9}$/.test(String(body.routing_number).replace(/\s/g,''))) return json({ok:false,msg:'Operation failed.'},400);
          if(body.swift!==undefined && body.swift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(body.swift).toUpperCase())) return json({ok:false,msg:'Operation failed.'},400);
          if(body.account_number!==undefined) addr.account_number=String(body.account_number).replace(/\s/g,'');
          if(body.routing_number!==undefined) addr.routing_number=String(body.routing_number).replace(/\s/g,'');
          if(body.swift!==undefined) addr.swift=String(body.swift).toUpperCase();
        }
      } else return json({ok:false,msg:'Unknown operation.'},400);
      if(!Array.isArray(target.address_audit)) target.address_audit=[];
      target.address_audit.push({id:'L'+Date.now()+crypto.randomBytes(3).toString('hex'),action:action,address_id:body.id,by:'admin',time:nowStr(),detail:String(body.reason||'').slice(0,200)});
      await auditAdmin('address_'+action, target.uid, JSON.stringify({ address_id: body.id, reason: String(body.reason || '').slice(0, 200) }), adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ok:true,audit_sync_pending:auditFlush.pending,msg:'Submitted successfully.'});
    }
    if (sub === 'audit-logs' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const limitValue = Number(params.limit || 100);
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitValue) ? Math.floor(limitValue) : 100));
      const actionFilter = String(params.action || '').trim();
      const uidFilter = String(params.uid || '').trim();
      const before = String(params.before || '').trim();
      if (actionFilter.length > 100 || (actionFilter && !/^[A-Za-z0-9_.:-]{1,100}$/.test(actionFilter))) return json({ ok: false, code: 'AUDIT_ACTION_FILTER_INVALID', msg: 'Audit action filter is invalid.' }, 400);
      if (uidFilter.length > 100 || (uidFilter && !/^[A-Za-z0-9_:-]{1,100}$/.test(uidFilter))) return json({ ok: false, code: 'AUDIT_UID_FILTER_INVALID', msg: 'Audit user filter is invalid.' }, 400);
      if (before && !isPositivePostgresBigintString(before)) return json({ ok: false, code: 'AUDIT_CURSOR_INVALID', msg: 'Audit page cursor is invalid.' }, 400);

      // Explicit opt-in switches the viewer to the canonical append-only PostgreSQL
      // audit table. Never silently fall back to the retention-limited state document.
      if (process.env.ADMIN_AUDIT_POSTGRES_READS_ENABLED === '1') {
        try {
          const result = await readAdminAuditLogPage({ limit, action: actionFilter, uid: uidFilter, before });
          return json({
            ok: true,
            source: 'postgres_financial_audit_log',
            completeness: 'postgres_canonical',
            logs: result.logs,
            next_before: result.next_before
          });
        } catch (e) {
          return json({ ok: false, code: 'ADMIN_AUDIT_READ_UNAVAILABLE', msg: 'Canonical administrator audit history is temporarily unavailable. No incomplete fallback was shown.' }, 503);
        }
      }

      let logs = (Array.isArray(db.audit_logs) ? db.audit_logs : []).slice().reverse();
      if (actionFilter) logs = logs.filter(function (entry) { return String(entry.action || '') === actionFilter; });
      if (uidFilter) logs = logs.filter(function (entry) { return String(entry.uid || '') === uidFilter; });
      if (before) {
        const beforeIndex = logs.findIndex(function (entry) { return String(entry.id || '') === before; });
        if (beforeIndex < 0) return json({ ok: false, code: 'AUDIT_CURSOR_NOT_FOUND', msg: 'Audit page cursor is no longer available. Refresh the log list.' }, 400);
        logs = logs.slice(beforeIndex + 1);
      }
      const hasMore = logs.length > limit;
      const page = logs.slice(0, limit).map(function (entry) {
        const safeDetail = redactAdminAuditDetail(entry.detail);
        return {
          id: String(entry.id || ''),
          action: String(entry.action || '').slice(0, 100),
          uid: String(entry.uid || '').slice(0, 100),
          by: String(entry.by || 'admin').slice(0, 80),
          time: String(entry.time || '').slice(0, 40),
          detail: safeDetail,
          postgres_sync_status: ['synced', 'pending', 'local_only'].includes(entry.postgres_sync_status) ? entry.postgres_sync_status : 'unknown'
        };
      });
      return json({
        ok: true,
        source: 'btcbox_state',
        completeness: 'state_document_retention_limited',
        logs: page,
        next_before: hasMore && page.length ? String(page[page.length - 1].id || '') : null
      });
    }

    // GET /api/admin/config
    if (sub === 'config' && method === 'GET') {
      return json({ ok: true, deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement || '' });
    }

    // POST /api/admin/config 更新充值地址和公告。只接受已知网络且格式有效的地址，
    // 避免误把占位符/错误网络地址保存为可供用户使用的充值地址。
    if (sub === 'config' && method === 'POST') {
      const allowedDepositKeys = {
        'USDT-TRC20': function (v) { return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v); },
        'USDT-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'USDT-BEP20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'BTC-BTC': function (v) { return /^(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v); },
        'ETH-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'SOL-SOL': function (v) { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v); },
        'BNB-BEP20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
        'USDC-ERC20': function (v) { return /^0x[a-fA-F0-9]{40}$/.test(v); },
      };
      const updates = body.deposit_addresses;
      const changedKeys = [];
      if (updates !== undefined) {
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return json({ ok: false, msg: 'Invalid deposit address configuration format.' }, 400);
        for (const key of Object.keys(updates)) {
          if (!Object.prototype.hasOwnProperty.call(allowedDepositKeys, key)) return json({ ok: false, msg: 'Unsupported deposit network configuration found.' }, 400);
          const value = typeof updates[key] === 'string' ? updates[key].trim() : '';
          if (!value || /PLACEHOLDER|TPLACEHOLDER/i.test(value) || !allowedDepositKeys[key](value)) {
            return json({ ok: false, msg: 'Invalid deposit address format: ' + key }, 400);
          }
          changedKeys.push(key);
        }
      }
      if (updates !== undefined) db.deposit_addresses = Object.assign({}, db.deposit_addresses, Object.fromEntries(Object.keys(updates).map(function (key) { return [key, updates[key].trim()]; })));
      if (typeof body.announcement === 'string') {
        if (body.announcement.length > 2000) return json({ ok: false, msg: 'Announcement cannot exceed 2,000 characters.' }, 400);
        db.announcement = body.announcement.trim();
      }
      await auditAdmin('system_config_update', 'system', JSON.stringify({ deposit_address_keys: changedKeys, announcement_updated: typeof body.announcement === 'string' }), adminUserId);
      await saveDB(db);
      const auditFlush = await flushAdminAuditOutbox();
      return json({ ok: true, audit_sync_pending: auditFlush.pending, msg: 'Configuration updated.', deposit_addresses: safeDepositAddresses(db.deposit_addresses), announcement: db.announcement });
    }


    // GET /api/admin/withdrawals 待审核提现列表
    if (sub === 'withdrawals' && method === 'GET') {
      if (financialPostgresReadsEnabled()) {
        try {
          const snapshot = await readAdminWithdrawalSnapshot();
          const usersById = db.users || {};
          const list = snapshot.withdrawals.map(function (w) {
            const legacyUser = Object.values(usersById).find(function (u) { return String(u.uid) === String(w.uid); });
            return Object.assign({}, w, { email: legacyUser ? (legacyUser.email || '') : '' });
          });
          return json({ ok: true, withdrawals: list, source: 'postgres_financial_ledger' });
        } catch (e) {
          return json({ ok: false, msg: 'Financial data temporarily unavailable. Please try again later.', code: 'FINANCIAL_READ_UNAVAILABLE' }, 503);
        }
      }
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.withdrawals) ? u.withdrawals : []).forEach(function (w) {
          if (w.status === 'pending' || w.status === 'pending_admin_review' || w.status === 'approved_pending_broadcast') list.push({ id: w.id, uid: u.uid, email: u.email, coin: w.coin, amount: w.amount, fee: w.fee || 0, network: w.network, address: w.address, status: w.status, require_admin_review: w.status === 'pending_admin_review', txid: w.txid || '', time: w.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, withdrawals: list });
    }
    // GET /api/admin/orders 全部订单。When the matching engine is requested,
    // never silently show legacy JSON orders: they would omit orders written to PostgreSQL.
    if (sub === 'orders' && method === 'GET') {
      if (matchingEngineRequested()) {
        if (!matchingEngineEnabled()) return json({ ok: false, code: 'MATCHING_ENGINE_UNAVAILABLE', msg: 'Order query is unavailable until matching engine cutover is approved.' }, 503);
        try {
          const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
          const query = new URLSearchParams({
            select: 'id,user_id,base_asset,quote_asset,side,price,quantity,remaining_quantity,status,created_at,updated_at',
            order: 'created_at.desc', limit: '200'
          });
          const response = await fetch(base + '/rest/v1/financial_matching_orders?' + query.toString(), { headers: supabaseHeaders() });
          const rows = await response.json().catch(() => null);
          if (!response.ok || !Array.isArray(rows)) return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503);
          const usersById = new Map(Object.values(db.users).map(function (u) { return [String(u.uid), u]; }));
          const orders = rows.map(function (o) {
            const owner = usersById.get(String(o.user_id));
            return { id: o.id, uid: o.user_id, email: owner ? (owner.email || '') : '',
              symbol: o.base_asset + '/' + o.quote_asset, side: o.side, type: 'limit', price: o.price,
              amount: o.quantity, remaining_quantity: o.remaining_quantity,
              status: o.status === 'cancelled' ? 'canceled' : o.status, time: o.created_at, updated_at: o.updated_at };
          });
          return json({ ok: true, orders: orders, source: 'postgres_financial_matching' });
        } catch (e) {
          return json({ ok: false, code: 'ORDER_READ_UNAVAILABLE', msg: 'Order data temporarily unavailable. Please try again later.' }, 503);
        }
      }
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.orders) ? u.orders : []).forEach(function (o) {
          list.push({ id: o.id, uid: u.uid, email: u.email, symbol: o.symbol, side: o.side, type: o.type, price: o.price, amount: o.amount, status: o.status, time: o.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, orders: list.slice(0, 200), source: 'legacy_state' });
    }
    // GET /api/admin/support/messages 客服消息
    if (sub === 'support/messages' && method === 'GET') {
      const list = [];
      Object.values(db.users).forEach(function (u) {
        (Array.isArray(u.support_messages) ? u.support_messages : []).filter(function(m){return m.from==='user';}).forEach(function (m) {
          list.push({ id: m.id, uid: u.uid, email: u.email, content: m.content, time: m.time });
        });
      });
      list.sort(function (a, b) { return (a.time < b.time) ? 1 : -1; });
      return json({ ok: true, messages: list.slice(0, 100) });
    }
    return json({ ok: false, msg: 'Unknown admin endpoint: ' + sub }, 404);
  }

  return json({ ok: false, msg: 'Endpoint not found: ' + method + ' /' + path }, 404);
  } catch (e) {
    if (e && e.message === 'Persistent storage write conflict') {
      return json({ ok: false, msg: 'Data changed recently. Please refresh and try again.', code: 'STORAGE_CONFLICT' }, 409);
    }
    if (e && e.code === 'ADMIN_AUDIT_OUTBOX_FULL') {
      return json({ ok: false, msg: 'Administrator audit storage is temporarily backed up. No change was saved; please retry later.', code: 'ADMIN_AUDIT_OUTBOX_FULL' }, 503);
    }
    // Do not expose internal storage, provider, or database error details to clients.
    return json({ ok: false, msg: 'Service temporarily unavailable. Please try again later.', code: 'INTERNAL_ERROR' }, 500);
  }
}

// Serialize requests within one warm function instance. 这不是跨实例锁，也不能替代事务数据库。
// It reduces same-instance overlap only and does not replace database transactions.
let requestQueue = Promise.resolve();
exports.handler = function (event, context) {
  const run = requestQueue.then(
    () => handleRequest(event, context),
    () => handleRequest(event, context)
  );
  requestQueue = run.then(() => undefined, () => undefined);
  return run;
};
// 导出纯函数供后端单元测试（无网络/无 DB 依赖）。
exports._test = {
  depositAddressFromEnv: depositAddressFromEnv,
  DEPOSIT_ADDRESS_ENV_KEYS: DEPOSIT_ADDRESS_ENV_KEYS,
  getPublishableKey: getPublishableKey,
  validateFundPassword: validateFundPassword,
  validateAdminPasswordStrength: validateAdminPasswordStrength,
  parseMoneyInput: parseMoneyInput,
  compareMoney: compareMoney,
  addMoney: addMoney,
  withdrawalAddressCheck: withdrawalAddressCheck,
  withdrawalRequiresAdminReview: withdrawalRequiresAdminReview,
  estimateUsdtValue: estimateUsdtValue,
  redactAdminAuditDetail: redactAdminAuditDetail,
  secCounterIsLocked: secCounterIsLocked,
  secCounterRecordFailure: secCounterRecordFailure,
  secCounterReset: secCounterReset,
};
