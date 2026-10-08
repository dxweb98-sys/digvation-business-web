import { employeeDisplayName } from '../transaction/model/sale-presentation';
import type { Employee, SaleLine } from '../transaction/model/cashier-transaction.types';
import { serviceWorkUnitAllocations } from './service-performers-dialog';
import {
  formatPercent,
  formatUnitRanges,
  groupAllocations,
  resolveAllocation,
  type PerformerAllocation,
} from './service-performer-allocation';
import { copyFor } from '../transaction/model/sale-display';

export interface PerformerCredit {
  employeeId: string;
  name: string;
  /** Shown only when the split was set by hand; an even split needs no numbers. */
  percent: string | null;
}

interface PerformerGroup {
  /** Units this setting covers, e.g. "1–2, 4–7"; null when it covers the whole line. */
  units: string | null;
  performers: PerformerCredit[];
}

/**
 * Who performs a service line. Units with an identical assignment collapse
 * into one group, so a line reads as one setting unless units really differ.
 */
export function servicePerformerSummary(
  line: SaleLine,
  employees: readonly Employee[],
  locale: string,
): { unitCount: number; groups: PerformerGroup[] } {
  const units = serviceWorkUnitAllocations(line);
  const credits = (allocation: PerformerAllocation): PerformerCredit[] => {
    const { shares } = resolveAllocation(allocation);
    const custom = shares.some((share) => share.manual);
    return shares.map((share) => ({
      employeeId: share.employeeId,
      name: employeeDisplayName(
        line,
        share.employeeId,
        employees,
        copyFor('Employee unavailable', locale),
      ),
      percent: custom ? `${formatPercent(share.basisPoints, locale)}%` : null,
    }));
  };
  const grouped = groupAllocations(units);
  return {
    unitCount: units.length,
    groups: grouped.map((group) => ({
      units: grouped.length > 1 ? formatUnitRanges(group.unitNumbers) : null,
      performers: credits(group.allocation),
    })),
  };
}
