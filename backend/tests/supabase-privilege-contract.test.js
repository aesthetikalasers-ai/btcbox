'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlDir = path.join(__dirname, '..', 'supabase', 'sql');
const rateLimit = fs.readFileSync(path.join(sqlDir, '0023_btcbox_shared_rate_limit_v1.sql'), 'utf8');
const secondsPolicy = fs.readFileSync(path.join(sqlDir, '0025_seconds_policy_versioning_v1.sql'), 'utf8');

test('shared rate-limit table is server-only with RLS and service-role RPC execution', () => {
  assert.match(rateLimit, /alter table public\.btcbox_rate_limits enable row level security/i);
  assert.match(rateLimit, /revoke all on table public\.btcbox_rate_limits from public, anon, authenticated/i);
  assert.match(rateLimit, /grant select, insert, update, delete on table public\.btcbox_rate_limits to service_role/i);
  assert.match(rateLimit, /revoke all on function public\.btcbox_rate_limit_consume_v1\(text, text\) from public, anon, authenticated/i);
  assert.match(rateLimit, /grant execute on function public\.btcbox_rate_limit_consume_v1\(text, text\) to service_role/i);
  assert.match(rateLimit, /revoke all on function public\.btcbox_rate_limit_cleanup_v1\(\) from public, anon, authenticated/i);
  assert.match(rateLimit, /grant execute on function public\.btcbox_rate_limit_cleanup_v1\(\) to service_role/i);
});

test('seconds policy tables are RLS protected and cannot be written directly by API roles or service role', () => {
  for (const table of [
    'seconds_contract_policies',
    'seconds_contract_policy_active',
    'seconds_contract_policy_audit'
  ]) {
    assert.match(secondsPolicy, new RegExp('ALTER TABLE public\\.' + table + ' ENABLE ROW LEVEL SECURITY', 'i'));
  }
  assert.match(secondsPolicy, /REVOKE ALL ON public\.seconds_contract_policies, public\.seconds_contract_policy_active,[\s\S]*?FROM public, anon, authenticated/i);
  assert.match(secondsPolicy, /REVOKE INSERT, UPDATE, DELETE ON public\.seconds_contract_policies,[\s\S]*?FROM service_role/i);
  assert.match(secondsPolicy, /GRANT SELECT ON public\.seconds_contract_policies, public\.seconds_contract_policy_active TO service_role/i);
  assert.match(secondsPolicy, /REVOKE ALL ON FUNCTION public\.submit_seconds_order_v1\([\s\S]*?FROM public, anon, authenticated/i);
  assert.match(secondsPolicy, /GRANT EXECUTE ON FUNCTION public\.submit_seconds_order_v1\([\s\S]*?TO service_role/i);
  assert.match(secondsPolicy, /REVOKE ALL ON FUNCTION public\.settle_seconds_position_v1\([\s\S]*?FROM public, anon, authenticated/i);
  assert.match(secondsPolicy, /GRANT EXECUTE ON FUNCTION public\.settle_seconds_position_v1\([\s\S]*?TO service_role/i);
});
