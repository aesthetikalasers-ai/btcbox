'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const preflight = path.join(__dirname, '..', 'scripts', 'deployment-preflight.js');

function runPreflight(overrides = {}) {
  const env = {
    ...process.env,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key',
    SUPABASE_AUTH_URL: 'https://example.supabase.co',
    SUPABASE_AUTH_PUBLISHABLE_KEY: 'sb_publishable_test_key',
    FINANCIAL_POSTGRES_RPC_ENABLED: '0',
    FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED: '0',
    FINANCIAL_POSTGRES_READS_ENABLED: '0',
    FINANCIAL_MATCHING_ENGINE_ENABLED: '0',
    ...overrides,
  };
  delete env.ADMIN_USER;
  delete env.ADMIN_PASS;
  return spawnSync(process.execPath, [preflight], {
    encoding: 'utf8',
    env,
  });
}

test('deployment preflight accepts Supabase Auth + RBAC without legacy ADMIN_USER/ADMIN_PASS', () => {
  const result = runPreflight();
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /Preflight passed/);
  assert.doesNotMatch(result.stdout, /admin credentials are configured|ADMIN_PASS/);
});

test('deployment preflight still fails closed when a financial flag is not explicitly disabled', () => {
  const result = runPreflight({ FINANCIAL_MATCHING_ENGINE_ENABLED: '' });
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stdout, /all financial cutover flags are explicitly disabled/);
  assert.match(result.stderr, /Preflight failed/);
});
