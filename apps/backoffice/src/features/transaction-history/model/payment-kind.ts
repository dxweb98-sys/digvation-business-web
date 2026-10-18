import type { Payment, PaymentKind } from '../api/transaction-history-api';

type KindFact = Pick<Payment, 'appliedAmount'> &
  Partial<Pick<Payment, 'kind' | 'correction' | 'refund' | 'providerReference'>>;

/**
 * What a payment fact IS. Runtime sends an explicit `kind` and it is used as is. Only fixtures and
 * older payloads may omit it; then the fact's own markers decide (a correction leg, a refund record
 * or refund reference) and finally the database invariant that a negative payment is never anything
 * but a refund or a correction leg. The sign alone never overrides an explicit kind.
 */
export function paymentKind(payment: KindFact): PaymentKind {
  if (payment.kind) return payment.kind;
  if (payment.correction)
    return payment.correction.leg === 'IN' ? 'CORRECTION_IN' : 'CORRECTION_OUT';
  if (payment.refund || payment.providerReference?.startsWith('REFUND:')) return 'REFUND';
  return payment.appliedAmount.trim().startsWith('-') ? 'REFUND' : 'PAYMENT';
}
