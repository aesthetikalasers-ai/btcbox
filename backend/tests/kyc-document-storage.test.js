const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('KYC image upload validates content, size and stores evidence privately', () => {
  const backend = read('backend/api-core.js');
  assert.ok(backend.includes("const KYC_STORAGE_BUCKET = 'kyc-documents'"));
  assert.ok(backend.includes("const KYC_IMAGE_MAX_BYTES = 512 * 1024"));
  assert.ok(backend.includes("['image/jpeg', 'image/png', 'image/webp'].includes(contentType)"));
  assert.ok(backend.includes("bytes.toString('ascii', 8, 12) === 'WEBP'"));
  assert.ok(backend.includes("bytes.toString('ascii', 0, 4) === 'RIFF'"));
  assert.ok(backend.includes("'x-upsert': 'false'"));
  assert.ok(backend.includes("'/storage/v1/object/' + KYC_STORAGE_BUCKET"));
  assert.ok(backend.includes("body: JSON.stringify({ expiresIn: 300 })"));
  assert.ok(backend.includes("'/storage/v1/object/sign/' + KYC_STORAGE_BUCKET"));
  assert.ok(backend.includes("document_path: documentPath"));
  assert.ok(backend.includes("KYC_STORAGE_UNAVAILABLE"));
  assert.ok(backend.includes("KYC_DOCUMENT_REQUIRED"));
  assert.ok(backend.includes("document_preview_error"));
  assert.ok(!backend.includes("publicUrl"));
});

test('KYC evidence is exposed only to permission-checked admin review', () => {
  const backend = read('backend/api-core.js');
  const permission = backend.indexOf("if (route === 'kyc' && verb === 'GET') return 'kyc.read'");
  const adminList = backend.indexOf("if (sub === 'kyc' && method === 'GET')");
  const adminApprove = backend.indexOf("if (sub === 'kyc/approve' && method === 'POST')");
  assert.ok(permission >= 0 && adminList > permission && adminApprove > adminList);
  const listBlock = backend.slice(adminList, backend.indexOf('// GET /api/admin/user?uid=', adminList));
  assert.ok(listBlock.includes('createSignedKycDocumentUrl'));
  assert.ok(listBlock.includes('document_url'));
  assert.ok(!listBlock.includes('id_number:'));
  assert.ok(!listBlock.includes('document_path:'));
});

test('customer KYC form requires a compressed identity image', () => {
  const page = read('frontend/src/features/pages/Pages.tsx');
  const api = read('frontend/src/lib/api.ts');
  const admin = read('frontend/src/features/admin/AdminPage.tsx');
  assert.ok(page.includes('prepareKycDocumentImage'));
  assert.ok(page.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.ok(page.includes('document_image_base64'));
  assert.ok(page.includes('512 * 1024'));
  assert.ok(api.includes('document_content_type: "image/jpeg"'));
  assert.ok(api.includes('document_image_base64: string'));
  assert.ok(admin.includes('Open secure image'));
});
