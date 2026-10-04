/**
 * Anything a caller may pass from a conditional expression: a class string, or
 * the falsy half of a guard (`cond && 'x'` yields `false`, `''`, `0`, `0n` or
 * `undefined` when `cond` is a `ReactNode`).
 */
export type ClassValue = string | number | bigint | boolean | null | undefined;

/**
 * Minimal class joiner. The panel needs `clsx`/`tailwind-merge` behaviour only
 * in its most basic form — every call site composes complete class strings —
 * so a dependency would be more weight than the feature.
 *
 * Only strings survive: a falsy guard must vanish rather than print `"false"`,
 * and a number would only ever be a mistake in a class list.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ');
}
