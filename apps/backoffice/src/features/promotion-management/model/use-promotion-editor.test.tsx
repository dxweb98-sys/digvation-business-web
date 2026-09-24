import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Promotion, PromotionReferenceOption } from '../../../entities/promotion';
import { usePromotionEditor } from './use-promotion-editor';

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

describe('usePromotionEditor', () => {
  it('uses the shared form state for field updates', () => {
    const { result } = renderHook(() => usePromotionEditor(promotion));

    act(() => result.current.form.setField('name', 'Changed promotion'));

    expect(result.current.form.values.name).toBe('Changed promotion');
    expect(result.current.form.values.code).toBe('SAVE10');
  });

  it('hydrates percentage values and keeps coordinated mode transitions', () => {
    const { result } = renderHook(() => usePromotionEditor(promotion));

    expect(result.current.form.values.discountValue).toBe('10');

    act(() => result.current.actions.changeMode('AUTOMATIC'));

    expect(result.current.form.values.mode).toBe('AUTOMATIC');
    expect(result.current.form.values.code).toBe('');
  });

  it('clears incompatible targets when scope changes', () => {
    const { result } = renderHook(() => usePromotionEditor(promotion));

    act(() => result.current.actions.changeScope('TRANSACTION'));

    expect(result.current.form.values.itemIds).toEqual([]);
    expect(result.current.form.values.variantIds).toEqual([]);
    expect(result.current.form.values.categoryIds).toEqual([]);
    expect(result.current.form.values.categoryItemScope).toBe('ALL');
  });

  it('keeps only selected-category items when categories change', () => {
    const source: Promotion = {
      ...promotion,
      scope: 'CATEGORY',
      categoryIds: ['category-1', 'category-2'],
      itemIds: ['item-1', 'item-2'],
      variantIds: [],
    };
    const options: PromotionReferenceOption[] = [
      { id: 'item-1', code: 'ITEM-1', name: 'Item 1', categoryId: 'category-1' },
      { id: 'item-2', code: 'ITEM-2', name: 'Item 2', categoryId: 'category-2' },
    ];
    const { result } = renderHook(() => usePromotionEditor(source));

    act(() => result.current.actions.changeCategories(['category-2'], options));

    expect(result.current.form.values.categoryIds).toEqual(['category-2']);
    expect(result.current.form.values.itemIds).toEqual(['item-2']);
  });

  it('clears maximum discount when fixed amount is selected', () => {
    const { result } = renderHook(() => usePromotionEditor(promotion));

    act(() => result.current.actions.changeDiscountType('FIXED_AMOUNT'));

    expect(result.current.form.values.discountType).toBe('FIXED_AMOUNT');
    expect(result.current.form.values.maximumDiscount).toBe('');
  });
});
