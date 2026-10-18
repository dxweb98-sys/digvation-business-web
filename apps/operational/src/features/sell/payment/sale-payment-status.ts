import { createDecimal } from '@digvation/pos-money';
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  Sale,
} from '../transaction/model/cashier-transaction.types';
import { isFullySettled } from '../transaction/model/sale-lifecycle';

export function hasSuccessfulCheckout(sale: Sale): boolean {
  return isFullySettled(sale);
}

function successfulPayments(sale: Sale) {
  return sale.payments.filter((payment) => payment.status === 'SUCCEEDED');
}

export function financialSummary(sale: Sale) {
  const totalPaid = successfulPayments(sale).reduce(
    (sum, payment) => sum.plus(createDecimal(payment.appliedAmount)),
    createDecimal('0'),
  );
  const balance = createDecimal(sale.totalAmount).minus(totalPaid);
  return {
    totalPaid: totalPaid.toFixed(4),
    balanceDue: balance.greaterThan(createDecimal('0')) ? balance.toFixed(4) : '0.0000',
  };
}

export function paymentAccountLabel(
  payment: Payment,
  fallback: (method: PaymentMethod) => string,
): string {
  return payment.financeFinancialAccountNameSnapshot?.trim() || fallback(payment.method);
}

export type TerminalPaymentStatus = Exclude<PaymentStatus, 'PENDING'>;

export function hasSuccessfulPayment(sale: Sale): boolean {
  return successfulPayments(sale).some((payment) =>
    createDecimal(payment.appliedAmount).greaterThan(createDecimal('0')),
  );
}
