'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'frontend/src/features/admin/admin-navigation.ts'), 'utf8');
const api = fs.readFileSync(path.join(root, 'backend/api-core.js'), 'utf8');

test('Seconds admin module exposes versioned policy controls and a read-only open-position queue', () => {
  assert.ok(nav.includes('id: "seconds", label: "Seconds contracts", permission: "seconds_policy.read"'));
  assert.ok(page.includes('tab === "seconds" && secondsPolicy'));
  assert.ok(page.includes('Create and activate new policy version'));
  assert.ok(page.includes('tab === "seconds" ? <Card'));
  assert.ok(page.includes('Open Seconds positions'));
  assert.ok(page.includes('staff cannot force a result or manually release frozen funds here'));
  assert.ok(api.includes("route === 'seconds-positions' && verb === 'GET'"));
  assert.ok(api.includes("route === 'seconds-policy' && verb === 'POST'"));
  assert.ok(api.includes("admin_read_seconds_open_positions_v1"));
  assert.ok(api.includes("admin_set_seconds_policy_v1"));
});

test('Seconds admin does not expose a staff settlement or result override route', () => {
  const start = api.indexOf("const requiredPermission = (function(route, verb)");
  const end = api.indexOf(")(sub, method);", start);
  const resolver = api.slice(start, end);
  assert.ok(!resolver.includes("seconds-settle"));
  assert.ok(!resolver.includes("seconds-result"));
  assert.ok(!resolver.includes("seconds/settle"));
});
