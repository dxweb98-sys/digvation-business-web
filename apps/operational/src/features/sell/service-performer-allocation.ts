import { createDecimal } from '@digvation/pos-money';

/**
 * How one performed service is attributed to its employees. Shares are whole
 * basis points (10000 = 100%), so an equal split of three is 33.34/33.33/33.33
 * and every resolved allocation totals exactly 100%. Attribution only: it never
 * changes the sale line amount.
 */
export const FULL_SHARE = 10000;

export interface PerformerAllocation {
  /** Selected employees in the order they were picked. */
  employeeIds: string[];
  /** Shares the operator typed, in edit order; everyone else shares the rest. */
  manual: Array<[employeeId: string, basisPoints: number]>;
}

export interface ResolvedShare {
  employeeId: string;
  basisPoints: number;
  manual: boolean;
}

export type AllocationIssue = 'EMPTY' | 'OVER' | 'UNDER' | null;

export interface ServiceLineWorkPlan {
  lineId: string;
  /** One entry per unit of quantity, in unit order. */
  units: Array<Array<{ employeeId: string; shareRate: string }>>;
}

export const emptyAllocation = (): PerformerAllocation => ({ employeeIds: [], manual: [] });

export const cloneAllocation = (allocation: PerformerAllocation): PerformerAllocation => ({
  employeeIds: [...allocation.employeeIds],
  manual: allocation.manual.map(([id, share]) => [id, share]),
});

function manualShares(allocation: PerformerAllocation) {
  return allocation.employeeIds.length > 1
    ? allocation.manual.filter(([id]) => allocation.employeeIds.includes(id))
    : [];
}

/** Splits `total` evenly; the first employees absorb the leftover basis points. */
function evenSplit(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return [...Array(count).keys()].map((index) => base + (index < extra ? 1 : 0));
}

export function resolveAllocation(allocation: PerformerAllocation): {
  shares: ResolvedShare[];
  total: number;
  issue: AllocationIssue;
} {
  const { employeeIds } = allocation;
  if (!employeeIds.length) return { shares: [], total: 0, issue: 'EMPTY' };
  const manual = new Map(manualShares(allocation));
  const automatic = employeeIds.filter((id) => !manual.has(id));
  const manualTotal = [...manual.values()].reduce((sum, share) => sum + share, 0);
  const remainder = FULL_SHARE - manualTotal;
  const split =
    automatic.length && remainder >= automatic.length
      ? evenSplit(remainder, automatic.length)
      : automatic.map(() => 0);
  const shares = employeeIds.map((employeeId) =>
    manual.has(employeeId)
      ? { employeeId, basisPoints: manual.get(employeeId)!, manual: true }
      : { employeeId, basisPoints: split[automatic.indexOf(employeeId)]!, manual: false },
  );
  const total = shares.reduce((sum, share) => sum + share.basisPoints, 0);
  // Everyone sharing the rest needs a positive share; with nobody left, typed shares must be 100%.
  const issue: AllocationIssue = automatic.length
    ? remainder < automatic.length
      ? 'OVER'
      : null
    : total > FULL_SHARE
      ? 'OVER'
      : total < FULL_SHARE
        ? 'UNDER'
        : null;
  return { shares, total, issue };
}

/**
 * Keeps typed shares where they still fit after the selection changed. When
 * they no longer leave room for everyone (or no longer total 100% once nobody
 * shares the rest), the most recently typed share returns to automatic.
 */
function settle(allocation: PerformerAllocation): PerformerAllocation {
  let manual = manualShares(allocation);
  for (;;) {
    const automatic = allocation.employeeIds.length - manual.length;
    const total = manual.reduce((sum, [, share]) => sum + share, 0);
    const fits = automatic ? FULL_SHARE - total >= automatic : total === FULL_SHARE;
    if (fits || !manual.length) break;
    manual = manual.slice(0, -1);
  }
  return { employeeIds: allocation.employeeIds, manual };
}

export function withEmployees(
  allocation: PerformerAllocation,
  employeeIds: readonly string[],
): PerformerAllocation {
  return settle({ employeeIds: [...employeeIds], manual: allocation.manual });
}

/** Sets or clears (null) one employee's typed share; the rest follow automatically. */
export function withShare(
  allocation: PerformerAllocation,
  employeeId: string,
  basisPoints: number | null,
): PerformerAllocation {
  const manual = allocation.manual.filter(([id]) => id !== employeeId);
  return {
    employeeIds: allocation.employeeIds,
    manual: basisPoints === null ? manual : [...manual, [employeeId, basisPoints]],
  };
}

export const evenAllocation = (allocation: PerformerAllocation): PerformerAllocation => ({
  employeeIds: allocation.employeeIds,
  manual: [],
});

export function sameAllocation(left: PerformerAllocation, right: PerformerAllocation): boolean {
  const a = resolveAllocation(left).shares;
  const b = resolveAllocation(right).shares;
  return (
    a.length === b.length &&
    a.every((share) =>
      b.some(
        (other) => other.employeeId === share.employeeId && other.basisPoints === share.basisPoints,
      ),
    )
  );
}

/** Rebuilds an allocation from persisted fractions; null or even rates mean an even split. */
export function allocationFromRates(
  performers: ReadonlyArray<{ employeeId: string; shareRate: string | null }>,
): PerformerAllocation {
  const employeeIds = performers.map((performer) => performer.employeeId);
  if (employeeIds.length < 2 || performers.some((performer) => performer.shareRate === null))
    return { employeeIds, manual: [] };
  const typed = performers.map((performer): [string, number] => [
    performer.employeeId,
    createDecimal(performer.shareRate!).times(FULL_SHARE).toDecimalPlaces(0).toNumber(),
  ]);
  const even = evenSplit(FULL_SHARE, typed.length);
  if (typed.every(([, share]) => even.some((candidate) => Math.abs(candidate - share) <= 1)))
    return { employeeIds, manual: [] };
  // Finer persisted precision can round away a basis point; the last share absorbs it.
  const total = typed.reduce((sum, [, share]) => sum + share, 0);
  return settle({ employeeIds, manual: total === FULL_SHARE ? typed : typed.slice(0, -1) });
}

/** Persistable fractions of a valid allocation, e.g. 3334 -> "0.3334". */
export function allocationRates(
  allocation: PerformerAllocation,
): Array<{ employeeId: string; shareRate: string }> {
  return resolveAllocation(allocation).shares.map((share) => ({
    employeeId: share.employeeId,
    shareRate: createDecimal(String(share.basisPoints)).dividedBy(FULL_SHARE).toFixed(),
  }));
}

/** Operator input such as "40", "33,5" or "12.25" as basis points; null unless above 0 and at most 100. */
export function parsePercent(text: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{0,2}))?$/.exec(text.trim());
  if (!match) return null;
  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return basisPoints > 0 && basisPoints <= FULL_SHARE ? basisPoints : null;
}

export function formatPercent(basisPoints: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(basisPoints / 100);
}

/** Units (1-based) of a service line that share one identical allocation. */
export interface AllocationGroup {
  unitNumbers: number[];
  allocation: PerformerAllocation;
}

/**
 * Collapses per-unit allocations into distinct settings, in order of first
 * appearance, so identical assignments are stated once instead of per unit.
 */
export function groupAllocations(units: readonly PerformerAllocation[]): AllocationGroup[] {
  const groups: AllocationGroup[] = [];
  units.forEach((allocation, index) => {
    const group = groups.find((candidate) => sameAllocation(candidate.allocation, allocation));
    if (group) group.unitNumbers.push(index + 1);
    else groups.push({ unitNumbers: [index + 1], allocation });
  });
  return groups;
}

/** Ascending unit numbers as compact ranges, e.g. [1, 2, 4, 5, 6] -> "1–2, 4–6". */
export function formatUnitRanges(unitNumbers: readonly number[]): string {
  const ranges: string[] = [];
  let start = unitNumbers[0];
  unitNumbers.forEach((unit, index) => {
    const next = unitNumbers[index + 1];
    if (next === unit + 1) return;
    ranges.push(start === unit ? String(unit) : `${start}–${unit}`);
    start = next;
  });
  return ranges.join(', ');
}
