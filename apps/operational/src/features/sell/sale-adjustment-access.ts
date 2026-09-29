import type { Sale } from './cashier-transaction.types';

/**
 * Runtime's canonical permission for adjusting an order after work has started. It is an
 * additional requirement on top of `sales:update`; Role Management decides who receives it.
 */
export const PROGRESSED_ADJUSTMENT_PERMISSION = 'sales:adjust-progressed';

/**
 * Whether the session may open Adjust Order for a Sale. A queued or otherwise not-yet-started Sale
 * keeps its existing rules. Once work is IN_PROGRESS, both `sales:update` and the progressed
 * adjustment permission are required, so the action is never offered just to end in a 403.
 * This only mirrors Runtime; it does not relax the immutable rules for progressed lines.
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
