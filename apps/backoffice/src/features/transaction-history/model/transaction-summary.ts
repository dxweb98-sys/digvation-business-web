import type { BadgeVariant } from '@digvation/ui';

import type {
  FulfillmentStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Sale,
  SaleLine,
  SaleStatus,
} from '../api/transaction-history-api';
import { toMoneyUnits, transactionPaymentComposition } from './transaction-payment-composition';

/** A business-facing summary: a copy key plus its badge tone. Never stored, always derived. */
export interface TransactionSummary<K extends string> {
  kind: K;
  label: string;
  variant: BadgeVariant;
}

// ---------------------------------------------------------------- Transaction status

export type TransactionStatusKind = 'OPEN' | 'COMPLETED' | 'CANCELLED' | 'REVERSED';

const TRANSACTION_STATUS: Record<TransactionStatusKind, Omit<TransactionSummary<never>, 'kind'>> = {
  OPEN: { label: 'Open', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'secondary' },
  REVERSED: { label: 'Reversed', variant: 'danger' },
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  OPEN: TRANSACTION_STATUS.OPEN.label,
  FINALIZED: TRANSACTION_STATUS.COMPLETED.label,
  VOIDED: TRANSACTION_STATUS.CANCELLED.label,
};

/** Sale lifecycle as people read it; a reversal is derived from the appended reversal fact. */
export function transactionStatusSummary(
  sale: Pick<Sale, 'status' | 'reversal'>,
): TransactionSummary<TransactionStatusKind> {
  const kind: TransactionStatusKind =
    sale.status === 'FINALIZED' && sale.reversal
      ? 'REVERSED'
      : sale.status === 'FINALIZED'
        ? 'COMPLETED'
        : sale.status === 'VOIDED'
          ? 'CANCELLED'
          : 'OPEN';
  return { kind, ...TRANSACTION_STATUS[kind] };
}

// ---------------------------------------------------------------- Payment summary

export type PaymentSummaryKind =
  | 'NOT_PAID'
  | 'NO_PAYMENT'
  | 'NOTHING_DUE'
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PAID_SPLIT'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

const PAYMENT_SUMMARY: Record<PaymentSummaryKind, Omit<TransactionSummary<never>, 'kind'>> = {
  NOT_PAID: { label: 'Not paid', variant: 'outline' },
  NO_PAYMENT: { label: 'No payment', variant: 'secondary' },
  NOTHING_DUE: { label: 'Nothing to pay', variant: 'secondary' },
  PENDING: { label: 'Payment pending', variant: 'warning' },
  PARTIALLY_PAID: { label: 'Partially paid', variant: 'warning' },
  PAID: { label: 'Paid', variant: 'success' },
  PAID_SPLIT: { label: 'Paid (split)', variant: 'success' },
  PARTIALLY_REFUNDED: { label: 'Partially refunded', variant: 'info' },
  REFUNDED: { label: 'Refunded', variant: 'secondary' },
};

/**
 * One payment state for the whole transaction, from the authoritative payment facts:
 * only succeeded positive payments settle; refunds are negative succeeded facts; failed,
 * cancelled and expired attempts never define the state.
 */
export function paymentSummary(
  sale: Pick<Sale, 'status' | 'totalAmount' | 'payments'> &
    Partial<Pick<Sale, 'paymentComposition'>>,
): TransactionSummary<PaymentSummaryKind> {
  const composition = transactionPaymentComposition(sale);
  const paid = toMoneyUnits(composition.totalPaid);
  const refunded = toMoneyUnits(composition.totalRefunded);
  const total = toMoneyUnits(sale.totalAmount);
  const kind: PaymentSummaryKind =
    paid > 0n && refunded > 0n
      ? refunded >= paid
        ? 'REFUNDED'
        : 'PARTIALLY_REFUNDED'
      : composition.settled && composition.applied.length
        ? composition.isSplit
          ? 'PAID_SPLIT'
          : 'PAID'
        : composition.hasPending
          ? 'PENDING'
          : paid > 0n
            ? 'PARTIALLY_PAID'
            : sale.status === 'VOIDED'
              ? 'NO_PAYMENT'
              : total === 0n
                ? 'NOTHING_DUE'
                : 'NOT_PAID';
  return { kind, ...PAYMENT_SUMMARY[kind] };
}

// ---------------------------------------------------------------- Work summary

export type WorkSummaryKind =
  'NONE' | 'DRAFT' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const WORK_SUMMARY: Record<WorkSummaryKind, Omit<TransactionSummary<never>, 'kind'>> = {
  NONE: { label: 'No tracked work', variant: 'outline' },
  DRAFT: { label: 'Not submitted', variant: 'outline' },
  WAITING: { label: 'Waiting', variant: 'warning' },
  IN_PROGRESS: { label: 'In progress', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'secondary' },
};

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  WAITING: WORK_SUMMARY.WAITING.label,
  IN_PROGRESS: WORK_SUMMARY.IN_PROGRESS.label,
  COMPLETED: WORK_SUMMARY.COMPLETED.label,
  CANCELED: WORK_SUMMARY.CANCELLED.label,
};

export function fulfillmentStatusSummary(
  status: FulfillmentStatus,
): TransactionSummary<WorkSummaryKind> {
  const kind: WorkSummaryKind =
    status === 'CANCELED' ? 'CANCELLED' : status === 'WAITING' ? 'WAITING' : status;
  return { kind, ...WORK_SUMMARY[kind] };
}

/** Billed lines only: removed or corrected lines are retired history, not current items. */
export function activeSaleLines<L extends Pick<SaleLine, 'removedAt'>>(lines: readonly L[]): L[] {
  return lines.filter((line) => !line.removedAt);
}

/**
 * One work state for the whole transaction from the Sale operational state and the tracked
 * lines' fulfillment facts. Completed work stays completed after a later refund or reversal.
 */
export function workSummary(
  sale: Pick<Sale, 'status' | 'operationalState' | 'lines'>,
): TransactionSummary<WorkSummaryKind> {
  const tracked = activeSaleLines(sale.lines).filter(
    (line) => line.fulfillmentBehaviorSnapshot === 'TRACKED',
  );
  const statuses = tracked.map((line) => line.fulfillment?.status ?? null);
  const ended = (status: FulfillmentStatus | null) =>
    status === 'COMPLETED' || status === 'CANCELED';
  const kind: WorkSummaryKind = !tracked.length
    ? 'NONE'
    : statuses.every(ended)
      ? statuses.includes('COMPLETED')
        ? 'COMPLETED'
        : 'CANCELLED'
      : statuses.some((status) => status === 'IN_PROGRESS' || status === 'COMPLETED')
        ? 'IN_PROGRESS'
        : sale.status === 'VOIDED'
          ? 'CANCELLED'
          : sale.operationalState === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : sale.operationalState === 'QUEUED'
              ? 'WAITING'
              : sale.operationalState === 'UNSUBMITTED' || statuses.every((status) => !status)
                ? 'DRAFT'
                : 'WAITING';
  return { kind, ...WORK_SUMMARY[kind] };
}

// ---------------------------------------------------------------- Raw filter labels

/** Labels for the raw payment-attempt statuses Runtime filters on. */
export const PAYMENT_ATTEMPT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const PAYMENT_ATTEMPT_STATUS_BADGES: Record<PaymentStatus, BadgeVariant> = {
  PENDING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'secondary',
  EXPIRED: 'secondary',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  WALLET: 'E-wallet',
  QRIS: 'QRIS',
};

/** Where the money went: the captured destination account, else the payment method. */
export function paymentDestinationLabel(
  payment: Pick<Payment, 'method' | 'financeFinancialAccountNameSnapshot'>,
): { label: string; isMethod: boolean } {
  const account = payment.financeFinancialAccountNameSnapshot?.trim();
  return account
    ? { label: account, isMethod: false }
    : { label: PAYMENT_METHOD_LABELS[payment.method], isMethod: true };
}
