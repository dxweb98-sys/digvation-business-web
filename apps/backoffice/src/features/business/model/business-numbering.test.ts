import { describe, expect, it } from 'vitest';

import { isValidNumberingPadding, isValidNumberingPrefix } from './business-numbering';

describe('business numbering rules', () => {
  it('accepts uppercase prefixes of up to 16 characters', () => {
    expect(isValidNumberingPrefix('PRD')).toBe(true);
    expect(isValidNumberingPrefix('INV-2026_A')).toBe(true);
    expect(isValidNumberingPrefix('A'.repeat(16))).toBe(true);
    expect(isValidNumberingPrefix('A'.repeat(17))).toBe(false);
    expect(isValidNumberingPrefix('prd')).toBe(false);
    expect(isValidNumberingPrefix('-PRD')).toBe(false);
    expect(isValidNumberingPrefix('')).toBe(false);
  });

  it('accepts a whole number of digits from 1 to 12', () => {
    expect(isValidNumberingPadding('1')).toBe(true);
    expect(isValidNumberingPadding('12')).toBe(true);
    expect(isValidNumberingPadding('0')).toBe(false);
    expect(isValidNumberingPadding('13')).toBe(false);
    expect(isValidNumberingPadding('6.5')).toBe(false);
    expect(isValidNumberingPadding('')).toBe(false);
  });
});
