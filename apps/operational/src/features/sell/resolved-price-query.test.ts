import { ApiError } from '@digvation/pos-api';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import type { SellingCatalogQuery } from './cashier-transaction.adapter';
import { fetchResolvedVariantPrices } from './resolved-price-query';
import type { ResolvedPrice } from './cashier-transaction.types';

function resolvedPrice(catalogVariantId: string, amount: string): ResolvedPrice {
  return {
    catalogPriceId: `price-${catalogVariantId}`,
    catalogItemId: 'item-1',
    catalogVariantId,
    locationId: 'location-1',
    currency: 'IDR',
    amount,
    effectiveAt: '2026-09-06T00:00:00.000Z',
    sourceScope: { catalogVariantId, locationId: 'location-1' },
  };
}

function pricingQuery(resolvePrice: SellingCatalogQuery['resolvePrice']): SellingCatalogQuery {
  return {
    listSellingLocations: vi.fn(),
    listCatalogCategories: vi.fn(),
    listCatalogItems: vi.fn(),
    listCatalogVariants: vi.fn(),
    resolvePrice,
  };
}

describe('fetchResolvedVariantPrices', () => {
  it('keeps priced variants and identifies variants without a configured price', async () => {
    const query = pricingQuery(
      vi.fn(async (input) => {
        if (input.catalogVariantId === 'variant-missing') {
          throw new ApiError(404, 'PRICE_NOT_FOUND', 'Price was not found.');
        }
        return resolvedPrice(input.catalogVariantId!, '25000.0000');
      }),
    );

    const result = await fetchResolvedVariantPrices(new QueryClient(), query, {
      catalogItemId: 'item-1',
      catalogVariantIds: ['variant-priced', 'variant-missing'],
      sellingLocationId: 'location-1',
      currency: 'IDR',
    });

    expect(result).toEqual({
      pricesByVariantId: { 'variant-priced': '25000.0000' },
      unavailableVariantIds: ['variant-missing'],
    });
  });

  it('preserves non-pricing failures for the transaction error boundary', async () => {
    const query = pricingQuery(
      vi.fn(async () => {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
      }),
    );

    await expect(
      fetchResolvedVariantPrices(new QueryClient(), query, {
        catalogItemId: 'item-1',
        catalogVariantIds: ['variant-1'],
        sellingLocationId: 'location-1',
        currency: 'IDR',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
