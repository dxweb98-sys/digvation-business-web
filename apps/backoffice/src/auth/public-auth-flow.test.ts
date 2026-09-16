import { describe, expect, it } from 'vitest';
import {
  isE164,
  normalizeIndonesianPhone,
  readSecureTokenFromHash,
  whatsappChatUrl,
} from './public-auth-flow';

describe('public auth link helpers', () => {
  it('reads only a valid opaque secure token from the URL fragment', () => {
    const token = 'A'.repeat(43);
    expect(readSecureTokenFromHash(`#token=${token}`)).toBe(token);
    expect(readSecureTokenFromHash('#token=123456')).toBeNull();
    expect(readSecureTokenFromHash('#other=value')).toBeNull();
  });

  it('normalizes common Indonesian phone input without claiming WhatsApp availability', () => {
    expect(normalizeIndonesianPhone('0812 3456-7890')).toBe('+6281234567890');
    expect(normalizeIndonesianPhone('81234567890')).toBe('+6281234567890');
    expect(normalizeIndonesianPhone('6281234567890')).toBe('+6281234567890');
    expect(isE164('+6281234567890')).toBe(true);
  });

  it('builds a safe WhatsApp support URL containing only the registered destination number', () => {
    expect(whatsappChatUrl('+6281234567890')).toBe('https://wa.me/6281234567890');
    expect(whatsappChatUrl('081234567890')).toBeNull();
  });
});
