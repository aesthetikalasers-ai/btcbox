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
  const start = api.indexOf("if (sub === 'support/read' && method === 'POST')");
  const end = api.indexOf('// GET /api/admin/support/messages', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes("String(adminUserId) + ':' + uid"));
  assert.ok(route.includes('const previousReceipt = db.admin_support_read_receipts[receiptKey]'));
  assert.ok(route.includes('const readReceipt = latestUserMessage'));
  assert.ok(route.includes('message_id: String(latestUserMessage.id || \'\')'));
  assert.ok(route.includes("auditAdmin('support_mark_read', uid"));
});

test('admin support unread count uses message cursors and preserves same-second arrivals', () => {
  const start = api.indexOf("if (sub === 'support/messages' && method === 'GET')");
  const end = api.indexOf('// ---------- Admin: help centre (FAQ) ----------', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('const readCursorIndex = lastReadMessageId'));
  assert.ok(route.includes('index > readCursorIndex'));
  assert.ok(route.includes("String(m.id || '') > lastReadMessageId"));
  assert.ok(route.includes('admin_unread_count: unreadCount'));
});

test('admin client persists thread read receipts and renders unread state', () => {
  assert.ok(client.includes('admin/support/read'));
  assert.ok(admin.includes('markAdminSupportRead(token, uid)'));
  assert.ok(admin.includes('thread.adminUnreadCount > 0'));
  assert.ok(admin.includes('markSupportThreadRead(thread.uid)'));
});
