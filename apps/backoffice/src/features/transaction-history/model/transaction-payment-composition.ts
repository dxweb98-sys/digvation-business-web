import type { Payment } from '../api/transaction-history-api';

type CompositionPayment = Pick<Payment, 'id' | 'status' | 'appliedAmount'> &
  Partial<Pick<Payment, 'refundOfPaymentId'>> & { createdAt?: string };

export interface TransactionPaymentComposition<P> {
  /** Payments that actually settle the sale, in the order they were taken. */
  applied: P[];
  /** Succeeded negative facts that return money against an applied payment. */
  refunds: P[];
  /** Failed, cancelled, expired or still pending attempts; they never settle the sale. */
  notApplied: P[];
  totalPaid: string;
  totalRefunded: string;
  /** What is still open against the sale total; zero once settled. */
  balanceDue: string;
  settled: boolean;
  /** More than one applied payment settled the sale. The number of attempts never counts. */
  isSplit: boolean;
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
}): TransactionPaymentComposition<P> {
  const succeeded = (payment: P) => payment.status === 'SUCCEEDED';
  const applied = sale.payments
    .filter((payment) => succeeded(payment) && toMoneyUnits(payment.appliedAmount) > 0n)
    .sort(byCreation);
  const refunds = sale.payments
    .filter((payment) => succeeded(payment) && toMoneyUnits(payment.appliedAmount) < 0n)
    .sort(byCreation);
  const totalPaid = applied.reduce((sum, payment) => sum + toMoneyUnits(payment.appliedAmount), 0n);
  const totalRefunded = refunds.reduce(
    (sum, payment) => sum - toMoneyUnits(payment.appliedAmount),
    0n,
  );
  const total = toMoneyUnits(sale.totalAmount);
  const hasPending = sale.payments.some((payment) => payment.status === 'PENDING');
  const settled = !hasPending && totalPaid >= total;
  return {
    applied,
    refunds,
    notApplied: sale.payments.filter((payment) => !succeeded(payment)).sort(byCreation),
    totalPaid: fromMoneyUnits(totalPaid),
    totalRefunded: fromMoneyUnits(totalRefunded),
    balanceDue: fromMoneyUnits(total > totalPaid ? total - totalPaid : 0n),
    settled,
    isSplit: settled && applied.length > 1,
    hasPending,
  };
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
