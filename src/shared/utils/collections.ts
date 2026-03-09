/** Returns unique values while preserving first-seen order. */
export function uniqueValues<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Type guard for non-null object records. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
