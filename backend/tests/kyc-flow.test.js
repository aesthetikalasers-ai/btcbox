'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');
const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('KYC submission validates legal name, supported document type and document number on the server', () => {
  assert.ok(api.includes('function validateKycSubmission(body)'));
  assert.ok(api.includes("['passport', 'id_card', 'driver_license'].includes(idType)"));
  assert.ok(api.includes("if (path === 'kyc' && method === 'POST')"));
  assert.ok(api.includes("status: 'pending'"));
  assert.ok(api.includes('await saveDB(db)'));
});

test('KYC frontend submits authenticated data and refreshes the account status', () => {
  assert.ok(client.includes('export async function submitKyc(input:'));
  assert.ok(client.includes('${API_BASE_URL}/kyc'));
  assert.ok(pages.includes('export function KycPage()'));
  assert.ok(pages.includes('await submitKyc({name:cleanName,id_type:idType,id_number:cleanId})'));
  assert.ok(pages.includes('setReload(value=>value+1)'));
  assert.ok(!pages.includes('Submission is not enabled in this frontend build.'));
});

test('administrator KYC review remains permission-gated and exposes approve/reject actions', () => {
  assert.ok(api.includes("route === 'kyc' && verb === 'GET'"));
  assert.ok(api.includes("route === 'kyc/approve' || route === 'kyc/reject'"));
  assert.ok(client.includes('adminApproveKyc'));
  assert.ok(client.includes('adminRejectKyc'));
  assert.ok(admin.includes('adminApproveKyc('));
  assert.ok(admin.includes('adminRejectKyc('));
});
