'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '../api-core.js'), 'utf8');

test('admin support inbox bounds history per customer instead of truncating the global queue', () => {
  const start = api.indexOf("if (sub === 'support/messages' && method === 'GET')");
  const end = api.indexOf("// ---------- Admin: help centre (FAQ) ----------", start);
  assert.ok(start >= 0 && end > start, 'admin support inbox route must exist');
  const route = api.slice(start, end);

  assert.ok(route.includes('const conversation = Array.isArray(u.support_messages) ? u.support_messages : [];'));
  assert.ok(route.includes('conversation.slice(-100).forEach'));
  assert.ok(route.includes('return json({ ok: true, messages: list });'));
  assert.ok(!route.includes('list.slice(-500)'), 'a busy customer must not hide other customers from the inbox');
  assert.ok(!route.includes('list.slice(0, 100)'), 'the inbox must not discard the newest customer threads by global ordering');

  const unreadStart = route.indexOf('const unreadCount = conversation.filter');
  const windowStart = route.indexOf('conversation.slice(-100).forEach');
  assert.ok(unreadStart >= 0 && windowStart > unreadStart, 'unread count must include the full retained conversation before response-window trimming');

  for (const contract of ['String(adminUserId) + ':' + uid', "m.from === 'user'", "m.from !== 'user' && m.from !== 'admin'"]) {
    assert.ok(route.includes(contract), 'missing support inbox isolation contract: ' + contract);
  }
});

test('customer and admin support histories remain isolated by account UID', () => {
  const customerStart = api.indexOf("if (path === 'support/messages' && method === 'GET')");
  const customerEnd = api.indexOf('// ---------- GET /api/support/faq', customerStart);
  assert.ok(customerStart >= 0 && customerEnd > customerStart);
  const customerRoute = api.slice(customerStart, customerEnd);
  assert.ok(customerRoute.includes('user.support_messages.slice(-50)'));

  const replyStart = api.indexOf("if (sub === 'support/reply' && method === 'POST')");
  const replyEnd = api.indexOf('// POST /api/admin/support/read', replyStart);
  assert.ok(replyStart >= 0 && replyEnd > replyStart);
  const replyRoute = api.slice(replyStart, replyEnd);
  assert.ok(replyRoute.includes('const target = db.users[uid]'));
  assert.ok(replyRoute.includes('target.support_messages.push(message)'));

  const readStart = api.indexOf("if (sub === 'support/read' && method === 'POST')");
  const readEnd = api.indexOf("// GET /api/admin/support/messages", readStart);
  assert.ok(readStart >= 0 && readEnd > readStart);
  const readRoute = api.slice(readStart, readEnd);
  assert.ok(readRoute.includes('const readAt = latestUserMessage || nowStr()'));
  assert.ok(!readRoute.includes('const readAt = nowStr()'), 'read receipts must not advance past messages visible in the read snapshot');
});
