'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const admin = fs.readFileSync(path.resolve(root, '../frontend/src/features/admin/AdminPage.tsx'), 'utf8');

test('administrator membership mutation is not reported as failed when list refresh fails', () => {
  const start = admin.indexOf('const submitAdminMembershipChange = async');
  const end = admin.indexOf('if (authStatus ===', start);
  assert.ok(start >= 0 && end > start);
  const handler = admin.slice(start, end);
  const mutation = handler.indexOf('await manageAdminMembership(token');
  const confirmedNotice = handler.indexOf('setNotice(action ===', mutation);
  const refreshTry = handler.indexOf('try {', confirmedNotice);
  const refreshCall = handler.indexOf('getAdminMemberships(token)', refreshTry);
  const refreshCatch = handler.indexOf('} catch {', refreshCall);
  const outerCatch = handler.indexOf('} catch (reason)', refreshCatch);

  assert.ok(mutation >= 0 && confirmedNotice > mutation);
  assert.ok(refreshTry > confirmedNotice && refreshCall > refreshTry);
  assert.ok(refreshCatch > refreshCall && outerCatch > refreshCatch);
  assert.ok(handler.includes('Administrator change is confirmed; the list could not refresh.'));
  assert.ok(handler.includes('Administrator change could not be confirmed.'));
  assert.ok(!handler.slice(refreshTry, outerCatch).includes('Administrator change could not be confirmed.'));
});
