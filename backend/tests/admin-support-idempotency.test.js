'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

function sliceRoute(marker, endMarker) {
  const start = api.indexOf(marker);
  const end = api.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, marker + ' route must exist');
  return api.slice(start, end);
}

test('admin support reply is idempotent by request_id and never duplicates a message', () => {
  const route = sliceRoute("if (sub === 'support/reply' && method === 'POST')", "// GET /api/admin/support/messages");
  assert.ok(route.includes('request_id'));
  assert.ok(route.includes('[A-Za-z0-9_-]{16,100}'));
  // Prior same request_id + same content => duplicate success; different content => 409 conflict.
  assert.ok(route.includes('SUPPORT_REPLY_IDEMPOTENCY_CONFLICT'));
  assert.ok(route.includes("message.from === 'admin' && message.request_id === requestId"));
  assert.ok(route.includes('duplicate: true'));
  // Persisted message carries the request_id and actor; audit + save follow.
  assert.ok(route.includes('request_id: requestId'));
  assert.ok(route.includes("auditAdmin('support_reply'"));
  assert.ok(route.includes('await saveDB(db)'));
  assert.ok(route.includes('flushAdminAuditOutbox()'));
});

test('admin broadcast push requires an idempotency key and dedups exact retries', () => {
  const route = sliceRoute("if (sub === 'push' && method === 'POST')", "// GET /api/admin/addresses");
  // Request ID is now mandatory; a missing/invalid key refuses before any send.
  assert.ok(route.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(route.includes('[A-Za-z0-9_-]{16,100}'));
  // Deduplication state is bounded and persisted with the message.
  assert.ok(route.includes('recent_admin_push_requests'));
  assert.ok(route.includes('ADMIN_PUSH_IDEMPOTENCY_CONFLICT'));
  assert.ok(route.includes('duplicate: true'));
  assert.ok(route.includes('slice(-200)'));
  // Every delivered message carries the request_id so a client can reconcile.
  assert.ok(route.includes('request_id: requestId'));
  // Audit records the request_id; durable save happens before the response.
  assert.ok(route.includes('request_id: requestId }), adminUserId'));
  assert.ok(route.includes('await saveDB(db)'));
  assert.ok(route.includes('flushAdminAuditOutbox()'));
  // No browser prompt; the Admin Panel uses in-app forms.
  assert.ok(!route.includes('window.confirm'));
});

test('KYC and withdrawal review operations are state/idempotency guarded so a retry cannot double-apply', () => {
  const kycApprove = sliceRoute("if (sub === 'kyc/approve' && method === 'POST')", "// POST /api/admin/kyc/reject");
  const kycReject = sliceRoute("if (sub === 'kyc/reject' && method === 'POST')", "// POST /api/admin/push");
  // Approve refuses non-in-review states without an exception reason, so a second
  // click after a successful (but response-lost) approval surfaces 409, not a
  // second mutation. Reject always records reviewed_by/reviewed_at and is audited.
  assert.ok(kycApprove.includes('KYC_EXCEPTION_REQUIRED'));
  assert.ok(kycApprove.includes('reviewed_by = adminUserId'));
  assert.ok(kycApprove.includes('await saveDB(db)'));
  assert.ok(kycReject.includes('Please provide a rejection reason.'));
  assert.ok(kycReject.includes("auditAdmin('kyc_reject'"));
  // Withdrawal review uses atomic RPCs with duplicate detection (covered by
  // admin-fund-ops-audit); the API never falls back to legacy state mutation.
  const wdApprove = sliceRoute("if (sub === 'withdraw/approve' && method === 'POST')", "if (sub === 'withdraw/reject' && method === 'POST')");
  assert.ok(wdApprove.includes('WITHDRAWAL_ALREADY_PROCESSED'));
  assert.ok(wdApprove.includes('duplicate'));
});

test('customer support chat send is idempotent by request_id and the SupportPage persists it across retries', () => {
  const route = sliceRoute("if (path === 'support/chat' && method === 'POST')", "// ---------- GET /api/support/messages");
  // Optional client request_id; invalid format refused before any write.
  assert.ok(route.includes('request_id'));
  assert.ok(route.includes('INVALID_REQUEST_ID'));
  // Prior same request_id + same content => duplicate success; different content => 409.
  assert.ok(route.includes('SUPPORT_MESSAGE_IDEMPOTENCY_CONFLICT'));
  assert.ok(route.includes("message.from === 'user' && message.request_id === requestId"));
  assert.ok(route.includes('duplicate: true'));
  // Delivered user message carries request_id for reconciliation.
  assert.ok(route.includes('entry.request_id = requestId'));
  assert.ok(route.includes('await saveDB(db)'));
  // Frontend SupportPage generates a stable request id and keeps it until send
  // succeeds, so a retry after a lost response cannot duplicate the message.
  const pages = fs.readFileSync(path.resolve(root, '../frontend/src/features/pages/Pages.tsx'), 'utf8');
  assert.ok(pages.includes('pendingRequestId'));
  assert.ok(pages.includes('sendSupportMessage(message,requestId)'));
  assert.ok(pages.includes('crypto.randomUUID()'));
  const client = fs.readFileSync(path.resolve(root, '../frontend/src/lib/api.ts'), 'utf8');
  assert.ok(client.includes('sendSupportMessage(content: string, requestId?: string)'));
  assert.ok(client.includes('request_id: requestId'));
});
