'use strict';

// Validate the standard IBAN structure and ISO 13616 mod-97 checksum.
// Whitespace is ignored so users may paste a conventionally grouped IBAN.
function isValidIban(value) {
  const iban = String(value || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

module.exports = { isValidIban };
