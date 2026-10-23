import type { RefundDisbursementInput } from '../../transaction/api/cashier-transaction.adapter';
import type { PaymentRoute } from '../../transaction/model/cashier-transaction.types';

/** The manual refund methods of v1; QRIS and wallets are never a way to return money here. */
export const REFUND_METHODS = ['CASH', 'BANK_TRANSFER'] as const;

export interface RefundDisbursementDraft {
  method: RefundDisbursementInput['method'];
  paymentRouteId: string;
  externalReference: string;
  note: string;
}

/** The active routes a refund can leave through: cash or bank transfer, of an active account. */
export function refundRoutes(routes: readonly PaymentRoute[]): PaymentRoute[] {
  return routes.filter(
    (route) =>
      route.status === 'ACTIVE' &&
      (REFUND_METHODS as readonly string[]).includes(route.paymentMethod),
  );
}

/** The first available disbursement: cash when a cash route exists, otherwise bank transfer. */
export function defaultRefundDisbursement(
  routes: readonly PaymentRoute[],
): RefundDisbursementDraft | null {
  const available = refundRoutes(routes);
  const route = available.find((entry) => entry.paymentMethod === 'CASH') ?? available[0] ?? null;
  return route
    ? {
        method: route.paymentMethod as RefundDisbursementInput['method'],
        paymentRouteId: route.id,
        externalReference: '',
        note: '',
      }
    : null;
}

/** What Runtime receives; it validates the route and account again. */
export function refundDisbursementInput(draft: RefundDisbursementDraft): RefundDisbursementInput {
  return {
    method: draft.method,
    paymentRouteId: draft.paymentRouteId,
    ...(draft.externalReference.trim()
      ? { externalReference: draft.externalReference.trim() }
      : {}),
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
  };
}
