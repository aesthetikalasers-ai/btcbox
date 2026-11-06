'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

test('Admin spot-market panel is permission-gated and uses the audited API client', () => {
  assert.match(admin, /id: "markets", label: "Spot markets", permission: "system_config\.read"/);
  assert.match(admin, /tab === "markets"/);
  assert.match(admin, /getAdminSpotMarkets\(token\)/);
  assert.match(admin, /saveAdminSpotMarket\(token/);
  assert.match(admin, /hasPermission\("system_config\.write"\)/);
  assert.match(api, /"admin\/spot-markets"/);
  assert.match(admin, /btcbox\.admin\.spot-market\.v1\./);
  assert.match(admin, /Retry same update/);
});

test('Spot-market editor is constrained to supported ledger assets and keeps fees fail-closed', () => {
  const supported = backend.match(/const SUPPORTED_LEDGER_ASSETS = new Set\(\[([\s\S]*?)\]\);/);
  const uiAssets = admin.match(/const spotAssets = \[([^\]]+)\];/);
  assert.ok(supported && uiAssets, 'backend and UI supported asset catalogues must exist');
  const backendAssets = [...supported[1].matchAll(/'([A-Z0-9]+)'/g)].map(match => match[1]).sort();
  const frontendAssets = [...uiAssets[1].matchAll(/"([A-Z0-9]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(frontendAssets, backendAssets);
  assert.match(backend, /SUPPORTED_LEDGER_ASSETS\.has\(baseAsset\)/);
  assert.match(backend, /SUPPORTED_LEDGER_ASSETS\.has\(quoteAsset\)/);
  assert.match(admin, /maker\/taker fees stay at zero until fee movements are implemented atomically/i);
  assert.match(admin, /Market orders remain disabled/);
});
