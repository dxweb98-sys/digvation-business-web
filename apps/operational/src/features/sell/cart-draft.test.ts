import { describe, expect, it } from 'vitest';

import {
  addCartDraftSelection,
  cartDraftEstimatedTotal,
  cartDraftStartInput,
  emptyCartDraft,
  removeCartDraftLine,
  saleDisplayLines,
  setCartDraftCustomer,
  setCartDraftQuantity,
} from './cart-draft';
import type {
  CatalogItem,
  ResolvedPrice,
  SaleAdjustment,
  SaleLine,
} from './cashier-transaction.types';

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
    const changed = setCartDraftCustomer(
      setCartDraftQuantity(added, added.lines[0]!.id, '1.5'),
      { type: 'NON_MEMBER', name: 'Siti Aminah', phone: '081234567890' },
    );

    expect(cartDraftStartInput(changed)).toEqual({
      sellingLocationId: 'location-1',
      currency: 'IDR',
      customer: { type: 'NON_MEMBER', name: 'Siti Aminah', phone: '081234567890' },
      lines: [{ catalogItemId: 'item-1', quantity: '1.5000' }],
    });
    expect(removeCartDraftLine(changed, changed.lines[0]!.id).lines).toEqual([]);
  });

  it('refuses to create a Sale without the customer it belongs to', () => {
    const added = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price);

    expect(() => cartDraftStartInput(added)).toThrow(/customer/i);
  });

  it('starts every new cart without inheriting a customer', () => {
    expect(emptyCartDraft('location-1', 'IDR').customer).toBeNull();
  });

  it('shows the Runtime promotion snapshot without replacing the base line subtotal', () => {
    const line = {
      id: 'line-1',
      itemNameSnapshot: 'Item one',
      itemTypeSnapshot: 'PRODUCT',
      variantNameSnapshot: 'Regular',
      quantity: '1.0000',
      effectiveUnitPrice: '12500.0000',
      grossAmount: '12500.0000',
      lineDiscountAmount: '1250.0000',
      discountType: null,
      discountValue: null,
      totalAmount: '11250.0000',
    } as SaleLine;
    const adjustment = {
      id: 'adjustment-1',
      source: 'PROMOTION',
      scope: 'ITEM',
      type: 'PERCENTAGE',
      configuredValue: '0.1',
      requestedValue: null,
      actualAmount: '1250.0000',
      promotionId: 'promotion-1',
      label: 'Promo September',
      saleLineId: 'line-1',
      actorId: null,
      actorKind: null,
      reason: null,
      createdAt: '2026-09-16T00:00:00.000Z',
    } satisfies SaleAdjustment;

    const displayed = saleDisplayLines([line], [adjustment])[0];

    expect(displayed?.variantNameSnapshot).toBe('Regular · Promo: Promo September');
    expect(displayed?.effectiveUnitPrice).toBe('12500.0000');
    expect(displayed?.totalAmount).toBe('12500.0000');
    expect(displayed?.discountType).toBe('PERCENTAGE');
    expect(displayed?.discountValue).toBe('0.1');
  });

  it('keeps a line-specific discount explicit while preserving its base line subtotal', () => {
    const line = {
      id: 'line-2',
      itemNameSnapshot: 'Hair Color',
      itemTypeSnapshot: 'SERVICE',
      variantNameSnapshot: 'Red',
      quantity: '1.0000',
      effectiveUnitPrice: '150000.0000',
      grossAmount: '150000.0000',
      lineDiscountAmount: '15000.0000',
      discountType: 'PERCENTAGE',
      discountValue: '0.1',
      totalAmount: '135000.0000',
    } as SaleLine;

    const displayed = saleDisplayLines([line])[0];

    expect(displayed?.effectiveUnitPrice).toBe('150000.0000');
    expect(displayed?.totalAmount).toBe('150000.0000');
    expect(displayed?.lineDiscountAmount).toBe('15000.0000');
    expect(displayed?.discountType).toBe('PERCENTAGE');
    expect(displayed?.discountValue).toBe('0.1');
  });

  it('does not attach one percentage to a combined line discount with several adjustments', () => {
    const line = {
      id: 'line-3',
      itemNameSnapshot: 'Hair Color',
      itemTypeSnapshot: 'SERVICE',
      variantNameSnapshot: 'Red',
      quantity: '1.0000',
      effectiveUnitPrice: '150000.0000',
      grossAmount: '150000.0000',
      lineDiscountAmount: '20000.0000',
      discountType: 'PERCENTAGE',
      discountValue: '0.05',
      totalAmount: '130000.0000',
    } as SaleLine;
    const promotion = {
      id: 'promo-line',
      source: 'PROMOTION',
      scope: 'ITEM',
      type: 'PERCENTAGE',
      configuredValue: '0.1',
      requestedValue: null,
      actualAmount: '15000.0000',
      promotionId: 'promotion-1',
      label: 'Promo September',
      saleLineId: 'line-3',
      actorId: null,
      actorKind: null,
      reason: null,
      createdAt: '2026-09-17T00:00:00.000Z',
    } satisfies SaleAdjustment;
    const manual = {
      id: 'manual-line',
      source: 'MANUAL_DISCOUNT',
      scope: 'ITEM',
      type: 'FIXED_AMOUNT',
      configuredValue: '5000.0000',
      requestedValue: '5000.0000',
      actualAmount: '5000.0000',
      promotionId: null,
      label: 'Diskon layanan',
      saleLineId: 'line-3',
      actorId: 'actor-1',
      actorKind: 'USER',
      reason: 'Diskon layanan',
      createdAt: '2026-09-17T00:00:00.000Z',
    } satisfies SaleAdjustment;

    const displayed = saleDisplayLines([line], [promotion, manual])[0];

    expect(displayed?.totalAmount).toBe('150000.0000');
    expect(displayed?.lineDiscountAmount).toBe('20000.0000');
    expect(displayed?.discountType).toBeNull();
    expect(displayed?.discountValue).toBeNull();
  });
});
