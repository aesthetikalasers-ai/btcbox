'use strict';

// Closed backend permission catalogue. Policy helpers only: this module does not
// authenticate callers or load administrator membership from storage.
const ADMIN_PERMISSION_KEYS = Object.freeze([
  'dashboard.read',
  'users.read', 'users.manage', 'users.freeze',
  'kyc.read', 'kyc.review',
  'deposits.read', 'deposits.review',
  'payout_addresses.read_sensitive', 'payout_addresses.manage',
  'withdrawals.read', 'withdrawals.review',
  'orders.read',
  'support.read', 'support.reply', 'support.manage',
  'announcements.read', 'announcements.manage',
  'system_config.read', 'system_config.write',
  'seconds_policy.read', 'seconds_policy.manage',
  'financial_audit.read', 'financial_adjustment.request'
]);
const ADMIN_PERMISSION_SET = new Set(ADMIN_PERMISSION_KEYS);
function normalizeAdminPermissionSet(input) {
  if (!Array.isArray(input)) return { ok: false, code: 'INVALID_PERMISSION_SET', permissions: [] };
  const normalized = [], seen = new Set();
  for (const item of input) {
    if (typeof item !== 'string' || !ADMIN_PERMISSION_SET.has(item)) return { ok: false, code: 'UNKNOWN_ADMIN_PERMISSION', permissions: [] };
    if (seen.has(item)) return { ok: false, code: 'DUPLICATE_ADMIN_PERMISSION', permissions: [] };
    seen.add(item); normalized.push(item);
  }
  normalized.sort();
  return { ok: true, permissions: normalized };
}
// membership must originate from the protected server-side store after the
// request's Supabase Auth token has been verified by the trusted Auth server.
function hasAdminPermission(membership, permission) {
  if (!membership || membership.status !== 'active') return false;
  if (membership.is_super_admin === true) return ADMIN_PERMISSION_SET.has(permission);
  if (!ADMIN_PERMISSION_SET.has(permission)) return false;
  const parsed = normalizeAdminPermissionSet(membership.permissions);
  return parsed.ok && parsed.permissions.includes(permission);
}
function canManageAdministrators(membership) {
  return !!membership && membership.status === 'active' && membership.is_super_admin === true;
}
module.exports = Object.freeze({ ADMIN_PERMISSION_KEYS, normalizeAdminPermissionSet, hasAdminPermission, canManageAdministrators });
