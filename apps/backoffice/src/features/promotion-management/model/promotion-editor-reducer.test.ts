import { describe, expect, it } from 'vitest';

import type { Promotion } from '../../../entities/promotion';
import { promotionEditorReducer } from './promotion-editor-reducer';
import { createPromotionEditorState } from './promotion-editor-state';

const promotion: Promotion = {
  id: 'promotion-1',
  name: 'Existing promotion',
  enabled: true,
  mode: 'CODE',
  code: 'SAVE10',
  scope: 'ITEM',
  audience: 'ALL',
  discountType: 'PERCENTAGE',
  discountValue: '0.1',
  currency: 'IDR',
  maximumDiscount: '50000',
  minimumPurchase: '100000',
  effectiveFrom: null,
  effectiveUntil: null,
  version: 1,
  itemIds: ['item-1'],
  variantIds: ['variant-1'],
  categoryIds: [],
  locationIds: ['location-1'],
  status: 'ACTIVE',
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
};

describe('promotionEditorReducer', () => {
  it('hydrates editable percentage values from the persisted promotion', () => {
    const state = createPromotionEditorState(promotion);

    expect(state.form.discountValue).toBe('10');
    expect(state.form.code).toBe('SAVE10');
    expect(state.form.itemIds).toEqual(['item-1']);
  });

  it('clears code when switching to automatic mode', () => {
    const state = promotionEditorReducer(createPromotionEditorState(promotion), {
      type: 'MODE_CHANGED',
      value: 'AUTOMATIC',
    });

    expect(state.form.mode).toBe('AUTOMATIC');
    expect(state.form.code).toBe('');
  });

  it('clears incompatible targets when scope changes', () => {
    const state = promotionEditorReducer(createPromotionEditorState(promotion), {
      type: 'SCOPE_CHANGED',
      value: 'TRANSACTION',
    });

    expect(state.form.itemIds).toEqual([]);
    expect(state.form.variantIds).toEqual([]);
    expect(state.form.categoryIds).toEqual([]);
    expect(state.form.categoryItemScope).toBe('ALL');
  });

  it('clears maximum discount for fixed amount discounts', () => {
    const state = promotionEditorReducer(createPromotionEditorState(promotion), {
      type: 'DISCOUNT_TYPE_CHANGED',
      value: 'FIXED_AMOUNT',
    });

    expect(state.form.discountType).toBe('FIXED_AMOUNT');
    expect(state.form.maximumDiscount).toBe('');
  });
});
