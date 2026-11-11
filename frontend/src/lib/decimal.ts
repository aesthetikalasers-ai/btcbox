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
