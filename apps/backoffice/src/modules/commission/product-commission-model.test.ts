import { describe, expect, it } from 'vitest';

import {
  commissionPerItemLabel,
  selectableProducts,
  trimCommissionAmount,
  validateCommissionAmount,
} from './product-commission-model';

describe('product commission amount', () => {
  it.each(['5000', '7500.5', '0.5', '0.0001', ' 5000 '])('accepts %p', (value) => {
    expect(validateCommissionAmount(value)).toBeNull();
  });

  it.each(['', '   ', '0', '0.0000', '-1', '-5000', '1.00001', '1e3', 'abc', '1,5'])(
    'rejects %p',
    (value) => {
      expect(validateCommissionAmount(value)).not.toBeNull();
    },
  );

  it('formats exact text per item without floating-point money', () => {
    expect(trimCommissionAmount('5000.0000')).toBe('5000');
    expect(trimCommissionAmount('7500.5000')).toBe('7500.5');
    expect(commissionPerItemLabel('5000.0000', 'IDR')).toBe('Rp5.000 / item');
    expect(commissionPerItemLabel('1234567.5000', 'IDR')).toBe('Rp1.234.567,5 / item');
    expect(commissionPerItemLabel('2.0000', 'USD')).toBe('USD 2 / item');
  });
});

describe('selectable commission Products', () => {
  const items = [
    { id: 'p1', type: 'PRODUCT' },
    { id: 'p2', type: 'PRODUCT' },
    { id: 's1', type: 'SERVICE' },
  ];

  it('excludes Services and already configured Products', () => {
    expect(selectableProducts(items, [{ catalogItemId: 'p1' }]).map((item) => item.id)).toEqual([
      'p2',
    ]);
  });

  it('never offers a Service even when nothing is configured', () => {
    expect(selectableProducts(items, []).map((item) => item.id)).toEqual(['p1', 'p2']);
  });
});
