const SECURE_LINK_TOKEN = /^[A-Za-z0-9_-]{43,128}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export function readSecureTokenFromHash(hash: string): string | null {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  const token = new URLSearchParams(value).get('token');
  return token && SECURE_LINK_TOKEN.test(token) ? token : null;
}

export function removeSecureTokenFromAddress(): void {
  if (typeof window === 'undefined' || !window.location.hash) return;
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
}

export function normalizeIndonesianPhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!compact) return '';
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('08')) return `+62${compact.slice(1)}`;
  if (compact.startsWith('8')) return `+62${compact}`;
  if (compact.startsWith('62')) return `+${compact}`;
  return compact;
}

export function isE164(value: string): boolean {
  return E164.test(value);
}

export function whatsappChatUrl(phoneE164: string): string | null {
  if (!isE164(phoneE164)) return null;
  return `https://wa.me/${phoneE164.slice(1)}`;
}
