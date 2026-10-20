import { describe, expect, it } from 'vitest';

import { settlementRefusal } from './settlement-recovery';

type Line = Parameters<typeof settlementRefusal>[0]['lines'][number];

const addition = (componentSource: 'FIXED_BOM' | 'SALE_SELECTED') =>
  ({ componentSource }) as NonNullable<Line['compositionComponents']>[number];

const line = (overrides: Partial<Line> = {}): Line => ({
  removedAt: null,
  discountType: 'PERCENTAGE',
  compositionComponents: [addition('SALE_SELECTED')],
  ...overrides,
});

const sale = (
  lines: Line[],
  payments: Array<{ status: 'SUCCEEDED' | 'PENDING'; appliedAmount: string }>,
  totalAmount = '249750.0000',
) => ({ totalAmount, payments, lines });

const paidInFull = [{ status: 'SUCCEEDED' as const, appliedAmount: '249750.0000' }];
const DISCOUNT = ['sales:read', 'sales:create', 'sales:discount'];
const CASHIER = ['sales:read', 'sales:create'];

describe('settlement refusal guidance', () => {
  it('keeps ordinary payment guidance while an amount is still open', () => {
    expect(
      settlementRefusal(
        sale([line()], [{ status: 'SUCCEEDED', appliedAmount: '100000.0000' }]),
        DISCOUNT,
      ),
    ).toBe('REMAINING_PAYMENT');
    expect(settlementRefusal(sale([line({ discountType: null })], []), DISCOUNT)).toBe(
      'REMAINING_PAYMENT',
    );
  });

  it('guides a re-application of the item discount on a fully paid transaction with additions', () => {
    expect(settlementRefusal(sale([line()], paidInFull), DISCOUNT)).toBe('ITEM_DISCOUNT_REPRICE');
    expect(
      settlementRefusal(sale([line({ discountType: 'FIXED_AMOUNT' })], paidInFull), DISCOUNT),
    ).toBe('ITEM_DISCOUNT_REPRICE');
  });

  it('sends an account without the discount permission to a Manager or Owner', () => {
    expect(settlementRefusal(sale([line()], paidInFull), CASHIER)).toBe(
      'ITEM_DISCOUNT_REPRICE_NEEDS_AUTHORIZATION',
    );
  });

  it('gives no discount guidance to unrelated settlement refusals', () => {
    // No item discount.
    expect(settlementRefusal(sale([line({ discountType: null })], paidInFull), DISCOUNT)).toBe(
      'UNSETTLED',
    );
    // Discount without sale-selected additions (none, or a fixed BOM only).
    expect(
      settlementRefusal(sale([line({ compositionComponents: [] })], paidInFull), DISCOUNT),
    ).toBe('UNSETTLED');
    expect(
      settlementRefusal(
        sale([line({ compositionComponents: [addition('FIXED_BOM')] })], paidInFull),
        DISCOUNT,
      ),
    ).toBe('UNSETTLED');
    // The affected line was removed.
    expect(
      settlementRefusal(sale([line({ removedAt: '2026-10-20T00:00:00Z' })], paidInFull), DISCOUNT),
    ).toBe('UNSETTLED');
    // A pending payment is its own case.
    expect(
      settlementRefusal(
        sale(
          [line()],
          [
            { status: 'SUCCEEDED', appliedAmount: '200000.0000' },
            { status: 'PENDING', appliedAmount: '49750.0000' },
          ],
        ),
        DISCOUNT,
      ),
    ).toBe('UNSETTLED');
  });
});
