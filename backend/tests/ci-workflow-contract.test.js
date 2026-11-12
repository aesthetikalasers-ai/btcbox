'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const workflowRoot = path.join(root, '.github', 'workflows');
const backendWorkflow = fs.readFileSync(path.join(workflowRoot, 'backend-ci.yml'), 'utf8');
const frontendWorkflow = fs.readFileSync(path.join(workflowRoot, 'frontend-ci.yml'), 'utf8');
const postgresWorkflow = fs.readFileSync(path.join(workflowRoot, 'btcbox-postgres-schema-ci.yml'), 'utf8');
const integrationBranch = 'integration/btcbox-mainline-consolidation-20261112';

test('backend CI retains workflow structure and fail-closed release gates', () => {
  assert.match(backendWorkflow, /^name: BTCBOX backend CI$/m);
  assert.match(backendWorkflow, /^on:\s*$/m);
  assert.match(backendWorkflow, /^jobs:\s*$/m);
  assert.match(backendWorkflow, /^  backend:\s*$/m);
  assert.match(backendWorkflow, /npm test --prefix backend/);
  assert.match(backendWorkflow, /npm run test:integration --prefix backend/);
  assert.match(backendWorkflow, /npm run preflight --prefix backend/);
  assert.doesNotMatch(backendWorkflow, /^import React/m);
});

test('all required CI workflows run on the current integration candidate branch', () => {
  assert.ok(backendWorkflow.includes("'" + integrationBranch + "'"));
  assert.ok(frontendWorkflow.includes('"' + integrationBranch + '"'));
  assert.ok(postgresWorkflow.includes(integrationBranch));
});

test('frontend CI retains build, browser-route, and responsive evidence steps', () => {
  assert.match(frontendWorkflow, /npm run lint/);
  assert.match(frontendWorkflow, /npm run build/);
  assert.match(frontendWorkflow, /npm run test:e2e/);
  assert.match(frontendWorkflow, /Upload responsive visual QA screenshots/);
});

test('PostgreSQL CI retains disposable canonical-schema bootstrap validation', () => {
  assert.match(postgresWorkflow, /empty-postgres-bootstrap/);
  assert.match(postgresWorkflow, /test-postgres-schema-bootstrap\.sh/);
  assert.match(postgresWorkflow, /postgres:16/);
});
