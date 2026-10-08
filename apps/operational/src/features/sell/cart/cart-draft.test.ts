import { describe, expect, it } from 'vitest';

import {
  addCartDraftSelection,
  cartDraftDisplayLines,
  cartDraftEstimatedTotal,
  cartDraftPricingInput,
  cartDraftStartInput,
  emptyCartDraft,
  removeCartDraftLine,
  replaceCartDraftLine,
  replacementLinesOf,
  saleDisplayLines,
  setCartDraftCustomer,
  setCartDraftQuantity,
} from './cart-draft';
import type {
  CatalogItem,
  ResolvedPrice,
  SaleAdjustment,
  SaleLine,
} from '../transaction/model/cashier-transaction.types';

const item: CatalogItem = {
  id: 'item-1',
  code: 'ITEM-1',
  name: 'Item one',
  type: 'PRODUCT',
  categoryId: null,
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
    const changed = setCartDraftCustomer(setCartDraftQuantity(added, added.lines[0]!.id, '1.5'), {
      type: 'NON_MEMBER',
      name: 'Siti Aminah',
      phone: '081234567890',
    });

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
      promotionEffectiveFrom: '2026-09-16T00:00:00.000Z',
      promotionEffectiveUntil: '2026-09-16T18:20:00.000Z',
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
    expect(displayed?.promotion).toEqual({
      name: 'Promo September',
      effectiveFrom: '2026-09-16T00:00:00.000Z',
      effectiveUntil: '2026-09-16T18:20:00.000Z',
    });
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
      promotionEffectiveFrom: '2026-09-16T00:00:00.000Z',
      promotionEffectiveUntil: '2026-09-16T18:20:00.000Z',
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

describe('CartDraft with configured quantity and additional items', () => {
  const service: CatalogItem = { ...item, id: 'hair-color', name: 'Hair Color', type: 'SERVICE' };
  const servicePrice: ResolvedPrice = {
    ...price,
    catalogItemId: service.id,
    amount: '150000.0000',
  };
  const serum = {
    componentItemId: 'serum',
    quantity: '2.0000',
    label: 'Serum',
    unitPrice: '5000.0000',
  };

  it('adds the dialog quantity as the initial quantity and merges the same configuration', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const three = addCartDraftSelection(empty, item, null, price, { quantity: '3' });
    expect(three.lines[0]?.quantity).toBe('3.0000');
    const five = addCartDraftSelection(three, item, null, price, { quantity: '2' });
    expect(five.lines).toHaveLength(1);
    expect(five.lines[0]?.quantity).toBe('5.0000');
  });

  it('rejects a non-positive configured quantity', () => {
    expect(() =>
      addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price, {
        quantity: '0',
      }),
    ).toThrow();
  });

  it('keeps a composed Service as ONE cart line priced with its additional items', () => {
    const draft = addCartDraftSelection(
      emptyCartDraft('location-1', 'IDR'),
      service,
      null,
      servicePrice,
      {
        additionalComponents: [serum],
      },
    );
    expect(draft.lines).toHaveLength(1);
    const display = draft.lines.length ? cartDraftEstimatedTotal(draft) : '0';
    // 150.000 + 2 x 5.000 = 160.000 on one line; the additional item is not a separate priced line.
    expect(display).toBe('160000.0000');
    expect(draft.lines[0]).toMatchObject({ itemName: 'Hair Color', itemType: 'SERVICE' });
  });

  it('never merges lines that carry different additional items', () => {
    let draft = addCartDraftSelection(
      emptyCartDraft('location-1', 'IDR'),
      service,
      null,
      servicePrice,
      {
        additionalComponents: [serum],
      },
    );
    draft = addCartDraftSelection(draft, service, null, servicePrice, {
      additionalComponents: [serum],
    });
    draft = addCartDraftSelection(draft, service, null, servicePrice);
    draft = addCartDraftSelection(draft, service, null, servicePrice);
    expect(draft.lines).toHaveLength(3);
    // Plain lines still merge with each other.
    expect(draft.lines[2]?.quantity).toBe('2.0000');
  });

  it('sends only canonical ids and quantities for additional items when the Sale is created', () => {
    const draft = addCartDraftSelection(
      setCartDraftCustomer(emptyCartDraft('location-1', 'IDR'), {
        type: 'NON_MEMBER',
        name: 'Ayu',
        phone: '+628123456789',
      }),
      service,
      null,
      servicePrice,
      { quantity: '2', additionalComponents: [{ ...serum, componentVariantId: 'serum-large' }] },
    );
    const [line] = cartDraftStartInput(draft).lines;
    expect(line).toEqual({
      catalogItemId: 'hair-color',
      quantity: '2.0000',
      additionalComponents: [
        { componentItemId: 'serum', componentVariantId: 'serum-large', quantity: '2.0000' },
      ],
    });
    expect(cartDraftStartInput(draft).lines).toHaveLength(1);
  });
});

describe('editing a draft cart line', () => {
  const base: CatalogItem = { ...item, id: 'shampoo', name: 'Shampoo', type: 'PRODUCT' };
  const basePrice: ResolvedPrice = { ...price, catalogItemId: base.id, amount: '200000.0000' };
  const cap = { componentItemId: 'cap', quantity: '1.0000', label: 'Cap', unitPrice: '10000.0000' };

  it('replaces the whole configuration of the same line in place: base + additions = line total', () => {
    let draft = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), base, null, basePrice);
    draft = addCartDraftSelection(draft, item, null, price);
    const lineId = draft.lines[0]!.id;
    draft = replaceCartDraftLine(draft, lineId, base, null, basePrice, {
      quantity: '2',
      additionalComponents: [cap],
    });
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({ id: lineId, quantity: '2.0000' });
    expect(cartDraftDisplayLines(draft)[0]?.totalAmount).toBe('420000.0000');
    expect(
      cartDraftStartInput({
        ...draft,
        customer: { type: 'NON_MEMBER', name: 'A', phone: '1' } as never,
      }).lines[0],
    ).toMatchObject({
      quantity: '2.0000',
      additionalComponents: [{ componentItemId: 'cap', quantity: '1.0000' }],
    });
  });

  it('turning the additions off removes them from the line', () => {
    let draft = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), base, null, basePrice, {
      additionalComponents: [cap],
    });
    const lineId = draft.lines[0]!.id;
    draft = replaceCartDraftLine(draft, lineId, base, null, basePrice, { quantity: '1' });
    expect(draft.lines[0]?.additionalComponents).toBeUndefined();
    expect(cartDraftEstimatedTotal(draft)).toBe('200000.0000');
  });

  it('marks draft lines editable and exposes only their additions for display', () => {
    const draft = addCartDraftSelection(
      emptyCartDraft('location-1', 'IDR'),
      base,
      null,
      basePrice,
      {
        additionalComponents: [cap],
      },
    );
    const [line] = cartDraftDisplayLines(draft);
    expect(line).toMatchObject({
      editable: true,
      additions: [{ label: 'Cap', quantity: '1.0000', unitPrice: '10000.0000' }],
    });
  });
});

describe('per-unit additions in a cart group', () => {
  const service: CatalogItem = { ...item, id: 'hair-color', name: 'Hair Color', type: 'SERVICE' };
  const base: ResolvedPrice = { ...price, catalogItemId: service.id, amount: '200000.0000' };
  const a = {
    componentItemId: 'a',
    quantity: '1.0000',
    label: 'Addition A',
    unitPrice: '10000.0000',
  };
  const b = {
    componentItemId: 'b',
    componentVariantId: 'b-y',
    quantity: '1.0000',
    label: 'Addition B / Y',
    unitPrice: '15000.0000',
  };
  const empty = () => emptyCartDraft('location-1', 'IDR');
  const startable = (draft: ReturnType<typeof empty>) => ({
    ...draft,
    customer: { type: 'NON_MEMBER', name: 'A', phone: '1' } as never,
  });

  it('keeps each unit configuration and sums exact unit amounts: 210.000 + 215.000 = 425.000, never 2 x 212.500', () => {
    const draft = addCartDraftSelection(empty(), service, null, base, {
      quantity: '2',
      unitAdditions: [[a], [b]],
    });
    const [line] = cartDraftDisplayLines(draft);
    expect(line?.units?.map((unit) => unit.amount)).toEqual(['210000.0000', '215000.0000']);
    expect(line?.totalAmount).toBe('425000.0000');
    // No invented average unit price: the shown unit price is the base item's, never 212.500.
    expect(line?.effectiveUnitPrice).toBe('200000.0000');
    expect(JSON.stringify(line)).not.toContain('212500');
    expect(cartDraftEstimatedTotal(draft)).toBe('425000.0000');
  });

  it('persists different units as separate lines and groups identical ones', () => {
    const draft = addCartDraftSelection(empty(), service, null, base, {
      quantity: '3',
      unitAdditions: [[a], [b], [a]],
    });
    const lines = cartDraftStartInput(startable(draft)).lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      quantity: '2.0000',
      additionalComponents: [{ componentItemId: 'a', quantity: '1.0000' }],
    });
    expect(lines[1]).toMatchObject({
      quantity: '1.0000',
      additionalComponents: [{ componentItemId: 'b', componentVariantId: 'b-y' }],
    });
  });

  it('prices exactly the lines checkout would start the Sale with, without who performs or sells', () => {
    const performed = { ...a, performers: [{ employeeId: 'emp-1', name: 'Andi' }] } as never;
    const draft = {
      ...addCartDraftSelection(empty(), service, null, base, {
        quantity: '3',
        unitAdditions: [[performed], [b], [performed]],
      }),
    };
    const member = { ...draft, customer: { type: 'MEMBER' as const, referenceId: 'member-1' } };
    const started = cartDraftStartInput(member).lines;
    const priced = cartDraftPricingInput(member);

    expect(priced).toEqual({
      sellingLocationId: 'location-1',
      currency: 'IDR',
      customer: { type: 'MEMBER', referenceId: 'member-1' },
      lines: [
        {
          catalogItemId: 'hair-color',
          quantity: '2.0000',
          additionalComponents: [{ componentItemId: 'a', quantity: '1.0000' }],
        },
        {
          catalogItemId: 'hair-color',
          quantity: '1.0000',
          additionalComponents: [
            { componentItemId: 'b', componentVariantId: 'b-y', quantity: '1.0000' },
          ],
        },
      ],
    });
    // Same lines, same quantities and the same additions as the Sale checkout starts.
    expect(priced?.lines.map((line) => [line.catalogItemId, line.quantity])).toEqual(
      started.map((line) => [line.catalogItemId, line.quantity]),
    );
    expect(started[0]?.additionalComponents?.[0]).toHaveProperty('performers');
  });

  it('prices a walk-in or a cart without customer as a non-member, and nothing for an empty cart', () => {
    const draft = addCartDraftSelection(empty(), service, null, base);
    expect(cartDraftPricingInput(startable(draft))).not.toHaveProperty('customer');
    expect(cartDraftPricingInput(draft)).not.toHaveProperty('customer');
    expect(cartDraftPricingInput(empty())).toBeNull();
    expect(cartDraftPricingInput(null)).toBeNull();
  });

  it('sends a unit without additions as its own plain line', () => {
    const draft = addCartDraftSelection(empty(), service, null, base, {
      quantity: '2',
      unitAdditions: [[], [a]],
    });
    const lines = cartDraftStartInput(startable(draft)).lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ catalogItemId: 'hair-color', quantity: '1.0000' });
    expect(lines[1]).toMatchObject({
      quantity: '1.0000',
      additionalComponents: [expect.anything()],
    });
  });

  it('never merges a per-unit group with another line and needs a configuration for every unit', () => {
    let draft = addCartDraftSelection(empty(), service, null, base, {
      quantity: '2',
      unitAdditions: [[a], [b]],
    });
    draft = addCartDraftSelection(draft, service, null, base, {
      quantity: '2',
      unitAdditions: [[a], [b]],
    });
    expect(draft.lines).toHaveLength(2);
    expect(() =>
      addCartDraftSelection(empty(), service, null, base, {
        quantity: '3',
        unitAdditions: [[a], [b]],
      }),
    ).toThrow();
  });

  it('shrinking keeps the leading units untouched; growing is refused here (a new unit is configured explicitly)', () => {
    const draft = addCartDraftSelection(empty(), service, null, base, {
      quantity: '3',
      unitAdditions: [[a], [b], []],
    });
    const id = draft.lines[0]!.id;
    const smaller = setCartDraftQuantity(draft, id, '2');
    expect(smaller.lines[0]?.unitAdditions).toEqual([[a], [b]]);
    expect(() => setCartDraftQuantity(smaller, id, '3')).toThrow();
  });

  it('editing one unit replaces the same group in place without touching the other unit', () => {
    let draft = addCartDraftSelection(empty(), service, null, base, {
      quantity: '2',
      unitAdditions: [[a], [b]],
    });
    const id = draft.lines[0]!.id;
    draft = replaceCartDraftLine(draft, id, service, null, base, {
      quantity: '2',
      unitAdditions: [[a], [{ ...b, quantity: '2.0000' }]],
    });
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]?.id).toBe(id);
    expect(draft.lines[0]?.unitAdditions?.[0]).toEqual([a]);
    expect(cartDraftDisplayLines(draft)[0]?.units?.map((unit) => unit.amount)).toEqual([
      '210000.0000',
      '230000.0000',
    ]);
  });
});

describe('persisted OPEN Sale lines in the cart', () => {
  const line = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'l1',
      removedAt: null,
      itemNameSnapshot: 'Hair Color',
      itemTypeSnapshot: 'SERVICE',
      variantNameSnapshot: null,
      quantity: '1.0000',
      effectiveUnitPrice: '200000.0000',
      grossAmount: '200000.0000',
      lineDiscountAmount: '0.0000',
      discountType: null,
      discountValue: null,
      overrideAmount: null,
      fulfillment: { status: 'WAITING' },
      participations: [],
      contributions: [],
      compositionComponents: [],
      ...overrides,
    }) as never;

  it('offers editing only for a free line of an editable Sale', () => {
    expect(saleDisplayLines([line()], [], { canEdit: true })[0]?.editable).toBe(true);
    // Finalized/paid-pending Sale, or no permission to change it: never offered.
    expect(saleDisplayLines([line()], [], { canEdit: false })[0]?.editable).toBe(false);
    expect(saleDisplayLines([line()])[0]?.editable).toBe(false);
  });

  it('never offers editing for work in progress, assigned performers or manual price/discount', () => {
    const editable = (overrides: Record<string, unknown>) =>
      saleDisplayLines([line(overrides)], [], { canEdit: true })[0]?.editable;
    expect(editable({ fulfillment: { status: 'IN_PROGRESS' } })).toBe(false);
    expect(editable({ fulfillment: { status: 'COMPLETED' } })).toBe(false);
    expect(editable({ participations: [{ assigned: true }] })).toBe(false);
    expect(editable({ contributions: [{}] })).toBe(false);
    expect(editable({ overrideAmount: '1000.0000' })).toBe(false);
    expect(editable({ discountType: 'PERCENTAGE' })).toBe(false);
  });
});

describe('replacementLinesOf (one configuration becomes exact Sale lines)', () => {
  const a = { componentItemId: 'a', quantity: '1.0000', label: 'A', unitPrice: '10000.0000' };
  const b = {
    componentItemId: 'b',
    componentVariantId: 'b-y',
    quantity: '2.0000',
    label: 'B / Y',
    unitPrice: '15000.0000',
  };

  it('keeps identical units as one line', () => {
    expect(replacementLinesOf('svc', 'v1', { quantity: '2', additionalComponents: [a] })).toEqual([
      {
        catalogItemId: 'svc',
        catalogVariantId: 'v1',
        quantity: '2',
        additionalComponents: [{ componentItemId: 'a', quantity: '1.0000' }],
      },
    ]);
  });

  it('turns different unit additions into separate lines, in order, each with its own additions and variant', () => {
    expect(
      replacementLinesOf('svc', null, {
        quantity: '2',
        additionalComponents: [],
        unitAdditions: [[a], [b]],
      }),
    ).toEqual([
      {
        catalogItemId: 'svc',
        quantity: '1',
        additionalComponents: [{ componentItemId: 'a', quantity: '1.0000' }],
      },
      {
        catalogItemId: 'svc',
        quantity: '1',
        additionalComponents: [
          { componentItemId: 'b', componentVariantId: 'b-y', quantity: '2.0000' },
        ],
      },
    ]);
  });

  it('groups equal units among different ones and never merges a plain unit into a configured one', () => {
    const lines = replacementLinesOf('svc', null, {
      quantity: '3',
      additionalComponents: [],
      unitAdditions: [[a], [], [a]],
    });
    expect(lines).toEqual([
      {
        catalogItemId: 'svc',
        quantity: '2',
        additionalComponents: [{ componentItemId: 'a', quantity: '1.0000' }],
      },
      { catalogItemId: 'svc', quantity: '1' },
    ]);
  });
});

describe('CartDraft Product salesperson attribution', () => {
  const andi = { employeeId: 'emp-andi', name: 'Andi' };
  const budi = { employeeId: 'emp-budi', name: 'Budi' };
  const service: CatalogItem = {
    ...item,
    id: 'svc-1',
    type: 'SERVICE',
    fulfillmentBehavior: 'TRACKED',
  };
  const start = (draft: ReturnType<typeof emptyCartDraft>) =>
    cartDraftStartInput(
      setCartDraftCustomer(draft, { type: 'NON_MEMBER', name: 'Siti', phone: '0812' }),
    );

  it('merges the same Product sold by the same salesperson', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const once = addCartDraftSelection(empty, item, null, price, { soldBy: andi });
    const twice = addCartDraftSelection(once, item, null, price, { soldBy: andi, quantity: '2' });
    expect(twice.lines).toHaveLength(1);
    expect(twice.lines[0]?.quantity).toBe('3.0000');
    expect(twice.lines[0]?.soldBy).toEqual(andi);
  });

  it('keeps the same Product sold by different salespeople as distinct lines', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const draft = addCartDraftSelection(
      addCartDraftSelection(empty, item, null, price, { soldBy: andi }),
      item,
      null,
      price,
      { soldBy: budi },
    );
    expect(draft.lines).toHaveLength(2);
    expect(new Set(draft.lines.map((line) => line.id)).size).toBe(2);
    expect(draft.lines.map((line) => line.soldBy?.employeeId)).toEqual(['emp-andi', 'emp-budi']);
  });

  it('never merges a Product with a salesperson into one without, in either order', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const sellerFirst = addCartDraftSelection(
      addCartDraftSelection(empty, item, null, price, { soldBy: andi }),
      item,
      null,
      price,
    );
    const plainFirst = addCartDraftSelection(
      addCartDraftSelection(empty, item, null, price),
      item,
      null,
      price,
      { soldBy: andi },
    );
    expect(sellerFirst.lines).toHaveLength(2);
    expect(plainFirst.lines).toHaveLength(2);
  });

  it('still merges two lines that both have no salesperson', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const draft = addCartDraftSelection(
      addCartDraftSelection(empty, item, null, price, { soldBy: null }),
      item,
      null,
      price,
    );
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]).not.toHaveProperty('soldBy');
  });

  it('keeps the salesperson through a quantity change', () => {
    const added = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price, {
      soldBy: andi,
      quantity: '2',
    });
    const changed = setCartDraftQuantity(added, added.lines[0]!.id, '5');
    expect(changed.lines[0]).toMatchObject({ quantity: '5.0000', soldBy: andi });
  });

  it('keeps the salesperson when a line is reopened and replaced, and lets it change or clear', () => {
    const added = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price, {
      soldBy: andi,
    });
    const id = added.lines[0]!.id;
    const kept = replaceCartDraftLine(added, id, item, null, price, {
      soldBy: andi,
      quantity: '3',
    });
    expect(kept.lines[0]).toMatchObject({ id, quantity: '3.0000', soldBy: andi });
    expect(
      replaceCartDraftLine(added, id, item, null, price, { soldBy: budi }).lines[0]?.soldBy,
    ).toEqual(budi);
    expect(
      replaceCartDraftLine(added, id, item, null, price, { soldBy: null }).lines[0],
    ).not.toHaveProperty('soldBy');
  });

  it('carries the salesperson from the local draft into the Runtime Sale start input', () => {
    const empty = emptyCartDraft('location-1', 'IDR');
    const draft = addCartDraftSelection(
      addCartDraftSelection(empty, item, null, price, { soldBy: andi, quantity: '2' }),
      item,
      null,
      price,
    );
    expect(start(draft).lines).toEqual([
      { catalogItemId: 'item-1', quantity: '2.0000', soldByEmployeeId: 'emp-andi' },
      { catalogItemId: 'item-1', quantity: '1.0000' },
    ]);
  });

  it('never attributes a salesperson to a Service line', () => {
    const draft = addCartDraftSelection(
      emptyCartDraft('location-1', 'IDR'),
      service,
      null,
      { ...price, catalogItemId: service.id },
      { soldBy: andi },
    );
    expect(draft.lines[0]).not.toHaveProperty('soldBy');
    expect(start(draft).lines[0]).not.toHaveProperty('soldByEmployeeId');
  });

  it('presents the salesperson name on the cart line', () => {
    const draft = addCartDraftSelection(emptyCartDraft('location-1', 'IDR'), item, null, price, {
      soldBy: andi,
    });
    expect(cartDraftDisplayLines(draft)[0]?.soldByName).toBe('Andi');
  });

  it('carries the salesperson explicitly into every recreated replacement line', () => {
    expect(
      replacementLinesOf('item-1', null, {
        quantity: '2',
        additionalComponents: [],
        soldByEmployeeId: 'emp-andi',
      }),
    ).toEqual([{ catalogItemId: 'item-1', quantity: '2', soldByEmployeeId: 'emp-andi' }]);
    expect(
      replacementLinesOf('item-1', null, {
        quantity: '2',
        additionalComponents: [],
        soldByEmployeeId: null,
      }),
    ).toEqual([{ catalogItemId: 'item-1', quantity: '2' }]);
  });
});
