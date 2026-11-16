'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const rbac = fs.readFileSync(path.join(root, 'admin-rbac.js'), 'utf8');

function sliceRoute(from, to) {
  const start = source.indexOf(from);
  assert.ok(start >= 0, 'missing route: ' + from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, 'missing route boundary after: ' + from);
  return source.slice(start, end);
}

test('help-centre entries are stored in the state document, not hard-coded in the bundle', () => {
  // Defaults are seeded once for documents that predate the field and are never
  // allowed to overwrite staff edits, so the administrator console stays the
  // single source of truth for FAQ content.
  assert.ok(source.includes('const DEFAULT_SUPPORT_FAQ = Object.freeze(['));
  assert.ok(source.includes('function normalizeSupportFaq(db) {'));
  assert.match(source, /if \(!Array\.isArray\(db\.support_faq\)\) db\.support_faq = supportFaqDefaults\(\);/);
  const defaults = source.slice(source.indexOf('const DEFAULT_SUPPORT_FAQ'), source.indexOf('function supportFaqDefaults()'));
  assert.ok((defaults.match(/question:/g) || []).length >= 6);
  // Both the first-bootstrap and the ordinary load paths must hydrate the field.
  const loadStart = source.indexOf('async function loadDB()');
  const loadEnd = source.indexOf('async function saveDB(db)');
  const load = source.slice(loadStart, loadEnd);
  assert.equal((load.match(/normalizeSupportFaq\(/g) || []).length, 3);
  assert.ok(source.includes('support_faq: supportFaqDefaults(),'));
});

test('public help-centre endpoint is unauthenticated, enabled-only and order-stable', () => {
  const route = sliceRoute("if (path === 'support/faq' && method === 'GET')", "// ---------- POST /api/settings/password ----------");
  assert.ok(!route.includes('if (!user)'), 'the help centre must be readable before sign-in');
  assert.ok(route.includes("entry.enabled !== false"));
  assert.ok(route.includes('Number(a.order || 0) - Number(b.order || 0)'));
  assert.ok(route.includes('question: String(entry.question'));
  assert.ok(route.includes('answer: String(entry.answer'));
});

test('admin help-centre routes are permission-gated and audited before delivery', () => {
  assert.ok(source.includes("if (route === 'support/faq' && verb === 'GET') return 'support.read';"));
  assert.ok(source.includes("if ((route === 'support/faq' || route === 'support/faq/delete') && verb === 'POST') return 'support.manage';"));
  assert.ok(rbac.includes("'support.read', 'support.reply', 'support.manage'"));

  const readRoute = sliceRoute("if (sub === 'support/faq' && method === 'GET')", "// POST /api/admin/support/faq");
  assert.ok(readRoute.includes('enabled: entry.enabled !== false'));

  const writeRoute = sliceRoute("if (sub === 'support/faq' && method === 'POST')", "// POST /api/admin/support/faq/delete");
  assert.ok(writeRoute.includes('INVALID_FAQ_QUESTION'));
  assert.ok(writeRoute.includes('INVALID_FAQ_ANSWER'));
  assert.ok(writeRoute.includes('INVALID_FAQ_ORDER'));
  assert.ok(writeRoute.includes('FAQ_DUPLICATE_QUESTION'));
  const audit = writeRoute.indexOf('await auditAdmin(');
  const save = writeRoute.indexOf('await saveDB(db)', audit);
  const flush = writeRoute.indexOf('await flushAdminAuditOutbox()', save);
  assert.ok(audit >= 0 && save > audit && flush > save);

  const deleteRoute = sliceRoute("if (sub === 'support/faq/delete' && method === 'POST')", "// ---------- Admin: Perpetual markets");
  assert.ok(deleteRoute.includes('FAQ_NOT_FOUND'));
  const deleteAudit = deleteRoute.indexOf('await auditAdmin(');
  const deleteSave = deleteRoute.indexOf('await saveDB(db)', deleteAudit);
  const deleteFlush = deleteRoute.indexOf('await flushAdminAuditOutbox()', deleteSave);
  assert.ok(deleteAudit >= 0 && deleteSave > deleteAudit && deleteFlush > deleteSave);
});

test('customer support replies keep the idempotent request-id contract', () => {
  const route = sliceRoute("if (path === 'support/chat' && method === 'POST')", "// ---------- GET /api/support/messages ----------");
  assert.ok(route.includes('request_id'));
  assert.ok(route.includes('SUPPORT_MESSAGE_IDEMPOTENCY_CONFLICT'));
});
