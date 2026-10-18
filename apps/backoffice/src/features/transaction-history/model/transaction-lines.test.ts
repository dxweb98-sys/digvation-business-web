import { describe, expect, it } from 'vitest';

import { retiredSaleLines, transactionItems } from './transaction-lines';
import {
  EMPLOYEE,
  SCENARIOS,
  testComponent,
  testLine,
  testProductLine,
  testSale,
} from './transaction-test-fixtures';

describe('transactionItems', () => {
  it('lists only billed lines with their captured snapshots', () => {
    const sale = testSale({
      lines: [
        testLine(),
        testProductLine(),
        testLine({ id: 'retired', removedAt: '2026-10-01T04:00:00.000Z' }),
      ],
    });
    const items = transactionItems(sale);
    expect(items.map((item) => item.line.id)).toEqual(['line-service', 'line-product']);
    expect(items[0]).toMatchObject({ isService: true });
    expect(items[0]!.line.variantNameSnapshot).toBe('Long Hair');
    expect(retiredSaleLines(sale).map((line) => line.id)).toEqual(['retired']);
  });

  it('names planned Service performers from the Sale read projection, never by id', () => {
    const [item] = transactionItems(SCENARIOS.draft);
    expect(item!.performers).toEqual(['Rina Kartika']);
  });

  it('uses immutable contribution snapshots for finalized work', () => {
    const sale = testSale({
      workEmployees: [{ id: EMPLOYEE.rina, code: 'EMP-001', displayName: 'Rina (renamed)' }],
      lines: [
        testLine({
          contributions: [
            {
              employeeId: EMPLOYEE.rina,
              employeeCodeSnapshot: 'EMP-001',
              employeeDisplayNameSnapshot: 'Rina Kartika',
            },
          ],
        }),
      ],
    });
    expect(transactionItems(sale)[0]!.performers).toEqual(['Rina Kartika']);
  });

  it('keeps per-unit attribution when different units name different employees', () => {
    const [item] = transactionItems(SCENARIOS.inProgress);
    expect(item!.workUnits).toEqual([
      { unitNumber: 1, performers: ['Rina Kartika'] },
      { unitNumber: 2, performers: ['Budi Santoso'] },
    ]);
    expect(transactionItems(SCENARIOS.draft)[0]!.workUnits).toEqual([]);
  });

  it('returns an unknown employee rather than exposing an unresolvable id', () => {
    const sale = testSale({ workEmployees: [] });
    expect(transactionItems(sale)[0]!.performers).toEqual([null]);
  });

  it('shows sale-selected additional items with their own performer, not fixed BOM', () => {
    const sale = testSale({
      lines: [
        testLine({
          compositionComponents: [
            testComponent(),
            testComponent({
              id: 'bom',
              componentSource: 'FIXED_BOM',
              itemNameSnapshot: 'Developer 6%',
              performers: [],
            }),
            testComponent({
              id: 'included',
              position: 2,
              itemNameSnapshot: 'Hair Mask',
              pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
              performers: [],
            }),
          ],
        }),
      ],
    });
    const [item] = transactionItems(sale);
    expect(item!.additionalComponents).toEqual([
      expect.objectContaining({
        name: 'Hair Color Red',
        quantity: '1.0000',
        chargedAmount: '50000.0000',
        performers: ['Citra Ayu'],
      }),
      expect.objectContaining({ name: 'Hair Mask', chargedAmount: null, performers: [] }),
    ]);
  });

  it('prefers finalized component contribution snapshots', () => {
    const sale = testSale({
      lines: [
        testLine({
          compositionComponents: [
            testComponent({
              contributions: [
                {
                  employeeId: EMPLOYEE.citra,
                  employeeCodeSnapshot: 'EMP-002',
                  employeeDisplayNameSnapshot: 'Citra (at finalization)',
                },
              ],
            }),
          ],
        }),
      ],
    });
    expect(transactionItems(sale)[0]!.additionalComponents[0]!.performers).toEqual([
      'Citra (at finalization)',
    ]);
  });

  it('attributes a product to its salesperson, never as a Service performer', () => {
    const [item] = transactionItems(SCENARIOS.productOnly);
    expect(item).toMatchObject({ isService: false, soldBy: 'Dewi Lestari', performers: [] });
  });
});

/** A composed Service line as Runtime captures it: resolved = effective, gross = quantity × effective. */
function composedLine(change: Parameters<typeof testLine>[0] = {}) {
  return testLine({
    itemNameSnapshot: 'Hair Color',
    variantNameSnapshot: 'Red',
    quantity: '1.0000',
    resolvedUnitPrice: '210000.0000',
    overrideAmount: null,
    effectiveUnitPrice: '210000.0000',
    grossAmount: '210000.0000',
    totalAmount: '210000.0000',
    compositionComponents: [
      testComponent({ itemNameSnapshot: 'Red Coloring BRAND', extendedContribution: '10000.0000' }),
    ],
    ...change,
  });
}
const breakdownOf = (line: ReturnType<typeof testLine>) =>
  transactionItems(testSale({ lines: [line] }))[0]!.priceBreakdown;

describe('service price breakdown', () => {
  it('keeps the compact presentation for a Service without additional items', () => {
    expect(breakdownOf(composedLine({ compositionComponents: [] }))).toBeNull();
    expect(breakdownOf(testLine())).toBeNull();
  });

  it('explains a composed price as the Service plus its addition, reconciling to the line', () => {
    expect(breakdownOf(composedLine())).toEqual({
      serviceUnitPrice: '200000.0000',
      serviceAmount: '200000.0000',
      additions: [
        expect.objectContaining({
          name: 'Red Coloring BRAND',
          quantity: '1.0000',
          chargedAmount: '10000.0000',
          lineAmount: '10000.0000',
          performers: ['Citra Ayu'],
        }),
      ],
      totalAmount: '210000.0000',
    });
  });

  it('shows an included addition without an amount, and needs a priced addition to break down', () => {
    const included = testComponent({
      id: 'included',
      position: 1,
      itemNameSnapshot: 'Hair Mask',
      pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
      extendedContribution: '0.0000',
    });
    expect(
      breakdownOf(
        composedLine({
          resolvedUnitPrice: '200000.0000',
          effectiveUnitPrice: '200000.0000',
          grossAmount: '200000.0000',
          compositionComponents: [included],
        }),
      ),
    ).toBeNull();
    const mixed = breakdownOf(
      composedLine({
        compositionComponents: [
          testComponent({
            itemNameSnapshot: 'Red Coloring BRAND',
            extendedContribution: '10000.0000',
          }),
          included,
        ],
      }),
    );
    expect(mixed?.serviceAmount).toBe('200000.0000');
    expect(mixed?.additions.map((addition) => [addition.name, addition.lineAmount])).toEqual([
      ['Red Coloring BRAND', '10000.0000'],
      ['Hair Mask', null],
    ]);
  });

  it('reconciles several sale-selected additions to the composed amount', () => {
    const breakdown = breakdownOf(
      composedLine({
        resolvedUnitPrice: '225000.0000',
        effectiveUnitPrice: '225000.0000',
        grossAmount: '225000.0000',
        compositionComponents: [
          testComponent({
            id: 'red',
            itemNameSnapshot: 'Red Coloring BRAND',
            extendedContribution: '10000.0000',
          }),
          testComponent({
            id: 'vitamin',
            position: 1,
            itemNameSnapshot: 'Vitamin Serum',
            quantity: '2.0000',
            pricingMode: 'FIXED_COMPONENT_PRICE',
            extendedContribution: '15000.0000',
          }),
        ],
      }),
    );
    expect(breakdown?.serviceAmount).toBe('200000.0000');
    expect(breakdown?.additions.map((addition) => addition.lineAmount)).toEqual([
      '10000.0000',
      '15000.0000',
    ]);
    expect(breakdown?.totalAmount).toBe('225000.0000');
  });

  it('keeps quantity and line amounts understandable for more than one unit', () => {
    expect(breakdownOf(composedLine({ quantity: '2.0000', grossAmount: '420000.0000' }))).toEqual(
      expect.objectContaining({
        serviceUnitPrice: '200000.0000',
        serviceAmount: '400000.0000',
        additions: [
          expect.objectContaining({ chargedAmount: '10000.0000', lineAmount: '20000.0000' }),
        ],
        totalAmount: '420000.0000',
      }),
    );
  });

  it('keeps fixed composition bundled in the Service price and never lists it', () => {
    const breakdown = breakdownOf(
      composedLine({
        compositionComponents: [
          testComponent({
            id: 'fixed',
            componentSource: 'FIXED_BOM',
            itemNameSnapshot: 'Developer',
            pricingMode: 'FIXED_COMPONENT_PRICE',
            extendedContribution: '5000.0000',
          }),
          testComponent({
            id: 'red',
            position: 1,
            itemNameSnapshot: 'Red Coloring BRAND',
            extendedContribution: '10000.0000',
          }),
        ],
      }),
    );
    expect(breakdown?.serviceAmount).toBe('200000.0000');
    expect(breakdown?.additions.map((addition) => addition.name)).toEqual(['Red Coloring BRAND']);
  });

  it('never derives a historical base price from a manual price override', () => {
    expect(
      breakdownOf(
        composedLine({
          overrideAmount: '180000.0000',
          effectiveUnitPrice: '180000.0000',
          grossAmount: '180000.0000',
          totalAmount: '180000.0000',
        }),
      ),
    ).toBeNull();
  });

  it('keeps the plain presentation when the snapshot does not reconcile or is incomplete', () => {
    expect(breakdownOf(composedLine({ grossAmount: '220000.0000' }))).toBeNull();
    const withoutResolvedPrice = composedLine();
    delete withoutResolvedPrice.resolvedUnitPrice;
    expect(breakdownOf(withoutResolvedPrice)).toBeNull();
    expect(
      breakdownOf(
        composedLine({ resolvedUnitPrice: '5000.0000', effectiveUnitPrice: '5000.0000' }),
      ),
    ).toBeNull();
  });
});
