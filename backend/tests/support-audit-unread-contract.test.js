'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('customer conversation reads and unread count are scoped to the authenticated user record', () => {
  const readStart = api.indexOf("if (path === 'support/messages' && method === 'GET')");
  const readEnd = api.indexOf("// ---------- GET /api/support/faq", readStart);
  const unreadStart = api.indexOf("if (path === 'chat/unread' && method === 'GET')");
  const unreadEnd = api.indexOf("// ==================== 后台管理 API", unreadStart);
  assert.ok(readStart >= 0 && readEnd > readStart && unreadStart >= 0 && unreadEnd > unreadStart);
  const readRoute = api.slice(readStart, readEnd);
  const unreadRoute = api.slice(unreadStart, unreadEnd);
  assert.ok(readRoute.includes("user.last_read_chat_at = nowStr()"));
  assert.ok(readRoute.includes("user.support_messages.slice(-50)"));
  assert.ok(unreadRoute.includes("user.support_messages"));
  assert.ok(unreadRoute.includes("m.from === 'admin' && m.time > lastRead"));
});

test('administrator replies are UID-scoped, idempotent, and audited before persistence', () => {
  const start = api.indexOf("if (sub === 'support/reply' && method === 'POST')");
  const end = api.indexOf("// POST /api/admin/support/read", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('const target = db.users[uid]'));
  assert.ok(route.includes("message.from === 'admin' && message.request_id === requestId"));
  assert.ok(route.includes('SUPPORT_REPLY_IDEMPOTENCY_CONFLICT'));
  assert.ok(route.includes("await auditAdmin('support_reply', uid"));
  assert.ok(route.includes('await saveDB(db)'));
  assert.ok(route.includes('await flushAdminAuditOutbox()'));
});
