import { describe, expect, it } from 'vitest';

import type { PriceHistoryEntry, ResolvedPrice, Variant } from './catalog-api';
import {
  bulkVariantPricePreview,
  priceChangeActorLabel,
  priceHistoryTarget,
  variantPriceState,
  type VariantPriceState,
} from './catalog-price-history';

const variant = (id: string, status: Variant['status'] = 'ACTIVE'): Variant => ({
  id,
  code: id.toUpperCase(),
  name: `Variant ${id}`,
  status,
  version: 1,
  catalogItemId: 'item',
});

const resolved = (amount: string, sourceVariantId: string | null): ResolvedPrice => ({
  catalogPriceId: 'price',
  catalogItemId: 'item',
  catalogVariantId: 'large',
  locationId: null,
  currency: 'IDR',
  amount,
  effectiveAt: '2026-09-19T00:00:00.000Z',
  sourceScope: { catalogVariantId: sourceVariantId, locationId: null },
});

const entry = (overrides: Partial<PriceHistoryEntry> = {}): PriceHistoryEntry => ({
  id: 'history',
  catalogItemId: 'item',
  catalogVariantId: null,
  locationId: null,
  currency: 'IDR',
  amount: '28000.0000',
  effectiveFrom: '2026-09-19T00:00:00.000Z',
  effectiveUntil: null,
  cancelledAt: null,
  createdAt: '2026-09-19T00:00:00.000Z',
  catalogVariantCode: null,
  catalogVariantName: null,
  previousAmount: '25000.0000',
  changedBy: { id: 'actor', kind: 'user', displayName: 'Rina Owner' },
  ...overrides,
});

describe('variantPriceState', () => {
  const query = (data: ResolvedPrice | undefined, isError = false) => ({
    data,
    isLoading: false,
    isError,
  });

  it('marks a price resolved from the variant itself as explicit', () => {
    expect(variantPriceState(query(resolved('28000.0000', 'large')), 'large')).toEqual({
      kind: 'explicit',
      amount: '28000.0000',
      currency: 'IDR',
    });
  });

  it('never presents the item price as if it were the variant price', () => {
    expect(variantPriceState(query(resolved('25000.0000', null)), 'large')).toEqual({
      kind: 'missing',
    });
  });

  it('reports loading and missing prices explicitly', () => {
    expect(variantPriceState(undefined, 'large')).toEqual({ kind: 'loading' });
    expect(
      variantPriceState({ ...query(undefined, true), error: { code: 'PRICE_NOT_FOUND' } }, 'large'),
    ).toEqual({ kind: 'missing' });
  });

  it('does not claim a price is missing when Runtime cannot resolve the item yet', () => {
    expect(
      variantPriceState(
        { ...query(undefined, true), error: { code: 'CATALOG_SELECTION_INVALID' } },
        'large',
      ),
    ).toEqual({ kind: 'unavailable' });
  });
});

describe('bulkVariantPricePreview', () => {
  const states = new Map<string, VariantPriceState>([
    ['a', { kind: 'explicit', amount: '25000.0000', currency: 'IDR' }],
    ['b', { kind: 'explicit', amount: '28000.0000', currency: 'IDR' }],
    ['c', { kind: 'missing' }],
  ]);

  it('targets active variants only and flags variants already at the target price', () => {
    const rows = bulkVariantPricePreview(
      [variant('a'), variant('b'), variant('c'), variant('d', 'INACTIVE')],
      states,
      '28000',
    );
    expect(rows.map((row) => [row.variant.id, row.unchanged])).toEqual([
      ['a', false],
      ['b', true],
      // A variant without its own price always receives the applied price.
      ['c', false],
    ]);
  });

  it('does not flag anything as unchanged for an invalid amount', () => {
    expect(
      bulkVariantPricePreview([variant('b')], states, '28.00001').every((row) => !row.unchanged),
    ).toBe(true);
  });
});

describe('item price history presentation', () => {
  it('labels parent item rows', () => {
    expect(priceHistoryTarget(entry())).toEqual({ scope: 'ITEM', name: 'Harga item', sku: null });
  });

  it('labels variant rows with their name and SKU', () => {
    expect(
      priceHistoryTarget(
        entry({
          catalogVariantId: 'large',
          catalogVariantName: 'Large / Iced',
          catalogVariantCode: 'LRG-ICED',
        }),
      ),
    ).toEqual({ scope: 'VARIANT', name: 'Large / Iced', sku: 'LRG-ICED' });
  });

  it('shows a readable actor and never a raw identifier', () => {
    expect(priceChangeActorLabel(entry())).toBe('Rina Owner');
    expect(
      priceChangeActorLabel(entry({ changedBy: { id: 'actor', kind: 'user', displayName: null } })),
    ).toBe('Pengguna tidak dikenal');
    expect(
      priceChangeActorLabel(
        entry({ changedBy: { id: 'job', kind: 'machine', displayName: null } }),
      ),
    ).toBe('Sistem');
    expect(priceChangeActorLabel(entry({ changedBy: null }))).toBe('Tidak tercatat');
  });
});
