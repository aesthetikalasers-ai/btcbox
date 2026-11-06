'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.resolve(__dirname, '../supabase/sql/0026_admin_rbac_private_store_v1.sql'), 'utf8');
const design = fs.readFileSync(path.resolve(__dirname, '../../docs/SECONDS_POLICY_ADMIN_RBAC.md'), 'utf8');

test('administrator storage lives in a non-exposed private schema with RLS and no browser grants', () => {
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS private/i);
  assert.match(sql, /ALTER TABLE private\.admin_memberships ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /ALTER TABLE private\.admin_permission_events ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION.*reject_admin_history_mutation_v1.*FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(sql, /GRANT USAGE ON SCHEMA private TO service_role/i);
  assert.match(sql, /COMMENT ON SCHEMA private IS 'Non-exposed/i);
});

test('only the project owner can bootstrap the single Super Admin out of band', () => {
  assert.match(sql, /FUNCTION private\.bootstrap_super_admin_v1/i);
  assert.match(sql, /session_user <> 'postgres'/i);
  assert.match(sql, /Super Admin already bootstrapped/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private\.bootstrap_super_admin_v1[\s\S]* TO postgres/i);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION private\.bootstrap_super_admin_v1[\s\S]* TO service_role/i);
  assert.match(sql, /single_super_admin_idx/i);
});

test('ordinary Admin permissions come from a closed seeded catalogue', () => {
  for (const permission of [
    'dashboard.read','users.read','users.manage','users.freeze','kyc.read','kyc.review',
    'deposits.read','deposits.review','withdrawals.read','withdrawals.review','orders.read',
    'support.read','support.reply','support.manage','announcements.read','announcements.manage',
    'system_config.read','system_config.write','seconds_policy.read','seconds_policy.manage',
    'financial_audit.read','financial_adjustment.request'
  ]) assert.ok(sql.includes("'" + permission + "'"), 'missing permission ' + permission);
  assert.doesNotMatch(sql, /'\*'|admins\.manage|admins\.create/i);
});

test('grant and audit history is append-only and all membership state is revisioned', () => {
  assert.match(sql, /CREATE TABLE private\.admin_permission_events/i);
  assert.match(sql, /CREATE TABLE private\.admin_security_audit/i);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON private\.admin_permission_events/i);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON private\.admin_security_audit/i);
  assert.match(sql, /actor_kind text NOT NULL DEFAULT 'admin'/i);
  assert.match(sql, /'owner_bootstrap',NULL,p_auth_user_id,'provision'/i);
  assert.match(sql, /revision=revision\+1/i);
  assert.match(sql, /p_expected_revision<>v_target\.revision/i);
  assert.match(sql, /p_expected_revision<>0/i);
  assert.match(sql, /membership_revision bigint NOT NULL/i);
  assert.match(sql, /event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY/i);
});

test('service role can execute narrowly scoped functions but has no direct table DML', () => {
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private\.admin_get_membership_v1\(uuid\) TO service_role/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION private\.admin_manage_membership_v1[\s\S]* TO service_role/i);
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, private, auth/i);
  assert.match(sql, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, private/i);
});

test('membership management requires active Super Admin and rejects self-management and Super Admin target changes', () => {
  assert.match(sql, /p_actor_user_id=p_target_user_id/i);
  assert.match(sql, /is_super_admin=true[\s\S]*FOR UPDATE/i);
  assert.match(sql, /Super Admin authority required/i);
  assert.match(sql, /Super Admin authority cannot be changed through this API/i);
  assert.match(sql, /target administrator cannot be modified/i);
});

test('permission writes reject unknown, duplicate, wildcard, and malformed permission sets', () => {
  assert.match(sql, /JOIN private\.admin_permission_catalog USING\(permission_key\)/i);
  assert.match(sql, /unknown or duplicate permission key/i);
  assert.match(sql, /provision\/reactivate requires explicit permissions/i);
  assert.match(sql, /suspend\/revoke cannot carry permissions/i);
});

test('grant, revoke, membership revision, idempotency and audit commit in one transition function', () => {
  assert.match(sql, /CREATE TABLE private\.admin_request_idempotency/i);
  assert.match(sql, /idempotency conflict/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /complete desired permission snapshot/i);
  assert.match(sql, /CASE WHEN c\.permission_key=ANY\(v_allowed\) THEN 'grant' ELSE 'revoke' END/i);
  assert.match(sql, /INSERT INTO private\.admin_permission_events/i);
  assert.match(sql, /INSERT INTO private\.admin_security_audit/i);
  assert.match(sql, /INSERT INTO private\.admin_request_idempotency/i);
  assert.match(sql, /RETURN v_response[\s\S]*replayed',false/i);
});

test('membership lookup derives permissions from live membership and latest grant events', () => {
  assert.match(sql, /FUNCTION private\.admin_get_membership_v1/i);
  assert.match(sql, /v_membership\.status <> 'active'/i);
  assert.match(sql, /DISTINCT ON \(e\.permission_key\)/i);
  assert.match(sql, /ORDER BY e\.permission_key,e\.event_id DESC/i);
  assert.match(sql, /IF v_membership\.is_super_admin THEN/i);
});

test('migration source is not applied and bootstrap does not provision a default account', () => {
  assert.match(sql, /SOURCE ONLY: apply only to an isolated Supabase staging project/i);
  assert.match(sql, /No administrator is bootstrapped by this migration/i);
  const beforeBootstrap = sql.slice(0, sql.indexOf('CREATE OR REPLACE FUNCTION private.bootstrap_super_admin_v1'));
  assert.doesNotMatch(beforeBootstrap, /INSERT INTO private\.admin_memberships/i);
  assert.match(design, /initial Super Admin is provisioned once by the project owner/i);
  assert.match(design, /No default email, password, UUID, or public bootstrap endpoint/i);
});

test('design supersedes old two-person bootstrap and three-person approval requirements', () => {
  assert.match(design, /supersedes conflicting approval\/bootstrap language/i);
  assert.match(design, /The Super Admin may perform the complete seconds-policy lifecycle alone/i);
  assert.match(design, /No three-person approval requirement is imposed/i);
  assert.match(design, /The initial Super Admin is provisioned once by the project owner through a private, out-of-band operation/i);
  assert.doesNotMatch(design.slice(design.indexOf('## 13. Product decision'), design.length), /two separately authenticated approvers/i);
});
