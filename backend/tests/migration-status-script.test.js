const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const LF = String.fromCharCode(10);
const script = path.join(__dirname, '..', 'scripts', 'check_migration_status.py');

test('migration checker labels offline output as static-only', () => {
  const env = { ...process.env }; delete env.DATABASE_URL;
  const result = spawnSync('python3', [script, '--offline'], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('[STATUS] STATIC_ONLY'));
  assert.ok(result.stdout.includes('Database migration state was not checked'));
  assert.ok(result.stdout.includes('Retired sequence numbers intentionally omitted: [9, 15, 16, 17, 18, 19, 20]'));
});

test('migration checker does not pass when database verification was requested but unavailable', () => {
  const env = { ...process.env }; delete env.DATABASE_URL;
  const result = spawnSync('python3', [script], { encoding: 'utf8', env });
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('[STATUS] DATABASE_UNAVAILABLE'));
  assert.ok(result.stderr.includes('DATABASE_URL is not set'));
});

test('migration checker refuses to compare timestamp ledger versions with four-digit filenames', () => {
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
  ].join(LF);
  try {
    fs.writeFileSync(path.join(tempDir, 'psycopg2.py'), fakeDriver);
    const env = { ...process.env, DATABASE_URL: 'postgresql://migration-check-test.invalid/test', PYTHONPATH: [tempDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
    const result = spawnSync('python3', [script], { encoding: 'utf8', env });
    assert.equal(result.status, 2, result.stderr);
    assert.ok(result.stderr.includes('[STATUS] VERSION_MAPPING_REQUIRED'));
    assert.ok(result.stderr.includes("do not use the repository's four-digit numbering"));
  } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
});

test('canonical bootstrap source preserves the prepared Seconds and Admin migration dependencies', () => {
  const root = path.resolve(__dirname, '..');
  const scripts = ['bootstrap-empty-database.sh', 'docker-init-migrations.sh']
    .map(name => fs.readFileSync(path.join(root, 'scripts', name), 'utf8'));
  const required = [
    '0023_btcbox_shared_rate_limit_v1.sql',
    '0024_seconds_settlement_idempotency_v1.sql',
    '0025_seconds_policy_versioning_v1.sql',
    '0026_admin_rbac_private_store_v1.sql',
    '0027_withdrawal_manual_payout_completion_v1.sql',
    '0028_admin_rbac_service_rpc_wrappers_v1.sql',
    '0029_withdrawal_fee_quote_idempotency_v1.sql',
    '0030_seconds_admin_open_positions_read_v1.sql',
    '0031_seconds_policy_duration_alignment_v1.sql',
    '0032_admin_audit_log_filter_indexes_v1.sql',
    '0033_withdrawal_legacy_rpc_cleanup_v1.sql',
    '0034_financial_audit_duplicate_index_cleanup_v1.sql',
    '0035_service_role_privilege_minimization_v1.sql',
'0042_support_read_state_v1.sql',
    '0043_support_read_cursor_v1.sql',
    '0044_withdrawal_operation_type_compatibility_v1.sql',
    '0057_admin_withdrawal_queue_includes_approved_payouts_v1.sql',
  ];
  for (const source of scripts) {
    const block = source.split('FILES=(')[1]?.split(LF + ')')[0];
    assert.ok(block, 'canonical migration inventory missing');
    const configured = block.split(LF).map(line => line.trim()).filter(line => line.endsWith('.sql'));
    let previous = -1;
    for (const file of required) {
      const index = configured.indexOf(file);
      assert.ok(index > previous, 'migration dependency order is incorrect for ' + file);
      previous = index;
    }
  }
});

test('existing-schema upgrades are kept outside the fresh-bootstrap SQL inventory', () => {
  const root = path.resolve(__dirname, '..');
  const canonicalDir = path.join(root, 'supabase', 'sql');
  const existingSchemaUpgrade = path.join(root, 'supabase', 'existing-schema-upgrades', '0039_existing_schema_market_catalog_upgrade_v1.sql');
  assert.equal(fs.existsSync(existingSchemaUpgrade), true);
  assert.equal(fs.existsSync(path.join(canonicalDir, '0039_existing_schema_market_catalog_upgrade_v1.sql')), false);
});

test('fresh database bootstrap expands safety variables and includes every canonical SQL file', () => {
  const root = path.resolve(__dirname, '..');
  const bootstrapPath = path.join(root, 'scripts', 'bootstrap-empty-database.sh');
  const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
  assert.ok(bootstrap.includes('BTCBOX_BOOTSTRAP_CONFIRM'));
  assert.ok(bootstrap.includes('BTCBOX_ALLOW_REMOTE_BOOTSTRAP'));
  assert.ok(bootstrap.includes('BTCBOX-owned tables'));
  for (const variable of ['BASH_SOURCE[0]', 'DATABASE_URL:-', 'BTCBOX_BOOTSTRAP_CONFIRM:-', 'BTCBOX_ALLOW_REMOTE_BOOTSTRAP:-']) {
    assert.ok(bootstrap.includes('$' + '{' + variable + '}'), 'missing real shell expansion: ' + variable);
  }
  const escapedExpansion = String.fromCharCode(92) + '$' + '{';
  assert.ok(!bootstrap.includes(escapedExpansion), 'shell expansions must not be escaped');
  assert.ok(bootstrap.includes('urlsplit(sys.argv[1]).hostname'));
  assert.ok(!bootstrap.includes('case "$DATABASE_URL" in'));
  const remoteEnv = { ...process.env, DATABASE_URL: 'postgresql://operator:secret@db.example.com/app?note=localhost', BTCBOX_BOOTSTRAP_CONFIRM: 'YES' };
  delete remoteEnv.BTCBOX_ALLOW_REMOTE_BOOTSTRAP;
  const remoteAttempt = spawnSync('bash', [bootstrapPath], { encoding: 'utf8', env: remoteEnv });
  assert.equal(remoteAttempt.status, 2, remoteAttempt.stderr);
  assert.ok(remoteAttempt.stderr.includes('Remote database refused'));
  const syntax = spawnSync('bash', ['-n', bootstrapPath], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const sqlDir = path.join(root, 'supabase', 'sql');
  const actual = fs.readdirSync(sqlDir).filter(name => name.endsWith('.sql') && /^[0-9]{4}_/.test(name)).sort();
  const block = bootstrap.split('FILES=(')[1].split(LF + ')')[0];
  const configured = block.split(LF).map(line => line.trim()).filter(line => line.endsWith('.sql')).map(line => line.replace(/,$/, '')).sort();
  assert.deepEqual(configured, actual, 'bootstrap must include each canonical SQL file exactly once');
  assert.ok(!bootstrap.includes('0016_financial_deposit_chain_verification_v3.sql'));
  assert.ok(!bootstrap.includes('0017_financial_migration_staging_v5.sql'));
  assert.ok(!bootstrap.includes('0020_financial_ledger_reconciliation_v1.sql'));
});


test('Docker first-init and guarded empty-database bootstrap use the exact canonical SQL inventory', () => {
  const root = path.resolve(__dirname, '..');
  const scripts = [
    path.join(root, 'scripts', 'bootstrap-empty-database.sh'),
    path.join(root, 'scripts', 'docker-init-migrations.sh'),
  ];
  const inventories = scripts.map((scriptPath) => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const block = source.split('FILES=(')[1]?.split(LF + ')')[0];
    assert.ok(block, 'migration FILES allowlist missing in ' + scriptPath);
    const configured = block.split(LF).map(line => line.trim())
      .filter(line => line.endsWith('.sql')).map(line => line.replace(/,$/, '')).sort();
    const syntax = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    return configured;
  });
  assert.deepEqual(inventories[1], inventories[0], 'Docker init must not drift from guarded canonical bootstrap');
  const sqlDir = path.join(root, 'supabase', 'sql');
  const actual = fs.readdirSync(sqlDir)
    .filter(name => name.endsWith('.sql') && /^[0-9]{4}_/.test(name)).sort();
  assert.deepEqual(inventories[0], actual, 'both bootstrap paths must apply every canonical SQL file exactly once');
  assert.ok(!inventories[1].includes('0008_financial_spot_trade_v3.sql'));
  assert.ok(!inventories[1].includes('0009_financial_matching_engine_v1.sql'));
  assert.ok(inventories[1].includes('0008_financial_matching_engine_v1.sql'));
  assert.ok(inventories[1].includes('0032_admin_audit_log_filter_indexes_v1.sql'));
  assert.ok(inventories[1].includes('0033_withdrawal_legacy_rpc_cleanup_v1.sql'));
  assert.ok(inventories[1].includes('0034_financial_audit_duplicate_index_cleanup_v1.sql'));
  assert.ok(inventories[1].includes('0035_service_role_privilege_minimization_v1.sql'));
  assert.ok(inventories[1].includes('0036_service_role_maintain_privilege_revoke_v1.sql'));
  assert.ok(inventories[1].includes('0037_financial_write_rate_limit_scopes_v1.sql'));
  assert.ok(inventories[1].includes('0038_withdrawal_first_successful_review_guard_v1.sql'));
});


test('service-role privilege hardening keeps only rate-limit cleanup DELETE access', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '0035_service_role_privilege_minimization_v1.sql'), 'utf8');
  assert.match(migration, /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER[\s\S]*?ON ALL TABLES IN SCHEMA public[\s\S]*?FROM service_role/i);
  assert.match(migration, /GRANT DELETE ON TABLE public\.btcbox_rate_limits TO service_role/i);
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]*?REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role/i);
  assert.doesNotMatch(migration, /GRANT DELETE ON TABLE public\.(?!btcbox_rate_limits)/i);
});


test('PostgreSQL 17 MAINTAIN privilege is removed from service_role defaults and existing public tables', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'sql', '0036_service_role_maintain_privilege_revoke_v1.sql'), 'utf8');
  assert.match(migration, /server_version_num[\s\S]*?>= 170000[\s\S]*?REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM service_role/i);
  assert.match(migration, /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public[\s\S]*?REVOKE MAINTAIN ON TABLES FROM service_role/i);
});
