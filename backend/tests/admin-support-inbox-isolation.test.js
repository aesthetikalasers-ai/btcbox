'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('customer support history marks only the last admin message actually returned as read', () => {
  const start = api.indexOf("if (path === 'support/messages' && method === 'GET')");
  const end = api.indexOf('// ---------- GET /api/support/faq', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('const lastVisibleAdminMessage = messages.slice().reverse().find'));
  assert.ok(route.includes('await markSupportConversationRead(user.uid, lastVisibleAdminMessage)'));
  assert.ok(route.includes('return json({ ok: true, messages: messages })'));
  assert.doesNotMatch(route, /saveDB\(db\)|last_read_chat_at/);
});

test('admin replies and read receipts remain scoped to the selected customer UID', () => {
  const replyStart = api.indexOf("if (sub === 'support/reply' && method === 'POST')");
  const readStart = api.indexOf("if (sub === 'support/read' && method === 'POST')");
  assert.ok(replyStart >= 0 && readStart > replyStart);
  const replyRoute = api.slice(replyStart, readStart);
  assert.ok(replyRoute.includes('const target = db.users[uid]'));
  assert.ok(replyRoute.includes('target.support_messages.push(message)'));
  assert.ok(replyRoute.includes('request_id'));
  const readEnd = api.indexOf('// GET /api/admin/support/messages', readStart);
  const readRoute = api.slice(readStart, readEnd);
  assert.ok(readRoute.includes("String(adminUserId) + ':' + uid"));
  assert.ok(readRoute.includes('const readReceipt = latestUserMessage'));
  assert.ok(readRoute.includes('message_id: String(latestUserMessage.id || \'\')'));
});

test('admin support inbox bounds history per customer and counts unread by message cursor', () => {
  const start = api.indexOf("if (sub === 'support/messages' && method === 'GET')");
  const end = api.indexOf('// ---------- Admin: help centre (FAQ) ----------', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('const conversation = Array.isArray(u.support_messages) ? u.support_messages : [];'));
  assert.ok(route.includes('conversation.slice(-100).forEach'));
  assert.ok(route.includes('const readCursorIndex = lastReadMessageId'));
  assert.ok(route.includes('index > readCursorIndex'));
  assert.ok(route.includes('admin_unread_count: unreadCount'));
  assert.ok(!route.includes('list.slice(-500)'));
  assert.ok(!route.includes('list.slice(0, 100)'));
});
