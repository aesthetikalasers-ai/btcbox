'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');

test('admin audit persistence is awaited and rejects failed PostgreSQL writes', () => {
  const start = source.indexOf('async function auditAdmin(action, uid, detail)');
  const end = source.indexOf('// POST /api/admin/user/balance', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  assert.match(helper, /await fetch\(base \+ '\/rest\/v1\/rpc\/append_admin_audit_log'/);
  assert.match(helper, /if \(!response\.ok\) throw new Error\('Admin audit persistence failed/);
  assert.doesNotMatch(helper, /\.catch\(function \(e\)/);

  const calls = source.split('\n').filter(line => line.includes('auditAdmin(') && !line.includes('function auditAdmin'));
  assert.equal(calls.length, 7);
  for (const line of calls) assert.match(line.trim(), /^await auditAdmin\(/);
});

test('admin state mutations are saved only after their required audit append completes', () => {
  const actionBlocks = [
    ["if (sub === 'user/freeze' && method === 'POST')", "if (sub === 'user/reset-pwd'"],
    ["if (sub === 'user/reset-pwd' && method === 'POST')", "if (sub === 'user/reset-email'"],
    ["if (sub === 'user/reset-email' && method === 'POST')", "if (sub === 'deposit/confirm'"],
    ["if (sub === 'kyc/approve' && method === 'POST')", "if (sub === 'kyc/reject'"],
    ["if (sub === 'kyc/reject' && method === 'POST')", "if (sub === 'push'"],
    ["if (sub === 'push' && method === 'POST')", "if (sub === 'support/reply'"],
    ["if (sub === 'config' && method === 'POST')", "if (sub === 'withdrawals'"]
  ];
  for (const [from, to] of actionBlocks) {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    const block = source.slice(start, end);
    const audit = block.indexOf('await auditAdmin(');
    const save = block.indexOf('await saveDB(db)');
    assert.ok(audit >= 0 && save > audit, from + ' must await audit before state save');
  }
});
