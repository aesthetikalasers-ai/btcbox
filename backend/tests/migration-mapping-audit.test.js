const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const script = path.join(__dirname, '..', 'scripts', 'audit_migration_mapping.py');

test('migration evidence tool emits source SHA manifest without connecting to a database', () => {
  const env = { ...process.env };
  delete env.STAGING_DATABASE_URL;
  const result = spawnSync('python3', [script, '--source-only'], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mapping_status, 'MANUAL_REVIEW_REQUIRED');
  assert.equal(report.database.status, 'NOT_CHECKED');
  assert.ok(report.source_migrations.length >= 26);
  for (const migration of report.source_migrations) {
    assert.match(migration.sha256, /^[a-f0-9]{64}$/);
    assert.match(migration.filename, /^\d{4}_.+\.sql$/);
  }
});

test('migration evidence tool refuses to guess a mapping when staging URL is absent', () => {
  const env = { ...process.env };
  delete env.STAGING_DATABASE_URL;
  delete env.DATABASE_URL;
  const result = spawnSync('python3', [script], { encoding: 'utf8', env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /MANUAL_REVIEW_REQUIRED|STAGING_DATABASE_URL/);
  assert.match(result.stderr, /production DATABASE_URL is intentionally ignored/);
});

test('migration evidence tool refuses the known production project even when supplied as staging URL', () => {
  const env = { ...process.env, STAGING_DATABASE_URL: 'postgresql://operator:secret@db.zlozsutefnmgwwzrlipt.supabase.co/postgres' };
  const result = spawnSync('python3', [script], { encoding: 'utf8', env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Refusing the known production Supabase project/);
  assert.doesNotMatch(result.stderr, /operator|secret/);
});

test('migration evidence collector is read-only and blocks the known production project', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /SET TRANSACTION READ ONLY/);
  assert.match(source, /PROTECTED_PROJECT/);
  assert.match(source, /zlozsutefnmgwwzrlipt/);
  assert.doesNotMatch(source, /\b(?:INSERT INTO|UPDATE\s+\w|DELETE FROM|ALTER TABLE|CREATE TABLE|DROP TABLE|GRANT\s|REVOKE\s)\b/i);
});
