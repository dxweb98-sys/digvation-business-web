import { describe, expect, it } from 'vitest';

import { sanitizeNationalPhoneInput, toCanonicalPhone, toLocalPhoneDisplay } from './customer-input';

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

describe('national editable phone presentation', () => {
  it.each([
    ['0812 3456 7890', '081234567890'],
    ['+6281234567890', '081234567890'],
    ['6281234567890', '081234567890'],
    ['(0812)-3456.7890', '081234567890'],
  ])('%p becomes national digits %p', (input, expected) => {
    expect(sanitizeNationalPhoneInput(input)).toBe(expected);
  });

  it('initializes a canonical Indonesian number as national digits', () => {
    expect(toLocalPhoneDisplay('+6281234567890')).toBe('081234567890');
  });
});
