'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const canonical = fs.readFileSync(path.join(root, 'supabase/sql/0042_support_read_state_v1.sql'), 'utf8');
const upgrade = fs.readFileSync(path.join(root, 'supabase/existing-schema-upgrades/0042_existing_schema_support_read_state_v1.sql'), 'utf8');

test('support read markers no longer write the monolithic BTCBOX state', () => {
  const messagesStart = api.indexOf("if (path === 'support/messages' && method === 'GET')");
  const messagesEnd = api.indexOf("if (path === 'support/faq' && method === 'GET')", messagesStart);
  assert.ok(messagesStart >= 0 && messagesEnd > messagesStart);
  const messagesRoute = api.slice(messagesStart, messagesEnd);
  assert.ok(messagesRoute.includes('await markSupportConversationRead(user.uid)'));
  assert.doesNotMatch(messagesRoute, /saveDB\(db\)|last_read_chat_at/);

  const unreadStart = api.indexOf("if (path === 'chat/unread' && method === 'GET')");
  const unreadEnd = api.indexOf('// ==================== 后台管理 API', unreadStart);
  assert.ok(unreadStart >= 0 && unreadEnd > unreadStart);
  const unreadRoute = api.slice(unreadStart, unreadEnd);
  assert.ok(unreadRoute.includes('await getSupportConversationReadAt(user.uid)'));
  assert.ok(unreadRoute.includes("m.from === 'admin'"));
});

test('support read marker RPC is isolated, atomic, and service-role-only', () => {
  for (const contract of [
    'create table if not exists public.btcbox_support_read_state',
    'enable row level security',
    'revoke all on table public.btcbox_support_read_state from public, anon, authenticated',
    'grant select, insert, update on table public.btcbox_support_read_state to service_role',
    'on conflict (uid) do update',
    'greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at)',
    'create or replace function public.btcbox_mark_support_read(p_uid text)',
    'create or replace function public.btcbox_get_support_read(p_uid text)',
    'grant execute on function public.btcbox_mark_support_read(text) to service_role',
    'grant execute on function public.btcbox_get_support_read(text) to service_role',
    'at time zone \'UTC\''
  ]) assert.ok(canonical.toLowerCase().includes(contract.toLowerCase()), 'missing SQL contract: ' + contract);
  assert.equal(upgrade, canonical, 'existing-schema upgrade must stay byte-identical to canonical SQL');
  assert.equal((canonical.match(/create table if not exists public\.btcbox_support_read_state/g) || []).length, 1);
  assert.equal((canonical.match(/create or replace function public\.btcbox_mark_support_read/g) || []).length, 1);
  assert.equal((canonical.match(/create or replace function public\.btcbox_get_support_read/g) || []).length, 1);
  assert.doesNotMatch(canonical, /;\s*on conflict \(uid\) do update/);
  assert.ok(canonical.trimEnd().endsWith('grant execute on function public.btcbox_get_support_read(text) to service_role;'));
});

test('support read migration preserves valid legacy UTC read markers', () => {
  assert.ok(canonical.includes("u.value->>'last_read_chat_at'"));
  assert.ok(canonical.includes("::timestamp without time zone at time zone 'UTC'"));
  assert.ok(canonical.includes("length(coalesce(u.value->>'last_read_chat_at', '')) = 19"));
  assert.ok(canonical.includes("~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}'"));
  assert.ok(canonical.includes("pg_input_is_valid(u.value->>'last_read_chat_at', 'timestamp without time zone')"));
  assert.ok(canonical.includes('on conflict (uid) do update'));
});
