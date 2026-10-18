import { createDecimal } from '@digvation/pos-money';

import type { Sale } from './cashier-transaction.types';

/**
 * The single Sale-level lifecycle classification for Operational checkout.
 *
 * A Sale follows the queue / service-work lifecycle only when at least one ACTIVE line is TRACKED
 * work. Fulfillment behavior is the authority, not the item type: a Product-only Sale and any
 * future all-INSTANT Sale have no work to perform and complete at checkout. Removed lines (for
 * example the retired source of a correction) never force a Sale into the tracked workflow.
 */
export function hasTrackedWork(sale: Pick<Sale, 'lines'>): boolean {
  return sale.lines.some(
    (line) => line.removedAt === null && line.fulfillmentBehaviorSnapshot === 'TRACKED',
  );
}

/** Has at least one active line and none of them is tracked work. */
export function isInstantOnly(sale: Pick<Sale, 'lines'>): boolean {
  return sale.lines.some((line) => line.removedAt === null) && !hasTrackedWork(sale);
}

function sumPayments(sale: Pick<Sale, 'payments'>, status: 'SUCCEEDED' | 'PENDING') {
  return sale.payments
    .filter((payment) => payment.status === status)
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
}

/** Successful payments equal the Sale total exactly and nothing is pending. */
export function isFullySettled(sale: Pick<Sale, 'payments' | 'totalAmount'>): boolean {
  if (sale.payments.some((payment) => payment.status === 'PENDING')) return false;
  return sumPayments(sale, 'SUCCEEDED').equals(createDecimal(sale.totalAmount));
}

/** What happens once a payment has been recorded or confirmed. */
export type CheckoutCompletion = 'AWAIT_PAYMENT' | 'QUEUE' | 'FINALIZE';

/**
 * Decides the next lifecycle step after a payment change. Only an exactly settled Sale (no
 * pending payment) completes; then tracked work queues, and an all-INSTANT Sale finalizes
 * immediately. Runtime stays the final authority for both commands.
 */
export function checkoutCompletionOf(
  sale: Pick<Sale, 'lines' | 'payments' | 'totalAmount'>,
): CheckoutCompletion {
  if (!sale.lines.some((line) => line.removedAt === null)) return 'AWAIT_PAYMENT';
  if (!isFullySettled(sale)) return 'AWAIT_PAYMENT';
  return hasTrackedWork(sale) ? 'QUEUE' : 'FINALIZE';
}

/**
 * A partly paid (or payment-pending) all-INSTANT Sale has no queue to live in, so the active
 * transaction must not be silently abandoned by starting a new one.
 */
export function blocksNewTransaction(
  sale: Pick<Sale, 'status' | 'lines' | 'payments'> | null | undefined,
): boolean {
  if (!sale || sale.status !== 'OPEN' || !isInstantOnly(sale)) return false;
  return (
    sumPayments(sale, 'SUCCEEDED').greaterThan(0) ||
    sale.payments.some((payment) => payment.status === 'PENDING')
  );
}

export type SettledCheckoutResult =
  { kind: 'AWAIT_PAYMENT' } | { kind: 'QUEUED'; sale: Sale } | { kind: 'FINALIZED'; sale: Sale };

/**
 * Completes a checkout whose payment just changed. Tracked work is queued; an all-INSTANT Sale
 * is finalized straight away and never touches the queue. Nothing happens until the Sale is
 * exactly settled. A rejected command propagates so the caller can keep the payment and retry.
 */
export async function completeSettledCheckout(
  sale: Sale,
  ports: {
    queue: (sale: Sale) => Promise<Sale>;
    finalizeInstant: (sale: Sale) => Promise<Sale>;
  },
): Promise<SettledCheckoutResult> {
  const next = checkoutCompletionOf(sale);
  if (next === 'AWAIT_PAYMENT') return { kind: 'AWAIT_PAYMENT' };
  if (next === 'FINALIZE') return { kind: 'FINALIZED', sale: await ports.finalizeInstant(sale) };
  return { kind: 'QUEUED', sale: await ports.queue(sale) };
}
