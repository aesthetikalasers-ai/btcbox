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

test('React seconds page reads authenticated positions with strict response validation', () => {
  assert.match(api, /export async function getSecondsPositions\(signal\?: AbortSignal\)/);
  assert.match(api, /readAuthenticated<SecondsPositionsSnapshot.*>\("seconds\/positions", signal\)/);
  assert.match(api, /INVALID_SECONDS_POSITIONS_RESPONSE/);
  assert.match(api, /INVALID_SECONDS_CUTOVER_RESPONSE/);
  assert.match(api, /payload\.open\.every\(isSecondsPosition\)/);
  assert.match(api, /payload\.history\.every/);
});

test('seconds React route is authenticated and read-only while cutover is incomplete', () => {
  assert.match(app, /<Route path="\/seconds" element=\{<ProtectedAccountRoute><SecondsPage \/><\/ProtectedAccountRoute>\}/);
  assert.match(page, /snapshot\?\.cutover_incomplete/);
  assert.match(page, /empty response does not mean you have no positions/i);
  assert.match(page, /No orders can be placed or settled from this page/);
  assert.doesNotMatch(page, /fetch\([^\n]*seconds\/(order|settle)/);
  assert.doesNotMatch(api, /fetch\([^\n]*seconds\/(order|settle)/);
});

test('seconds backend continues to fail closed for financial writes', () => {
  const order = backend.indexOf("if (path === 'seconds/order' && method === 'POST')");
  const settle = backend.indexOf("if (path === 'seconds/settle' && method === 'POST')");
  const positions = backend.indexOf("if (path === 'seconds/positions' && method === 'GET')");
  assert.ok(order >= 0 && settle > order && positions > settle);
  assert.match(backend.slice(order, settle), /if \(!financialWritesEnabled\(\)\)/);
  assert.match(backend.slice(settle, positions), /if \(!financialWritesEnabled\(\)\)/);
  assert.match(backend.slice(positions, positions + 1000), /cutover_incomplete: true/);
});
