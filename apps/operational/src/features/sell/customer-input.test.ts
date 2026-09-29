import { describe, expect, it } from 'vitest';

import {
  isCompleteNik,
  sanitizeNikInput,
  sanitizePhoneInput,
  toCanonicalPhone,
} from './customer-input';

describe('toCanonicalPhone', () => {
  it.each([
    ['081234567890', '+6281234567890'],
    ['6281234567890', '+6281234567890'],
    ['+6281234567890', '+6281234567890'],
    ['006281234567890', '+6281234567890'],
    ['0812-3456 7890', '+6281234567890'],
    ['(0812) 3456.7890', '+6281234567890'],
    ['08192381923', '+628192381923'],
  ])('%p becomes %p', (raw, expected) => {
    expect(toCanonicalPhone(raw)).toBe(expected);
  });

  it.each(['', '   ', '0', '08', '+', '+62', 'abc', '0812abc', '+0812345678', '+62 (81) x'])(
    'rejects %p instead of prefixing +62 onto it',
    (raw) => {
      expect(toCanonicalPhone(raw)).toBeNull();
    },
  );
});

describe('sanitizePhoneInput', () => {
  it('keeps the friendly local value and never rewrites it to +62', () => {
    expect(sanitizePhoneInput('081234567890')).toBe('081234567890');
    expect(sanitizePhoneInput('0812-3456 7890')).toBe('0812-3456 7890');
  });

  it('drops characters a phone number cannot contain', () => {
    expect(sanitizePhoneInput('08ab12#3')).toBe('08123');
  });
});

describe('NIK input', () => {
  it('removes letters and punctuation', () => {
    expect(sanitizeNikInput('12ab34-56')).toBe('123456');
  });

  it('caps a longer paste at 16 digits', () => {
    expect(sanitizeNikInput('12345678901234567')).toBe('1234567890123456');
    expect(sanitizeNikInput('1234 5678 9012 3456 78')).toBe('1234567890123456');
  });

  it('requires exactly 16 digits', () => {
    expect(isCompleteNik('123456789012345')).toBe(false);
    expect(isCompleteNik('1234567890123456')).toBe(true);
    expect(isCompleteNik('12345678901234567')).toBe(false);
    expect(isCompleteNik('123456789012345a')).toBe(false);
  });
});
