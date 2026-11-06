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

test('migration order document records prepared Seconds migrations and their prerequisites', () => {
  const fs = require('node:fs');
  const orderDoc = fs.readFileSync(path.join(__dirname, '..', 'supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md'), 'utf8');
  const rateLimit = orderDoc.indexOf('0023_btcbox_shared_rate_limit_v1.sql');
  const settlement = orderDoc.indexOf('0024_seconds_settlement_idempotency_v1.sql');
  const policy = orderDoc.indexOf('0025_seconds_policy_versioning_v1.sql');
  const adminRbac = orderDoc.indexOf('0026_admin_rbac_private_store_v1.sql');
  const manualPayout = orderDoc.indexOf('0027_withdrawal_manual_payout_completion_v1.sql');
  assert.ok(rateLimit >= 0 && settlement > rateLimit && policy > settlement && adminRbac > policy && manualPayout > adminRbac);
  assert.match(orderDoc, /requires the Seconds tables\/RPCs from/i);
  assert.match(orderDoc, /Apply only after the Seconds base and settlement-idempotency migrations/i);
  assert.match(orderDoc, /timestamp registry versions directly with four-digit filenames/i);
});


test('fresh database bootstrap includes only canonical operational SQL and refuses unconfirmed targets', () => {
  const fs = require('node:fs');
  const bootstrap = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'bootstrap-empty-database.sh'), 'utf8');
  assert.match(bootstrap, /BTCBOX_BOOTSTRAP_CONFIRM/);
  assert.match(bootstrap, /BTCBOX_ALLOW_REMOTE_BOOTSTRAP/);
  assert.match(bootstrap, /BTCBOX-owned tables/);
  const syntax = spawnSync('bash', ['-n', path.join(__dirname, '..', 'scripts', 'bootstrap-empty-database.sh')], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(bootstrap, /0001_btcbox_state_cas.sql/);
  assert.match(bootstrap, /0028_admin_rbac_service_rpc_wrappers_v1.sql/);
  for (const excluded of ['0016_financial_deposit_chain_verification_v3.sql','0017_financial_migration_staging_v5.sql','0018_financial_migration_staging_reconciliation_v6.sql','0019_financial_migration_reconciliation_v4.sql','0020_financial_ledger_reconciliation_v1.sql']) {
    assert.ok(!bootstrap.includes(excluded), excluded + ' must not be part of fresh operational bootstrap');
  }
});
