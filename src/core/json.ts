/** Stable serialization is shared by plan comparison, receipts and fixture hashes. */
export function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, sorted(item)]));
  }
  return value;
}
export function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}
export function json(value: unknown): string { return JSON.stringify(sorted(value), null, 2) + '\n'; }
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** JavaScript's $ also matches before a final newline; validation requires the entire value. */
export function fullMatch(pattern: RegExp, value: string): boolean { return pattern.exec(value)?.[0] === value; }
