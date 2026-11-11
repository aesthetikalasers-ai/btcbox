'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('retired ADMIN_PASS environment value cannot block Supabase-authenticated API startup', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./api-core.js')"], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, ADMIN_PASS: 'weak-legacy-password' },
    timeout: 10000
  });

  assert.equal(result.error, undefined, result.error && result.error.message);
  assert.equal(result.status, 0, [
    'api-core must not reject startup based on the retired ADMIN_PASS setting',
    result.stdout,
    result.stderr
  ].filter(Boolean).join('\n'));
  assert.doesNotMatch(result.stderr, /ADMIN_PASS_TOO_WEAK/);
});
