'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..', 'frontend', 'src');
const auth = fs.readFileSync(path.join(root, 'lib', 'auth.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'lib', 'api.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'features', 'account', 'AccountSecurityPage.tsx'), 'utf8');

test('identity linking requires source reauthentication before target proof', () => {
  assert.ok(auth.includes('flow=link-reauth'));
  assert.ok(auth.includes('flow=link-target'));
  assert.ok(auth.includes('reauthenticateIdentityForLinkRequest(data.session.access_token)'));
  assert.ok(auth.includes('await linkIdentityRequest(data.session.access_token)'));
  assert.ok(auth.includes('First verify a sign-in method already connected to this BTCBOX account.'));
  assert.ok(page.includes('Step 1 · Verify an existing method'));
  assert.ok(page.includes('Step 2 · Verify the new method'));
  assert.ok(page.includes('!identityLinkSourceVerified'));
});

test('source identity proof supports Google TOTP challenge and Web3 wallet proof', () => {
  assert.ok(auth.includes('identityLinkNeedsTwoFactor'));
  assert.ok(auth.includes('pendingIdentityLinkToken'));
  assert.ok(auth.includes('completeIdentityLinkReauthTwoFactor'));
  assert.ok(auth.includes('reauthenticateIdentityLinkWithWeb3'));
  assert.ok(auth.includes('Reverify my existing BTCBOX sign-in identity'));
  assert.ok(page.includes('Confirm existing identity'));
  assert.ok(page.includes('Authenticator code (required when account 2FA is enabled)'));
});

test('identity link API calls are cookie-bound and do not expose reauth marker or tokens in URL', () => {
  assert.ok(api.includes('/auth/link-identity/reauth'));
  assert.ok(api.includes('/auth/link-identity'));
  assert.ok(api.includes('credentials: "include"'));
  assert.equal(auth.includes('localStorage.setItem("identity_link'), false);
  assert.equal(auth.includes('sessionStorage.setItem("identity_link'), false);
  assert.equal(auth.includes('flow=link-target&token='), false);
});
