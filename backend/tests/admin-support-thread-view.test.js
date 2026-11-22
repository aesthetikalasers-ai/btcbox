'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('admin support inbox returns both senders with stable customer ownership', () => {
  const start = api.indexOf("// GET /api/admin/support/messages");
  const end = api.indexOf("// ---------- Admin: help centre", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("m.from !== 'user' && m.from !== 'admin'"));
  assert.ok(route.includes('uid: uid'));
  assert.ok(route.includes("from: m.from"));
  assert.ok(route.includes("email: String(u.email || '')"));
  assert.ok(route.includes('conversation.slice(-100).forEach'));
  assert.ok(route.includes('return json({ ok: true, messages: list });'));
  assert.ok(!route.includes('list.slice(-500)'));
});

test('admin support UI groups full conversations by UID and shows reply state', () => {
  assert.ok(admin.includes('function groupSupportThreads(messages: Array<Record<string, unknown>>)'));
  assert.ok(admin.includes('grouped.get(uid)'));
  assert.ok(admin.includes('thread.messages.sort'));
  assert.ok(admin.includes('thread.unanswered > 0'));
  assert.ok(admin.includes('thread.messages.map'));
  assert.ok(admin.includes('replySupport(thread.uid)'));
});
