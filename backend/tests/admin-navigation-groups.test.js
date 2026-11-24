'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const registry = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/admin/admin-navigation.ts'), 'utf8');
const i18n = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/lib/admin-i18n.ts'), 'utf8');

test('admin navigation groups the existing tabs by business centre without duplicating or inventing modules', () => {
  const start = registry.indexOf('export const ADMIN_TAB_GROUPS:');
  const end = registry.length;
  assert.ok(start >= 0 && end > start);
  const groups = registry.slice(start, end);
  const expected = [
    'tabs: ["overview"]',
    'tabs: ["users", "kyc"]',
    'tabs: ["deposits", "withdrawals", "financial-adjustments", "payout-addresses"]',
    'tabs: ["orders", "markets", "seconds"]',
    'tabs: ["support", "support-faq"]',
    'tabs: ["audit"]',
    'tabs: ["admins"]',
  ];
  for (const item of expected) assert.ok(groups.includes(item), 'missing business-centre group ' + item);
  assert.ok(registry.includes('"financial-adjustments"'));
  assert.ok(registry.includes('id: "users", label: "Users", permission: "users.read"'));
  assert.ok(!registry.includes("Users & manual credit"), "user centre label must not imply finance actions");

  const userStart = page.indexOf('!loading && tab === "users"');
  const financeStart = page.indexOf('!loading && tab === "financial-adjustments"');
  const userBlock = page.slice(userStart, financeStart);
  const financeEnd = page.indexOf('!loading && tab === "deposits"', financeStart);
  const financeBlock = page.slice(financeStart, financeEnd);
  assert.ok(userBlock.includes('setTab("financial-adjustments")'), 'opening a user should enter the finance module');
  assert.ok(!userBlock.includes('ManualDebitPanel') && !userBlock.includes('manualCredit(event,coin)'), 'user directory must not contain financial action forms');
  assert.ok(financeBlock.includes('ManualDebitPanel') && financeBlock.includes('manualCredit(event,coin)'), 'finance module must own both manual actions');
  assert.ok(page.includes('ADMIN_TAB_GROUPS.map'));
  assert.ok(page.includes('allowedTabs.filter(item => group.tabs.includes(item.id))'));
  assert.ok(page.includes('if (!visibleItems.length) return null'));
  assert.ok(!groups.includes('"perpetual"'), 'do not expose a non-wired perpetual module');
});

test('admin business-centre navigation labels have Chinese translations', () => {
  for (const label of ['Workspace', 'User centre', 'Finance centre', 'Trading operations', 'Support centre', 'Audit centre', 'System', 'Seconds contracts']) {
    assert.ok(i18n.includes('"' + label + '":'), 'missing translation for ' + label);
  }
});
