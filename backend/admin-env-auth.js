'use strict';

/**
 * 环境变量后台登录（ADMIN_USERNAME / ADMIN_PASSWORD）。
 *
 * 目的：给运营人员一个"一个账号一个密码就能进后台"的入口，不需要理解
 * Supabase 的 UUID、RBAC 表格或英文控制台。
 *
 * 安全边界（重要）：
 *   - 凭据只存在于 Vercel 环境变量里，不落库、不写日志、不回传到前端。
 *   - 密码比较使用 timingSafeEqual，避免逐字符比对泄漏长度/前缀。
 *   - 登录成功后签发一个短时效 HMAC token（默认 12 小时），不再回传密码。
 *   - 未配置环境变量时此登录方式整体关闭（fail closed），不会出现空密码可进。
 *   - 该 token 只被后台 API 接受，不会获得普通用户账户的任何能力。
 */

const crypto = require('crypto');

const TOKEN_PREFIX = 'envadmin';
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;

function readConfig(env = process.env) {
  const username = String(env.ADMIN_USERNAME || '').trim();
  const password = String(env.ADMIN_PASSWORD || '');
  const secret = String(env.ADMIN_SESSION_SECRET || '').trim();
  if (!username || !password || !secret) return null;
  if (password.length < MIN_PASSWORD_LENGTH) return null;
  if (secret.length < 32) return null;
  return { username, password, secret };
}

/** Constant-time comparison that never leaks length through early return timing. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  const length = Math.max(left.length, right.length, 1);
  const leftPadded = Buffer.alloc(length);
  const rightPadded = Buffer.alloc(length);
  left.copy(leftPadded);
  right.copy(rightPadded);
  return crypto.timingSafeEqual(leftPadded, rightPadded) && left.length === right.length;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isConfigured(env = process.env) {
  return readConfig(env) !== null;
}

function verifyCredentials(username, password, env = process.env) {
  const config = readConfig(env);
  if (!config) return { ok: false, code: 'ADMIN_ENV_LOGIN_DISABLED' };
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { ok: false, code: 'ADMIN_CREDENTIALS_REQUIRED' };
  }
  // Evaluate both comparisons so a wrong username and a wrong password take the
  // same amount of work.
  const userOk = safeEqual(username.trim(), config.username);
  const passOk = safeEqual(password, config.password);
  if (!userOk || !passOk) return { ok: false, code: 'ADMIN_CREDENTIALS_INVALID' };
  return { ok: true, username: config.username };
}

function issueToken(username, env = process.env) {
  const config = readConfig(env);
  if (!config) return null;
  const expiresAt = Date.now() + DEFAULT_TTL_MS;
  const payload = base64url(JSON.stringify({ u: username, exp: expiresAt }));
  return { token: TOKEN_PREFIX + '.' + payload + '.' + sign(payload, config.secret), expiresAt };
}

function verifyToken(token, env = process.env) {
  const config = readConfig(env);
  if (!config || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, payload, signature] = parts;
  if (!safeEqual(signature, sign(payload, config.secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    if (!safeEqual(String(parsed.u || ''), config.username)) return null;
    return { username: config.username, expiresAt: parsed.exp };
  } catch (_) {
    return null;
  }
}

module.exports = { isConfigured, verifyCredentials, issueToken, verifyToken, TOKEN_PREFIX, MIN_PASSWORD_LENGTH };
