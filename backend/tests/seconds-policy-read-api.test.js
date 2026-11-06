'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0025_seconds_policy_versioning_v1.sql'), 'utf8');

test('active Seconds policy is exposed only through the trusted server RPC', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.read_active_seconds_policy_v1\(\)/i);
  assert.match(sql, /SECURITY DEFINER[\s\S]*?seconds_contract_policy_active[\s\S]*?seconds_contract_policies/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.read_active_seconds_policy_v1\(\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.read_active_seconds_policy_v1\(\) TO service_role/i);
});

test('policy API requires an authenticated user and validates policy bounds before returning them', () => {
  const start = api.indexOf("if (path === 'seconds/policy' && method === 'GET')");
  const end = api.indexOf("// ---------- POST /api/seconds/order ----------", start);
  assert.ok(start >= 0 && end > start);
  const handler = api.slice(start, end);
  assert.match(handler, /if \(!user\)/);
  assert.match(handler, /read_active_seconds_policy_v1/);
  assert.match(handler, /SECONDS_ALLOWED_SYMBOLS/);
  assert.match(handler, /SECONDS_ALLOWED_DURATIONS/);
  assert.match(handler, /payout_bps/);
  assert.match(handler, /actions_enabled: financialWritesEnabled\(\)/);
});


test('active payout policy has an 85 percent floor and no hard-coded 100 percent ceiling', () => {
  assert.match(sql, /payout_bps integer NOT NULL CHECK \(payout_bps >= 8500\)/);
  assert.doesNotMatch(sql, /payout_bps BETWEEN 8500 AND 10000/);
  assert.match(api, /policy\.payout_bps < 8500/);
  assert.doesNotMatch(api, /policy\.payout_bps > 10000/);
});
