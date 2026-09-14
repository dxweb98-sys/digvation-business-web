import type { Sale } from './cashier-transaction.types';

/**
 * Mirrors the Runtime start-work precondition from the authoritative Sale projection.
 * The Web never advances operational state locally; it only decides whether to expose
 * the server command for a QUEUED Sale that currently has tracked WAITING work.
 */
export function hasStartableQueuedWork(sale: Sale): boolean {
  return (
    sale.status === 'OPEN' &&
    sale.operationalState === 'QUEUED' &&
    sale.lines.some(
      (line) =>
        line.removedAt === null &&
        line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
        line.fulfillment?.status === 'WAITING',
    )
  );
}
