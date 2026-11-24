'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'frontend/src/features/admin/admin-navigation.ts'), 'utf8');
const debit = fs.readFileSync(path.join(root, 'frontend/src/features/admin/ManualDebitPanel.tsx'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'frontend/src/lib/admin-i18n.ts'), 'utf8');
const api = fs.readFileSync(path.join(root, 'backend/api-core.js'), 'utf8');

test('manual credit and manual debit are separate finance-centre actions, not user-directory controls', () => {
  const userStart = page.indexOf('!loading && tab === "users"');
  const financeStart = page.indexOf('!loading && tab === "financial-adjustments"');
  const financeEnd = page.indexOf('!loading && tab === "deposits"', financeStart);
  assert.ok(userStart >= 0 && financeStart > userStart && financeEnd > financeStart);
  const userBlock = page.slice(userStart, financeStart);
  const financeBlock = page.slice(financeStart, financeEnd);
  assert.ok(userBlock.includes('setTab("financial-adjustments")'));
  assert.ok(!userBlock.includes('ManualDebitPanel'));
  assert.ok(!userBlock.includes('manualCredit(event,coin)'));
  assert.ok(financeBlock.includes('financialAction === "credit"'));
  assert.ok(financeBlock.includes('financialAction === "debit"'));
  assert.ok(financeBlock.includes('manualCredit(event,coin)'));
  assert.ok(financeBlock.includes('ManualDebitPanel'));
  assert.ok(navigation.includes('label: "Manual credit / debit", permission: "users.read"'));
  assert.ok(navigation.includes('"financial-adjustments"'));
});

test('manual debit remains reason-free and localized while preserving the existing adjustment permission', () => {
  assert.ok(debit.includes('adminAdjustUserBalance(token'));
  assert.ok(debit.includes('delta: "-" + normalizedAmount'));
  assert.ok(!debit.includes('name="reason"'));
  assert.ok(!debit.includes('placeholder="Reason"'));
  assert.ok(debit.includes('adminText("Manual debit")'));
  assert.ok(debit.includes('adminText("Confirm debit")'));
  assert.ok(api.includes("route === 'user/balance' && verb === 'POST'"));
  assert.ok(api.includes("'financial_adjustment.request'"));
  for (const label of ['Manual debit', 'Debit amount', 'Confirm debit', 'Financial adjustments']) {
    assert.ok(i18n.includes('"' + label + '":'), 'missing translation for ' + label);
  }
});
