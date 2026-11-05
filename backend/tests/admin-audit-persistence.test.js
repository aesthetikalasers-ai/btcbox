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


test('canonical PostgreSQL audit reader is opt-in, keyset-paginated, redacted, and fail-closed', () => {
  const start = source.indexOf('async function readAdminAuditLogPage(params)');
  const end = source.indexOf('function attachRevision', start);
  assert.ok(start >= 0 && end > start);
  const reader = source.slice(start, end);
  assert.match(reader, /financial_audit_log/);
  assert.match(reader, /id::text/);
    assert.ok(reader.includes('!isPositivePostgresBigintString(row.id)'));
  assert.ok(!reader.includes('Number.isSafeInteger(Number(row.id))'));
  assert.match(reader, /order: 'id\.desc'/);
  assert.match(reader, /query\.set\('id', 'lt\.' \+ params\.before\)/);
  assert.match(reader, /query\.set\('action', 'eq\.' \+ params\.action\)/);
  assert.match(reader, /query\.set\('subject_user_id', 'eq\.' \+ params\.uid\)/);
  assert.match(reader, /redactAdminAuditDetail\(row\.reason \|\| ''\)/);
  assert.doesNotMatch(reader, /metadata/);
  assert.match(source, /ADMIN_AUDIT_POSTGRES_READS_ENABLED === '1'/);
  const routeStart = source.indexOf("if (sub === 'audit-logs' && method === 'GET')");
  const routeEnd = source.indexOf('// GET /api/admin/config', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /AUDIT_ACTION_FILTER_INVALID/);
  assert.match(route, /AUDIT_UID_FILTER_INVALID/);
  assert.match(route, /AUDIT_CURSOR_INVALID/);
  assert.match(route, /completeness: 'postgres_canonical'/);
  assert.match(route, /ADMIN_AUDIT_READ_UNAVAILABLE/);
  assert.match(route, /Never silently fall back/);
  assert.match(route, /state_document_retention_limited/);
});


test('admin audit bigint cursor validation rejects values above signed PostgreSQL bigint without Number coercion', () => {
  const start = source.indexOf('function isPositivePostgresBigintString(value)');
  const end = source.indexOf('function redactAdminAuditDetail(value)', start);
  assert.ok(start >= 0 && end > start);
  const validator = source.slice(start, end);
  assert.ok(validator.includes('/^[1-9][0-9]{0,18}$/'));
  assert.ok(validator.includes("value <= '9223372036854775807'"));
  assert.ok(source.includes('before && !isPositivePostgresBigintString(before)'));
  assert.ok(source.includes('!isPositivePostgresBigintString(row.id)'));
  assert.ok(!validator.includes('Number('));
});


test('admin audit detail redaction masks credential, personal, and wallet values', () => {
  const start = source.indexOf('function redactAdminAuditDetail(value)');
  const end = source.indexOf('function isValidAuthEmail(value)', start);
  assert.ok(start >= 0 && end > start);
  const redact = require('node:vm').runInNewContext(source.slice(start, end) + '\nredactAdminAuditDetail');
  const raw = JSON.stringify({
    password: 'hunter2-secret',
    token: 'eyJ-sensitive-token',
    api_key: 'sk-sensitive-key',
    recovery_code: 'recovery-phrase-123',
    email: 'private.person@example.com',
    wallet: '0x1234567890abcdef1234567890abcdef12345678',
    tron: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
  });
  const safe = redact(raw);
  for (const secret of ['hunter2-secret', 'eyJ-sensitive-token', 'sk-sensitive-key', 'recovery-phrase-123',
    'private.person@example.com', '0x1234567890abcdef1234567890abcdef12345678',
    'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE']) {
    assert.ok(!safe.includes(secret), 'sensitive value must not appear: ' + secret);
  }
  assert.match(safe, /\[redacted\]/);
  assert.match(safe, /\[email\]/);
  assert.match(safe, /\[wallet address\]/);
  assert.ok(safe.length <= 300);
});

test('admin audit detail redaction is case-insensitive and caps displayed detail length', () => {
  const start = source.indexOf('function redactAdminAuditDetail(value)');
  const end = source.indexOf('function isValidAuthEmail(value)', start);
  const redact = require('node:vm').runInNewContext(source.slice(start, end) + '\nredactAdminAuditDetail');
  const safe = redact('PASSWORD=UpperSecret TOKEN=UpperToken ' + 'x'.repeat(500));
  assert.ok(!safe.includes('UpperSecret'));
  assert.ok(!safe.includes('UpperToken'));
  assert.ok(safe.length <= 300);
});


test('admin audit fallback pagination only emits a cursor when another row exists', () => {
  const routeStart = source.indexOf("if (sub === 'audit-logs' && method === 'GET')");
  const routeEnd = source.indexOf('// GET /api/admin/config', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /const hasMore = logs\.length > limit/);
  assert.match(route, /next_before: hasMore && page\.length \?/);
  assert.doesNotMatch(route, /next_before: page\.length === limit/);
});

test('admin audit action and uid filters reject overlong raw values before allowlist validation', () => {
  const routeStart = source.indexOf("if (sub === 'audit-logs' && method === 'GET')");
  const routeEnd = source.indexOf('// GET /api/admin/config', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /const actionFilter = String\(params\.action \|\| ''\)\.trim\(\);/);
  assert.match(route, /const uidFilter = String\(params\.uid \|\| ''\)\.trim\(\);/);
  assert.match(route, /actionFilter\.length > 100/);
  assert.match(route, /uidFilter\.length > 100/);
  assert.doesNotMatch(route, /params\.action \|\| ''\)\.trim\(\)\.slice\(0, 100\)/);
  assert.doesNotMatch(route, /params\.uid \|\| ''\)\.trim\(\)\.slice\(0, 100\)/);
});


test('admin audit outbox stages only redacted detail before local persistence and PostgreSQL delivery', () => {
  const stageStart = source.indexOf('async function auditAdmin(action, uid, detail)');
  const stageEnd = source.indexOf('// POST /api/admin/user/balance', stageStart);
  assert.ok(stageStart >= 0 && stageEnd > stageStart);
  const stage = source.slice(stageStart, stageEnd);
  assert.match(stage, /detail: redactAdminAuditDetail\(detail\)/);
  assert.doesNotMatch(stage, /detail: String\(detail/);

  const flushStart = source.indexOf('async function flushAdminAuditOutbox()');
  const flushEnd = source.indexOf("if (path.startsWith('admin/'))", flushStart);
  assert.ok(flushStart >= 0 && flushEnd > flushStart);
  const flush = source.slice(flushStart, flushEnd);
  assert.match(flush, /const safeDetail = redactAdminAuditDetail\(entry\.detail\)/);
  assert.match(flush, /entry\.detail = safeDetail/);
  assert.match(flush, /p_detail: safeDetail/);
});


test('admin audit SQL idempotency tolerates reason redaction upgrades but preserves event identity checks', () => {
  const start = migration.indexOf('if v_inserted = 0 then');
  const end = migration.indexOf('return true;', start);
  assert.ok(start >= 0 && end > start);
  const block = migration.slice(start, end);
  assert.match(block, /v_existing\.actor_id is distinct from v_actor/);
  assert.match(block, /v_existing\.subject_user_id is distinct from v_subject/);
  assert.match(block, /v_existing\.action is distinct from p_action/);
  assert.match(block, /v_existing\.metadata is distinct from p_meta/);
  assert.doesNotMatch(block, /v_existing\.reason is distinct from v_reason/);
  assert.match(block, /Reason text may differ on a retry when/);
});
