import type { PaymentKind } from './cashier-transaction.types';

export interface PaymentKindFact {
  appliedAmount: string;
  kind?: PaymentKind | undefined;
  correction?: { leg: 'OUT' | 'IN' } | null | undefined;
  refund?: unknown;
  providerReference?: string | null | undefined;
}
type KindFact = PaymentKindFact;

/**
 * What a payment fact IS. Runtime sends an explicit `kind`; it is used as is. Only the local demo
 * adapters, which have no Runtime, may omit it, and then the fact's own markers decide: a
 * correction leg, a refund record or refund reference, and finally the database invariant that
 * a negative payment is never anything but a refund or a correction leg.
 */
export function paymentKind(payment: KindFact): PaymentKind {
  if (payment.kind) return payment.kind;
  if (payment.correction)
    return payment.correction.leg === 'IN' ? 'CORRECTION_IN' : 'CORRECTION_OUT';
  if (payment.refund || payment.providerReference?.startsWith('REFUND:')) return 'REFUND';
  return payment.appliedAmount.trim().startsWith('-') ? 'REFUND' : 'PAYMENT';
}

/** One leg of a payment correction: a bookkeeping movement, never a payment, refund or attempt. */
export function isCorrectionLeg(payment: KindFact): boolean {
  const kind = paymentKind(payment);
  return kind === 'CORRECTION_IN' || kind === 'CORRECTION_OUT';
}
