'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0026_admin_rbac_private_store_v1.sql'), 'utf8');

test('Admin Panel list endpoint has a public PostgREST bridge to the private membership function', () => {
  assert.ok(api.includes('/rest/v1/rpc/admin_list_memberships_v1'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION private.admin_list_memberships_v1(p_actor_user_id uuid)'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.admin_list_memberships_v1(p_actor_user_id uuid)'));
  assert.ok(sql.includes('SELECT private.admin_list_memberships_v1(p_actor_user_id)'));
});

test('Admin Panel delegated membership mutations have a matching public PostgREST bridge and exact RPC contract', () => {
  assert.ok(api.includes('/rest/v1/rpc/admin_manage_membership_v1'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION private.admin_manage_membership_v1('));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.admin_manage_membership_v1('));
  for (const arg of [
    'p_actor_user_id uuid', 'p_target_user_id uuid', 'p_expected_revision bigint',
    'p_action text', 'p_permissions text[]', 'p_reason text', 'p_request_id text', 'p_request_hash text'
  ]) assert.ok(sql.includes(arg), 'missing SQL bridge argument ' + arg);
  assert.ok(sql.includes('SELECT private.admin_manage_membership_v1('));
});

test('delegated administrator bridges are executable only by the trusted backend role', () => {
  for (const signature of [
    'public.admin_list_memberships_v1(uuid)',
    'public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)'
  ]) {
    const revoke = sql.indexOf('REVOKE ALL ON FUNCTION ' + signature + ' FROM PUBLIC, anon, authenticated;');
    const grant = sql.indexOf('GRANT EXECUTE ON FUNCTION ' + signature + ' TO service_role;');
    assert.ok(revoke >= 0 && grant > revoke, 'bridge privilege boundary missing for ' + signature);
  }
});

test('delegated admin HTTP routes derive actor identity from verified auth and enforce Super Admin authority', () => {
  const listStart = api.indexOf("if (sub === 'admins' && method === 'GET')");
  const manageStart = api.indexOf("if (sub === 'admins/manage' && method === 'POST')");
  const permissionResolver = api.indexOf('const requiredPermission = (function(route, verb)');
  assert.ok(listStart >= 0 && manageStart > listStart && permissionResolver > manageStart);
  const listRoute = api.slice(listStart, manageStart);
  const manageRoute = api.slice(manageStart, permissionResolver);
  assert.ok(listRoute.includes('adminMembership.is_super_admin !== true'));
  assert.ok(manageRoute.includes('adminMembership.is_super_admin !== true'));
  assert.ok(manageRoute.includes('p_actor_user_id: adminUserId'));
  assert.ok(!manageRoute.includes('p_actor_user_id: body.'));
});
