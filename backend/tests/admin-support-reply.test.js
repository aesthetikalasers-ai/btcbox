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

test('customer support history and admin replies stay scoped to one authenticated UID', () => {
  const customerStart = api.indexOf("if (path === 'support/messages' && method === 'GET')");
  const customerEnd = api.indexOf("if (path === 'support/faq' && method === 'GET')", customerStart);
  assert.ok(customerStart >= 0 && customerEnd > customerStart);
  const customerRoute = api.slice(customerStart, customerEnd);
  assert.ok(customerRoute.includes('if (!user)'));
  assert.ok(customerRoute.includes('await markSupportConversationRead(user.uid)'));
  assert.ok(customerRoute.includes('messages: user.support_messages.slice(-50)'));
  assert.doesNotMatch(customerRoute, /Object\.values\(db\.users\)|db\.users\[/);

  const replyStart = api.indexOf("if (sub === 'support/reply' && method === 'POST')");
  const replyEnd = api.indexOf("if (sub === 'support/messages' && method === 'GET')", replyStart);
  assert.ok(replyStart >= 0 && replyEnd > replyStart);
  const replyRoute = api.slice(replyStart, replyEnd);
  assert.ok(replyRoute.includes("conversationId !== 'support:' + uid"));
  assert.ok(replyRoute.includes('const target = db.users[uid]'));
  assert.ok(replyRoute.includes('target.support_messages.push(message)'));
  assert.doesNotMatch(replyRoute, /user\.support_messages\.push\(message\)/);
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

test('customer support polling preserves visible messages while account changes clear private history', () => {
  const chat = fs.readFileSync(path.resolve(root, '../frontend/src/features/support/SupportChat.tsx'), 'utf8');
  const start = chat.indexOf('useEffect(() => {\n    if (status !== "authenticated") {');
  const end = chat.indexOf('}, [status, email, reload, pendingStorageKey]);', start);
  assert.ok(start >= 0 && end > start);
  const refreshEffect = chat.slice(start, end);
  assert.match(refreshEffect, /loadedAccountKeyRef\.current !== accountKey/);
  assert.match(refreshEffect, /setMessages\(\[\]\)/);
  assert.match(refreshEffect, /getSupportMessages\(controller\.signal\)/);
  assert.match(refreshEffect, /if \(status !== "authenticated"\)[\s\S]*?setMessages\(\[\]\)/);
  assert.match(refreshEffect, /if \(loadedAccountKeyRef\.current !== accountKey\)[\s\S]*?setMessages\(\[\]\)/);

});

test('uncertain admin replies keep one immutable request across refresh and retry', () => {
  assert.ok(admin.includes('btcbox.admin.support-reply.v1.'));
  assert.ok(admin.includes('window.sessionStorage.getItem(key)'));
  assert.ok(admin.includes('window.sessionStorage.setItem(supportReplyStorageKey(uid)'));
  assert.ok(admin.includes('submitted: true'));
  assert.ok(admin.includes('setSupportReplySubmitted'));
  assert.ok(admin.includes('Retry same request'));
  const composerStart = admin.indexOf('<textarea value={supportReply[uid]');
  const composerEnd = admin.indexOf('</Button>', composerStart);
  assert.ok(composerStart >= 0 && composerEnd > composerStart);
  const composer = admin.slice(composerStart, composerEnd);
  assert.ok(composer.includes('disabled={!!supportReplySubmitted[uid]}'));
  assert.ok(composer.includes('onChange={event=>updateSupportReply(uid,event.target.value)}'));
  assert.doesNotMatch(composer, /crypto\.randomUUID/);
});

test('admin support queue remains visible while refreshing after a reply', () => {
  const start = admin.indexOf('const replySupport = async (uid: string)');
  const end = admin.indexOf('const saveSpotMarket = async', start);
  assert.ok(start >= 0 && end > start);
  const handler = admin.slice(start, end);
  assert.doesNotMatch(handler, /setSupport\(\[\]\)/);
  assert.ok(handler.includes('setSupport(snapshot.conversations || [])'));
  assert.ok(handler.includes('The conversation could not refresh.'));
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


test('definite support reply rejection unlocks editing but preserves uncertain and conflict retries', () => {
  const start = admin.indexOf('const replySupport = async (uid: string)');
  const end = admin.indexOf('const saveSpotMarket = async', start);
  assert.ok(start >= 0 && end > start);
  const handler = admin.slice(start, end);
  assert.match(handler, /reason instanceof ApiError && reason\.status >= 400 && reason\.status < 500 && reason\.status !== 409/);
  assert.ok(handler.includes('setSupportReplySubmitted((current) => ({ ...current, [uid]: false }))'));
  assert.ok(handler.includes('delete next[uid]'));
  assert.ok(handler.includes('window.sessionStorage.removeItem(supportReplyStorageKey(uid))'));
  assert.ok(handler.includes('Keep 409 locked'));
  assert.ok(handler.includes('finally { supportReplyLocksRef.current[uid] = false; setBusy(false); }'));
});
