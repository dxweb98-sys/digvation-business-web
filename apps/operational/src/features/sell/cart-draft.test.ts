import { describe, expect, it } from 'vitest';

import {
  addCartDraftSelection,
  cartDraftEstimatedTotal,
  cartDraftStartInput,
  emptyCartDraft,
  removeCartDraftLine,
  setCartDraftQuantity,
} from './cart-draft';
import type { CatalogItem, ResolvedPrice } from './cashier-transaction.types';

const item: CatalogItem = {
  id: 'item-1',
  code: 'ITEM-1',
  name: 'Item one',
  type: 'PRODUCT',
  categoryId: null,
  taxCategoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  version: 1,
  createdAt: '2026-09-06T00:00:00.000Z',
  updatedAt: '2026-09-06T00:00:00.000Z',
  serviceDefinition: null,
};

const price: ResolvedPrice = {
  catalogPriceId: 'price-1',
  catalogItemId: item.id,
  catalogVariantId: null,
  locationId: 'location-1',
  currency: 'IDR',
  amount: '12500.0000',
  effectiveAt: '2026-09-06T00:00:00.000Z',
  sourceScope: { catalogVariantId: null, locationId: 'location-1' },
};

describe('CartDraft local mutations', () => {
  it('adds and combines compatible selections without creating server state', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const once = addCartDraftSelection(empty, item, null, price);
    const twice = addCartDraftSelection(once, item, null, price);

    expect(twice.lines).toHaveLength(1);
    expect(twice.lines[0]?.quantity).toBe('2.0000');
    expect(cartDraftEstimatedTotal(twice)).toBe('25000.0000');
  });

  it('changes quantity, removes lines, and emits selection-only atomic start input', () => {
    const added = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price);
    const changed = setCartDraftQuantity(added, added.lines[0]!.id, '1.5');

    expect(cartDraftStartInput(changed)).toEqual({
      sellingLocationId: 'location-1',
      currency: 'IDR',
      lines: [{ catalogItemId: 'item-1', quantity: '1.5000' }],
    });
    expect(removeCartDraftLine(changed, changed.lines[0]!.id).lines).toEqual([]);
  });
});
