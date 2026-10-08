import { describe, expect, it } from 'vitest';

import {
  allocationFromRates,
  allocationRates,
  emptyAllocation,
  evenAllocation,
  formatUnitRanges,
  groupAllocations,
  parsePercent,
  resolveAllocation,
  withEmployees,
  withShare,
} from './service-performer-allocation';

const pick = (...ids: string[]) => withEmployees(emptyAllocation(), ids);
const shares = (allocation: Parameters<typeof resolveAllocation>[0]) =>
  resolveAllocation(allocation).shares.map((share) => share.basisPoints);

describe('service performer allocation', () => {
  it('gives one employee 100% and splits several evenly', () => {
    expect(shares(pick('a'))).toEqual([10000]);
    expect(shares(pick('a', 'b'))).toEqual([5000, 5000]);
    expect(shares(pick('a', 'b', 'c', 'd'))).toEqual([2500, 2500, 2500, 2500]);
  });

  it('resolves an even split of three to exactly 100%', () => {
    const resolved = resolveAllocation(pick('a', 'b', 'c'));
    expect(resolved.shares.map((share) => share.basisPoints)).toEqual([3334, 3333, 3333]);
    expect(resolved.total).toBe(10000);
    expect(allocationRates(pick('a', 'b', 'c')).map((rate) => rate.shareRate)).toEqual([
      '0.3334',
      '0.3333',
      '0.3333',
    ]);
  });

  it('shares the rest among employees without a typed share', () => {
    let allocation = withShare(pick('rindu', 'jessica', 'rifna', 'silva'), 'rindu', 4000);
    expect(shares(allocation)).toEqual([4000, 2000, 2000, 2000]);
    allocation = withShare(allocation, 'jessica', 3000);
    const resolved = resolveAllocation(allocation);
    expect(resolved.shares).toEqual([
      { employeeId: 'rindu', basisPoints: 4000, manual: true },
      { employeeId: 'jessica', basisPoints: 3000, manual: true },
      { employeeId: 'rifna', basisPoints: 1500, manual: false },
      { employeeId: 'silva', basisPoints: 1500, manual: false },
    ]);
    expect(resolved.issue).toBeNull();
  });

  it('recalculates when an employee is removed or added', () => {
    const typed = withShare(
      withShare(pick('rindu', 'jessica', 'rifna', 'silva'), 'rindu', 4000),
      'jessica',
      3000,
    );
    expect(shares(withEmployees(typed, ['rindu', 'jessica', 'rifna']))).toEqual([4000, 3000, 3000]);
    expect(shares(withEmployees(typed, ['rindu', 'jessica', 'rifna', 'silva', 'budi']))).toEqual([
      4000, 3000, 1000, 1000, 1000,
    ]);
    expect(shares(withEmployees(typed, ['jessica']))).toEqual([10000]);
  });

  it('returns the latest typed share to automatic when the rest no longer fits', () => {
    const full = withShare(withShare(pick('a', 'b'), 'a', 7000), 'b', 3000);
    expect(resolveAllocation(full).issue).toBeNull();
    const added = withEmployees(full, ['a', 'b', 'c']);
    expect(resolveAllocation(added).shares).toEqual([
      { employeeId: 'a', basisPoints: 7000, manual: true },
      { employeeId: 'b', basisPoints: 1500, manual: false },
      { employeeId: 'c', basisPoints: 1500, manual: false },
    ]);
    const removed = withEmployees(withShare(pick('a', 'b', 'c'), 'a', 6000), ['a', 'b']);
    expect(shares(removed)).toEqual([6000, 4000]);
  });

  it('reports typed shares that exceed or miss 100%', () => {
    expect(resolveAllocation(withShare(pick('a', 'b'), 'a', 10000)).issue).toBe('OVER');
    const over = withShare(withShare(pick('a', 'b', 'c'), 'a', 6000), 'b', 5000);
    expect(resolveAllocation(over).issue).toBe('OVER');
    const under = withShare(withShare(pick('a', 'b'), 'a', 6000), 'b', 3000);
    expect(resolveAllocation(under).issue).toBe('UNDER');
    expect(resolveAllocation(emptyAllocation()).issue).toBe('EMPTY');
    expect(shares(evenAllocation(under))).toEqual([5000, 5000]);
  });

  it('restores persisted shares and treats even rates as an even split', () => {
    expect(
      allocationFromRates([
        { employeeId: 'a', shareRate: '0.333333333333333334' },
        { employeeId: 'b', shareRate: '0.333333333333333333' },
        { employeeId: 'c', shareRate: '0.333333333333333333' },
      ]).manual,
    ).toEqual([]);
    const restored = allocationFromRates([
      { employeeId: 'a', shareRate: '0.7' },
      { employeeId: 'b', shareRate: '0.3' },
    ]);
    expect(shares(restored)).toEqual([7000, 3000]);
    expect(allocationRates(restored)).toEqual([
      { employeeId: 'a', shareRate: '0.7' },
      { employeeId: 'b', shareRate: '0.3' },
    ]);
    expect(
      allocationFromRates([
        { employeeId: 'a', shareRate: null },
        { employeeId: 'b', shareRate: null },
      ]).manual,
    ).toEqual([]);
  });

  it('reads percentages typed with a comma or a dot', () => {
    expect(parsePercent('40')).toBe(4000);
    expect(parsePercent('33,5')).toBe(3350);
    expect(parsePercent('12.25')).toBe(1225);
    expect(parsePercent('100')).toBe(10000);
    expect(parsePercent('0')).toBeNull();
    expect(parsePercent('101')).toBeNull();
    expect(parsePercent('1.234')).toBeNull();
    expect(parsePercent('')).toBeNull();
  });

  it('states identical unit assignments once and keeps differing ones apart', () => {
    const pair = withShare(pick('a', 'b'), 'a', 3000);
    const groups = groupAllocations([pair, pair, pick('b'), pair, pair]);
    expect(groups.map((group) => group.unitNumbers)).toEqual([[1, 2, 4, 5], [3]]);
    expect(groupAllocations([pair, pair, pair])).toHaveLength(1);
    expect(groupAllocations([pick('a'), emptyAllocation()]).map((g) => g.unitNumbers)).toEqual([
      [1],
      [2],
    ]);
  });

  it('writes unit numbers as compact ranges', () => {
    expect(formatUnitRanges([1, 2, 4, 5, 6, 9])).toBe('1–2, 4–6, 9');
    expect(formatUnitRanges([3])).toBe('3');
    expect(formatUnitRanges([])).toBe('');
  });
});
