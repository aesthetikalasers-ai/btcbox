'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0055_withdrawal_approval_debit_at_review_v1.sql'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.join(root, '../frontend/src/lib/api.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');

test('withdrawal history RPC uses stable user-scoped keyset pagination', () => {
  const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.read_withdrawal_history_page_v1');
  const end = migration.indexOf('REVOKE ALL ON FUNCTION public.read_withdrawal_history_page_v1', start);
  assert.ok(start >= 0 && end > start);
  const fn = migration.slice(start, end);
  assert.match(fn, /WHERE user_id = p_user_id/);
  assert.match(fn, /\(created_at, id\) < \(p_before_created_at, p_before_id\)/);
  assert.match(fn, /ORDER BY created_at DESC, id DESC/);
  assert.match(fn, /LIMIT v_limit \+ 1/);
  assert.match(fn, /'reviewed_at', reviewed_at/);
  assert.match(fn, /'rejection_reason', rejection_reason/);
  assert.doesNotMatch(fn, /payout_reference|payout_note|paid_by|paid_at|txid/i);
  assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS rejection_reason text'));
  assert.match(migration, /withdrawal_requests_user_history_idx[\s\S]*?ON public\.withdrawal_requests \(user_id, created_at DESC, id DESC\)/);
});

test('history RPC is executable only by the trusted backend service role', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.read_withdrawal_history_page_v1\(text, timestamptz, text, integer\)[\s\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.read_withdrawal_history_page_v1\(text, timestamptz, text, integer\)[\s\S]*?TO service_role/);
});

test('customer history API derives scope from the authenticated session and returns a strict public projection', () => {
  const start = api.indexOf("if (path === 'withdrawal/history' && method === 'GET')");
  const end = api.indexOf("// ---------- GET /api/withdrawal/config", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('if (!user)'));
  assert.ok(route.includes('p_user_id: String(user.uid)'));
  assert.ok(route.includes('read_withdrawal_history_page_v1'));
  for (const field of ['reviewed_at:', 'rejection_reason:', 'amount:', 'fee:', 'network:', 'address:', 'status:']) {
    assert.ok(route.includes(field), 'public history projection missing ' + field);
  }
  for (const field of ['payout_reference', 'payout_note', 'paid_by', 'paid_at', 'txid']) {
    assert.doesNotMatch(route, new RegExp(field));
  }
});

test('frontend history client follows the server cursor and renders a load-more action', () => {
  assert.ok(client.includes('getWithdrawalHistoryPage'));
  assert.ok(client.includes('withdrawal/history'));
  assert.ok(client.includes('encodeURIComponent(cursor)'));
  assert.ok(page.includes('getWithdrawalHistoryPage(historyCursor)'));
  assert.ok(page.includes('historyRecords'));
  assert.ok(page.includes('t("Load more")'));
  assert.ok(page.includes('setHistoryCursor(page.next_cursor)'));
});
