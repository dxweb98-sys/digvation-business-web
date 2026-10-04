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
