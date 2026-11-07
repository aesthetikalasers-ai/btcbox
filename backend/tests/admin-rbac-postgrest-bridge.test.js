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
  assert.ok(sql.includes("AS 'SELECT private.admin_list_memberships_v1($1)';"));
});

test('Admin Panel delegated membership mutations have a matching public PostgREST bridge and exact RPC contract', () => {
  assert.ok(api.includes('/rest/v1/rpc/admin_manage_membership_v1'));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION private.admin_manage_membership_v1('));
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.admin_manage_membership_v1('));
  for (const arg of [
    'p_actor_user_id uuid', 'p_target_user_id uuid', 'p_expected_revision bigint',
    'p_action text', 'p_permissions text[]', 'p_reason text', 'p_request_id text', 'p_request_hash text'
  ]) assert.ok(sql.includes(arg), 'missing SQL bridge argument ' + arg);
  assert.ok(sql.includes("AS 'SELECT private.admin_manage_membership_v1($1,$2,$3,$4,$5,$6,$7,$8)';"));
});

test('public PostgREST bridges are SECURITY DEFINER functions with a fixed search path', () => {
  for (const name of ['public.admin_list_memberships_v1', 'public.admin_manage_membership_v1']) {
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION ' + name);
    const end = sql.indexOf('REVOKE ALL ON FUNCTION ' + name, start);
    assert.ok(start >= 0 && end > start);
    const definition = sql.slice(start, end);
    assert.ok(definition.includes('SECURITY DEFINER'));
    assert.ok(definition.includes('SET search_path = pg_catalog, private'));
  }
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

test('final Admin PostgREST RPC wrappers are invoker-only and service-role-only', () => {
  const wrappers = fs.readFileSync(path.join(root, 'supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql'), 'utf8');
  const contracts = [
    ['public.admin_get_membership_v1', 'public.admin_get_membership_v1(uuid)'],
    ['public.admin_list_memberships_v1', 'public.admin_list_memberships_v1(uuid)'],
    ['public.admin_manage_membership_v1', 'public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)'],
    ['public.admin_set_seconds_policy_v1', 'public.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)'],
    ['public.admin_set_spot_market_v1', 'public.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)'],
    ['public.read_spot_market_snapshot_v1', 'public.read_spot_market_snapshot_v1()']
  ];

  for (const [name, signature] of contracts) {
    const start = wrappers.indexOf('CREATE OR REPLACE FUNCTION ' + name);
    const revoke = wrappers.indexOf('REVOKE ALL ON FUNCTION ' + signature, start);
    const grant = wrappers.indexOf('GRANT EXECUTE ON FUNCTION ' + signature, revoke);
    assert.ok(start >= 0 && revoke > start && grant > revoke, 'missing final wrapper privilege contract for ' + name);

    const definition = wrappers.slice(start, revoke);
    assert.match(definition, /SECURITY INVOKER/i, name + ' must execute with invoker privileges');
    assert.match(definition, /SET search_path = ''/i, name + ' must use an empty search_path');
    assert.doesNotMatch(definition, /SECURITY DEFINER/i, name + ' must not elevate privileges');

    const privilegeBlock = wrappers.slice(revoke, wrappers.indexOf(';', grant) + 1);
    assert.match(privilegeBlock, /FROM PUBLIC,\s*anon,\s*authenticated,\s*service_role/i,
      name + ' must revoke inherited/default execute privileges');
    assert.match(privilegeBlock, /TO service_role/i, name + ' must grant execute only to service_role');
    assert.doesNotMatch(privilegeBlock, /TO (PUBLIC|anon|authenticated)\b/i,
      name + ' must not grant browser-role execution');
  }
});
