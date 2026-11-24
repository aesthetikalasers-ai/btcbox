'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const page = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('support search is filtered on the server by UID, email, username or message ID', () => {
  const start = api.indexOf("if (sub === 'support/messages' && method === 'GET')");
  const end = api.indexOf('// ---------- Admin: help centre (FAQ) ----------', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('event.queryStringParameters'));
  assert.ok(route.includes('[uid, email, username]'));
  assert.ok(route.includes("String(m.id || '').toLowerCase() === searchQuery"));
  assert.ok(route.includes("String(m.id || '').toLowerCase().includes(searchQuery)"));
  assert.ok(route.includes('list.slice(-500)'));
  assert.ok(route.includes('conversation.slice(-100)'));
});

test('exact message ID search returns nearby conversation context and full-thread reply status', () => {
  const start = api.indexOf("if (sub === 'support/messages' && method === 'GET')");
  const end = api.indexOf('// ---------- Admin: help centre (FAQ) ----------', start);
  const route = api.slice(start, end);
  assert.ok(route.includes('exactMessageIndex - 10'));
  assert.ok(route.includes('exactMessageIndex + 11'));
  assert.ok(route.includes('thread_unanswered_count: threadUnansweredCount'));
  assert.ok(route.includes('admin_unread_count: unreadCount'));
});

test('support UI submits server-side search and exposes message IDs without changing reply/read actions', () => {
  assert.match(client, /getAdminSupportMessages\(token: string, search = ""/);
  assert.ok(client.includes('"admin/support/messages" + query'));
  assert.ok(page.includes('Search message ID, UID, username or email'));
  assert.ok(page.includes('setSupportSearchApplied(supportSearch.trim())'));
  assert.ok(page.includes('ID {asText(message.id)}'));
  assert.ok(page.includes('markSupportThreadRead(thread.uid)'));
  assert.ok(page.includes('replySupport(thread.uid)'));
});
