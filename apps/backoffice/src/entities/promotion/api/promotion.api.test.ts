import { ApiClient } from '@digvation/business-api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Promotion, PromotionWriteInput } from '..';
import { PromotionsApi } from './promotion.api';

const promotion: Promotion = {
  id: 'promotion-1',
  name: 'Flash Sale',
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
  version: 3,
  itemIds: ['item-1'],
  variantIds: [],
  categoryIds: [],
  locationIds: [],
  status: 'ACTIVE',
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
};

const writeInput: PromotionWriteInput = {
  name: promotion.name,
  enabled: promotion.enabled,
  mode: promotion.mode,
  code: promotion.code,
  scope: promotion.scope,
  discountType: promotion.discountType,
  discountValue: promotion.discountValue,
  currency: promotion.currency,
  maximumDiscount: promotion.maximumDiscount,
  minimumPurchase: promotion.minimumPurchase,
  effectiveFrom: promotion.effectiveFrom,
  effectiveUntil: promotion.effectiveUntil,
  itemIds: promotion.itemIds,
  variantIds: promotion.variantIds,
  categoryIds: promotion.categoryIds,
  locationIds: promotion.locationIds,
};

function respondWith(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function createApi() {
  return new PromotionsApi(new ApiClient({ baseUrl: 'https://runtime.example.test' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PromotionsApi', () => {
  it('lists promotions using the existing paging contract', async () => {
    const response = { items: [promotion], total: 1, limit: 100, offset: 0 };
    const fetchMock = respondWith(response);

    await expect(createApi().list()).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://runtime.example.test/api/v1/promotions?limit=100&offset=0',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('loads promotion reference options', async () => {
    const response = { items: [], variants: [], categories: [], locations: [] };
    const fetchMock = respondWith(response);

    await expect(createApi().options()).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://runtime.example.test/api/v1/promotions/options',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('creates a promotion without changing the write contract', async () => {
    const fetchMock = respondWith(promotion);

    await expect(createApi().create(writeInput)).resolves.toEqual(promotion);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://runtime.example.test/api/v1/promotions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(writeInput),
      }),
    );
  });

  it('updates a promotion with the expected version', async () => {
    const fetchMock = respondWith(promotion);

    await expect(createApi().update(promotion.id, promotion.version, writeInput)).resolves.toEqual(
      promotion,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://runtime.example.test/api/v1/promotions/promotion-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: promotion.version,
          ...writeInput,
        }),
      }),
    );
  });
});
