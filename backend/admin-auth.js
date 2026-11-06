'use strict';

// Supabase Auth identity verification for the future delegated-admin API.
// This module deliberately does not decode JWT claims or infer administrator
// roles. Membership and permissions must be loaded separately from protected
// server-side storage after this function returns the canonical Auth user UUID.

const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLISHABLE_KEY_RE = /^(sb_publishable_|eyJ)[A-Za-z0-9._-]+$/;

function readBearerToken(header) {
  if (typeof header !== 'string' || header.length > 8300) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(header.trim());
  if (!match || match[1].length < 20 || match[1].length > 8192) return null;
  return match[1];
}

function resolveAuthConfig(env) {
  const baseUrl = String(env.SUPABASE_AUTH_URL || env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const publishableKey = String(env.SUPABASE_AUTH_PUBLISHABLE_KEY || env.SUPABASE_AUTH_ANON_KEY || '').trim();
  if (!/^https:\/\//i.test(baseUrl) || /\s/.test(baseUrl) ||
      !publishableKey || /\s/.test(publishableKey) || !PUBLISHABLE_KEY_RE.test(publishableKey)) return null;
  return { baseUrl, publishableKey };
}

async function verifySupabaseAccessToken(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const token = readBearerToken(options.authorization);
  const config = resolveAuthConfig(env);
  if (!token) return { ok: false, code: 'UNAUTHENTICATED', status: 401 };
  if (!config || typeof fetchImpl !== 'function') {
    return { ok: false, code: 'AUTH_VERIFICATION_UNAVAILABLE', status: 503 };
  }

  try {
    const response = await fetchImpl(config.baseUrl + '/auth/v1/user', {
      method: 'GET',
      headers: {
        apikey: config.publishableKey,
        Authorization: 'Bearer ' + token,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: 'UNAUTHENTICATED', status: 401 };
    }
    if (!response.ok) return { ok: false, code: 'AUTH_VERIFICATION_UNAVAILABLE', status: 503 };
    const user = await response.json();
    if (!user || typeof user !== 'object' || !USER_ID_RE.test(String(user.id || '')) || user.is_anonymous === true) {
      return { ok: false, code: 'UNAUTHENTICATED', status: 401 };
    }
    return { ok: true, user: Object.freeze({ id: user.id.toLowerCase() }) };
  } catch (_) {
    return { ok: false, code: 'AUTH_VERIFICATION_UNAVAILABLE', status: 503 };
  }
}

module.exports = Object.freeze({ readBearerToken, resolveAuthConfig, verifySupabaseAccessToken });
