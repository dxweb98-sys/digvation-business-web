import type {
  Payment,
  PaymentComposition,
  PaymentCompositionEntry,
} from '../api/transaction-history-api';
import { paymentKind } from './payment-kind';

type CompositionPayment = Pick<Payment, 'id' | 'status' | 'appliedAmount'> &
  Partial<
    Pick<Payment, 'refundOfPaymentId' | 'kind' | 'correction' | 'refund' | 'providerReference'>
  > & { createdAt?: string };

export interface TransactionPaymentComposition<P> {
  /** Payments that actually settle the sale, in the order they were taken. */
  applied: P[];
  /** Succeeded refund facts: money returned. Decided by Runtime's kind, never by the sign. */
  refunds: P[];
  /** Succeeded legs of payment corrections: bookkeeping movements, neither payments nor refunds. */
  corrections: P[];
  /** Positive correction legs: they hold re-attributed money and can be refunded like a payment. */
  correctionIn: P[];
  /** Failed, cancelled, expired or still pending attempts; they never settle the sale. */
  notApplied: P[];
  totalPaid: string;
  totalRefunded: string;
  /** What is still open against the sale total; zero once settled. */
  balanceDue: string;
  settled: boolean;
  /**
   * Money sits on more than one effective payment route. Counts the non-zero routes of the effective
   * composition, never the raw payment rows or attempts.
   */
  isSplit: boolean;
  /** The effective routes that received money, one per route and account, after corrections. */
  received: PaymentCompositionEntry[];
  hasPending: boolean;
}

const SCALE = 4;

/** Runtime money is a decimal string with at most four fraction digits; work on it exactly. */
export function toMoneyUnits(amount: string): bigint {
  const [whole = '0', fraction = ''] = amount.trim().split('.');
  const negative = whole.startsWith('-');
  const units =
    BigInt(whole.replace('-', '') || '0') * 10n ** BigInt(SCALE) +
    BigInt(fraction.padEnd(SCALE, '0').slice(0, SCALE) || '0');
  return negative ? -units : units;
}

export function fromMoneyUnits(units: bigint): string {
  const factor = 10n ** BigInt(SCALE);
  const sign = units < 0n ? '-' : '';
  const absolute = units < 0n ? -units : units;
  return `${sign}${absolute / factor}.${(absolute % factor).toString().padStart(SCALE, '0')}`;
}

const byCreation = <P extends CompositionPayment>(left: P, right: P) =>
  (left.createdAt ?? '').localeCompare(right.createdAt ?? '');

/**
 * How a transaction was actually paid. Mirrors Runtime settlement, which only counts
 * succeeded payments toward the sale total; refunds are append-only negative facts.
 */
export function transactionPaymentComposition<P extends CompositionPayment>(sale: {
  totalAmount: string;
  payments: readonly P[];
  paymentComposition?: PaymentComposition | undefined;
}): TransactionPaymentComposition<P> {
  const succeeded = (payment: P) => payment.status === 'SUCCEEDED';
  const kindOf = (payment: P) => paymentKind(payment);
  // The payments as originally recorded; a correction leg is neither a payment nor a refund.
  const applied = sale.payments
    .filter((payment) => succeeded(payment) && kindOf(payment) === 'PAYMENT')
    .sort(byCreation);
  const refunds = sale.payments
    .filter((payment) => succeeded(payment) && kindOf(payment) === 'REFUND')
    .sort(byCreation);
  const corrections = sale.payments
    .filter(
      (payment) =>
        succeeded(payment) &&
        (kindOf(payment) === 'CORRECTION_IN' || kindOf(payment) === 'CORRECTION_OUT'),
    )
    .sort(byCreation);
  const correctionIn = corrections.filter((payment) => kindOf(payment) === 'CORRECTION_IN');
  const totalPaid = applied.reduce((sum, payment) => sum + toMoneyUnits(payment.appliedAmount), 0n);
  const totalRefunded = refunds.reduce(
    (sum, payment) => sum - toMoneyUnits(payment.appliedAmount),
    0n,
  );
  const total = toMoneyUnits(sale.totalAmount);
  const hasPending = sale.payments.some((payment) => payment.status === 'PENDING');
  const settled = !hasPending && totalPaid >= total;
  const received = effectivePaymentEntries(sale).filter(
    (entry) => toMoneyUnits(entry.receivedAmount) > 0n,
  );
  return {
    received,
    applied,
    refunds,
    corrections,
    correctionIn,
    notApplied: sale.payments.filter((payment) => !succeeded(payment)).sort(byCreation),
    totalPaid: fromMoneyUnits(totalPaid),
    totalRefunded: fromMoneyUnits(totalRefunded),
    balanceDue: fromMoneyUnits(total > totalPaid ? total - totalPaid : 0n),
    settled,
    isSplit: settled && received.length > 1,
    hasPending,
  };
}

type EffectiveSource = {
  payments: readonly (CompositionPayment & {
    method?: Payment['method'];
    financePaymentRouteId?: string | null;
    financeFinancialAccountId?: string | null;
    financeFinancialAccountCodeSnapshot?: string | null;
    financeFinancialAccountNameSnapshot?: string | null;
  })[];
  paymentComposition?: PaymentComposition | undefined;
};

/**
 * What each payment route holds now: Runtime's effective composition, which is the authority. Only
 * a payload without it (an older list row) is grouped here, by method, route and financial account,
 * never by method alone, so two bank routes stay two routes and one route stays one.
 */
export function effectivePaymentEntries(sale: EffectiveSource): PaymentCompositionEntry[] {
  if (sale.paymentComposition) return sale.paymentComposition.entries;
  const buckets = new Map<string, PaymentCompositionEntry>();
  // A payment that names no method, route or account cannot be grouped with another: it stands alone.
  const keyOf = (payment: EffectiveSource['payments'][number]) =>
    payment.method || payment.financePaymentRouteId || payment.financeFinancialAccountId
      ? `${payment.method ?? ''}|${payment.financePaymentRouteId ?? ''}|${payment.financeFinancialAccountId ?? ''}`
      : payment.id;
  for (const payment of sale.payments) {
    if (payment.status !== 'SUCCEEDED' || paymentKind(payment) === 'REFUND') continue;
    const key = keyOf(payment);
    const held = buckets.get(key);
    const received =
      toMoneyUnits(held?.receivedAmount ?? '0') + toMoneyUnits(payment.appliedAmount);
    buckets.set(key, {
      method: payment.method as PaymentCompositionEntry['method'],
      paymentRouteId: payment.financePaymentRouteId ?? null,
      financialAccountId: payment.financeFinancialAccountId ?? null,
      financialAccountCode: payment.financeFinancialAccountCodeSnapshot ?? null,
      financialAccountName: payment.financeFinancialAccountNameSnapshot ?? null,
      receivedAmount: fromMoneyUnits(received),
      refundedAmount: '0.0000',
      effectiveAmount: fromMoneyUnits(received),
    });
  }
  return [...buckets.values()].filter((entry) => toMoneyUnits(entry.receivedAmount) !== 0n);
}

/** Amount of an applied payment not yet compensated by its linked refund facts. */
export function uncompensatedAmount<P extends CompositionPayment>(
  payment: P,
  refunds: readonly P[],
): string {
  const refunded = refunds
    .filter((refund) => refund.refundOfPaymentId === payment.id)
    .reduce((sum, refund) => sum - toMoneyUnits(refund.appliedAmount), 0n);
  const remaining = toMoneyUnits(payment.appliedAmount) - refunded;
  return fromMoneyUnits(remaining > 0n ? remaining : 0n);
}

/**
 * What a succeeded payment (or a correction IN leg) still holds: its amount minus everything that
 * has consumed it — legacy refunds bound to it, manual refund allocations and correction-out
 * allocations. Runtime enforces the same capacity; this only mirrors it so the offered maximum is
 * not stale after a refund or a correction.
 */
export function remainingCapacity(
  payment: CompositionPayment,
  sale: {
    payments: readonly CompositionPayment[];
    paymentCorrections?: readonly {
      allocations: readonly { sourcePaymentId: string; amount: string }[];
    }[];
  },
): string {
  let consumed = 0n;
  for (const other of sale.payments) {
    if (other.status !== 'SUCCEEDED') continue;
    if (paymentKind(other) !== 'REFUND') continue;
    if (other.refundOfPaymentId === payment.id) consumed -= toMoneyUnits(other.appliedAmount);
    for (const allocation of other.refund?.allocations ?? [])
      if (allocation.sourcePaymentId === payment.id) consumed += toMoneyUnits(allocation.amount);
  }
  for (const correction of sale.paymentCorrections ?? [])
    for (const allocation of correction.allocations)
      if (allocation.sourcePaymentId === payment.id) consumed += toMoneyUnits(allocation.amount);
  const remaining = toMoneyUnits(payment.appliedAmount) - consumed;
  return fromMoneyUnits(remaining > 0n ? remaining : 0n);
}
