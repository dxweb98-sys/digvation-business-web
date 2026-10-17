/** Mirrors the Runtime role code rule: uppercase, 1 to 64 of letters, digits, dot, underscore, hyphen. */
export const ROLE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

/** Stable, readable code derived from a role name: "Kasir Senior" becomes "KASIR_SENIOR". */
export function roleCodeFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
    .replace(/_+$/g, '');
}
