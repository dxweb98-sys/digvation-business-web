import { describe, expect, it } from 'vitest';

import type {
  CatalogItem,
  ComponentCandidate,
} from '../transaction/model/cashier-transaction.types';
import {
  additionalItemsOf,
  additionalRowIssue,
  candidatesForRow,
  configuratorReadiness,
  fixedComponentsFor,
  opensItemConfigurator,
  priceSummary,
  stepQuantity,
  type AdditionalRow,
} from './item-configurator-model';

const price = (amount: string) => ({
  catalogPriceId: 'p',
  catalogItemId: 'x',
  catalogVariantId: null,
  locationId: null,
  currency: 'IDR',
  amount,
  effectiveAt: '',
  sourceScope: { catalogVariantId: null, locationId: null },
});

const candidate = (
  overrides: Partial<ComponentCandidate> & { id: string; name: string },
): ComponentCandidate => ({
  code: overrides.id.toUpperCase(),
  productUsage: 'STANDALONE_AND_COMPONENT',
  variantSelectionMode: 'OPTIONAL',
  resolvedPrice: price('10000.0000'),
  variants: [],
  ...overrides,
});

const cap = candidate({ id: 'cap', name: 'Hair Cap', productUsage: 'COMPONENT_ONLY' });
const dye = candidate({ id: 'dye', name: 'Hair Dye' });
const treatment = candidate({
  id: 'treatment',
  name: 'Hair Treatment',
  variantSelectionMode: 'REQUIRED',
  resolvedPrice: null,
  variants: [
    {
      id: 'premium',
      code: 'PREMIUM',
      name: 'Premium',
      status: 'ACTIVE',
      version: 1,
      createdAt: '',
      updatedAt: '',
      catalogItemId: 'treatment',
      resolvedPrice: price('20000.0000'),
    },
    {
      id: 'basic',
      code: 'BASIC',
      name: 'Basic',
      status: 'ACTIVE',
      version: 1,
      createdAt: '',
      updatedAt: '',
      catalogItemId: 'treatment',
      resolvedPrice: null,
    },
  ],
});
const serum = candidate({ id: 'serum', name: 'Serum', resolvedPrice: price('5000.0000') });
const all = [cap, dye, treatment, serum];

const row = (overrides: Partial<AdditionalRow> = {}): AdditionalRow => ({
  key: 'r1',
  candidateId: null,
  variantId: null,
  performers: [],
  quantity: '1',
  ...overrides,
});
const fixed = [
  {
    componentItemId: 'cap',
    componentVariantId: null,
    itemName: 'Hair Cap',
    variantName: null,
    quantity: '1.0000',
  },
  {
    componentItemId: 'dye',
    componentVariantId: 'dye-red',
    itemName: 'Hair Dye',
    variantName: 'Red',
    quantity: '1.0000',
  },
];

describe('opensItemConfigurator', () => {
  const simple = {} as Pick<CatalogItem, 'requireAdditionalItemAtSale'>;

  it('opens for every sellable item added to the cart', () => {
    expect(opensItemConfigurator('CART', simple)).toBe(true);
    expect(opensItemConfigurator('CART', { requireAdditionalItemAtSale: true })).toBe(true);
  });

  it('keeps the inline adjustment choice unless the item (Product or Service) needs additional items', () => {
    expect(opensItemConfigurator('TRANSACTION_ADJUSTMENT', simple)).toBe(false);
    expect(
      opensItemConfigurator('TRANSACTION_ADJUSTMENT', { requireAdditionalItemAtSale: true }),
    ).toBe(true);
  });
});

describe('fixed components', () => {
  it("uses the variant's own effective list when a variant is selected, else the item's", () => {
    const item = { fixedComponents: [fixed[0]!] };
    expect(fixedComponentsFor(item, { fixedComponents: [fixed[1]!] })).toEqual([fixed[1]]);
    expect(fixedComponentsFor(item, null)).toEqual([fixed[0]]);
    expect(fixedComponentsFor({}, null)).toEqual([]);
  });
});

describe('additional item candidates', () => {
  it('excludes fixed BOM Products, keeps everything else including component-only Products', () => {
    const offered = candidatesForRow(all, [fixed[1]!], [row()], 'r1');
    expect(offered.map((c) => c.id)).toEqual(['cap', 'treatment', 'serum']);
    expect(offered.find((c) => c.id === 'cap')?.productUsage).toBe('COMPONENT_ONLY');
    expect(candidatesForRow(all, fixed, [row()], 'r1').map((c) => c.id)).toEqual([
      'treatment',
      'serum',
    ]);
  });

  it('excludes Products already selected in another row and restores them when removed', () => {
    const rows = [row({ key: 'r1', candidateId: 'serum' }), row({ key: 'r2' })];
    expect(candidatesForRow(all, [], rows, 'r2').map((c) => c.id)).not.toContain('serum');
    // The row's own choice stays visible.
    expect(candidatesForRow(all, [], rows, 'r1').map((c) => c.id)).toContain('serum');
    // Removing the first row makes the Product a candidate again.
    expect(candidatesForRow(all, [], [row({ key: 'r2' })], 'r2').map((c) => c.id)).toContain(
      'serum',
    );
  });
});

describe('additional row validation', () => {
  it('requires a Product', () => {
    expect(additionalRowIssue(row(), undefined)).toBe('PRODUCT_REQUIRED');
  });

  it('requires an explicit variant when selection is required, by id', () => {
    expect(additionalRowIssue(row({ candidateId: 'treatment' }), treatment)).toBe(
      'VARIANT_REQUIRED',
    );
    expect(
      additionalRowIssue(row({ candidateId: 'treatment', variantId: 'premium' }), treatment),
    ).toBeNull();
  });

  it('rejects a variant without a price and non-positive quantities', () => {
    expect(
      additionalRowIssue(row({ candidateId: 'treatment', variantId: 'basic' }), treatment),
    ).toBe('PRICE_UNAVAILABLE');
    expect(additionalRowIssue(row({ candidateId: 'serum', quantity: '0' }), serum)).toBe(
      'QUANTITY_INVALID',
    );
    expect(additionalRowIssue(row({ candidateId: 'serum', quantity: '2' }), serum)).toBeNull();
  });
});

describe('add to cart readiness', () => {
  const base = {
    needsVariantChoice: false,
    selectedVariantChoice: null,
    selectionPrice: '150000.0000',
    quantity: '1',
    additionalRequired: false,
    rows: [] as AdditionalRow[],
    candidates: all,
  };

  it('is ready for a simple item', () => {
    expect(configuratorReadiness(base).ready).toBe(true);
  });

  it('waits for a variant and a valid price and quantity', () => {
    expect(
      configuratorReadiness({ ...base, needsVariantChoice: true, selectedVariantChoice: null })
        .ready,
    ).toBe(false);
    expect(configuratorReadiness({ ...base, selectionPrice: null }).ready).toBe(false);
    expect(configuratorReadiness({ ...base, quantity: '0' }).ready).toBe(false);
  });

  it('stays disabled until at least one valid additional item exists when required', () => {
    const required = { ...base, additionalRequired: true };
    expect(configuratorReadiness({ ...required, rows: [row()] })).toEqual({
      ready: false,
      additionalMissing: true,
    });
    expect(
      configuratorReadiness({ ...required, rows: [row({ candidateId: 'treatment' })] }).ready,
    ).toBe(false);
    expect(
      configuratorReadiness({ ...required, rows: [row({ candidateId: 'serum' })] }).ready,
    ).toBe(true);
  });

  it('asks the operator to finish or remove a half-filled extra row', () => {
    expect(
      configuratorReadiness({
        ...base,
        additionalRequired: true,
        rows: [row({ candidateId: 'serum' }), row({ key: 'r2' })],
      }).ready,
    ).toBe(false);
  });
});

describe('additional items and price summary', () => {
  it('maps valid rows to canonical ids with readable labels and their offered prices', () => {
    const items = additionalItemsOf(
      [
        row({ key: 'a', candidateId: 'treatment', variantId: 'premium', quantity: '2' }),
        row({ key: 'b', candidateId: 'serum', quantity: '1' }),
        row({ key: 'c' }),
      ],
      all,
    );
    expect(items).toEqual([
      {
        componentItemId: 'treatment',
        componentVariantId: 'premium',
        quantity: '2.0000',
        label: 'Hair Treatment / Premium',
        unitPrice: '20000.0000',
      },
      { componentItemId: 'serum', quantity: '1.0000', label: 'Serum', unitPrice: '5000.0000' },
    ]);
  });

  it('adds additional contributions per unit and multiplies by quantity without floating point', () => {
    const items = additionalItemsOf(
      [
        row({ key: 'a', candidateId: 'treatment', variantId: 'premium', quantity: '2' }),
        row({ key: 'b', candidateId: 'serum', quantity: '1' }),
      ],
      all,
    );
    expect(priceSummary({ servicePrice: '200000.0000', additional: items, quantity: '3' })).toEqual(
      {
        additionalUnit: '45000.0000',
        unit: '245000.0000',
        total: '735000.0000',
      },
    );
    expect(priceSummary({ servicePrice: '0.1', additional: [], quantity: '3' }).total).toBe(
      '0.3000',
    );
  });
});

describe('quantity stepper', () => {
  it('steps by one and never goes below one', () => {
    expect(stepQuantity('1', 1)).toBe('2');
    expect(stepQuantity('2', -1)).toBe('1');
    expect(stepQuantity('1', -1)).toBe('1');
    expect(stepQuantity('abc', 1)).toBe('2');
  });
});
