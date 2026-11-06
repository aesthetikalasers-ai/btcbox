'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, '..', name), 'utf8');
const api = read('frontend/src/lib/api.ts');
const page = read('frontend/src/features/pages/Pages.tsx');
const app = read('frontend/src/App.tsx');
const backend = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

test('React Seconds page loads the server policy and validates the complete positions snapshot', () => {
  assert.match(api, /export async function getSecondsPolicy\(signal\?: AbortSignal\)/);
  assert.match(api, /readAuthenticated<SecondsPolicyResponse.*>\("seconds\/policy", signal\)/);
  assert.match(api, /INVALID_SECONDS_POLICY/);
  assert.match(api, /export async function getSecondsPositions\(signal\?: AbortSignal\)/);
  assert.match(api, /INVALID_SECONDS_POSITIONS_RESPONSE/);
  assert.match(api, /payload\.open\.every\(isSecondsPosition\)/);
  assert.match(page, /getSecondsPolicy\(controller\.signal\)/);
});

test('React Seconds order entry persists a stable request and retries only the same intent until confirmed', () => {
  assert.match(app, /<Route path="\/seconds" element=\{<ProtectedAccountRoute><SecondsPage \/><\/ProtectedAccountRoute>\}/);
  assert.match(api, /export async function submitSecondsOrder/);
  assert.match(page, /btcbox\.seconds\.pending\.v1\./);
  assert.match(page, /window\.crypto\.randomUUID\(\)/);
  assert.match(page, /Retry same request/);
  assert.match(page, /const confirmed=latest\.open\.some/);
  assert.match(page, /policy\?\.actions_enabled/);
  assert.doesNotMatch(page, /No orders can be placed or settled from this page/);
});

test('each mature position is settled independently by the server endpoint', () => {
  assert.match(api, /export async function settleSecondsPosition/);
  assert.match(page, /snapshot\.open\.map\(position=>/);
  assert.match(page, /request_id:"settle_"\+position\.position_id/);
  assert.match(backend, /if \(path === 'seconds\/settle' && method === 'POST'\)/);
  assert.match(backend, /fetchSecondsReferencePrice\(symbol\)/);
});

test('Seconds order and settlement writes remain fail-closed behind backend financial cutover', () => {
  const order = backend.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const settle = backend.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const positions = backend.indexOf("if (path === 'seconds/positions' && method === 'GET')");
  assert.ok(order >= 0 && settle > order && positions > settle);
  assert.match(backend.slice(order, settle), /if \(!financialWritesEnabled\(\)\)/);
  assert.match(backend.slice(settle, positions), /if \(!financialWritesEnabled\(\)\)/);
});
