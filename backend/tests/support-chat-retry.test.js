'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const chat = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/support/SupportChat.tsx'), 'utf8');

test('uncertain customer support sends retain the same request ID and exact body across tab refresh', () => {
  assert.match(chat, /btcbox\.support\.pending\.v1\./);
  assert.match(chat, /window\.sessionStorage\.getItem\(pendingStorageKey\)/);
  assert.match(chat, /window\.sessionStorage\.setItem\(pendingStorageKey, JSON\.stringify\(\{ request_id: requestId, content: message \}\)\)/);
  assert.match(chat, /setPendingRequestId\(pending\.request_id\)/);
  assert.match(chat, /setPendingRequestContent\(pending\.content\)/);
  assert.match(chat, /window\.sessionStorage\.removeItem\(pendingStorageKey\)/);
  assert.ok(chat.includes('setDraft("");'));
  assert.ok(chat.includes('setPendingRequestId("");'));
  assert.ok(chat.includes('setPendingRequestContent("");'));
  assert.match(chat, /sendSupportMessage\(message, requestId\)/);
  assert.match(chat, /const hasPending = pendingRequestAccountKey === requestAccountKey && !!pendingRequestId/);
  assert.match(chat, /const message = hasPending \? pendingRequestContent : draft\.trim\(\)/);
});

test('customer support history and in-flight sends are isolated when the signed-in account changes', () => {
  assert.match(chat, /\[status, email, reload, pendingStorageKey\]/);
  assert.match(chat, /setMessages\(\[\]\);\s*setMessagesAccountKey\(""\);/);
  assert.match(chat, /messagesAccountKey !== pendingStorageKey/);
  assert.match(chat, /currentAccountKeyRef\.current !== requestAccountKey/);
  assert.match(chat, /currentAccountKeyRef\.current === requestAccountKey/);
});
