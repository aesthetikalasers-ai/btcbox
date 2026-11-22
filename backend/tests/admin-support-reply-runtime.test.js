'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../api-core');

test('admin support reply writes only to the selected customer and exact retries do not duplicate it', async () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const adminId = '94563eb1-55e2-4e52-b31f-5f54651fc659';
  const requestId = 'support-admin-reply-req-0001';
  const state = {
    users: {
      'uid-customer-a': {
        uid: 'uid-customer-a',
        email: 'customer-a@example.test',
        support_messages: [{ id: 'A-1', from: 'user', content: 'Question from A', time: '2026-11-22 10:00:00' }],
      },
      'uid-customer-b': {
        uid: 'uid-customer-b',
        email: 'customer-b@example.test',
        support_messages: [{ id: 'B-1', from: 'user', content: 'Question from B', time: '2026-11-22 10:01:00' }],
      },
    },
    sessions: {},
    audit_logs: [],
  };
  let revision = 11;
  let saveCount = 0;
  let auditAppendCount = 0;

  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SUPABASE_AUTH_PUBLISHABLE_KEY = 'sb_publishable_test_key_123456789';
  process.env.CONTEXT = 'dev';
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') {
      assert.equal(init.headers.Authorization, 'Bearer test-admin-access-token-123456789');
      return Response.json({ id: adminId, email: 'admin@example.test' });
    }
    if (url.pathname === '/rest/v1/rpc/admin_get_membership_v1') {
      return Response.json({
        found: true, active: true, user_id: adminId, is_super_admin: false,
        revision: 1, permissions: ['support.reply'],
      });
    }
    if (url.pathname === '/rest/v1/btcbox_state') {
      return Response.json([{ revision, data: state }]);
    }
    if (url.pathname === '/rest/v1/rpc/btcbox_save_state') {
      const payload = JSON.parse(init.body || '{}');
      assert.equal(payload.p_expected_revision, revision);
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, payload.p_data);
      revision += 1;
      saveCount += 1;
      return Response.json(true);
    }
    if (url.pathname === '/rest/v1/rpc/append_admin_audit_log') {
      auditAppendCount += 1;
      return Response.json(true);
    }
    throw new Error('Unexpected test fetch: ' + url.pathname);
  };

  const sendReply = (uid, conversationId, contentText) => api.handler({
    path: '/api/admin/support/reply',
    httpMethod: 'POST',
    headers: { authorization: 'Bearer test-admin-access-token-123456789' },
    body: JSON.stringify({ uid, conversation_id: conversationId, content: contentText, request_id: requestId }),
  }, {});

  try {
    const first = await sendReply('uid-customer-a', 'support:uid-customer-a', 'Reply only for customer A');
    assert.equal(first.statusCode, 200);
    assert.equal(JSON.parse(first.body).duplicate, false);
    assert.equal(state.users['uid-customer-a'].support_messages.filter((m) => m.from === 'admin').length, 1);
    assert.equal(state.users['uid-customer-b'].support_messages.filter((m) => m.from === 'admin').length, 0);
    assert.equal(state.users['uid-customer-a'].support_messages.at(-1).admin_id, adminId);
    assert.equal(state.audit_logs.filter((entry) => entry.action === 'support_reply').length, 1);

    const retry = await sendReply('uid-customer-a', 'support:uid-customer-a', 'Reply only for customer A');
    assert.equal(retry.statusCode, 200);
    assert.equal(JSON.parse(retry.body).duplicate, true);
    assert.equal(state.users['uid-customer-a'].support_messages.filter((m) => m.from === 'admin').length, 1);
    assert.equal(state.audit_logs.filter((entry) => entry.action === 'support_reply').length, 1);

    const mismatch = await sendReply('uid-customer-b', 'support:uid-customer-a', 'Must not reach B');
    assert.equal(mismatch.statusCode, 400);
    assert.equal(state.users['uid-customer-b'].support_messages.filter((m) => m.from === 'admin').length, 0);
    assert.equal(saveCount, 2);
    assert.equal(auditAppendCount, 1);
  } finally {
    global.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value;
  }
});
