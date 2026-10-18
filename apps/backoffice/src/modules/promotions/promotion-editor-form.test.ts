import { describe, expect, it } from 'vitest';

import {
  categoriesChange,
  categoryItemScopeChange,
  createPromotionEditorForm,
  discountTypeChange,
  modeChange,
  scopeChange,
  toPromotionWriteInput,
  validatePromotionEditorForm,
  type PromotionEditorForm,
} from './promotion-editor-form';
import type { Promotion } from './promotions-api';

const existing: Promotion = {
  id: 'promo-1',
  name: 'Member Weekend',
  enabled: true,
  mode: 'CODE',
  code: 'MEMBER10',
  scope: 'CATEGORY',
  audience: 'MEMBERS_ONLY',
  discountType: 'PERCENTAGE',
  discountValue: '0.1',
  currency: 'IDR',
  maximumDiscount: '50000.0000',
  minimumPurchase: null,
  effectiveFrom: null,
  effectiveUntil: null,
  version: 3,
  itemIds: ['item-a'],
  variantIds: [],
  categoryIds: ['cat-a'],
  locationIds: ['loc-1'],
  status: 'ACTIVE',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

const newForm = (change: Partial<PromotionEditorForm> = {}) => ({
  ...createPromotionEditorForm(null),
  name: 'Diskon 10',
  discountValue: '10',
  ...change,
});

describe('promotion editor audience', () => {
  it('defaults new promotions to all customers and hydrates an existing audience', () => {
    expect(createPromotionEditorForm(null).audience).toBe('ALL');
    expect(createPromotionEditorForm(existing).audience).toBe('MEMBERS_ONLY');
  });

  it('sends the chosen audience when Membership is available', () => {
    expect(toPromotionWriteInput(newForm(), { membershipAvailable: true }).audience).toBe('ALL');
    expect(
      toPromotionWriteInput(newForm({ audience: 'MEMBERS_ONLY' }), { membershipAvailable: true })
        .audience,
    ).toBe('MEMBERS_ONLY');
  });

  it('still sends ALL without Membership', () => {
    expect(toPromotionWriteInput(newForm(), { membershipAvailable: false }).audience).toBe('ALL');
  });

  it('leaves an existing member-only audience to Runtime without Membership', () => {
    const input = toPromotionWriteInput(createPromotionEditorForm(existing), {
      membershipAvailable: false,
    });
    expect('audience' in input).toBe(false);
    expect(input.code).toBe('MEMBER10');
  });
});

describe('promotion editor rules kept from the previous dialog', () => {
  it('maps an existing promotion back to the same write payload', () => {
    expect(
      toPromotionWriteInput(createPromotionEditorForm(existing), { membershipAvailable: true }),
    ).toEqual({
      name: 'Member Weekend',
      enabled: true,
      mode: 'CODE',
      code: 'MEMBER10',
      scope: 'CATEGORY',
      audience: 'MEMBERS_ONLY',
      discountType: 'PERCENTAGE',
      discountValue: '0.1',
      currency: 'IDR',
      maximumDiscount: '50000.0000',
      minimumPurchase: null,
      effectiveFrom: null,
      effectiveUntil: null,
      itemIds: ['item-a'],
      variantIds: [],
      categoryIds: ['cat-a'],
      locationIds: ['loc-1'],
    });
  });

  it('clears the code for automatic mode and the maximum for fixed discounts', () => {
    expect(modeChange('AUTOMATIC')).toEqual({ mode: 'AUTOMATIC', code: '' });
    expect(modeChange('CODE')).toEqual({ mode: 'CODE' });
    expect(discountTypeChange('FIXED_AMOUNT')).toEqual({
      discountType: 'FIXED_AMOUNT',
      maximumDiscount: '',
    });
  });

  it('resets targets when the scope changes', () => {
    expect(scopeChange('TRANSACTION')).toEqual({
      scope: 'TRANSACTION',
      itemIds: [],
      variantIds: [],
      categoryIds: [],
      categoryItemScope: 'ALL',
    });
    expect(scopeChange('ITEM')).toEqual({
      scope: 'ITEM',
      categoryIds: [],
      categoryItemScope: 'ALL',
    });
    expect(scopeChange('CATEGORY')).toEqual({
      scope: 'CATEGORY',
      itemIds: [],
      variantIds: [],
      categoryItemScope: 'ALL',
    });
  });

  it('keeps chosen items only while their category stays selected', () => {
    const form = newForm({ scope: 'CATEGORY', categoryIds: ['a', 'b'], itemIds: ['i-a', 'i-b'] });
    const items = [
      { id: 'i-a', code: 'A', name: 'A', categoryId: 'a' },
      { id: 'i-b', code: 'B', name: 'B', categoryId: 'b' },
    ];
    expect(categoriesChange(form, ['a'], items)).toEqual({ categoryIds: ['a'], itemIds: ['i-a'] });
    expect(categoryItemScopeChange('ALL')).toEqual({ categoryItemScope: 'ALL', itemIds: [] });
  });

  it('validates value, targets and period like before', () => {
    expect(validatePromotionEditorForm(newForm()).valid).toBe(true);
    expect(validatePromotionEditorForm(newForm({ discountValue: '120' })).valid).toBe(false);
    expect(validatePromotionEditorForm(newForm({ scope: 'ITEM' })).valid).toBe(false);
    expect(validatePromotionEditorForm(newForm({ mode: 'CODE', code: ' ' })).valid).toBe(false);
    expect(
      validatePromotionEditorForm(
        newForm({
          effectiveFrom: '2026-10-02T10:00:00.000Z',
          effectiveUntil: '2026-10-01T10:00:00.000Z',
        }),
      ),
    ).toEqual({ valid: false, periodValid: false });
  });

  it('sends percentages as rates and only the targets of the chosen scope', () => {
    const input = toPromotionWriteInput(
      newForm({ scope: 'ITEM', itemIds: ['i-a'], variantIds: ['v-a'], categoryIds: ['stale'] }),
      { membershipAvailable: true },
    );
    expect(input).toMatchObject({
      discountValue: '0.1',
      itemIds: ['i-a'],
      variantIds: ['v-a'],
      categoryIds: [],
    });
  });
});
