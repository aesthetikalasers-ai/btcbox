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
  const cursorCalls = [];
  const readStateByUid = {
    'uid-customer-a': { message_id: '', read_at: '' },
    'uid-customer-b': { message_id: '', read_at: '2026-11-22 10:02:00' },
  };
  let injectedConcurrentReply = false;
  let revision = 7;
  let state = {
    users: {
      'uid-customer-a': {
        uid: 'uid-customer-a',
        email: 'customer-a@example.test',
        support_messages: [
          { id: 'A-1', from: 'user', content: 'Private message for customer A', time: '2026-11-22 10:00:00' },
          { id: 'M1763805600000aaaaaaaaaaaa', from: 'admin', content: 'Private reply for customer A', time: '2026-11-22 10:01:00', admin_id: 'admin-1' },
        ],
      },
      'uid-customer-b': {
        uid: 'uid-customer-b',
        email: 'customer-b@example.test',
        support_messages: [
          { id: 'B-1', from: 'user', content: 'Private message for customer B', time: '2026-11-22 10:02:00' },
          { id: 'M1763805750000bbbbbbbbbbbb', from: 'admin', content: 'Private reply for customer B', time: '2026-11-22 10:02:30', admin_id: 'admin-1' },
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
    if (url.pathname === '/rest/v1/rpc/btcbox_mark_support_read_v2') {
      const payload = JSON.parse(init.body || '{}');
      cursorCalls.push(payload);
      const current = readStateByUid[payload.p_uid] || { message_id: '', read_at: '' };
      if (!current.message_id || payload.p_message_id > current.message_id) {
        readStateByUid[payload.p_uid] = { message_id: payload.p_message_id, read_at: payload.p_read_at };
      }
      if (payload.p_uid === 'uid-customer-a' && !injectedConcurrentReply) {
        injectedConcurrentReply = true;
        state.users['uid-customer-a'].support_messages.push({
          id: 'M1763805600500cccccccccccc', from: 'admin',
          content: 'Concurrent reply must remain unread', time: '2026-11-22 10:01:00', admin_id: 'admin-2'
        });
      }
      return Response.json(readStateByUid[payload.p_uid]);
    }
    if (url.pathname === '/rest/v1/rpc/btcbox_get_support_read_v2') {
      const payload = JSON.parse(init.body || '{}');
      return Response.json(readStateByUid[payload.p_uid] || { message_id: '', read_at: '' });
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
    const unreadAInitially = await api.handler({
      path: '/api/chat/unread', httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-a' },
    }, {});
    const unreadBInitially = await api.handler({
      path: '/api/chat/unread', httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-b' },
    }, {});
    assert.equal(JSON.parse(unreadAInitially.body).unread, 1);
    assert.equal(JSON.parse(unreadBInitially.body).unread, 1, 'legacy timestamp fallback must preserve unread state');

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
      'Private reply for customer B',
    ]);
    assert.ok(!JSON.stringify(bodyA).includes('customer B'));
    assert.ok(!JSON.stringify(bodyB).includes('customer A'));
    assert.ok(!JSON.stringify(bodyA).includes('admin_id'));
    assert.ok(!JSON.stringify(bodyA).includes('request_id'));
    assert.ok(!JSON.stringify(bodyA).includes('audit_event_id'));
    assert.ok(!bodyA.messages.some((message) => message.content === 'Concurrent reply must remain unread'));
    const unreadAAfterOpen = await api.handler({
      path: '/api/chat/unread', httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-a' },
    }, {});
    assert.equal(JSON.parse(unreadAAfterOpen.body).unread, 1);
    // Simulate a read cursor whose message has fallen out of the bounded
    // history. Message-ID ordering still preserves newer unread messages.
    readStateByUid['uid-customer-b'] = {
      message_id: 'M1763805700000aaaaaaaaaaaa',
      read_at: '2026-11-22 10:02:00'
    };
    const unreadBAfterOpen = await api.handler({
      path: '/api/chat/unread', httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-b' },
    }, {});
    assert.equal(JSON.parse(unreadBAfterOpen.body).unread, 1);
    readStateByUid['uid-customer-b'] = { message_id: '', read_at: '2026-11-22 10:02:00' };
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
    assert.ok(refreshedBodyA.messages.some((message) => message.content === 'Concurrent reply must remain unread'));
    assert.ok(!JSON.stringify(refreshedBodyB).includes('A follow-up that belongs only to customer A'));
    const unreadAFinal = await api.handler({
      path: '/api/chat/unread', httpMethod: 'GET',
      headers: { cookie: 'session_token=test-session-a' },
    }, {});
    assert.equal(JSON.parse(unreadAFinal.body).unread, 0);
    assert.deepEqual(cursorCalls.map((call) => [call.p_uid, call.p_message_id]), [
      ['uid-customer-a', 'M1763805600000aaaaaaaaaaaa'],
      ['uid-customer-b', 'M1763805750000bbbbbbbbbbbb'],
      ['uid-customer-a', 'M1763805600500cccccccccccc'],
      ['uid-customer-b', 'M1763805750000bbbbbbbbbbbb'],
    ]);
    assert.ok(cursorCalls.every((call) => call.p_read_at === '2026-11-22 10:01:00' || call.p_read_at === '2026-11-22 10:02:30'));
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
