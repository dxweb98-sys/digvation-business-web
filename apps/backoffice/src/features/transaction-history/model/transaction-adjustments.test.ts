import { describe, expect, it } from 'vitest';

import type { SaleAdjustment } from '../api/transaction-history-api';
import { discountBreakdown } from './transaction-adjustments';
import { testAdjustment, testLine, testProductLine, testSale } from './transaction-test-fixtures';

const sale = (adjustments: SaleAdjustment[], discountAmount: string, change = {}) =>
  testSale({ adjustments, discountAmount, lines: [testLine(), testProductLine()], ...change });

describe('discountBreakdown', () => {
  it('is empty without promotions or discounts', () => {
    const result = discountBreakdown(sale([], '0.0000'));
    expect(result).toMatchObject({
      entries: [],
      total: '0.0000',
      reconciles: true,
      promotionCode: null,
    });
    expect(result.byLine.size).toBe(0);
  });

  it('attaches an item-level promotion to its line and names the item', () => {
    const result = discountBreakdown(sale([testAdjustment()], '40000.0000'));
    expect(result.byLine.get('line-service')!.map((a) => a.label)).toEqual([
      'Promo Member Oktober',
    ]);
    expect(result.entries[0]).toMatchObject({ itemName: 'Hair Coloring' });
  });

  it('attaches an item-level manual discount with its reason', () => {
    const manual = testAdjustment({
      id: 'manual',
      source: 'MANUAL_DISCOUNT',
      label: 'Diskon manual',
      saleLineId: 'line-product',
      actualAmount: '10000.0000',
      reason: 'Kemasan rusak',
    });
    const result = discountBreakdown(sale([manual], '10000.0000'));
    expect(result.byLine.get('line-product')![0]!.reason).toBe('Kemasan rusak');
  });

  it('keeps transaction and category adjustments out of any single item', () => {
    const transaction = testAdjustment({
      id: 'trx',
      scope: 'TRANSACTION',
      saleLineId: null,
      label: 'Promo Akhir Pekan',
      type: 'PERCENTAGE',
      configuredValue: '10.0000',
      actualAmount: '34000.0000',
    });
    const category = testAdjustment({ id: 'cat', scope: 'CATEGORY', saleLineId: 'line-product' });
    const result = discountBreakdown(sale([transaction, category], '74000.0000'));
    expect(result.byLine.size).toBe(0);
    expect(result.entries.map((entry) => entry.itemName)).toEqual([null, null]);
  });

  it('reconciles several adjustments to the aggregate discount exactly, never adding to it', () => {
    const result = discountBreakdown(
      sale(
        [
          testAdjustment({ id: 'a', actualAmount: '100000.0000' }),
          testAdjustment({ id: 'b', source: 'MANUAL_DISCOUNT', actualAmount: '50000.1000' }),
          testAdjustment({ id: 'zero', actualAmount: '0.0000' }),
        ],
        '150000.1000',
      ),
    );
    expect(result.entries).toHaveLength(2);
    expect(result).toMatchObject({ total: '150000.1000', reconciles: true });
    expect(discountBreakdown(sale([testAdjustment()], '50000.0000')).reconciles).toBe(false);
  });

  it('keeps a meaningful promotion code and drops blank ones', () => {
    expect(
      discountBreakdown(sale([testAdjustment()], '40000.0000', { promotionCode: ' OKTOBER25 ' }))
        .promotionCode,
    ).toBe('OKTOBER25');
    expect(
      discountBreakdown(sale([testAdjustment()], '40000.0000', { promotionCode: '  ' }))
        .promotionCode,
    ).toBeNull();
  });

  it('ignores adjustments of retired lines', () => {
    const retired = testSale({
      adjustments: [testAdjustment({ saleLineId: 'gone' })],
      discountAmount: '0.0000',
      lines: [testLine(), testLine({ id: 'gone', removedAt: '2026-10-01T04:00:00.000Z' })],
    });
    expect(discountBreakdown(retired).entries).toEqual([]);
  });
});
