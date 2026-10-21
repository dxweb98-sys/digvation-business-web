import { describe, expect, it } from 'vitest';

import type { SaleAdjustment } from './cashier-transaction.types';
import { additionDiscountNote } from './sale-presentation';

type Line = Parameters<typeof additionDiscountNote>[1];

const component = (componentSource: 'FIXED_BOM' | 'SALE_SELECTED') =>
  ({ componentSource }) as NonNullable<Line['compositionComponents']>[number];

const line = (overrides: Partial<Line> = {}): Line => ({
  id: 'line-1',
  compositionComponents: [component('SALE_SELECTED')],
  discountType: null,
  lineDiscountAmount: '0.0000',
  orderDiscountAllocationAmount: '0.0000',
  overrideAmount: null,
  ...overrides,
});

const adjustment = (
  scope: SaleAdjustment['scope'],
  saleLineId: string | null,
  source: SaleAdjustment['source'] = 'PROMOTION',
) => ({ scope, saleLineId, source, actualAmount: '20000.0000' }) as SaleAdjustment;

const manualItem = { discountType: 'PERCENTAGE' as const, lineDiscountAmount: '20000.0000' };

describe('additional-item discount explanation', () => {
  it('explains a manual item discount on a line with selected additions', () => {
    expect(additionDiscountNote({ adjustments: [] }, line(manualItem))).toBe('ITEM_ONLY');
  });

  it('explains an ITEM or CATEGORY Promotion on that line', () => {
    for (const scope of ['ITEM', 'CATEGORY'] as const)
      expect(additionDiscountNote({ adjustments: [adjustment(scope, 'line-1')] }, line())).toBe(
        'ITEM_ONLY',
      );
  });

  it('distinguishes the item part when a transaction discount is also shared by the additions', () => {
    expect(
      additionDiscountNote(
        { adjustments: [] },
        line({ ...manualItem, orderDiscountAllocationAmount: '5000.0000' }),
      ),
    ).toBe('ITEM_AND_TRANSACTION');
  });

  it('stays silent for a transaction discount or Promotion only', () => {
    expect(
      additionDiscountNote(
        { adjustments: [adjustment('TRANSACTION', null)] },
        line({ orderDiscountAllocationAmount: '5000.0000' }),
      ),
    ).toBeNull();
  });

  it('stays silent without selected additions, without a discount, or on an overridden price', () => {
    expect(
      additionDiscountNote(
        { adjustments: [] },
        line({ ...manualItem, compositionComponents: [component('FIXED_BOM')] }),
      ),
    ).toBeNull();
    expect(additionDiscountNote({ adjustments: [] }, line())).toBeNull();
    expect(
      additionDiscountNote({ adjustments: [] }, line({ ...manualItem, overrideAmount: '150000' })),
    ).toBeNull();
    // A Promotion on another line says nothing about this one.
    expect(
      additionDiscountNote({ adjustments: [adjustment('ITEM', 'line-2')] }, line()),
    ).toBeNull();
  });
});
