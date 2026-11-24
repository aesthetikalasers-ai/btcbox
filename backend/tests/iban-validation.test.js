'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidIban } = require('../bank-account-validation');

test('accepts structurally valid IBANs with correct ISO 13616 checksum', () => {
  assert.equal(isValidIban('DE89370400440532013000'), true);
  assert.equal(isValidIban('GB82 WEST 1234 5698 7654 32'), true);
  assert.equal(isValidIban('FR1420041010050500013M02606'), true);
});

test('rejects invalid IBAN checksum and malformed values', () => {
  assert.equal(isValidIban('DE89370400440532013001'), false);
  assert.equal(isValidIban('DE00 3704 0044 0532 0130 00'), false);
  assert.equal(isValidIban('not-an-iban'), false);
  assert.equal(isValidIban(''), false);
});
