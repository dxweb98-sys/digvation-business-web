import { describe, expect, it } from 'vitest';

import type { PickerItem, PickerVariant } from '../api/workshop-lines-api';
import {
  addToDraft,
  canSelectInitialItems,
  draftLineFor,
  draftReady,
  formatQuantity,
  isConfigurable,
  isSelectableItem,
  isValidQuantity,
  itemPriceHint,
  stepQuantity,
  toSelectionInput,
} from './work-order-lines-model';

const price = (amount: string) => ({ amount, currency: 'IDR' });
const variant = (id: string, amount: string | null, status = 'ACTIVE'): PickerVariant => ({
  id,
  code: id,
  name: `Varian ${id}`,
  status,
  resolvedPrice: amount ? price(amount) : null,
});
const item = (overrides: Partial<PickerItem> = {}): PickerItem => ({
  id: 'item-1',
  code: 'OLI',
  name: 'Oli Mesin',
  type: 'PRODUCT',
  lifecycle: 'ACTIVE',
  resolvedPrice: price('10000'),
  variants: [],
  ...overrides,
});

describe('canSelectInitialItems', () => {
  const allowed = ['work-order-items:update'];

  it.each(['WAITING', 'ASSIGNED'] as const)('is offered while %s without accepted items', (status) => {
    expect(canSelectInitialItems(status, allowed, 0)).toBe(true);
  });

  it.each(['IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED'] as const)('is not offered while %s', (status) => {
    expect(canSelectInitialItems(status, allowed, 0)).toBe(false);
  });

  it('needs work-order-items:update and disappears once items are accepted', () => {
    expect(canSelectInitialItems('WAITING', ['work-orders:read'], 0)).toBe(false);
    expect(canSelectInitialItems('WAITING', allowed, 2)).toBe(false);
  });
});

describe('quantity', () => {
  it.each([
    ['1', true],
    ['2.5', true],
    ['0.0001', true],
    ['0', false],
    ['', false],
    ['-1', false],
    ['1.23456', false],
  ])('validates %j as %s', (value, valid) => {
    expect(isValidQuantity(value)).toBe(valid);
  });

  it('formats runtime quantities without trailing zeros', () => {
    expect(formatQuantity('2.0000')).toBe('2');
    expect(formatQuantity('1.5000')).toBe('1.5');
    expect(formatQuantity('3')).toBe('3');
  });
});

describe('Catalog presentation', () => {
  it('never offers a component-only or inactive item', () => {
    expect(isSelectableItem(item())).toBe(true);
    expect(isSelectableItem(item({ productUsage: 'COMPONENT_ONLY' }))).toBe(false);
    expect(isSelectableItem(item({ lifecycle: 'INACTIVE' }))).toBe(false);
  });

  it('shows the exact resolved price of an item without variants', () => {
    expect(itemPriceHint(item())).toEqual({ kind: 'exact', price: price('10000') });
    expect(itemPriceHint(item({ resolvedPrice: null }))).toEqual({ kind: 'none' });
  });

  it('shows the lowest active variant price as a starting price and ignores inactive variants', () => {
    const hint = itemPriceHint(
      item({
        resolvedPrice: null,
        variants: [variant('a', '250000'), variant('b', '200000'), variant('c', '1', 'INACTIVE')],
      }),
    );
    expect(hint).toEqual({ kind: 'from', price: price('200000') });
  });
});

describe('local draft', () => {
  it('raises the quantity when the same item and variant are picked again', () => {
    const first = draftLineFor(item(), null);
    const merged = addToDraft([first], draftLineFor(item(), null));
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe('2');
    expect(addToDraft(merged, draftLineFor(item({ id: 'other' }), null))).toHaveLength(2);
  });

  it('carries the effective fixed composition as context only', () => {
    const line = draftLineFor(
      item({
        type: 'SERVICE',
        fixedComponents: [
          { componentItemId: 'c1', itemName: 'Filter', variantName: null, quantity: '2' },
        ],
      }),
      null,
    );
    expect(line.includes).toEqual(['Filter ×2']);
    expect(line.includedItemIds).toEqual(['c1']);
  });

  it('merges the same resolved selection, but keeps a different additional item separate', () => {
    const needy = (additionalId: string) => ({
      ...draftLineFor(item({ requireAdditionalItemAtSale: true }), null),
      additional: { itemId: additionalId, itemName: additionalId, variantId: null },
    });
    const merged = addToDraft([needy('a')], { ...needy('a'), quantity: '2' });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe('3');
    expect(addToDraft(merged, needy('b'))).toHaveLength(2);
  });

  it('steps the quantity by one without leaving the valid range', () => {
    expect(stepQuantity('1', 1)).toBe('2');
    expect(stepQuantity('2.5', -1)).toBe('1.5');
    expect(stepQuantity('1', -1)).toBe('1');
    expect(stepQuantity('', 1)).toBe('1');
  });

  it('separates items that need a choice from items that can be added at once', () => {
    expect(isConfigurable(item())).toBe(false);
    expect(isConfigurable(item({ variants: [variant('a', '1')] }))).toBe(true);
    expect(isConfigurable(item({ variants: [variant('a', '1', 'INACTIVE')] }))).toBe(false);
    expect(isConfigurable(item({ requireAdditionalItemAtSale: true }))).toBe(true);
    expect(
      isConfigurable(
        item({
          type: 'SERVICE',
          fixedComponents: [{ componentItemId: 'c', itemName: 'F', variantName: null, quantity: '1' }],
        }),
      ),
    ).toBe(false);
  });

  it('is ready only with valid quantities and required additional items chosen', () => {
    const plain = draftLineFor(item(), null);
    expect(draftReady([])).toBe(false);
    expect(draftReady([plain])).toBe(true);
    expect(draftReady([{ ...plain, quantity: '0' }])).toBe(false);
    const needy = draftLineFor(item({ requireAdditionalItemAtSale: true }), null);
    expect(draftReady([needy])).toBe(false);
    expect(
      draftReady([{ ...needy, additional: { itemId: 'p', itemName: 'Oli', variantId: null } }]),
    ).toBe(true);
  });

  it('submits selection intent only: ids and quantity, never names, prices or currency', () => {
    const line = {
      ...draftLineFor(item({ requireAdditionalItemAtSale: true }), variant('v1', '200000')),
      quantity: '2',
      additional: { itemId: 'part', itemName: 'Filter', variantId: 'pv' },
    };
    const [payload] = toSelectionInput([line]);
    expect(payload).toEqual({
      catalogItemId: 'item-1',
      catalogVariantId: 'v1',
      quantity: '2',
      additionalComponents: [{ componentItemId: 'part', componentVariantId: 'pv', quantity: '1' }],
    });
    expect(JSON.stringify(payload)).not.toMatch(/Oli|price|currency|200000/i);
  });
});
