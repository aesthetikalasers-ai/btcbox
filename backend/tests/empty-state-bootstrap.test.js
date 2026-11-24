'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../api-core');

const { loadDB } = api._test;

function withSupabaseEnv(fn) {
  const before = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.SUPABASE_URL = 'https://btcbox-empty-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-only';
  delete process.env.SUPABASE_SECRET_KEY;
  return Promise.resolve().then(fn).finally(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('first request atomically initializes only an empty BTCBOX state row', async () => withSupabaseEnv(async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (init.method === 'POST') {
      assert.match(url, /\/rest\/v1\/rpc\/btcbox_save_state$/);
      const payload = JSON.parse(init.body);
      assert.equal(payload.p_expected_revision, 0);
      assert.deepEqual(payload.p_data.users, {});
      assert.deepEqual(payload.p_data.sessions, {});
      return { ok: true, status: 200, json: async () => true };
    }
    assert.match(url, /\/rest\/v1\/btcbox_state\?/);
    return { ok: true, status: 200, json: async () => [] };
  };
  try {
    const state = await loadDB();
    assert.deepEqual(state.users, {});
    assert.deepEqual(state.sessions, {});
    assert.equal(state._revision, 1);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].init.headers.Authorization, 'Bearer service-role-test-only');
  } finally {
    global.fetch = originalFetch;
  }
}));

test('concurrent first requests re-read the state created by the winning CAS request', async () => withSupabaseEnv(async () => {
  const originalFetch = global.fetch;
  let reads = 0;
  global.fetch = async (url, init = {}) => {
    if (init.method === 'POST') return { ok: true, status: 200, json: async () => false };
    reads += 1;
    if (reads === 1) return { ok: true, status: 200, json: async () => [] };
    return { ok: true, status: 200, json: async () => [{
      revision: 1,
      data: { users: {}, sessions: {}, next_uid: 16588, deposit_addresses: {}, withdrawal_fees: {} }
    }] };
  };
  try {
    const state = await loadDB();
    assert.deepEqual(state.users, {});
    assert.equal(state._revision, 1);
    assert.equal(reads, 2);
  } finally {
    global.fetch = originalFetch;
  }
}));

test('missing or unavailable state schema never triggers automatic initialization', async () => withSupabaseEnv(async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 404, json: async () => ({ message: 'relation does not exist' }) };
  };
  try {
    await assert.rejects(loadDB(), /Persistent storage unavailable/);
    assert.equal(calls, 1, 'must not attempt a seed when the state table cannot be read');
  } finally {
    global.fetch = originalFetch;
  }
}));
