'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.resolve(__dirname, '../supabase/sql/0040_admin_superadmin_membership_listing_v1.sql'),
  'utf8'
);

test('Super Admin membership listing includes the Super Admin and delegated admins', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.admin_list_memberships_v1\(p_actor_user_id uuid\)/i);
  assert.match(migration, /status = 'active'[\s\S]*is_super_admin = true/i);
  assert.match(migration, /'is_super_admin', m\.is_super_admin/i);
  assert.match(migration, /FROM private\.admin_memberships m;/i);
  assert.match(migration, /ORDER BY m\.is_super_admin DESC, m\.created_at DESC/i);
  assert.match(migration, /DISTINCT ON \(e\.permission_key\)/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION private\.admin_list_memberships_v1\(uuid\)[\s\S]*TO service_role/i);
});

test('Super Admin listing migration does not redefine financial or withdrawal operations', () => {
  assert.doesNotMatch(migration, /apply_financial_operation|withdraw_paid|withdraw_settle|review_withdrawal_atomic|mark_withdrawal_paid_atomic/i);
});
