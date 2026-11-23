'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('admin support read receipts are isolated by administrator and customer UID', () => {
  assert.ok(api.includes("db.admin_support_read_receipts"));
  assert.ok(api.includes("String(adminUserId) + ':' + uid"));
  assert.ok(api.includes("route === 'support/read' && verb === 'POST'"));
  assert.ok(api.includes("auditAdmin('support_mark_read', uid"));
  assert.ok(api.includes("db.admin_support_read_receipts[receiptKey] = readAt"));
});

test('admin support unread count compares only customer messages after that admin receipt', () => {
  const start = api.indexOf("// GET /api/admin/support/messages");
  const end = api.indexOf("// GET /api/admin/support/faq", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("m.from === 'user'"));
  assert.ok(route.includes("String(m.time || '') > lastReadAt"));
  assert.ok(route.includes("admin_unread_count: unreadCount"));
});

test('admin client can persist a thread read receipt and render unread state', () => {
  assert.ok(client.includes('admin/support/read'));
  assert.ok(admin.includes('markAdminSupportRead(token, uid)'));
  assert.ok(admin.includes('thread.adminUnreadCount > 0'));
  assert.ok(admin.includes('markSupportThreadRead(thread.uid)'));
});
