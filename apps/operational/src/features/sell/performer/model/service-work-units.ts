import { createDecimal } from '@digvation/pos-money';

import type { SaleLine } from '../../transaction/model/cashier-transaction.types';
import { allocationFromRates, type PerformerAllocation } from './service-performer-allocation';

/** Whole-number quantity of a service line; each unit is one separately performed service. */
export function serviceWorkUnitCount(line: SaleLine): number {
  try {
    const quantity = createDecimal(line.quantity);
    if (!quantity.isInteger() || quantity.lessThan(createDecimal('1'))) return 1;
    const count = quantity.toNumber();
    return Number.isSafeInteger(count) && count <= 100 ? count : 1;
  } catch {
    return 1;
  }
}

function assignedParticipations(line: SaleLine) {
  return line.participations.filter(
    (participation) => participation.assigned || participation.shareRate !== null,
  );
}

/** Employees and contribution shares of each unit, as persisted by Runtime. */
export function serviceWorkUnitAllocations(line: SaleLine): PerformerAllocation[] {
  const count = serviceWorkUnitCount(line);
  const stored = new Map(
    (line.workUnits ?? []).map((unit) => [
      unit.unitNumber,
      unit.performers ?? unit.employeeIds.map((employeeId) => ({ employeeId, shareRate: null })),
    ]),
  );
  const lineLevel = stored.size ? [] : assignedParticipations(line);
  return [...Array(count).keys()].map((index) =>
    allocationFromRates(stored.get(index + 1) ?? lineLevel),
  );
}
