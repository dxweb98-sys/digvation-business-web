import { createDecimal } from '@digvation/pos-money';

import type { Sale } from '../transaction/model/cashier-transaction.types';
import { saleSettlement } from '../transaction/model/sale-presentation';

/**
 * Settlement of the Sale a persisted correction or compensation returned: what is paid, what is
 * overpaid and must be returned, what remains to pay, and which payment a return goes through.
 */
export function correctionSettlement(authoritativeSale: Sale) {
  const authoritativeSettlement = saleSettlement(authoritativeSale);
  const settledPaid = createDecimal(authoritativeSettlement.totalPaid);
  const settledTotal = createDecimal(authoritativeSale.totalAmount);
  const settledOverpayment = settledPaid.greaterThan(settledTotal)
    ? settledPaid.minus(settledTotal)
    : createDecimal('0');
  const settledBalance = settledTotal.greaterThan(settledPaid)
    ? settledTotal.minus(settledPaid)
    : createDecimal('0');
  const settlementCashPayment = authoritativeSale.payments.find(
    (item) =>
      item.status === 'SUCCEEDED' &&
      item.method === 'CASH' &&
      createDecimal(item.appliedAmount).greaterThan(0),
  );
  const settlementProviderPayment = authoritativeSale.payments.find(
    (item) =>
      item.status === 'SUCCEEDED' &&
      item.method !== 'CASH' &&
      createDecimal(item.appliedAmount).greaterThan(0),
  );
  return {
    settledPaid,
    settledOverpayment,
    settledBalance,
    settlementCashPayment,
    settlementProviderPayment,
  };
}
