'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const i18n = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/admin-i18n.ts'), 'utf8');

test('admin navigation groups the existing tabs by business centre without duplicating or inventing modules', () => {
  const start = page.indexOf('const adminTabGroups:');
  const end = page.indexOf('const adminPermissionOptions', start);
  assert.ok(start >= 0 && end > start);
  const groups = page.slice(start, end);
  const expected = [
    'tabs: ["overview"]',
    'tabs: ["users", "kyc"]',
    'tabs: ["deposits", "withdrawals", "payout-addresses"]',
    'tabs: ["orders", "markets", "seconds"]',
    'tabs: ["support", "support-faq"]',
    'tabs: ["audit"]',
    'tabs: ["admins"]',
  ];
  for (const item of expected) assert.ok(groups.includes(item), 'missing business-centre group ' + item);
  assert.ok(page.includes('allowedTabs.filter(item => group.tabs.includes(item.id))'));
  assert.ok(page.includes('if (!visibleItems.length) return null'));
  assert.ok(!groups.includes('"perpetual"'), 'do not expose a non-wired perpetual module');
});

test('admin business-centre navigation labels have Chinese translations', () => {
  for (const label of ['Workspace', 'User centre', 'Finance centre', 'Trading operations', 'Support centre', 'Audit centre', 'System']) {
    assert.ok(i18n.includes('"' + label + '":'), 'missing translation for ' + label);
  }
});
