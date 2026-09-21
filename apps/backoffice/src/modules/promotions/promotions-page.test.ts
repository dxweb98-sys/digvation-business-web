import { describe, expect, it } from 'vitest';
import {
  filterPromotionItemTargets,
  promotionTargetSummary,
  type PromotionCopy,
} from './promotions-page';
import type { Promotion, PromotionReferenceOption } from './promotions-api';

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

describe('Promotion target search', () => {
  const items: PromotionReferenceOption[] = [
    { id: 'item-body', name: 'Body Bleaching', code: 'SVC-000008', categoryId: null },
    { id: 'item-brow', name: 'Brow Treatment', code: 'SVC-000006', categoryId: null },
  ];

  const variants: PromotionReferenceOption[] = [
    {
      id: 'variant-bomber',
      name: 'Brow Treatment — Brow Bomber',
      code: 'VAR-000012',
      categoryId: null,
      catalogItemId: 'item-brow',
    },
    {
      id: 'variant-henna',
      name: 'Brow Treatment — Brown Henna',
      code: 'VAR-000011',
      categoryId: null,
      catalogItemId: 'item-brow',
    },
  ];

  it('keeps the parent context when only a variant matches', () => {
    const result = filterPromotionItemTargets(items, variants, 'Brown Henna');

    expect(result).toHaveLength(1);
    expect(result[0]?.item.id).toBe('item-brow');
    expect(result[0]?.variants.map((variant) => variant.id)).toEqual(['variant-henna']);
  });

  it('shows all child variants when the parent matches', () => {
    const result = filterPromotionItemTargets(items, variants, 'SVC-000006');

    expect(result).toHaveLength(1);
    expect(result[0]?.item.id).toBe('item-brow');
    expect(result[0]?.variants.map((variant) => variant.id)).toEqual([
      'variant-bomber',
      'variant-henna',
    ]);
  });

  it('matches variant codes without flattening the hierarchy', () => {
    const result = filterPromotionItemTargets(items, variants, 'VAR-000011');

    expect(result).toHaveLength(1);
    expect(result[0]?.item.id).toBe('item-brow');
    expect(result[0]?.variants.map((variant) => variant.id)).toEqual(['variant-henna']);
  });
});
