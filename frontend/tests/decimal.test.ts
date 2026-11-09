import { test } from 'node:test';
import assert from 'node:assert/strict';
import { multiplyDecimalStrings } from '../src/lib/decimal.ts';

test('fractional order estimate has no floating-point artifacts', () => {
  assert.equal(multiplyDecimalStrings('0.1', '0.2'), '0.02');
  assert.equal(multiplyDecimalStrings('0.00000001', '0.00000001'), '0.0000000000000001');
});
test('amounts beyond Number safe precision remain exact', () => {
  assert.equal(multiplyDecimalStrings('9007199254740993', '1.01'), '9097271247288402.93');
  assert.equal(multiplyDecimalStrings('00012.50', '2.00'), '25');
  assert.equal(multiplyDecimalStrings('0', '9.99'), '0');
});
test('invalid and unbounded numeric inputs fail closed', () => {
  for (const value of ['-1', '1e8', 'Infinity', 'NaN', '', '.5', '1'.repeat(129)]) {
    assert.equal(multiplyDecimalStrings(value, '2'), undefined);
  }
});
