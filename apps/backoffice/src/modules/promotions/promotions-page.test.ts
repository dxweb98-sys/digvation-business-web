import { describe, expect, it } from 'vitest';
import { promotionTargetSummary, type PromotionCopy } from './promotions-page';
import type { Promotion } from './promotions-api';

const promotion: Promotion = {
  id: 'promotion-1',
  name: 'Variant promotion',
  enabled: true,
  mode: 'AUTOMATIC',
  code: null,
  scope: 'ITEM',
  audience: 'ALL',
  discountType: 'PERCENTAGE',
  discountValue: '0.1',
  currency: null,
  maximumDiscount: null,
  minimumPurchase: null,
  effectiveFrom: null,
  effectiveUntil: null,
  version: 1,
  itemIds: ['item-1'],
  variantIds: ['variant-1'],
  categoryIds: [],
  locationIds: [],
  status: 'ACTIVE',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

const copy = (key: 'item' | 'variants' | 'selected' | 'transaction' | 'category') =>
  ({
    item: 'Item',
    variants: 'Specific variants',
    selected: 'selected',
    transaction: 'Transaction',
    category: 'Category',
  })[key];

describe('Promotion variant target presentation', () => {
  it('keeps parent and specific variant target counts distinct', () => {
    expect(promotionTargetSummary(promotion, copy)).toBe('1 Item · 1 Specific variants');
  });
});
