import { describe, expect, it } from 'vitest';

import { formatDecimalDisplay } from './decimal-display';

describe('formatDecimalDisplay', () => {
  it('drops insignificant scale from Runtime decimal strings', () => {
    expect(formatDecimalDisplay('1.0000', 'id-ID')).toBe('1');
    expect(formatDecimalDisplay('2.0000', 'en-US')).toBe('2');
    expect(formatDecimalDisplay('0.2500', 'en-US')).toBe('0.25');
  });

  it('uses the locale decimal separator', () => {
    expect(formatDecimalDisplay('1.5000', 'id-ID')).toBe('1,5');
    expect(formatDecimalDisplay('1.5000', 'en-US')).toBe('1.5');
  });

  it('groups large whole parts exactly without floating point', () => {
    expect(formatDecimalDisplay('12345678901234567.1250', 'id-ID')).toBe(
      '12.345.678.901.234.567,125',
    );
    expect(formatDecimalDisplay('1250.0000', 'en-US')).toBe('1,250');
  });

  it('keeps a negative sign only for a non-zero value and leaves unknown input untouched', () => {
    expect(formatDecimalDisplay('-1.5000', 'en-US')).toBe('-1.5');
    expect(formatDecimalDisplay('-0.0000', 'en-US')).toBe('0');
    expect(formatDecimalDisplay('n/a', 'en-US')).toBe('n/a');
  });
});
