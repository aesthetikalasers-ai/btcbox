'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/sql/0030_seconds_admin_open_positions_read_v1.sql'), 'utf8');
const ui = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');

test('admin open-position queue is protected by seconds_policy.read and verified Supabase identity', () => {
  assert.match(api, /route === 'seconds-positions' && verb === 'GET'\) return 'seconds_policy\.read'/);
  assert.match(api, /if \(sub === 'seconds-positions' && method === 'GET'\)/);
  assert.match(api, /p_actor_user_id: adminUserId/);
  assert.match(api, /admin_read_seconds_open_positions_v1/);
  assert.match(api, /Array\.isArray\(result\.positions\)/);
});

test('database independently rechecks active admin membership and read permission', () => {
  assert.match(sql, /private\.admin_get_membership_v1\(p_actor_user_id\)/);
  assert.match(sql, /'seconds_policy\.read'/);
  assert.match(sql, /is_super_admin/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.admin_read_seconds_open_positions_v1\(uuid\)[\s\S]*FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_read_seconds_open_positions_v1\(uuid\)[\s\S]*TO service_role/);
});

test('queue is read-only, bounded, and exposes operational fields without personal profile data', () => {
  assert.match(sql, /WHERE status='open'[\s\S]*ORDER BY settle_at ASC[\s\S]*LIMIT 100/);
  assert.match(sql, /total_open_exposure/);
  assert.match(sql, /overdue_count/);
  assert.match(sql, /payout_bps_snapshot/);
  assert.doesNotMatch(sql, /UPDATE public\.seconds_contract_positions|DELETE FROM public\.seconds_contract_positions|financial_accounts|financial_ledger/);
  const executableSql = sql.split(/\\r?\\n/).filter(line => !line.trim().startsWith('--')).join('\\n');
  assert.doesNotMatch(executableSql, /email|phone|kyc|document_path/i);
});

test('admin UI loads the open-position queue and offers no manual settlement or outcome controls', () => {
  assert.match(client, /getAdminSecondsOpenPositions/);
  assert.match(ui, /Open Seconds positions/);
  assert.match(ui, /secondsOpenPositions/);
  assert.doesNotMatch(ui, /adminSettleSeconds|forceSecondsSettlement|overrideSecondsOutcome/);
});
