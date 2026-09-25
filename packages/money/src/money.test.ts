import { describe, expect, it } from 'vitest';

import {
  addDecimalStrings,
  compareDecimalStrings,
  formatDecimalNumber,
  formatMoney,
  formatPercentageFromRate,
  percentageValueFromRate,
  subtractDecimalStrings,
} from './money';

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

  it('uses currency minor units by default', () => {
    expect(formatMoney('110000.0000', 'IDR', 'id-ID')).toBe(
      formatMoney('110000', 'IDR', 'id-ID'),
    );
    expect(formatMoney('12.50', 'USD', 'en-US')).toBe('$12.50');
  });

  it('normalizes quantities without falsifying fractions', () => {
    expect(formatDecimalNumber('1.0000', 'id-ID')).toBe('1');
    expect(formatDecimalNumber('1.2500', 'id-ID')).toBe('1,25');
  });

  it('normalizes fractional rates as percentages', () => {
    expect(percentageValueFromRate('0.1100')).toBe('11');
    expect(percentageValueFromRate('0.1050')).toBe('10.5');
    expect(formatPercentageFromRate('0.1100', 'id-ID')).toBe('11%');
    expect(formatPercentageFromRate('0.1050', 'id-ID')).toBe('10,5%');
  });
});
