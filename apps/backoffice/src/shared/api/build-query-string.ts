export type QueryStringValue = string | number | boolean | null | undefined;

/**
 * Build URL query parameters while omitting values that mean "not provided".
 *
 * Null, undefined, and empty strings are omitted. Zero and false are preserved.
 */
export function buildQueryString(input: Record<string, QueryStringValue>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  return params.toString();
}
