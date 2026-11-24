'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../api-core');

test('clientIp returns a bounded normalized address from the proxy chain', () => {
  assert.equal(_test.clientIp({ headers: { 'x-forwarded-for': ' 203.0.113.7, 10.0.0.1 ' } }), '203.0.113.7');
  assert.equal(_test.clientIp({ headers: { 'X-Forwarded-For': '2001:DB8::1' } }), '2001:db8::1');
});

test('clientIp fails closed to a stable anonymous bucket for malformed or missing proxy headers', () => {
  assert.equal(_test.clientIp({ headers: { 'x-forwarded-for': 'unexpected value' } }), 'unknown');
  assert.equal(_test.clientIp({}), 'unknown');
});
