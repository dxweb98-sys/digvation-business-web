import { describe, expect, it } from 'vitest';

import {
  adjustmentAmountForRequest,
  parsePoints,
  pointsToString,
  previewAdjustment,
  sanitizePointsInput,
} from './member-points-model';

describe('member points model', () => {
  it('previews an addition: current 300 + 200 = 500', () => {
    expect(previewAdjustment('300.0000', '200', 'ADD')).toEqual({
      current: '300.0000',
      adjustment: '200.0000',
      result: '500.0000',
      wouldBeNegative: false,
    });
  });

  it('previews a subtraction and allows reaching exactly zero', () => {
    expect(previewAdjustment('300.0000', '120.5', 'SUBTRACT')).toMatchObject({
      adjustment: '-120.5000',
      result: '179.5000',
      wouldBeNegative: false,
    });
    expect(previewAdjustment('300.0000', '300', 'SUBTRACT')).toMatchObject({
      result: '0.0000',
      wouldBeNegative: false,
    });
  });

  it('flags a subtraction that would make the balance negative', () => {
    expect(previewAdjustment('100.0000', '100.0001', 'SUBTRACT')).toMatchObject({
      result: '-0.0001',
      wouldBeNegative: true,
    });
  });

  it('is exact for values beyond float precision', () => {
    expect(previewAdjustment('9007199254740993.0001', '1', 'ADD')?.result).toBe(
      '9007199254740994.0001',
    );
  });

  it.each(['', '0', '0.0000', 'abc', '-5', '1.00001', '1e3'])('has no preview for %p', (amount) => {
    expect(previewAdjustment('10.0000', amount, 'ADD')).toBeNull();
  });

  it('sanitizes typing to digits and at most 4 decimals', () => {
    expect(sanitizePointsInput('1a2,34567')).toBe('12.3456');
    expect(sanitizePointsInput('-5')).toBe('5');
    expect(sanitizePointsInput('1.2.3')).toBe('1.23');
  });

  it('normalizes the request amount', () => {
    expect(adjustmentAmountForRequest('0200')).toBe('200');
    expect(adjustmentAmountForRequest('12.50')).toBe('12.5');
    expect(adjustmentAmountForRequest('0')).toBeNull();
  });

  it('round-trips canonical strings', () => {
    expect(pointsToString(parsePoints('18750')!)).toBe('18750.0000');
  });
});
