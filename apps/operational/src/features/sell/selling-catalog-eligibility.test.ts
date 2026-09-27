import { describe, expect, it } from 'vitest';

import type { CatalogItem } from './cashier-transaction.types';
import { isStandaloneSellable } from './selling-catalog-eligibility';

describe('isStandaloneSellable', () => {
  it('keeps active standalone Products and Services selectable', () => {
    expect(isStandaloneSellable({ lifecycle: 'ACTIVE', productUsage: 'STANDALONE_AND_COMPONENT' })).toBe(
      true,
    );
    // Runtime omits usage for Services and older payloads; those stay sellable.
    expect(isStandaloneSellable({ lifecycle: 'ACTIVE' })).toBe(true);
  });

  it('hides component-only Products from the normal selling catalog', () => {
    expect(isStandaloneSellable({ lifecycle: 'ACTIVE', productUsage: 'COMPONENT_ONLY' })).toBe(false);
  });

  it('still requires an active lifecycle', () => {
    expect(isStandaloneSellable({ lifecycle: 'INACTIVE', productUsage: 'STANDALONE_AND_COMPONENT' })).toBe(
      false,
    );
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
