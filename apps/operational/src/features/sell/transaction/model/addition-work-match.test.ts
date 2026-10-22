import { describe, expect, it } from 'vitest';

import type { SaleLine } from './cashier-transaction.types';
import { additionWork, type SaleLineAddition } from './sale-line-additions';

const employees = [
  { id: 'andini', displayName: 'Andini' },
  { id: 'rindu', displayName: 'Rindu' },
  { id: 'jessica', displayName: 'Jessica' },
];

/** An open Service line performed by the given employees and contribution shares. */
function service(performers: Array<[string, string | null]>) {
  return {
    itemTypeSnapshot: 'SERVICE',
    participations: performers.map(([employeeId, shareRate]) => ({
      employeeId,
      assigned: true,
      shareRate,
    })),
    workUnits: [],
    contributions: [],
  } as unknown as Pick<
    SaleLine,
    'itemTypeSnapshot' | 'participations' | 'workUnits' | 'contributions'
  >;
}

function own(
  performers: Array<[string, string]>,
): Pick<
  SaleLineAddition,
  'performerIds' | 'performerSnapshots' | 'performerAssignment' | 'performerRates'
> {
  return {
    performerIds: performers.map(([employeeId]) => employeeId),
    performerRates: performers.map(([employeeId, shareRate]) => ({ employeeId, shareRate })),
    performerSnapshots: {},
    performerAssignment: 'OWN',
  };
}

const work = (addition: ReturnType<typeof own>, line: ReturnType<typeof service>) =>
  additionWork(addition, line, employees, 'Karyawan')!;

describe('additionWork recognises own employees that match the main Service', () => {
  it('one employee matching the main Service', () => {
    expect(work(own([['andini', '1']]), service([['andini', '1']])).match).toBe('SAME');
  });

  it('two employees match whatever the order', () => {
    const result = work(
      own([
        ['rindu', '0.5'],
        ['andini', '0.5'],
      ]),
      service([
        ['andini', '0.5'],
        ['rindu', '0.5'],
      ]),
    );
    expect(result.match).toBe('SAME');
    expect(result.state).toBe('OWN');
  });

  it('a partial or a larger set is not a match', () => {
    const parent = service([
      ['andini', '0.5'],
      ['rindu', '0.5'],
    ]);
    expect(work(own([['andini', '1']]), parent).match).toBe('NONE');
    expect(
      work(
        own([
          ['andini', '0.4'],
          ['rindu', '0.3'],
          ['jessica', '0.3'],
        ]),
        parent,
      ).match,
    ).toBe('NONE');
  });

  it('the same employees with different exact shares are only the same employees', () => {
    const result = work(
      own([
        ['andini', '0.7'],
        ['rindu', '0.3'],
      ]),
      service([
        ['andini', '0.500000000000000000'],
        ['rindu', '0.500000000000000000'],
      ]),
    );
    expect(result.match).toBe('SAME_EMPLOYEES');
    expect(result.shares).toEqual([
      { name: 'Andini', shareRate: '0.7' },
      { name: 'Rindu', shareRate: '0.3' },
    ]);
  });

  it('compares exact values, not their written form', () => {
    expect(
      work(
        own([
          ['andini', '0.5'],
          ['rindu', '0.5'],
        ]),
        service([
          ['andini', '0.500000000000000000'],
          ['rindu', '0.500000000000000000'],
        ]),
      ).match,
    ).toBe('SAME');
  });

  it('a Service without contribution shares splits equally, as Runtime does', () => {
    expect(
      work(
        own([
          ['andini', '0.5'],
          ['rindu', '0.5'],
        ]),
        service([
          ['andini', null],
          ['rindu', null],
        ]),
      ).match,
    ).toBe('SAME');
  });

  it('never matches when the main Service has nobody', () => {
    expect(work(own([['andini', '1']]), service([])).match).toBe('NONE');
  });

  it('own employees stay as chosen when the main Service changes; only the match is recomputed', () => {
    const addition = own([['andini', '1']]);
    expect(work(addition, service([['andini', '1']])).match).toBe('SAME');
    const changed = work(addition, service([['rindu', '1']]));
    expect(changed.match).toBe('NONE');
    expect(changed.names).toEqual(['Andini']);
    expect(changed.state).toBe('OWN');
  });

  it('following the main Service takes its current employees and shares', () => {
    const follows = { ...own([]), performerAssignment: 'SERVICE' as const };
    const result = work(
      follows,
      service([
        ['andini', '0.6'],
        ['rindu', '0.4'],
      ]),
    );
    expect(result.state).toBe('SERVICE');
    expect(result.shares).toEqual([
      { name: 'Andini', shareRate: '0.6' },
      { name: 'Rindu', shareRate: '0.4' },
    ]);
    expect(work(follows, service([['jessica', '1']])).names).toEqual(['Jessica']);
  });
});
