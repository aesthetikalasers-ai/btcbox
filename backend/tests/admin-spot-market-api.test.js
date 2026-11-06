'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const rbac = fs.readFileSync(path.join(root, 'admin-rbac.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0028_admin_rbac_service_rpc_wrappers_v1.sql'), 'utf8');
const spotSchema = fs.readFileSync(path.join(root, 'supabase/sql/0008_financial_matching_engine_v1.sql'), 'utf8');

test('admin spot-market API is protected by the existing system-config permission boundary', () => {
  assert.match(api, /route === 'spot-markets' && verb === 'GET'\) return 'system_config\.read'/);
  assert.match(api, /route === 'spot-markets' && verb === 'POST'\) return 'system_config\.write'/);
  assert.match(api, /if \(sub === 'spot-markets' && method === 'GET'\)/);
  assert.match(api, /if \(sub === 'spot-markets' && method === 'POST'\)/);
  assert.match(api, /SUPPORTED_LEDGER_ASSETS\.has\(baseAsset\)/);
  assert.match(api, /SUPPORTED_LEDGER_ASSETS\.has\(quoteAsset\)/);
  assert.match(api, /p_actor_user_id: adminUserId/);
  assert.match(api, /p_request_id: requestId, p_request_hash: requestHash/);
  assert.match(api, /admin_set_spot_market_v1/);
  assert.match(rbac, /'system_config\.write'/);
});

test('spot-market configuration is audited, idempotent and cannot be written directly by browser roles', () => {
  assert.match(spotSchema, /ALTER TABLE public\.financial_matching_markets ENABLE ROW LEVEL SECURITY/i);
  assert.match(spotSchema, /REVOKE ALL ON public\.financial_matching_markets FROM PUBLIC, anon, authenticated/i);
  assert.match(spotSchema, /GRANT SELECT ON public\.financial_matching_markets TO service_role/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS private\.spot_market_request_idempotency/i);
  assert.match(sql, /PRIMARY KEY\(actor_user_id,request_id\)/i);
  assert.match(sql, /private\.admin_get_membership_v1\(p_actor_user_id\)/i);
  assert.match(sql, /'system_config\.write'/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*p_actor_user_id::text \|\| ':' \|\| p_request_id/i);
  assert.match(sql, /spot market idempotency payload mismatch/i);
  assert.match(sql, /admin_spot_market_updated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_set_spot_market_v1[\s\S]*FROM PUBLIC,anon,authenticated,service_role/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_set_spot_market_v1[\s\S]*TO service_role/i);
  assert.match(sql, /read_spot_market_snapshot_v1/);
});
