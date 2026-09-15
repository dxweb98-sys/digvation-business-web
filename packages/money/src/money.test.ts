import { describe, expect, it } from 'vitest';

import { addDecimalStrings, compareDecimalStrings, subtractDecimalStrings } from './money';

describe('money helpers', () => {
  it('does not use floating-point arithmetic for addition', () => {
    expect(addDecimalStrings('0.1', '0.2')).toBe('0.3');
  });

  it('subtracts decimal strings deterministically', () => {
    expect(subtractDecimalStrings('100000.10', '0.10')).toBe('100000');
  });

  it('compares decimal strings', () => {
    expect(compareDecimalStrings('10.0000', '10')).toBe(0);
  });
});
