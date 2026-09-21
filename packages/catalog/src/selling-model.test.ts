import { describe, expect, it } from 'vitest';

import {
  catalogItemSellsDirectly,
  resolveCatalogSellingModel,
} from './selling-model';

describe('catalog selling model', () => {
  it('keeps parent items directly sellable when there are no active variants', () => {
    expect(resolveCatalogSellingModel(false, 'REQUIRED')).toBe('DIRECT');
    expect(catalogItemSellsDirectly('DIRECT')).toBe(true);
  });

  it('requires a variant when active variants exist and Runtime says REQUIRED', () => {
    const model = resolveCatalogSellingModel(true, 'REQUIRED');
    expect(model).toBe('VARIANT_REQUIRED');
    expect(catalogItemSellsDirectly(model)).toBe(false);
  });

  it('allows parent item plus variants when Runtime says OPTIONAL', () => {
    const model = resolveCatalogSellingModel(true, 'OPTIONAL');
    expect(model).toBe('ITEM_AND_VARIANTS');
    expect(catalogItemSellsDirectly(model)).toBe(true);
  });
});
