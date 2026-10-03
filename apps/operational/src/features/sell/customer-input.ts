/** Indonesian calling code: the Operational default for a nationally written number. */
const DEFAULT_CALLING_CODE = '62';
const E164 = /^\+[1-9]\d{7,14}$/;

/** National digits for Indonesian Customer and Member editor fields. */
export function sanitizeNationalPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith(`00${DEFAULT_CALLING_CODE}`)) return `0${digits.slice(4)}`;
  if (digits.startsWith(DEFAULT_CALLING_CODE)) return `0${digits.slice(2)}`;
  return digits;
}

/** Kept for receipt delivery, whose input presentation is outside this feature's scope. */
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
 * National editable presentation: +6285155050951 -> 085155050951.
 * It round-trips through toCanonicalPhone.
 */
export function toLocalPhoneDisplay(e164: string): string {
  return e164.startsWith(`+${DEFAULT_CALLING_CODE}`)
    ? sanitizeNationalPhoneInput(e164)
    : e164;
}
