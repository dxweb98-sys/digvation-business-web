import { describe, expect, it } from 'vitest';

import type { CatalogItem } from './cashier-transaction.types';
import {
  catalogItemMatchesSearch,
  isStandaloneSellable,
  visibleCatalogItems,
} from './selling-catalog-eligibility';

describe('isStandaloneSellable', () => {
  it('keeps active standalone Products and Services selectable', () => {
    expect(
      isStandaloneSellable({ lifecycle: 'ACTIVE', productUsage: 'STANDALONE_AND_COMPONENT' }),
    ).toBe(true);
    // Runtime omits usage for Services and older payloads; those stay sellable.
    expect(isStandaloneSellable({ lifecycle: 'ACTIVE' })).toBe(true);
  });

  it('hides component-only Products from the normal selling catalog', () => {
    expect(isStandaloneSellable({ lifecycle: 'ACTIVE', productUsage: 'COMPONENT_ONLY' })).toBe(
      false,
    );
  });

  it('still requires an active lifecycle', () => {
    expect(
      isStandaloneSellable({ lifecycle: 'INACTIVE', productUsage: 'STANDALONE_AND_COMPONENT' }),
    ).toBe(false);
  });
});

describe('standalone selling catalog with Service components', () => {
  const base = {
    categoryId: null,
    description: null,
    lifecycle: 'ACTIVE' as const,
    variantSelectionMode: 'OPTIONAL' as const,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    serviceDefinition: null,
  };
  const catalog: CatalogItem[] = [
    {
      ...base,
      id: 'cap',
      code: 'CAP',
      name: 'Disposable Cap',
      type: 'PRODUCT',
      fulfillmentBehavior: 'INSTANT',
      productUsage: 'COMPONENT_ONLY',
    },
    {
      ...base,
      id: 'shampoo',
      code: 'SHAMPOO',
      name: 'Shampoo',
      type: 'PRODUCT',
      fulfillmentBehavior: 'INSTANT',
      productUsage: 'STANDALONE_AND_COMPONENT',
    },
    {
      // A Service that uses the component-only Product; Services carry no usage classification.
      ...base,
      id: 'creambath',
      code: 'CREAMBATH',
      name: 'Creambath',
      type: 'SERVICE',
      fulfillmentBehavior: 'TRACKED',
    },
  ];

  it('drops only the component-only Product; the Service using it and standalone Products stay selectable', () => {
    const selectable = catalog.filter(isStandaloneSellable);

    expect(selectable.map((item) => item.name)).toEqual(['Shampoo', 'Creambath']);
    expect(selectable.some((item) => item.id === 'cap')).toBe(false);
    expect(selectable.find((item) => item.type === 'SERVICE')?.name).toBe('Creambath');
  });
});

describe('catalogItemMatchesSearch (item-level search including active variants)', () => {
  const paint = {
    name: 'Cat Dulux',
    code: 'CAT-001',
    variants: [
      { name: 'Merah', code: 'CAT-001-RED', status: 'ACTIVE' as const },
      { name: 'Merah Marun', code: 'CAT-001-MRN', status: 'ACTIVE' as const },
      { name: 'Hijau', code: 'CAT-001-GRN', status: 'INACTIVE' as const },
    ],
  };
  const match = (search: string, item: Parameters<typeof catalogItemMatchesSearch>[0] = paint) =>
    catalogItemMatchesSearch(item, search.trim().toLocaleLowerCase('id-ID'), 'id-ID');

  it('matches by item name and item code', () => {
    expect(match('dulux')).toBe(true);
    expect(match('cat-001')).toBe(true);
  });

  it('matches the parent item by active variant name or code, case-insensitively', () => {
    expect(match('Merah')).toBe(true);
    expect(match('cat-001-RED')).toBe(true);
    expect(match('MERAH')).toBe(true);
  });

  it('ignores inactive variants and hides an unmatched item', () => {
    expect(match('Hijau')).toBe(false);
    expect(match('CAT-001-GRN')).toBe(false);
    expect(match('biru')).toBe(false);
  });

  it('keeps everything on an empty search and works for items without variants', () => {
    expect(match('')).toBe(true);
    expect(match('  ')).toBe(true);
    expect(match('Merah', { name: 'Jasa', code: 'SVC-1' })).toBe(false);
    expect(match('svc', { name: 'Jasa', code: 'SVC-1' })).toBe(true);
  });
});

describe('visibleCatalogItems (the catalog grid: category + search, item-level)', () => {
  const variant = (name: string, code: string, status: 'ACTIVE' | 'INACTIVE') => ({
    name,
    code,
    status,
  });
  const hairColor = {
    id: 'hair-color',
    name: 'Hair Color',
    code: 'SVC-000001',
    categoryId: 'hair',
    variants: [variant('Red', 'HR', 'ACTIVE'), variant('Blue', 'HB', 'INACTIVE')],
  };
  const eye = {
    id: 'eye',
    name: 'Eye Treatment',
    code: 'SVC-000005',
    categoryId: 'lash',
    variants: [
      variant('Soft Natural Eyelash', 'VAR-4', 'ACTIVE'),
      variant('Glam Fashion Eyelash', 'VAR-5', 'ACTIVE'),
      variant('Under Eyelash', 'VAR-6', 'ACTIVE'),
    ],
  };
  const items = [hairColor, eye];
  const show = (search: string, categoryId = '') =>
    visibleCatalogItems(items, { search, categoryId, locale: 'id-ID' }).map((item) => item.id);

  it('keeps the parent item visible for an active variant name or code', () => {
    expect(show('red')).toEqual(['hair-color']);
    expect(show('RED')).toEqual(['hair-color']);
    expect(show('hr')).toEqual(['hair-color']);
  });

  it('does not match through an inactive variant', () => {
    expect(show('blue')).toEqual([]);
    expect(show('hb')).toEqual([]);
  });

  it('lists an item once even when several variants match', () => {
    expect(show('eyelash')).toEqual(['eye']);
  });

  it('never lets search bypass the category filter', () => {
    expect(show('red', 'hair')).toEqual(['hair-color']);
    expect(show('red', 'lash')).toEqual([]);
    expect(show('', 'lash')).toEqual(['eye']);
  });

  it('shows the whole (category-filtered) catalog for an empty search', () => {
    expect(show('')).toEqual(['hair-color', 'eye']);
  });
});
