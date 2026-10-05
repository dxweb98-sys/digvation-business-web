import { describe, expect, it } from 'vitest';

import type { CatalogItem, ResolvedPrice, SaleLine } from './cashier-transaction.types';
import { isCompatibleLine, type AddItemConfiguration } from './use-sale-workspace-controller';

const catalogItem: CatalogItem = {
  id: 'shampoo',
  code: 'SHAMPOO',
  name: 'Shampoo',
  type: 'PRODUCT',
  categoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  version: 1,
  createdAt: '',
  updatedAt: '',
  serviceDefinition: null,
};

const resolvedPrice: ResolvedPrice = {
  catalogPriceId: 'price-1',
  catalogItemId: 'shampoo',
  catalogVariantId: null,
  locationId: null,
  currency: 'IDR',
  amount: '85000.0000',
  effectiveAt: '',
  sourceScope: { catalogVariantId: null, locationId: null },
};

const line = (overrides: Partial<SaleLine> = {}): SaleLine =>
  ({
    id: 'line-1',
    removedAt: null,
    catalogItemId: 'shampoo',
    catalogVariantId: null,
    catalogPriceId: 'price-1',
    resolvedUnitPrice: '85000.0000',
    effectiveUnitPrice: '85000.0000',
    overrideAmount: null,
    overrideReason: null,
    discountType: null,
    discountValue: null,
    discountReason: null,
    fulfillmentBehaviorSnapshot: 'INSTANT',
    employeeAssignmentModeSnapshot: null,
    allowEmployeeContributionSnapshot: false,
    defaultDurationMinutesSnapshot: null,
    fulfillment: null,
    participations: [],
    contributions: [],
    compositionComponents: [],
    ...overrides,
  }) as SaleLine;

const configuration = (
  soldBy?: { employeeId: string; name: string } | null,
): AddItemConfiguration => ({
  catalogItem,
  catalogVariant: null,
  resolvedPrice,
  ...(soldBy === undefined ? {} : { soldBy }),
});

describe('persisted Sale line merge identity with a salesperson', () => {
  const andi = { employeeId: 'emp-andi', name: 'Andi' };
  const sold = (employeeId: string | null) =>
    line({ soldByEmployeeId: employeeId, soldByEmployeeNameSnapshot: employeeId ? 'x' : null });

  it('merges the same Product sold by the same salesperson', () => {
    expect(isCompatibleLine(sold('emp-andi'), undefined, configuration(andi))).toBe(true);
  });

  it('does not merge a different salesperson', () => {
    expect(
      isCompatibleLine(
        sold('emp-andi'),
        undefined,
        configuration({ employeeId: 'emp-budi', name: 'Budi' }),
      ),
    ).toBe(false);
  });

  it('does not merge a salesperson line with a line without one, in either direction', () => {
    expect(isCompatibleLine(sold('emp-andi'), undefined, configuration())).toBe(false);
    expect(isCompatibleLine(sold(null), undefined, configuration(andi))).toBe(false);
  });

  it('still merges two lines without a salesperson, including an older Runtime line with no field', () => {
    expect(isCompatibleLine(sold(null), undefined, configuration())).toBe(true);
    expect(isCompatibleLine(line(), undefined, configuration(null))).toBe(true);
  });
});
