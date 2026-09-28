/** Display only: +6281234567890 -> 0812 3456 7890. The stored value is unchanged. */
export function formatPhoneForDisplay(phoneE164: string): string {
  const local = phoneE164.startsWith('+62') ? `0${phoneE164.slice(3)}` : phoneE164;
  return local.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}
