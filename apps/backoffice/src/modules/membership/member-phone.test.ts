import { describe, expect, it } from 'vitest';

import { toCanonicalMemberPhone } from './member-phone';

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
