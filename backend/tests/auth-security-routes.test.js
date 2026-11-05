'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');
const ids = {
  source: '123e4567-e89b-42d3-a456-426614174000',
  target: '223e4567-e89b-42d3-a456-426614174001',
};
const sessionToken = 'test-session';

function jwt(subject) {
  const payload = Buffer.from(JSON.stringify({
    sub: subject, auth_time: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  return 'header.' + payload + '.signature';
}
function identity(id, address) {
  return {
    id,
    app_metadata: { provider: 'web3', providers: ['web3'] },
    identities: [{
      provider: 'web3',
      identity_data: { custom_claims: { chain: 'ethereum', address } },
    }],
  };
}
function reply(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function harness(marker = {}, options = {}) {
  const now = Date.now();
  let data = {
    users: { '16588': {
      uid: 16588, username: 'alice_123', username_normalized: 'alice_123',
      supabase_user_id: ids.source, supabase_user_ids: [ids.source],
      auth_providers: ['web3'], twofa_enabled: false,
    } },
    sessions: {
      [sessionToken]: Object.assign({ uid: 16588, created_at: now }, marker),
      'other-session': { uid: 16588, created_at: now - 1000 },
    },
    temp_tokens: { pending: { uid: 16588, exp: now + 60000 } },
    security_counters: {},
  };
  let revision = 4;
  let failCas = !!options.failCas;
  let reads = 0;
  let release;
  let barrier = null;
  const identities = new Map([
    ['source-token', identity(ids.source, '0x1111111111111111111111111111111111111111')],
    ['target-token', identity(ids.target, '0x2222222222222222222222222222222222222222')],
  ]);
  const env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_AUTH_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: 'test-key',
    SUPABASE_AUTH_PUBLISHABLE_KEY: 'sb_publishable_test_key',
    BTCBOX_RATE_LIMIT_HMAC_SECRET: 'a-test-only-hmac-secret-longer-than-32-bytes',
    CONTEXT: 'dev',
  };
  const fetchMock = async (input, init = {}) => {
    const url = String(input);
    if (url.includes('/rest/v1/btcbox_state?')) {
      const snapshot = { revision, data: JSON.parse(JSON.stringify(data)) };
      if (barrier) {
        reads += 1;
        if (reads >= 2) release();
        await barrier;
      }
      return reply([snapshot]);
    }
    if (url.endsWith('/rest/v1/rpc/btcbox_save_state')) {
      const body = JSON.parse(init.body);
      if (failCas) { failCas = false; return reply(false); }
      if (body.p_expected_revision !== revision) return reply(false);
      data = JSON.parse(JSON.stringify(body.p_data));
      revision += 1;
      return reply(true);
    }
    if (url.endsWith('/rest/v1/rpc/btcbox_rate_limit_consume_v1')) {
      const scope = JSON.parse(init.body).p_scope;
      const p = {
        identity_link_reauth: [8, 900],
        identity_link_target: [10, 900],
        credential_recover: [5, 900],
      }[scope];
      if (!p) return reply({}, 400);
      return reply({
        allowed: true, limit: p[0], count: 1, remaining: p[0] - 1,
        retry_after_seconds: p[1], window_seconds: p[1],
        window_start: Math.floor(Date.now() / 1000),
      });
    }
    if (url.endsWith('/auth/v1/user')) {
      const token = String(init.headers.Authorization || '').replace(/^Bearer /, '');
      return identities.has(token) ? reply(identities.get(token)) : reply({}, 401);
    }
    throw new Error('Unexpected request in isolated handler test: ' + url);
  };
  const mod = { exports: {} };
  const factory = vm.runInThisContext('(function(require,module,exports,process,Buffer,fetch,AbortSignal,URL,console){' +
    source + '\nexports.__testHandleRequest = handleRequest;\n})');
  factory(require, mod, mod.exports, { env }, Buffer, fetchMock, AbortSignal, URL, { warn() {}, error() {} });
  return {
    run: async (route, body = {}, cookie = sessionToken) => {
      const result = await mod.exports.__testHandleRequest({
        path: '/api/' + route, httpMethod: 'POST',
        headers: { cookie: 'session_token=' + cookie }, body: JSON.stringify(body),
      }, {});
      return { status: result.statusCode, body: JSON.parse(result.body) };
    },
    get data() { return JSON.parse(JSON.stringify(data)); },
    get revision() { return revision; },
    holdTwoReads() {
      reads = 0;
      barrier = new Promise(resolve => { release = resolve; });
    },
  };
}
const linkMarker = {
  identity_link_reauth: {
    purpose: 'identity_link', supabase_user_id: ids.source,
    auth_time: Math.floor(Date.now() / 1000), verified_at: Date.now(),
  },
};
const recoveryMarker = {
  credential_reauth: {
    purpose: 'credential_recovery', supabase_user_id: ids.source,
    auth_time: Math.floor(Date.now() / 1000), verified_at: Date.now(),
  },
};

test('identity-link handler verifies source, links target, consumes marker, and rejects replay', async () => {
  const h = harness();
  const source = await h.run('auth/link-identity/reauth', { supabase_access_token: 'source-token' });
  assert.equal(source.status, 200, JSON.stringify(source.body));
  const linked = await h.run('auth/link-identity', { supabase_access_token: 'target-token' });
  assert.equal(linked.status, 200);
  assert.ok(h.data.users['16588'].supabase_user_ids.includes(ids.target));
  assert.equal(h.data.sessions[sessionToken].identity_link_reauth, undefined);
  const replay = await h.run('auth/link-identity', { supabase_access_token: 'target-token' });
  assert.equal(replay.status, 403);
  assert.equal(replay.body.code, 'REAUTH_REQUIRED');
});

test('identity-link handler rejects expired or wrong-purpose markers and CAS allows one concurrent winner', async () => {
  for (const marker of [
    { purpose: 'identity_link', supabase_user_id: ids.source, auth_time: Math.floor(Date.now() / 1000), verified_at: Date.now() - 360000 },
    { purpose: 'credential_recovery', supabase_user_id: ids.source, auth_time: Math.floor(Date.now() / 1000), verified_at: Date.now() },
  ]) {
    const h = harness({ identity_link_reauth: marker });
    const result = await h.run('auth/link-identity', { supabase_access_token: 'target-token' });
    assert.equal(result.status, 403);
  }
  const h = harness();
  const reauth = await h.run('auth/link-identity/reauth', { supabase_access_token: 'source-token' });
  assert.equal(reauth.status, 200, JSON.stringify(reauth.body));
  h.holdTwoReads();
  const results = await Promise.all([
    h.run('auth/link-identity', { supabase_access_token: 'target-token' }),
    h.run('auth/link-identity', { supabase_access_token: 'target-token' }),
  ]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
  assert.equal(h.data.users['16588'].supabase_user_ids.filter(x => x === ids.target).length, 1);
});

test('credential recovery consumes marker once, revokes other sessions and keeps current session', async () => {
  const h = harness(recoveryMarker);
  const result = await h.run('account/credentials/recover', {
    password: 'a-new-strong-btcbox-password-2026',
  });
  assert.equal(result.status, 200);
  assert.ok(h.data.users['16588'].login_password_hash);
  assert.equal(h.data.sessions[sessionToken].uid, 16588);
  assert.equal(h.data.sessions[sessionToken].credential_reauth, undefined);
  assert.equal(h.data.sessions['other-session'], undefined);
  assert.equal(h.data.temp_tokens.pending, undefined);
  const replay = await h.run('account/credentials/recover', {
    password: 'another-strong-btcbox-password-2026',
  });
  assert.equal(replay.status, 403);
  assert.equal(replay.body.code, 'RECENT_REAUTH_REQUIRED');
});

test('credential recovery rejects wrong-purpose markers and CAS allows one concurrent winner', async () => {
  const wrong = harness({ credential_reauth: {
    purpose: 'identity_link', supabase_user_id: ids.source,
    auth_time: Math.floor(Date.now() / 1000), verified_at: Date.now(),
  } });
  const rejected = await wrong.run('account/credentials/recover', {
    password: 'a-new-strong-btcbox-password-2026',
  });
  assert.equal(rejected.status, 403);

  const h = harness(recoveryMarker);
  h.holdTwoReads();
  const results = await Promise.all([
    h.run('account/credentials/recover', { password: 'a-new-strong-btcbox-password-2026' }),
    h.run('account/credentials/recover', { password: 'a-different-strong-password-2026' }),
  ]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
  assert.ok(h.data.users['16588'].login_password_hash);
  assert.equal(h.data.sessions[sessionToken].credential_reauth, undefined);
  assert.equal(h.data.sessions['other-session'], undefined);
});

test('credential recovery does not commit or consume its marker after a database CAS conflict', async () => {
  const h = harness(recoveryMarker, { failCas: true });
  const result = await h.run('account/credentials/recover', {
    password: 'a-new-strong-btcbox-password-2026',
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'ACCOUNT_UPDATE_CONFLICT');
  assert.equal(h.data.users['16588'].login_password_hash, undefined);
  assert.equal(h.data.sessions[sessionToken].credential_reauth.purpose, 'credential_recovery');
});
