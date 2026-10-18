/** Indonesian calling code: the Backoffice default for a nationally written number. */
const DEFAULT_CALLING_CODE = '62';
const E164 = /^\+[1-9]\d{7,14}$/;

/** National digits for Customer and Member editor fields. */
export function sanitizeNationalMemberPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith(`00${DEFAULT_CALLING_CODE}`)) return `0${digits.slice(4)}`;
  if (digits.startsWith(DEFAULT_CALLING_CODE)) return `0${digits.slice(2)}`;
  return digits;
}

/**
 * Converts a typed phone number to canonical E.164 for Member management.
 *
 * 081234567890 / 6281234567890 / +6281234567890 / 0062... all become +6281234567890.
 * Returns null when no valid international number can be formed. Runtime remains the final
 * validation authority and the uniqueness authority for Member phones.
 */
export function toCanonicalMemberPhone(raw: string): string | null {
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
 * Indonesian national presentation of a canonical Member phone for Backoffice Member screens:
 * +6281234567890 → 081234567890. Presentation only; any other number is shown as stored.
 */
export function toNationalMemberPhone(canonical: string): string {
  return canonical.startsWith(`+${DEFAULT_CALLING_CODE}`)
    ? sanitizeNationalMemberPhone(canonical)
    : canonical;
}
