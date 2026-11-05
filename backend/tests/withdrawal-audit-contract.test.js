'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('withdrawal review migration extends the canonical table and retains atomic freeze', () => {
  const sql = read('supabase/sql/0022_withdrawal_admin_review_status_v1.sql');
  assert.match(sql, /alter table public\.withdrawal_requests[\s\S]*add column if not exists require_admin_review boolean not null default false/i);
  assert.match(sql, /add constraint withdrawal_requests_status_check[\s\S]*pending_admin_review/i);
  assert.match(sql, /drop function if exists public\.create_withdrawal_atomic\(text,text,text,text,numeric,numeric,text,text,text\)/i);
  assert.match(sql, /create function public\.create_withdrawal_atomic\([\s\S]*p_amount numeric[\s\S]*p_fee numeric[\s\S]*p_require_admin_review boolean default false/i);
  assert.match(sql, /public\.apply_financial_operation\([\s\S]*'withdraw-freeze:' \|\| p_request_id/i);
  assert.match(sql, /insert into public\.withdrawal_requests[\s\S]*freeze_operation_id[\s\S]*require_admin_review[\s\S]*request_hash/i);
  assert.doesNotMatch(sql, /public\.withdrawals\b/i);
  assert.match(sql, /security invoker\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.create_withdrawal_atomic[\s\S]*from public, anon, authenticated/i);
});

test('withdrawal retries return the original row and reject payload or review-flag mismatch', () => {
  const sql = read('supabase/sql/0022_withdrawal_admin_review_status_v1.sql');
  assert.match(sql, /where request_id = p_request_id\s+for update/i);
  assert.match(sql, /v_existing\.id,[\s\S]*v_existing\.status,[\s\S]*v_existing\.require_admin_review/i);
  assert.match(sql, /v_existing\.request_hash is distinct from p_request_hash/i);
  assert.match(sql, /v_existing\.require_admin_review is distinct from p_require_admin_review/i);
});

test('administrator review accepts both pending states and keeps ledger and audit in one transaction', () => {
  const sql = read('supabase/sql/0022_withdrawal_admin_review_status_v1.sql');
  assert.match(sql, /v_w\.status not in \('pending', 'pending_admin_review'\)/i);
  assert.match(sql, /public\.apply_financial_operation\([\s\S]*'withdraw-review:' \|\| v_w\.id/i);
  assert.match(sql, /update public\.withdrawal_requests[\s\S]*review_operation_id/i);
  assert.match(sql, /insert into public\.financial_audit_log/i);
});

test('admin withdrawal read RPC includes normal and admin-review queues', () => {
  const sql = read('supabase/sql/0012_financial_admin_read_api_v1.sql');
  assert.match(sql, /status in \('pending', 'pending_admin_review'\)/i);
  assert.match(sql, /pending_admin_review_count/i);
  assert.match(sql, /'require_admin_review', require_admin_review/i);
});

test('admin audit RPC maps the existing API contract to canonical financial_audit_log columns', () => {
  const sql = read('supabase/sql/0021_admin_audit_log_append_only_v1.sql');
  assert.match(sql, /actor_id, subject_user_id, action, object_type, object_id, reason, metadata/i);
  assert.match(sql, /coalesce\(nullif\(p_by, ''\), 'admin'\)/i);
  assert.match(sql, /security invoker\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.append_admin_audit_log\(text, text, text, text, jsonb\) from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /\b(uid|detail|meta)\s*\)/i);
});

test('withdrawal API trusts only validated database status and persisted review flag', () => {
  const api = read('api-core.js');
  assert.match(api, /!\['pending', 'pending_admin_review', 'approved', 'rejected', 'broadcast', 'failed'\]\.includes\(result\.status\)/);
  assert.match(api, /typeof result\.require_admin_review !== 'boolean'/);
  assert.match(api, /require_admin_review: result\.require_admin_review/);
  assert.doesNotMatch(api, /require_admin_review: requireAdminReview/);
  assert.match(api, /pending_admin_review_count/);
  assert.match(api, /pending_admin_review_withdrawals: pendingAdminReviewWd/);
  assert.match(api, /result\.pending_admin_review_count > result\.pending_count/);
  assert.match(api, /w\.status === 'pending_admin_review'/);
});
