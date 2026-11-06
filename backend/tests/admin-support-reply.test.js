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
  const handlers = [...api.matchAll(/if \\(sub === 'support\\/reply' && method === 'POST'\\)/g)];
  assert.equal(handlers.length, 1, 'only one support reply handler may exist; a legacy earlier route would shadow idempotency');
  const start = handlers[0].index;
  const end = api.indexOf("if (sub === 'support/messages' && method === 'GET')", start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(!route.includes('const supportMessage ='), 'legacy non-idempotent route must not shadow the current handler');
  for (const contract of [
    'body.request_id', 'SUPPORT_REPLY_IDEMPOTENCY_CONFLICT',
    "from: 'admin'", 'admin_id: adminUserId',
    "auditAdmin('support_reply'", 'await saveDB(db)',
    'await flushAdminAuditOutbox()', 'slice(-500)'
  ]) assert.ok(route.includes(contract), 'missing support reply contract: ' + contract);
  assert.ok(client.includes('admin/support/reply'));
  assert.ok(client.includes('request_id: requestId'));
  assert.ok(admin.includes('supportReplyRequestIds'));
  assert.ok(admin.includes('adminReplySupport(token, uid, content, requestId)'));
});
