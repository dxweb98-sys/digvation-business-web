import type { Sale, SaleLine } from '../transaction/model/cashier-transaction.types';

/**
 * Runtime's canonical permission for adjusting an order after work has started. It is an
 * additional requirement on top of `sales:update`; Role Management decides who receives it.
 */
export const PROGRESSED_ADJUSTMENT_PERMISSION = 'sales:adjust-progressed';

/**
 * Whether the session may open Adjust Order for a Sale. A queued or otherwise not-yet-started Sale
 * keeps its existing rules. Once work is IN_PROGRESS, both `sales:update` and the progressed
 * adjustment permission are required, so the action is never offered just to end in a 403.
 * This only mirrors Runtime: completed work stays non-correctable whatever the permission.
 */
export function canAdjustOrder(
  sale: Pick<Sale, 'operationalState'>,
  permissions: readonly string[],
): boolean {
  if (sale.operationalState !== 'IN_PROGRESS') return true;
  return (
    permissions.includes('sales:update') && permissions.includes(PROGRESSED_ADJUSTMENT_PERMISSION)
  );
}

/**
 * How a persisted line of an OPEN Sale may be changed in Adjust Order:
 * - `EDIT`: nothing has started on it, so it is edited ordinarily (quantity, configuration, removal).
 *   This includes an item added during the current adjustment of an in-progress Sale: a mistaken
 *   new item is fixed directly while it has no work of its own;
 * - `CORRECTION`: its own work is in progress, or it is a historical line of an in-progress Sale, so
 *   it changes only through the audited "Koreksi item" flow (replacement, Runtime impact, reason);
 * - `LOCKED`: its work is completed (or canceled). No permission makes it correctable.
 * Every change is still a Runtime command; this only decides which controls are offered.
 */
export type SaleLineAdjustmentMode = 'EDIT' | 'CORRECTION' | 'LOCKED';

export function saleLineAdjustmentMode(
  sale: Pick<Sale, 'operationalState'>,
  line: Pick<SaleLine, 'fulfillment'>,
  options: { addedInThisAdjustment?: boolean } = {},
): SaleLineAdjustmentMode {
  const status = line.fulfillment?.status;
  if (status === 'COMPLETED' || status === 'CANCELED') return 'LOCKED';
  if (status === 'IN_PROGRESS') return 'CORRECTION';
  if (sale.operationalState === 'IN_PROGRESS' && !options.addedInThisAdjustment)
    return 'CORRECTION';
  return 'EDIT';
}

/** The retired historical line a corrected line replaced, from Runtime's lineage on the same Sale. */
export function correctionSourceOf(
  sale: Pick<Sale, 'lines'>,
  line: Pick<SaleLine, 'correctedFromLineId'>,
): SaleLine | null {
  if (!line.correctedFromLineId) return null;
  return sale.lines.find((candidate) => candidate.id === line.correctedFromLineId) ?? null;
}
