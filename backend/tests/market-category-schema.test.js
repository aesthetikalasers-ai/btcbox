'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0045_market_asset_categories_v1.sql'), 'utf8');

test('market category taxonomy seeds only definitions and does not guess asset assignments', () => {
  for (const key of ['meme', 'ai', 'erc404', 'inscription']) {
    assert.match(migration, new RegExp("'" + key + "'"));
  }
  assert.match(migration, /insert into public\.btcbox_market_categories/i);
  assert.match(migration, /on conflict \(category_key\) do nothing/i);
  assert.doesNotMatch(migration, /insert into public\.btcbox_asset_category_assignments/i);
  assert.match(migration, /No asset is auto-classified/i);
});

test('category assignments support multiple tags and optional chain contract identity', () => {
  assert.match(migration, /asset_code text not null/i);
  assert.match(migration, /network text/i);
  assert.match(migration, /contract_address text/i);
  assert.match(migration, /btcbox_asset_category_identity_uidx/i);
  assert.match(migration, /references public\.btcbox_market_categories\(category_key\)/i);
});

test('category tables are protected by RLS and service-role-only grants', () => {
  assert.match(migration, /alter table public\.btcbox_market_categories enable row level security/i);
  assert.match(migration, /alter table public\.btcbox_asset_category_assignments enable row level security/i);
  assert.match(migration, /revoke all on public\.btcbox_market_categories, public\.btcbox_asset_category_assignments\s+from public, anon, authenticated/i);
  assert.match(migration, /grant select on public\.btcbox_market_categories, public\.btcbox_asset_category_assignments to service_role/i);
  assert.match(migration, /grant insert, update, delete on public\.btcbox_asset_category_assignments to service_role/i);
});

test('category migration does not touch balances, ledger, orders, or positions', () => {
  assert.doesNotMatch(migration, /\b(update|delete from|truncate)\s+public\.(financial_accounts|financial_operations|financial_ledger|financial_matching_orders|perpetual_orders|perpetual_positions)\b/i);
  assert.doesNotMatch(migration, /insert into public\.(financial_accounts|financial_operations|financial_ledger)\b/i);
});
