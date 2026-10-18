import { useOptionalAuth } from '@digvation/business-auth';

import type { CompletedSaleSummary, QueueSale, Sale } from './cashier-transaction.types';

/**
 * Amounts, details and receipts of completed transactions require this
 * permission. Runtime enforces it; Operational only mirrors it so restricted
 * users are never offered an action Runtime would refuse.
 */
export const COMPLETED_SALE_DETAILS_PERMISSION = 'sales:read-completed';

export function isCompletedSaleSummary(entry: QueueSale): entry is CompletedSaleSummary {
  return 'visibility' in entry && entry.visibility === 'SUMMARY';
}

export function canReadCompletedSaleDetails(permissions: readonly string[]): boolean {
  return permissions.includes(COMPLETED_SALE_DETAILS_PERMISSION);
}

/** Effective permission of the signed-in account; no session means no access. */
export function useCanReadCompletedSaleDetails(): boolean {
  const auth = useOptionalAuth();
  return canReadCompletedSaleDetails(auth?.session.access.permissions ?? []);
}

/** The same non-financial facts Runtime returns, for a completed Sale this client already holds. */
export function completedSaleSummary(sale: Sale): CompletedSaleSummary {
  return {
    visibility: 'SUMMARY',
    id: sale.id,
    saleNumber: sale.saleNumber ?? '',
    invoiceNumber: sale.invoiceNumber ?? null,
    sellingLocationId: sale.sellingLocationId,
    status: 'FINALIZED',
    operationalState: sale.operationalState,
    customer: sale.customer ? { type: sale.customer.type, name: sale.customer.name } : null,
    itemCount: sale.lines.filter((line) => line.removedAt === null).length,
    finalizedAt: sale.finalizedAt,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

/** How a Sale may be kept in the shared queue cache for this reader. */
export function queueEntryFor(sale: Sale, canReadCompleted: boolean): QueueSale {
  return sale.status === 'FINALIZED' && !canReadCompleted ? completedSaleSummary(sale) : sale;
}

/**
 * The summary to present for a queue entry the reader may not open in full:
 * any completed transaction without the permission, even when a full copy is
 * cached locally. Null means the entry is shown in full.
 */
export function restrictedQueueSummary(
  entry: QueueSale,
  canReadCompleted: boolean,
): CompletedSaleSummary | null {
  if (isCompletedSaleSummary(entry)) return entry;
  return entry.status === 'FINALIZED' && !canReadCompleted ? completedSaleSummary(entry) : null;
}

/**
 * What the transaction dialog may show. A completed Sale the reader may not
 * read in full is only shown as the receipt of the completion the operator has
 * just performed (it came from that command's response); never as detail.
 */
export function presentableTransaction(
  sale: Sale | null,
  canReadCompleted: boolean,
  immediateReceiptSaleId: string | null,
): Sale | null {
  if (!sale || sale.status !== 'FINALIZED' || canReadCompleted) return sale;
  return immediateReceiptSaleId === sale.id ? sale : null;
}
