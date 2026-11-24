'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hasActiveVersionedSecondsPolicy } = require('../seconds-policy-readiness');

const env = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key'
};
const policyId = '02500000-0000-4000-8000-000000000001';
const policy = {
  policy_id: policyId,
  policy_version: 1,
  symbols: ['BTC', 'ETH', 'SOL', 'BNB'],
  durations_sec: [30, 60, 300, 900],
  min_stake: '0.00000001',
  max_stake: '1000000',
  payout_bps: 8500
};

function response(payload, ok = true) {
  return { ok, json: async () => payload };
}

test('fails closed when Supabase policy configuration is missing', async () => {
  let called = false;
  const ready = await hasActiveVersionedSecondsPolicy({
    env: {},
    fetchImpl: async () => { called = true; return response([]); }
  });
  assert.equal(ready, false);
  assert.equal(called, false);
});

test('fails closed when legacy hosted schema has no active policy table', async () => {
  let calls = 0;
  const ready = await hasActiveVersionedSecondsPolicy({
    env,
    fetchImpl: async () => { calls += 1; return response({ code: '42P01' }, false); }
  });
  assert.equal(ready, false);
  assert.equal(calls, 1);
});

test('accepts a valid active versioned policy', async () => {
  const urls = [];
  const ready = await hasActiveVersionedSecondsPolicy({
    env,
    fetchImpl: async url => {
      urls.push(url);
      return urls.length === 1 ? response([{ policy_id: policyId }]) : response([policy]);
    }
  });
  assert.equal(ready, true);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /seconds_contract_policy_active/);
  assert.match(urls[1], /seconds_contract_policies/);
});

test('rejects a policy with missing version or unsafe duration', async () => {
  const invalid = { ...policy, policy_version: 0, durations_sec: [30, 0] };
  const ready = await hasActiveVersionedSecondsPolicy({
    env,
    fetchImpl: async (_url, options) => {
      const url = String(_url);
      return url.includes('policy_active')
        ? response([{ policy_id: policyId }])
        : response([invalid]);
    }
  });
  assert.equal(ready, false);
});

test('rejects malformed active policy identifiers before querying policy rows', async () => {
  for (const policy_id of ['not-a-uuid', '']) {
    let calls = 0;
    const ready = await hasActiveVersionedSecondsPolicy({
      env,
      fetchImpl: async () => {
        calls += 1;
        return response([{ policy_id }]);
      }
    });
    assert.equal(ready, false);
    assert.equal(calls, 1);
  }
});

test('fails closed on policy query errors and network exceptions', async () => {
  const badQuery = await hasActiveVersionedSecondsPolicy({
    env,
    fetchImpl: async url => String(url).includes('policy_active')
      ? response([{ policy_id: policyId }])
      : response(null, false)
  });
  const networkError = await hasActiveVersionedSecondsPolicy({
    env,
    fetchImpl: async () => { throw new Error('network unavailable'); }
  });
  assert.equal(badQuery, false);
  assert.equal(networkError, false);
});
