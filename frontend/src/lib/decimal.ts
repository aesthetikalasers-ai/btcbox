/** Exact multiplication for non-negative decimal input; never rounds financial strings. */
export function multiplyDecimalStrings(left: string, right: string): string | undefined {
  const decimal = /^(\d+)(?:\.(\d+))?$/;
  if (left.length > 128 || right.length > 128) return undefined;
  const a = decimal.exec(left), b = decimal.exec(right);
  if (!a || !b) return undefined;
  const scale = (a[2]?.length || 0) + (b[2]?.length || 0);
  const product = (BigInt(a[1] + (a[2] || "")) * BigInt(b[1] + (b[2] || ""))).toString();
  if (!scale) return product;
  const padded = product.padStart(scale + 1, "0");
  return (padded.slice(0, -scale) + "." + padded.slice(-scale)).replace(/0+$/, "").replace(/\.$/, "");
}

/** Exact non-negative balance comparison. Invalid values fail closed. */
export function compareDecimalStrings(left: string, right: string): number | undefined {
  const decimal = /^(\d+)(?:\.(\d+))?$/;
  if (left.length > 256 || right.length > 256) return undefined;
  const a = decimal.exec(left), b = decimal.exec(right);
  if (!a || !b) return undefined;
  const scale = Math.max(a[2]?.length || 0, b[2]?.length || 0);
  const x = BigInt(a[1] + (a[2] || "").padEnd(scale, "0"));
  const y = BigInt(b[1] + (b[2] || "").padEnd(scale, "0"));
  return x === y ? 0 : x > y ? 1 : -1;
}


function decimalParts(value: string): { whole: bigint; scale: number } | undefined {
  if (value.length > 128) return undefined;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return undefined;
  const fraction = match[2] || "";
  return { whole: BigInt(match[1] + fraction), scale: fraction.length };
}

function formatScaledDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  if (scale === 0) return (negative ? "-" : "") + absolute.toString();
  const padded = absolute.toString().padStart(scale + 1, "0");
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, "");
  return (negative ? "-" : "") + whole + (fraction ? "." + fraction : "");
}

/** True only when a non-negative decimal is an exact multiple of the market step. */
export function isDecimalMultipleOfStep(value: string, step: string): boolean {
  const a = decimalParts(value), b = decimalParts(step);
  if (!a || !b || b.whole <= 0n) return false;
  const scale = Math.max(a.scale, b.scale);
  const valueInt = a.whole * 10n ** BigInt(scale - a.scale);
  const stepInt = b.whole * 10n ** BigInt(scale - b.scale);
  return valueInt > 0n && valueInt % stepInt === 0n;
}

/** Add or subtract one exact market step without floating-point drift. */
export function addDecimalStep(value: string, step: string, direction: 1 | -1): string {
  const a = decimalParts(value), b = decimalParts(step);
  if (!a || !b || b.whole <= 0n) return "";
  const scale = Math.max(a.scale, b.scale);
  const valueInt = a.whole * 10n ** BigInt(scale - a.scale);
  const stepInt = b.whole * 10n ** BigInt(scale - b.scale);
  const next = valueInt + BigInt(direction) * stepInt;
  return formatScaledDecimal(next > 0n ? next : 0n, scale);
}

/** Round a non-negative decimal down to the nearest valid market step. */
export function floorDecimalToStep(value: string, step: string): string {
  const a = decimalParts(value), b = decimalParts(step);
  if (!a || !b || b.whole <= 0n) return "";
  const scale = Math.max(a.scale, b.scale);
  const valueInt = a.whole * 10n ** BigInt(scale - a.scale);
  const stepInt = b.whole * 10n ** BigInt(scale - b.scale);
  return formatScaledDecimal((valueInt / stepInt) * stepInt, scale);
}

/** Round a non-negative decimal to the nearest valid market step. */
export function roundDecimalToStep(value: string, step: string): string {
  const a = decimalParts(value), b = decimalParts(step);
  if (!a || !b || b.whole <= 0n) return "";
  const scale = Math.max(a.scale, b.scale);
  const valueInt = a.whole * 10n ** BigInt(scale - a.scale);
  const stepInt = b.whole * 10n ** BigInt(scale - b.scale);
  const quotient = valueInt / stepInt, remainder = valueInt % stepInt;
  const rounded = remainder * 2n >= stepInt ? quotient + 1n : quotient;
  return formatScaledDecimal(rounded * stepInt, scale);
}
