const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, '..', 'scripts', 'check_migration_status.py');

test('migration checker labels offline output as static-only', () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const result = spawnSync('python3', [script, '--offline'], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[STATUS\] STATIC_ONLY/);
  assert.match(result.stdout, /Database migration state was not checked/);
});

test('migration checker does not pass when database verification was requested but unavailable', () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const result = spawnSync('python3', [script], {
    encoding: 'utf8',
    env
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /\[STATUS\] DATABASE_UNAVAILABLE/);
  assert.match(result.stderr, /DATABASE_URL is not set/);
});
