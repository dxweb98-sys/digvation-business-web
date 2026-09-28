/**
 * Accepts the phone formats Indonesian operators actually type
 * (0812 3456 7890, 81234567890, +62 812-3456-7890, 62812…) and returns the
 * E.164 form the Customer API stores. Returns null when the input is not a
 * plausible phone number.
 */
export function normalizeIndonesianPhone(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, '');
  if (!compact) return null;

  let digits: string;
  if (compact.startsWith('+')) digits = compact.slice(1);
  else if (compact.startsWith('00')) digits = compact.slice(2);
  else if (compact.startsWith('62')) digits = compact;
  else if (compact.startsWith('0')) digits = `62${compact.slice(1)}`;
  else digits = `62${compact}`;

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}
