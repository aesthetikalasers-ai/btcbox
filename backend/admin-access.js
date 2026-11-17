'use strict';

/**
 * 后台访问控制（全部来自环境变量，不依赖任何数据库权限表）。
 *
 * 三个开关：
 *   ADMIN_EMAILS        必填。允许进入后台的 Supabase Auth 邮箱，逗号分隔。
 *                       默认 avali9308@gmail.com。匹配到的邮箱直接获得超级管理员权限。
 *   ADMIN_ALLOWED_IPS   可选。允许访问后台的客户端 IP，逗号分隔；留空表示不限制 IP。
 *   ADMIN_ALLOWED_HOST  可选。允许访问后台的域名，逗号分隔；留空表示不限制域名。
 *
 * 失败策略一律 fail-closed：邮箱不在名单内 → 拒绝；IP/域名不在名单内 → 404。
 * 这里不做任何数据库查询，也不再读写 private.admin_memberships。
 */

const DEFAULT_ADMIN_EMAILS = 'avali9308@gmail.com';

/** Placeholder strings that must never be treated as a real allowlist entry. */
const PLACEHOLDERS = new Set(['', 'your-ip', 'your-domain', 'example.com', 'changeme']);

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item && !PLACEHOLDERS.has(item));
}

/** Emails allowed into the admin console. Always at least the default owner. */
function readAllowedEmails(env = process.env) {
  const raw = env.ADMIN_EMAILS === undefined ? DEFAULT_ADMIN_EMAILS : env.ADMIN_EMAILS;
  const list = splitList(raw).filter((email) => email.includes('@'));
  return list;
}

function readAllowedIps(env = process.env) {
  return splitList(env.ADMIN_ALLOWED_IPS);
}

function readAllowedHosts(env = process.env) {
  return splitList(env.ADMIN_ALLOWED_HOST);
}

/**
 * Normalises a possibly-proxied address list to the first hop.
 * Vercel sets x-forwarded-for as "client, proxy1, proxy2".
 */
function firstForwardedIp(headers) {
  const source = headers && typeof headers === 'object' ? headers : {};
  const forwarded = source['x-forwarded-for'] || source['X-Forwarded-For'] || '';
  const candidate = String(forwarded).split(',', 1)[0].trim();
  return candidate.length <= 128 && /^[0-9a-f:.]+$/i.test(candidate) ? candidate.toLowerCase() : '';
}

function normaliseIp(ip) {
  const value = String(ip || '').trim().toLowerCase();
  // Treat IPv4-mapped IPv6 (::ffff:1.2.3.4) as the IPv4 address it wraps.
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

/** Exact IP match, plus IPv4 CIDR support (e.g. 203.0.113.0/24). */
function ipMatches(ip, rule) {
  const candidate = normaliseIp(ip);
  const pattern = String(rule || '').trim().toLowerCase();
  if (!candidate || !pattern) return false;
  if (!pattern.includes('/')) return normaliseIp(pattern) === candidate;

  const [network, bitsRaw] = pattern.split('/');
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const toLong = (value) => {
    const parts = value.split('.');
    if (parts.length !== 4) return null;
    let total = 0;
    for (const part of parts) {
      const octet = Number(part);
      if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
      total = (total * 256) + octet;
    }
    return total;
  };
  const candidateLong = toLong(candidate);
  const networkLong = toLong(network);
  if (candidateLong === null || networkLong === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (candidateLong & mask) === (networkLong & mask);
}

/**
 * IP gate. Returns null when the request may proceed, otherwise a rejection
 * descriptor. An empty ADMIN_ALLOWED_IPS disables the check entirely.
 */
function checkIp(headers, env = process.env) {
  const allowed = readAllowedIps(env);
  if (!allowed.length) return null;
  const ip = firstForwardedIp(headers);
  if (!ip) return { ok: false, status: 404, code: 'ADMIN_NOT_FOUND' };
  const passed = allowed.some((rule) => ipMatches(ip, rule));
  return passed ? null : { ok: false, status: 404, code: 'ADMIN_NOT_FOUND' };
}

function headerValue(headers, name) {
  const source = headers && typeof headers === 'object' ? headers : {};
  return String(source[name] || source[name.toLowerCase()] || source[name.toUpperCase()] || '').trim();
}

/**
 * Host gate. Returns null when the request may proceed. A wrong host is answered
 * with 404 so the admin surface is not even discoverable from other domains.
 */
function checkHost(headers, env = process.env) {
  const allowed = readAllowedHosts(env);
  if (!allowed.length) return null;
  const host = headerValue(headers, 'x-forwarded-host') || headerValue(headers, 'host');
  const bare = host.toLowerCase().replace(/:\d+$/, '');
  if (!bare) return { ok: false, status: 404, code: 'ADMIN_NOT_FOUND' };
  return allowed.includes(bare) ? null : { ok: false, status: 404, code: 'ADMIN_NOT_FOUND' };
}

/** Combined transport-level gate used before any authentication work. */
function checkTransport(headers, env = process.env) {
  return checkHost(headers, env) || checkIp(headers, env) || null;
}

/**
 * Email gate for an already-verified Supabase identity.
 * Supabase lowercases emails, but the allowlist is normalised defensively.
 */
function isAllowedEmail(email, env = process.env) {
  const normalised = String(email || '').trim().toLowerCase();
  if (!normalised) return false;
  return readAllowedEmails(env).includes(normalised);
}

module.exports = Object.freeze({
  DEFAULT_ADMIN_EMAILS,
  readAllowedEmails,
  readAllowedIps,
  readAllowedHosts,
  firstForwardedIp,
  ipMatches,
  checkIp,
  checkHost,
  checkTransport,
  isAllowedEmail,
});
