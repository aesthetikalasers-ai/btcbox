'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('admin support replies are permission-gated, persisted, audited and idempotent', () => {
  assert.ok(api.includes("route === 'support/reply' && verb === 'POST'"));
  const handlers = [...api.matchAll(/if \(sub === 'support\/reply' && method === 'POST'\)/g)];
  assert.equal(handlers.length, 1, 'only one support reply handler may exist; a legacy earlier route would shadow idempotency');
  const start = handlers[0].index;
  const end = api.indexOf("if (sub === 'support/messages' && method === 'GET')", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(!route.includes('const supportMessage ='), 'legacy non-idempotent route must not shadow the current handler');
  for (const contract of [
    'body.request_id', 'body.conversation_id', "conversationId !== 'support:' + uid", 'SUPPORT_REPLY_IDEMPOTENCY_CONFLICT',
    "from: 'admin'", 'admin_id: adminUserId',
    "auditAdmin('support_reply'", 'await saveDB(db)',
    'await flushAdminAuditOutbox()', 'slice(-500)'
  ]) assert.ok(route.includes(contract), 'missing support reply contract: ' + contract);
  assert.ok(client.includes('admin/support/reply'));
  assert.ok(client.includes('request_id: requestId'));
  assert.ok(admin.includes('supportReplyRequestIds'));
  assert.ok(admin.includes('adminReplySupport(token, uid, content, requestId)'));
});

test('admin support queue returns isolated per-customer conversations with reply history and status', () => {
  const start = api.indexOf("if (sub === 'support/messages' && method === 'GET')");
  const end = api.indexOf("// ---------- Admin: help centre", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  for (const contract of [
    'const conversations = []',
    "Object.values(db.users).forEach(function (u)",
    "u.support_messages",
    "m.from === 'user' || m.from === 'admin'",
    "conversation_id: 'support:' + uid",
    "status: lastMessage.from === 'user' ? 'waiting' : 'replied'",
    'pending_count: pendingCount',
    'messages: messages',
    'conversations: conversations.slice(0, 200)'
  ]) assert.ok(route.includes(contract), 'missing isolated support conversation contract: ' + contract);
  assert.ok(admin.includes('useState<AdminSupportConversation[]>([])'));
  assert.ok(admin.includes('key={conversation.conversation_id}'));
  assert.ok(admin.includes('conversation.messages.map(message'));
  assert.ok(admin.includes('conversation.status==="waiting"'));
});

test('customer support polling does not clear the visible conversation', () => {
  const chat = fs.readFileSync(path.resolve(root, '../frontend/src/features/support/SupportChat.tsx'), 'utf8');
  const start = chat.indexOf('useEffect(() => {');
  const end = chat.indexOf('}, [status, reload]);', start);
  assert.ok(start >= 0 && end > start);
  const refreshEffect = chat.slice(start, end);
  assert.match(refreshEffect, /if \(status !== "authenticated"\).*setMessages\(\[\]\)/);
  assert.doesNotMatch(refreshEffect, /setLoading\(true\);setMessages\(\[\]\)/);
  assert.ok(refreshEffect.includes('getSupportMessages(controller.signal)'));
});

test('confirmed support reply is not reported as failed when the conversation refresh fails', () => {
  const start = admin.indexOf('const replySupport = async (uid: string)');
  const end = admin.indexOf('const saveSpotMarket = async', start);
  assert.ok(start >= 0 && end > start);
  const handler = admin.slice(start, end);
  assert.match(handler, /await adminReplySupport\(token, uid, content, requestId\)[\s\S]*?setSupportReply\(\(current\) => \(\{ \.\.\.current, \[uid\]: "" \}\)\)/);
  assert.match(handler, /const successMessage = result\.audit_sync_pending/);
  assert.match(handler, /setError\(successMessage \+ " The conversation could not refresh\./);
});
