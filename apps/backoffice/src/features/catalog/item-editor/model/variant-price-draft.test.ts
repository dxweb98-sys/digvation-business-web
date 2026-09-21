import { describe, expect, it } from 'vitest';

import {
  applyPriceToAllVariants,
  editableAmount,
  isValidSellingPrice,
  variantDraftIssue,
  variantPriceSubmissions,
  type VariantPriceDraft,
} from './variant-price-draft';

const draft = (key: string, overrides: Partial<VariantPriceDraft> = {}): VariantPriceDraft => ({
  key,
  id: null,
  code: '',
  name: `Variant ${key}`,
  price: '',
  persistedPrice: null,
  ...overrides,
});

describe('applyPriceToAllVariants', () => {
  it('gives every variant the same explicit price and keeps each one editable', () => {
    const applied = applyPriceToAllVariants(
      [draft('a', { price: '25000' }), draft('b')],
      ' 28000 ',
    );
    expect(applied.map((row) => row.price)).toEqual(['28000', '28000']);

    const overridden = applied.map((row) => (row.key === 'b' ? { ...row, price: '26000' } : row));
    expect(overridden.map((row) => row.price)).toEqual(['28000', '26000']);
  });
});

describe('variantDraftIssue', () => {
  it('requires a name and an explicit valid price for a new variant', () => {
    expect(variantDraftIssue(draft('a', { name: ' ', price: '1' }), true)).toBe('NAME_REQUIRED');
    expect(variantDraftIssue(draft('a'), true)).toBe('PRICE_REQUIRED');
    expect(variantDraftIssue(draft('a', { price: '0' }), true)).toBe('PRICE_INVALID');
    expect(variantDraftIssue(draft('a', { price: '1.23456' }), true)).toBe('PRICE_INVALID');
    expect(variantDraftIssue(draft('a', { price: '28000' }), true)).toBeNull();
  });

  it('does not require a price when the user cannot manage pricing', () => {
    expect(variantDraftIssue(draft('a'), false)).toBeNull();
  });

  it('lets an existing variant without a price stay unchanged', () => {
    expect(variantDraftIssue(draft('a', { id: 'v-a' }), true)).toBeNull();
    expect(variantDraftIssue(draft('a', { id: 'v-a', persistedPrice: '25000.0000' }), true)).toBe(
      'PRICE_REQUIRED',
    );
  });
});

describe('variantPriceSubmissions', () => {
  it('turns every new variant into an explicit price grouped per amount', () => {
    const drafts = applyPriceToAllVariants([draft('a'), draft('b'), draft('c')], '28000').map(
      (row) => (row.key === 'b' ? { ...row, price: '26000' } : row),
    );
    const ids = new Map([
      ['a', 'v-a'],
      ['b', 'v-b'],
      ['c', 'v-c'],
    ]);
    expect(variantPriceSubmissions(drafts, ids)).toEqual([
      { amount: '28000', catalogVariantIds: ['v-a', 'v-c'] },
      { amount: '26000', catalogVariantIds: ['v-b'] },
    ]);
  });

  it('skips persisted variants whose price did not change', () => {
    const drafts = [
      draft('a', { id: 'v-a', persistedPrice: '28000.0000', price: '28000.0000' }),
      draft('b', { id: 'v-b', persistedPrice: '27000.0000', price: '28000' }),
      draft('c', { id: 'v-c', persistedPrice: null, price: '' }),
    ];
    expect(variantPriceSubmissions(drafts, new Map())).toEqual([
      { amount: '28000', catalogVariantIds: ['v-b'] },
    ]);
  });
});

describe('isValidSellingPrice', () => {
  it('accepts positive amounts with up to four decimals', () => {
    expect(isValidSellingPrice('28000')).toBe(true);
    expect(isValidSellingPrice('0.5')).toBe(true);
    expect(isValidSellingPrice('0')).toBe(false);
    expect(isValidSellingPrice('')).toBe(false);
    expect(isValidSellingPrice('-1')).toBe(false);
  });
});

describe('editableAmount', () => {
  it('shows Runtime four-place amounts without trailing zero fractions', () => {
    expect(['22000.0000', '22000.5000', '100.0000', '0.2500', '1000'].map(editableAmount)).toEqual([
      '22000',
      '22000.5',
      '100',
      '0.25',
      '1000',
    ]);
  });
});
