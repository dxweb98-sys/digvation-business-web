import { describe, expect, it } from 'vitest';

import type { SaleLine } from './cashier-transaction.types';
import {
  serviceWorkUnitAllocations,
  serviceWorkUnitCount,
} from './components/service-performers-dialog';
import { resolveAllocation } from './service-performer-allocation';

const performers = (value: SaleLine) =>
  serviceWorkUnitAllocations(value).map((allocation) => allocation.employeeIds);

const line = (changes: Partial<SaleLine>): SaleLine =>
  ({
    quantity: '1.0000',
    participations: [],
    workUnits: [],
    ...changes,
  }) as unknown as SaleLine;

const assigned = (employeeId: string) => ({
  saleId: 's',
  saleLineId: 'l',
  employeeId,
  assigned: true,
  shareRate: null,
});

describe('service work units', () => {
  it('treats each whole unit of quantity as one work unit', () => {
    expect(serviceWorkUnitCount(line({ quantity: '3.0000' }))).toBe(3);
    expect(serviceWorkUnitCount(line({ quantity: '1.0000' }))).toBe(1);
    expect(serviceWorkUnitCount(line({ quantity: '1.5000' }))).toBe(1);
  });

  it('reads the per-unit plan persisted by Runtime', () => {
    expect(
      performers(
        line({
          quantity: '2.0000',
          workUnits: [
            { unitNumber: 1, employeeIds: ['a'] },
            { unitNumber: 2, employeeIds: ['b', 'c'] },
          ],
        }),
      ),
    ).toEqual([['a'], ['b', 'c']]);
  });

  it('leaves added units empty once a plan exists', () => {
    expect(
      performers(line({ quantity: '2.0000', workUnits: [{ unitNumber: 1, employeeIds: ['a'] }] })),
    ).toEqual([['a'], []]);
  });

  it('restores the persisted contribution share of each unit', () => {
    const [first, second] = serviceWorkUnitAllocations(
      line({
        quantity: '2.0000',
        workUnits: [
          {
            unitNumber: 1,
            employeeIds: ['a', 'b'],
            performers: [
              { employeeId: 'a', shareRate: '0.7' },
              { employeeId: 'b', shareRate: '0.3' },
            ],
          },
          { unitNumber: 2, employeeIds: ['b'], performers: [{ employeeId: 'b', shareRate: '1' }] },
        ],
      }),
    );
    expect(resolveAllocation(first!).shares.map((share) => share.basisPoints)).toEqual([
      7000, 3000,
    ]);
    expect(resolveAllocation(second!).shares).toEqual([
      { employeeId: 'b', basisPoints: 10000, manual: false },
    ]);
  });

  it('starts a line assigned at line level with those performers on every unit', () => {
    expect(
      performers(line({ quantity: '2.0000', participations: [assigned('a'), assigned('b')] })),
    ).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ]);
  });
});
