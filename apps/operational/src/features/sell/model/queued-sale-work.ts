import type { Sale, SaleLine } from './cashier-transaction.types';

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

/** Work status that governs a line: its own fulfillment, or its historical source's for a corrected line. */
export function saleLineWorkStatus(
  line: Pick<SaleLine, 'fulfillment' | 'workLineage'>,
): NonNullable<SaleLine['fulfillment']>['status'] | null {
  return line.fulfillment?.status ?? line.workLineage?.status ?? null;
}
