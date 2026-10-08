import type { Payment, Sale } from '../api/transaction-history-api';
import {
  remainingCapacity,
  toMoneyUnits,
  transactionPaymentComposition,
} from './transaction-payment-composition';

export interface RefundablePayment {
  payment: Payment;
  /** Applied amount not yet returned by linked refund facts; Runtime still validates. */
  maxAmount: string;
}

/**
 * Why Reverse cannot be used yet, from the same payment facts the detail shows.
 * - `PAYMENT_PENDING`: a payment is still pending.
 * - `REFUND_REQUIRED`: succeeded money remains; refund it here first.
 * - `PROVIDER_REFUND_REQUIRED`: succeeded non-cash money remains, which this application cannot
 *   refund (provider-backed refunds need the provider's authoritative flow).
 */
export type ReverseBlock = 'PAYMENT_PENDING' | 'REFUND_REQUIRED' | 'PROVIDER_REFUND_REQUIRED';

export interface TransactionActions {
  refundable: RefundablePayment[];
  canRefund: boolean;
  /** Reverse is offered at all (completed, not reversed, permitted). */
  showReverse: boolean;
  /** Reverse is actionable now; Runtime still enforces the same rule. */
  canReverse: boolean;
  reverseBlock: ReverseBlock | null;
  /**
   * Correcting how received money was recorded is offered: permitted, the Sale is not voided or
   * reversed, and Runtime's effective composition holds money on a route. Runtime stays the
   * authority and refuses anything else.
   */
  canCorrect: boolean;
}

/**
 * Which follow-up commands to offer. Only a completed, not yet reversed Sale qualifies. Refunds are
 * offered for cash payments with an uncompensated balance. Reverse becomes actionable only once no
 * payment is pending and every succeeded payment is fully compensated — the Runtime reversal rule.
 */
export function transactionActions(
  sale: Pick<
    Sale,
    'status' | 'reversal' | 'totalAmount' | 'payments' | 'paymentCorrections' | 'paymentComposition'
  >,
  permissions: { refund: boolean; reverse: boolean; correct?: boolean },
): TransactionActions {
  const completed = sale.status === 'FINALIZED' && !sale.reversal;
  const composition = transactionPaymentComposition(sale);
  // Money can be refunded from the payments as recorded and from what a correction moved in.
  const outstanding = [...composition.applied, ...composition.correctionIn]
    .map((payment) => ({
      payment,
      maxAmount: remainingCapacity(payment, sale),
    }))
    .filter(({ maxAmount }) => toMoneyUnits(maxAmount) > 0n);
  const isCash = ({ payment }: RefundablePayment) =>
    payment.method === 'CASH' && !payment.providerReference;
  const refundable = outstanding.filter(isCash);
  const reverseBlock: ReverseBlock | null = composition.hasPending
    ? 'PAYMENT_PENDING'
    : outstanding.some((entry) => !isCash(entry))
      ? 'PROVIDER_REFUND_REQUIRED'
      : outstanding.length
        ? 'REFUND_REQUIRED'
        : null;
  const showReverse = completed && permissions.reverse;
  const canCorrect =
    Boolean(permissions.correct) &&
    sale.status !== 'VOIDED' &&
    !sale.reversal &&
    Boolean(
      sale.paymentComposition?.entries.some(
        (entry) => entry.paymentRouteId !== null && toMoneyUnits(entry.effectiveAmount) > 0n,
      ),
    );
  return {
    canCorrect,
    refundable: completed && permissions.refund ? refundable : [],
    canRefund: completed && permissions.refund && refundable.length > 0,
    showReverse,
    canReverse: showReverse && reverseBlock === null,
    reverseBlock: showReverse ? reverseBlock : null,
  };
}

/** A refund amount within (0, max], compared exactly. */
export function isRefundAmountValid(amount: string, maxAmount: string): boolean {
  if (!/^\d+(\.\d{1,4})?$/.test(amount.trim())) return false;
  const units = toMoneyUnits(amount);
  return units > 0n && units <= toMoneyUnits(maxAmount);
}

/** Localized copy keys for Runtime refund/reversal outcomes an operator can act on. */
const ACTION_ERROR_COPY: Record<string, string> = {
  SALE_REVERSAL_PAYMENT_COMPENSATION_REQUIRED:
    'Refund all completed payments before reversing this transaction.',
  SALE_REVERSAL_PAYMENT_PENDING: 'Resolve the pending payment before reversing this transaction.',
  SALE_REVERSAL_FINALIZED_REQUIRED: 'Only a completed transaction can be reversed.',
  SALE_ALREADY_REVERSED: 'This transaction has already been reversed.',
  SALE_VERSION_CONFLICT: 'This transaction changed in the meantime. Reload it and try again.',
  PAYMENT_REFUND_PROVIDER_CONFIRMATION_REQUIRED:
    'This payment went through a provider and must be refunded in that provider’s flow.',
  PAYMENT_REFUND_EXCEEDS_SOURCE: 'The amount is more than what is left to refund on this payment.',
  PAYMENT_REFUND_FINALIZED_REQUIRED: 'Only payments of a completed transaction can be refunded.',
  PAYMENT_REFUND_AMOUNT_INVALID: 'Enter a refund amount greater than zero.',
  PAYMENT_REFUND_SOURCE_INVALID: 'This payment can no longer be refunded.',
  PAYMENT_CORRECTION_NOT_NET_ZERO: 'The total paid must stay the same.',
  PAYMENT_CORRECTION_EXCEEDS_SOURCE: 'A route cannot give away more than was recorded on it.',
  PAYMENT_CORRECTION_ROUTE_INVALID:
    'A payment route is no longer available. Reload and choose again.',
  PAYMENT_CORRECTION_SALE_VOIDED: 'This transaction can no longer have its payments corrected.',
  PAYMENT_CORRECTION_FORBIDDEN: 'You are not allowed to correct payments.',
};

/** The localized message key for a known action error code, else the given fallback key. */
export function transactionActionErrorKey(code: string | undefined, fallback: string): string {
  return (code && ACTION_ERROR_COPY[code]) || fallback;
}
