'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../api-core');

test('real support message handler returns only the authenticated customer conversation', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CONTEXT: process.env.CONTEXT,
  };
  const readUids = [];
  let revision = 7;
  let state = {
    users: {
      'uid-customer-a': {
        uid: 'uid-customer-a',
        email: 'customer-a@example.test',
        support_messages: [
          { id: 'A-1', from: 'user', content: 'Private message for customer A', time: '2026-11-22 10:00:00' },
          { id: 'A-2', from: 'admin', content: 'Private reply for customer A', time: '2026-11-22 10:01:00' },
        ],
      },
      'uid-customer-b': {
        uid: 'uid-customer-b',
        email: 'customer-b@example.test',
        support_messages: [
          { id: 'B-1', from: 'user', content: 'Private message for customer B', time: '2026-11-22 10:02:00' },
        ],
      },
    },
    sessions: {
      'test-session-a': { uid: 'uid-customer-a', created_at: Date.now() },
      'test-session-b': { uid: 'uid-customer-b', created_at: Date.now() },
    },
  };

  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.CONTEXT = 'dev';
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/btcbox_state') {
      return Response.json([{ revision, data: state }]);
    }
    if (url.pathname === '/rest/v1/rpc/btcbox_mark_support_read') {
      const payload = JSON.parse(init.body || '{}');
      readUids.push(payload.p_uid);
      return Response.json('2026-11-22 10:03:00');
    }
    if (url.pathname === '/rest/v1/rpc/btcbox_save_state') {
      const payload = JSON.parse(init.body || '{}');
      assert.equal(payload.p_expected_revision, revision);
      state = payload.p_data;
      revision += 1;
      return Response.json(true);
    }
    throw new Error('Unexpected test fetch: ' + url.pathname);
  };

  try {
    const customerA = await api.handler({
      path: '/api/support/messages',
      httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-a' },
    }, {});
    const customerB = await api.handler({
      path: '/api/support/messages',
      httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-b' },
    }, {});

    assert.equal(customerA.statusCode, 200);
    assert.equal(customerB.statusCode, 200);
    const bodyA = JSON.parse(customerA.body);
    const bodyB = JSON.parse(customerB.body);
    assert.deepEqual(bodyA.messages.map((message) => message.content), [
      'Private message for customer A',
      'Private reply for customer A',
    ]);
    assert.deepEqual(bodyB.messages.map((message) => message.content), [
      'Private message for customer B',
    ]);
    assert.ok(!JSON.stringify(bodyA).includes('customer B'));
    assert.ok(!JSON.stringify(bodyB).includes('customer A'));
    const sent = await api.handler({
      path: '/api/support/chat',
      httpMethod: 'POST',
      headers: { cookie: 'session_token=test-session-a' },
      body: JSON.stringify({ content: 'A follow-up that belongs only to customer A', request_id: 'support-request-id-a-001' }),
    }, {});
    assert.equal(sent.statusCode, 200);
    assert.equal(JSON.parse(sent.body).ok, true);
    const duplicateSend = await api.handler({
      path: '/api/support/chat',
      httpMethod: 'POST',
      headers: { cookie: 'session_token=test-session-a' },
      body: JSON.stringify({ content: 'A follow-up that belongs only to customer A', request_id: 'support-request-id-a-001' }),
    }, {});
    assert.equal(duplicateSend.statusCode, 200);
    assert.equal(JSON.parse(duplicateSend.body).duplicate, true);
    assert.equal(state.users['uid-customer-a'].support_messages.filter((message) => message.request_id === 'support-request-id-a-001').length, 1);
    const conflictingSend = await api.handler({
      path: '/api/support/chat',
      httpMethod: 'POST',
      headers: { cookie: 'session_token=test-session-a' },
      body: JSON.stringify({ content: 'Different body with same id', request_id: 'support-request-id-a-001' }),
    }, {});
    assert.equal(conflictingSend.statusCode, 409);

    const refreshedA = await api.handler({
      path: '/api/support/messages',
      httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-a' },
    }, {});
    const refreshedB = await api.handler({
      path: '/api/support/messages',
      httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-b' },
    }, {});
    const refreshedBodyA = JSON.parse(refreshedA.body);
    const refreshedBodyB = JSON.parse(refreshedB.body);
    assert.ok(refreshedBodyA.messages.some((message) => message.content === 'A follow-up that belongs only to customer A'));
    assert.ok(!JSON.stringify(refreshedBodyB).includes('A follow-up that belongs only to customer A'));
    assert.deepEqual(readUids, ['uid-customer-a', 'uid-customer-b', 'uid-customer-a', 'uid-customer-b']);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
