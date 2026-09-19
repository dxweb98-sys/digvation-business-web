import type { Payment } from './transaction-history-api';

type CompositionPayment = Pick<Payment, 'status' | 'appliedAmount'> & { createdAt?: string };

export interface TransactionPaymentComposition<P> {
  /** Payments that actually settle the sale, in the order they were taken. */
  applied: P[];
  /** Failed, cancelled, expired or still pending attempts; they never settle the sale. */
  notApplied: P[];
  totalPaid: string;
  /** What is still open against the sale total; zero once settled. */
  balanceDue: string;
  settled: boolean;
  /** More than one applied payment settled the sale. The number of attempts never counts. */
  isSplit: boolean;
}

const SCALE = 4;

/** Runtime money is a decimal string with at most four fraction digits; sum it exactly. */
function toUnits(amount: string): bigint {
  const [whole = '0', fraction = ''] = amount.trim().split('.');
  const negative = whole.startsWith('-');
  const units =
    BigInt(whole.replace('-', '') || '0') * 10n ** BigInt(SCALE) +
    BigInt(fraction.padEnd(SCALE, '0').slice(0, SCALE) || '0');
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const factor = 10n ** BigInt(SCALE);
  return `${units / factor}.${(units % factor).toString().padStart(SCALE, '0')}`;
}

/**
 * How a transaction was actually paid. Mirrors Runtime settlement, which only counts
 * succeeded payments toward the sale total.
 */
export function transactionPaymentComposition<P extends CompositionPayment>(sale: {
  totalAmount: string;
  payments: readonly P[];
}): TransactionPaymentComposition<P> {
  const isApplied = (payment: P) =>
    payment.status === 'SUCCEEDED' && toUnits(payment.appliedAmount) > 0n;
  const applied = sale.payments
    .filter(isApplied)
    .sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? ''));
  const totalPaid = applied.reduce((sum, payment) => sum + toUnits(payment.appliedAmount), 0n);
  const total = toUnits(sale.totalAmount);
  const settled =
    !sale.payments.some((payment) => payment.status === 'PENDING') && totalPaid >= total;
  return {
    applied,
    notApplied: sale.payments
      .filter((payment) => !isApplied(payment))
      .sort((left, right) => (left.createdAt ?? '').localeCompare(right.createdAt ?? '')),
    totalPaid: fromUnits(totalPaid),
    balanceDue: fromUnits(total > totalPaid ? total - totalPaid : 0n),
    settled,
    isSplit: settled && applied.length > 1,
  };
}
