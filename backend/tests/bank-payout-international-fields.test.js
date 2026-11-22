'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const addressPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/AddressBookPage.tsx'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');
const clientApi = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');

test('bank payout creation accepts IBAN or local account number without forcing US-only routing fields', () => {
  const start = api.indexOf("if (path === 'addresses' && method === 'POST')");
  const end = api.indexOf('// Address book is immutable', start);
  assert.ok(start >= 0 && end > start);
  const route = api.slice(start, end);
  assert.ok(route.includes('(!account && !iban)'));
  assert.ok(route.includes('validIban'));
  assert.ok(route.includes('(routing && !/^\\d{9}$/'));
  assert.ok(!route.includes('!bankAddress'));
});

test('customer bank account identifiers are masked and customer records remain immutable', () => {
  const start = api.indexOf("if (path === 'addresses' && method === 'GET')");
  const end = api.indexOf('// ---------- GET /api/addresses/select', start);
  const route = api.slice(start, end);
  assert.ok(route.includes("out.account_number = out.account_number ? '••••'"));
  assert.ok(route.includes("out.iban = out.iban ? out.iban.slice(0,2)"));
  assert.ok(route.includes("out.routing_number = out.routing_number ? '••••'"));
  assert.ok(api.includes("return json({ok:false,msg:'Please contact support.'},403)"));
});

test('customer form supports IBAN and leaves regional wire fields optional', () => {
  assert.ok(addressPage.includes('IBAN (if applicable)'));
  assert.ok(addressPage.includes('setIban'));
  assert.ok(!addressPage.includes('required={showWireDetails}'));
  assert.ok(!addressPage.includes('required inputMode="numeric" placeholder={t("4–34 digits")}'));
});

test('admin payout details can be read, edited and deleted with dedicated permissions', () => {
  assert.ok(clientApi.includes('admin/addresses'));
  assert.ok(clientApi.includes('admin/address/manage'));
  assert.ok(adminPage.includes('id: "payout-addresses"'));
  assert.ok(adminPage.includes('payout_addresses.manage'));
  assert.ok(adminPage.includes('action:"update"'));
  assert.ok(adminPage.includes('action:"delete"'));
  assert.ok(adminPage.includes('reason:"Administrator removed saved payout details."'));
});
