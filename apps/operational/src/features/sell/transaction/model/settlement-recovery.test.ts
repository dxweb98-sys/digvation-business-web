import { describe, expect, it } from 'vitest';

import { settlementRefusal } from './settlement-recovery';

type Line = Parameters<typeof settlementRefusal>[0]['lines'][number];

const addition = (componentSource: 'FIXED_BOM' | 'SALE_SELECTED') =>
  ({ componentSource }) as NonNullable<Line['compositionComponents']>[number];

const line = (overrides: Partial<Line> = {}): Line => ({
  id: 'line-1',
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

describe('item promotion recovery', () => {
  const promoted = (
    lines: Line[],
    saleLineId: string | null = 'line-1',
    payments = paidInFull,
  ) => ({
    ...sale(lines, payments),
    adjustments: [{ source: 'PROMOTION' as const, saleLineId }],
  });
  const UPDATE = ['sales:read', 'sales:update'];
  const PROMOTIONS = ['PROMOTIONS'];

  it('offers the Promotion refresh to an account that may update the transaction', () => {
    expect(settlementRefusal(promoted([line({ discountType: null })]), UPDATE, PROMOTIONS)).toBe(
      'PROMOTION_REPRICE',
    );
    // One refresh re-prices an item discount on the same line too.
    expect(settlementRefusal(promoted([line()]), [...UPDATE, 'sales:discount'], PROMOTIONS)).toBe(
      'PROMOTION_REPRICE',
    );
  });

  it('sends an account without the update permission to a Manager or Owner', () => {
    expect(settlementRefusal(promoted([line({ discountType: null })]), CASHIER, PROMOTIONS)).toBe(
      'PROMOTION_REPRICE_NEEDS_AUTHORIZATION',
    );
  });

  it('offers no Promotion guidance where Promotions are disabled', () => {
    // Runtime refuses the refresh for every account, so nobody is pointed at it.
    expect(settlementRefusal(promoted([line({ discountType: null })]), UPDATE, [])).toBe(
      'UNSETTLED',
    );
    // A manual item discount on the same line keeps its own guidance.
    expect(settlementRefusal(promoted([line()]), DISCOUNT, [])).toBe('ITEM_DISCOUNT_REPRICE');
  });

  it('gives no Promotion guidance where the rule did not change anything', () => {
    // A transaction Promotion is not tied to a line.
    expect(
      settlementRefusal(promoted([line({ discountType: null })], null), UPDATE, PROMOTIONS),
    ).toBe('UNSETTLED');
    // A line Promotion on an item without sale-selected additions.
    expect(
      settlementRefusal(
        promoted([line({ discountType: null, compositionComponents: [addition('FIXED_BOM')] })]),
        UPDATE,
        PROMOTIONS,
      ),
    ).toBe('UNSETTLED');
    // An amount is still open: ordinary payment guidance.
    expect(
      settlementRefusal(
        promoted([line({ discountType: null })], 'line-1', [
          { status: 'SUCCEEDED', appliedAmount: '100000.0000' },
        ]),
        UPDATE,
        PROMOTIONS,
      ),
    ).toBe('REMAINING_PAYMENT');
  });
});
