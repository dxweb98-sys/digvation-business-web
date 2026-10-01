import { describe, expect, it } from 'vitest';

import { toCanonicalMemberPhone, toNationalMemberPhone } from './member-phone';

describe('toCanonicalMemberPhone', () => {
  it.each([
    ['081234567890', '+6281234567890'],
    ['6281234567890', '+6281234567890'],
    ['+6281234567890', '+6281234567890'],
    ['006281234567890', '+6281234567890'],
    ['0812 3456 7890', '+6281234567890'],
    ['+62 (812) 3456-7890', '+6281234567890'],
  ])('turns %s into %s', (typed, canonical) => {
    expect(toCanonicalMemberPhone(typed)).toBe(canonical);
  });

  it.each(['', '08', 'abc', '0812-abc', '+0812345678'])('rejects %s', (typed) => {
    expect(toCanonicalMemberPhone(typed)).toBeNull();
  });
});

describe('toNationalMemberPhone', () => {
  it('presents an Indonesian canonical number nationally', () => {
    expect(toNationalMemberPhone('+6281234567890')).toBe('081234567890');
  });

  it('keeps any other number as stored', () => {
    expect(toNationalMemberPhone('+12025550123')).toBe('+12025550123');
  });

  it('round-trips: presenting and re-saving never changes the canonical phone', () => {
    const stored = '+6281234567890';
    expect(toCanonicalMemberPhone(toNationalMemberPhone(stored))).toBe(stored);
  });
});
