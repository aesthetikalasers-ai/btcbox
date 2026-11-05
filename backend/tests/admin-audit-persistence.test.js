'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/sql/0021_admin_audit_log_append_only_v1.sql'), 'utf8');

test('admin audit events are staged locally and delivered through a durable outbox', () => {
  const stageStart = source.indexOf('async function auditAdmin(action, uid, detail)');
  const stageEnd = source.indexOf('// POST /api/admin/user/balance', stageStart);
  assert.ok(stageStart >= 0 && stageEnd > stageStart);
  const stage = source.slice(stageStart, stageEnd);
  assert.match(stage, /postgres_sync_status: supabaseStorageConfigured\(\) \? 'pending' : 'local_only'/);
  assert.doesNotMatch(stage, /await fetch\(/);

  const flushStart = source.indexOf('async function flushAdminAuditOutbox()');
  const flushEnd = source.indexOf("if (path.startsWith('admin/'))", flushStart);
  assert.ok(flushStart >= 0 && flushEnd > flushStart);
  const flush = source.slice(flushStart, flushEnd);
  assert.match(flush, /p_event_id: String\(entry\.id\)/);
  assert.match(flush, /response\.ok && result === true/);
  assert.match(flush, /entry\.postgres_sync_status = 'synced'/);
  assert.match(flush, /await saveDB\(db\)/);
  assert.match(flush, /pending: db\.audit_logs\.some/);
});

test('every non-financial admin mutation stages an audit event and saves state before delivery', () => {
  const actionBlocks = [
    ["if (sub === 'user/freeze' && method === 'POST')", "if (sub === 'user/reset-pwd'"],
    ["if (sub === 'user/reset-pwd' && method === 'POST')", "if (sub === 'user/reset-email'"],
    ["if (sub === 'user/reset-email' && method === 'POST')", "if (sub === 'deposit/confirm'"],
    ["if (sub === 'kyc/approve' && method === 'POST')", "if (sub === 'kyc/reject'"],
    ["if (sub === 'kyc/reject' && method === 'POST')", "if (sub === 'push'"],
    ["if (sub === 'push' && method === 'POST')", "if (sub === 'support/reply'"],
    ["if (sub === 'support/reply' && method === 'POST')", "if (sub === 'addresses'"],
    ["if (sub === 'address/manage' && method === 'POST')", "if (sub === 'audit-logs'"],
    ["if (sub === 'config' && method === 'POST')", "if (sub === 'withdrawals'"]
  ];
  for (const [from, to] of actionBlocks) {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    const block = source.slice(start, end);
    const audit = block.indexOf('await auditAdmin(');
    const save = block.indexOf('await saveDB(db)', audit);
    const flush = block.indexOf('await flushAdminAuditOutbox()', save);
    assert.ok(audit >= 0 && save > audit && flush > save, from + ' must persist state/outbox before PostgreSQL delivery');
  }
  const calls = source.split('\n').filter(line => line.includes('auditAdmin(') && !line.includes('function auditAdmin'));
  assert.equal(calls.length, 9);
  for (const line of calls) assert.match(line.trim(), /^await auditAdmin\(/);
});

test('admin audit RPC uses a unique event ID and validates duplicate payloads', () => {
  assert.match(migration, /add column if not exists event_id text/i);
  assert.match(migration, /create unique index if not exists financial_audit_event_id_uidx[\s\S]*\(event_id\)[\s\S]*where event_id is not null/i);
  assert.match(migration, /drop function if exists public\.append_admin_audit_log\(text, text, text, text, jsonb\)/i);
  assert.match(migration, /create or replace function public\.append_admin_audit_log\([\s\S]*p_event_id text/i);
  assert.match(migration, /on conflict \(event_id\) where event_id is not null do nothing/i);
  assert.match(migration, /administrator audit event idempotency conflict/i);
  assert.match(migration, /notify pgrst, 'reload schema'/i);
});
