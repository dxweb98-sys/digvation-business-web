/** Indonesian calling code: the Operational default for a nationally written number. */
const DEFAULT_CALLING_CODE = '62';
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Keeps what a cashier legitimately types in a phone field (digits, a leading +, spaces and
 * common separators) so the visible value stays friendly and local. It never rewrites the number.
 */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+\s().-]/g, '');
}

/**
 * The single Operational conversion of a typed phone number to canonical E.164.
 *
 * 081234567890 / 6281234567890 / +6281234567890 / 0062... all become +6281234567890.
 * Returns null when no valid international number can be formed. Web normalization is a
 * convenience: Runtime remains the final validation authority.
 */
export function toCanonicalPhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  let candidate: string;
  if (compact.startsWith('+')) candidate = compact;
  else if (compact.startsWith('00')) candidate = `+${compact.slice(2)}`;
  else if (compact.startsWith(DEFAULT_CALLING_CODE)) candidate = `+${compact}`;
  else candidate = `+${DEFAULT_CALLING_CODE}${compact.replace(/^0+/, '')}`;

  return E164.test(candidate) ? candidate : null;
}

/**
 * Friendly local display for an Indonesian canonical number: +6285155050951 -> 0851 5505 0951.
 * Other regions keep their international form. It round-trips through toCanonicalPhone.
 */
export function toLocalPhoneDisplay(e164: string): string {
  if (!e164.startsWith(`+${DEFAULT_CALLING_CODE}`)) return e164;
  const national = `0${e164.slice(DEFAULT_CALLING_CODE.length + 1)}`;
  return national.replace(/(\d{4})(?=\d)/g, '$1 ');
}
