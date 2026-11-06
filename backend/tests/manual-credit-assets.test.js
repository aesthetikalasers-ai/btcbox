'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const depositSql = fs.readFileSync(path.join(root, 'supabase/sql/0007_financial_admin_manual_deposit_v1.sql'), 'utf8');

test('manual credit supports every asset exposed in the admin asset selector', () => {
  const supported = ['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'USDC'];
  const allowlist = api.match(/if \(!\[([^\]]+)\]\.includes\(coin\)\)/);
  assert.ok(allowlist, 'backend manual-credit allowlist must exist');
  for (const asset of supported) {
    assert.ok(allowlist[1].includes("'" + asset + "'"), 'backend is missing ' + asset);
    assert.ok(admin.includes('"' + asset + '"'), 'admin selector is missing ' + asset);
  }
  assert.ok(depositSql.includes("coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}  assert.ok(api.includes("route === 'deposit/confirm' && verb === 'POST'"));
});
"));
  assert.ok(api.includes("route === 'deposit/confirm' && verb === 'POST'"));
});
