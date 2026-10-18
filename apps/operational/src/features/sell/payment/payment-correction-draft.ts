import {
  createDecimal,
  type CorrectionEffectiveEntry,
  type CorrectionRouteInfo,
} from '@digvation/pos-money';

import type {
  PaymentComposition,
  PaymentCompositionEntry,
  PaymentRoute,
  Sale,
} from '../transaction/model/cashier-transaction.types';
import { paymentKind } from '../transaction/model/payment-kind';

export const PAYMENT_CORRECT_PERMISSION = 'payments:correct';

const ZERO = '0.0000';

/**
 * Runtime's effective payment composition. Only the local demo adapters, which have no Runtime,
 * lack it; then the successful payments received are grouped by route, exactly once, here.
 */
export function paymentCompositionOf(sale: Sale): PaymentComposition {
  if (sale.paymentComposition) return sale.paymentComposition;
  const entries = new Map<string, PaymentCompositionEntry>();
  let received = createDecimal('0');
  for (const payment of sale.payments) {
    if (payment.status !== 'SUCCEEDED') continue;
    const kind = paymentKind(payment);
    if (kind === 'REFUND') continue;
    const key = `${payment.method}|${payment.financePaymentRouteId ?? ''}`;
    const amount = createDecimal(payment.appliedAmount);
    received = received.plus(amount);
    const previous = entries.get(key);
    const total = createDecimal(previous?.receivedAmount ?? '0')
      .plus(amount)
      .toFixed(4);
    entries.set(key, {
      method: payment.method,
      paymentRouteId: payment.financePaymentRouteId ?? null,
      financialAccountId: payment.financeFinancialAccountId ?? null,
      financialAccountCode: payment.financeFinancialAccountCodeSnapshot ?? null,
      financialAccountName: payment.financeFinancialAccountNameSnapshot ?? null,
      receivedAmount: total,
      refundedAmount: ZERO,
      effectiveAmount: total,
    });
  }
  const refunded = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED' && paymentKind(payment) === 'REFUND')
    .reduce((sum, payment) => sum.minus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  return {
    entries: [...entries.values()],
    totalReceived: received.toFixed(4),
    totalRefunded: refunded.toFixed(4),
    totalPaid: received.minus(refunded).toFixed(4),
  };
}

/**
 * Whether the correction entry point is offered: the session holds the permission and the Sale has
 * money recorded on a route that could be re-attributed. Runtime stays the authority and refuses a
 * voided or reversed Sale, so a stale screen can never write one.
 */
export function canCorrectPayments(sale: Sale, permissions: readonly string[]): boolean {
  if (!permissions.includes(PAYMENT_CORRECT_PERMISSION)) return false;
  if (sale.status === 'VOIDED' || sale.reversal) return false;
  return paymentCompositionOf(sale).entries.some(
    (entry) => entry.paymentRouteId !== null && createDecimal(entry.effectiveAmount).greaterThan(0),
  );
}

/**
 * What the shared composition model starts from: the route-bound routes of Runtime's effective
 * composition. Legacy payments without a route cannot be re-attributed and stay out of the editor.
 */
export function correctionEffectiveEntries(sale: Sale): CorrectionEffectiveEntry[] {
  return paymentCompositionOf(sale)
    .entries.filter((entry) => entry.paymentRouteId !== null)
    .map((entry) => ({ routeId: entry.paymentRouteId!, amount: entry.effectiveAmount }));
}

/**
 * Every route money can be attributed to: the routes of the Sale's effective composition and every
 * active payment route of its location and currency. Two BANK_TRANSFER routes stay distinct.
 */
export function correctionRouteInfos(
  sale: Sale,
  routes: readonly PaymentRoute[],
): CorrectionRouteInfo[] {
  const infos = new Map<string, CorrectionRouteInfo>();
  for (const entry of paymentCompositionOf(sale).entries)
    if (entry.paymentRouteId)
      infos.set(entry.paymentRouteId, {
        routeId: entry.paymentRouteId,
        name: entry.financialAccountName ?? entry.method,
        method: entry.method,
      });
  for (const route of routes)
    if (
      route.status === 'ACTIVE' &&
      route.sellingLocationId === sale.sellingLocationId &&
      route.currency === sale.currency &&
      !infos.has(route.id)
    )
      infos.set(route.id, {
        routeId: route.id,
        name: route.financialAccountName,
        method: route.paymentMethod,
      });
  return [...infos.values()];
}
