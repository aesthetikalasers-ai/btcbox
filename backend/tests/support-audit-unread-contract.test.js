'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('customer conversation reads and unread count use the per-user message cursor RPC', () => {
  const readStart = api.indexOf("if (path === 'support/messages' && method === 'GET')");
  const readEnd = api.indexOf("// ---------- GET /api/support/faq", readStart);
  const unreadStart = api.indexOf("if (path === 'chat/unread' && method === 'GET')");
  const unreadEnd = api.indexOf("// ==================== 后台管理 API", unreadStart);
  assert.ok(readStart >= 0 && readEnd > readStart && unreadStart >= 0 && unreadEnd > unreadStart);
  const readRoute = api.slice(readStart, readEnd);
  const unreadRoute = api.slice(unreadStart, unreadEnd);
  assert.ok(readRoute.includes("await markSupportConversationRead(user.uid, lastVisibleAdminMessage)"));
  assert.ok(unreadRoute.includes("await getSupportConversationReadState(user.uid)"));
  assert.ok(unreadRoute.includes("cursorIndex >= 0"));
  assert.ok(unreadRoute.includes("index > cursorIndex"));
  assert.ok(api.includes("btcbox_mark_support_read_v2"));
  assert.ok(api.includes("btcbox_get_support_read_v2"));
  assert.ok(api.includes("supportReadCursorRpc"));
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
