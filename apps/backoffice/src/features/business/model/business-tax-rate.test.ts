import { describe, expect, it } from 'vitest';

import {
  isValidTaxPercentage,
  percentageFromTaxRate,
  taxRateFromPercentage,
} from './business-tax-rate';

describe('business tax rate', () => {
  it('converts between stored rates and percentages exactly', () => {
    expect(percentageFromTaxRate('0.11')).toBe('11');
    expect(percentageFromTaxRate('0.125')).toBe('12.5');
    expect(percentageFromTaxRate('0.0725')).toBe('7.25');
    expect(percentageFromTaxRate('1')).toBe('100');
    expect(taxRateFromPercentage('11')).toBe('0.11');
    expect(taxRateFromPercentage('12.5')).toBe('0.125');
    expect(taxRateFromPercentage('7.25')).toBe('0.0725');
    expect(taxRateFromPercentage('0')).toBe('0');
    expect(taxRateFromPercentage('100')).toBe('1');
  });

  it('accepts only percentages from 0 to 100', () => {
    expect(isValidTaxPercentage('0')).toBe(true);
    expect(isValidTaxPercentage('11')).toBe(true);
    expect(isValidTaxPercentage('100')).toBe(true);
    expect(isValidTaxPercentage('')).toBe(false);
    expect(isValidTaxPercentage('100.5')).toBe(false);
    expect(isValidTaxPercentage('-1')).toBe(false);
    expect(isValidTaxPercentage('abc')).toBe(false);
  });
});
