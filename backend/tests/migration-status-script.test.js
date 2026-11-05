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

test('migration checker refuses to compare timestamp ledger versions with four-digit filenames', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'btcbox-fake-psycopg2-'));
  const fakeDriver = [
    'class Cursor:',
    '    def execute(self, query):',
    '        self.query = query',
    '    def fetchall(self):',
    "        return [('20261102133555',), ('20261103062716',)]",
    '    def __enter__(self):',
    '        return self',
    '    def __exit__(self, *args):',
    '        return False',
    'class Connection:',
    '    def cursor(self):',
    '        return Cursor()',
    '    def close(self):',
    '        pass',
    'def connect(url):',
    '    return Connection()'
  ].join(String.fromCharCode(10));

  try {
    fs.writeFileSync(path.join(tempDir, 'psycopg2.py'), fakeDriver);
    const env = {
      ...process.env,
      DATABASE_URL: 'postgresql://migration-check-test.invalid/test',
      PYTHONPATH: [tempDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)
    };
    const result = spawnSync('python3', [script], { encoding: 'utf8', env });

    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /\[STATUS\] VERSION_MAPPING_REQUIRED/);
    assert.match(result.stderr, /do not use the repository's four-digit numbering/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
