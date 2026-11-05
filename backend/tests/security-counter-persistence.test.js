'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'api-core.js'), 'utf8');

test('Supabase login request counters fail closed when persistence is unavailable', () => {
  const start = source.indexOf("if ((path === 'supabase-login' || path === 'google-login') && method === 'POST')");
  const end = source.indexOf("// ---------- POST /api/logout ----------", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(route, /\[login-rl\] persist failed:/);
  assert.match(route, /code: 'SECURITY_STATE_UNAVAILABLE'/);
  assert.doesNotMatch(route, /persist failed \(best-effort\)/);
});

test('withdrawal fund-password failure and reset counters fail closed before financial submission', () => {
  const start = source.indexOf("if (path === 'withdraw' && method === 'POST')");
  const end = source.indexOf("// ----------", start + 10);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(route, /\[fundpwd-lock\] persist failed:/);
  assert.match(route, /\[fundpwd-lock\] reset persist failed:/);
  assert.ok((route.match(/code: 'SECURITY_STATE_UNAVAILABLE'/g) || []).length >= 2, 'fund-password failure/reset and TOTP persistence must fail closed');
  assert.doesNotMatch(route, /fundpwd-lock.*best-effort/);
  assert.ok(route.indexOf('reset persist failed') < route.indexOf('financialWritesEnabled()'));
});

test('administrator authentication fails closed if lockout counter persistence fails', () => {
  const start = source.indexOf('async function adminAuth()');
  const end = source.indexOf("\n  if (path.startsWith('admin/'))", start);
  assert.ok(start >= 0 && end > start);
  const auth = source.slice(start, end);
  assert.match(auth, /persistenceUnavailable: true/);
  assert.match(auth, /\[admin-lock\] reset persist failed:/);
  assert.match(auth, /\[admin-lock\] persist failed:/);
  assert.doesNotMatch(auth, /persist failed \(best-effort\)/);
  const routeStart = end;
  const route = source.slice(routeStart, routeStart + 900);
  assert.match(route, /adminAuthResult\.persistenceUnavailable/);
  assert.match(route, /code: 'SECURITY_STATE_UNAVAILABLE'/);
});
