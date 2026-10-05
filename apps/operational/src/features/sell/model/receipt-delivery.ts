import type {
  ReceiptDeliveryAttempt,
  ReceiptDeliveryRequest,
  ReceiptDeliveryState,
} from '../api/operational-projection-client';

/**
 * Receipt delivery as the cashier sees it.
 *
 * The WhatsApp provider only acknowledges that it accepted a send request; there is no delivery or
 * read confirmation. SENT is therefore presented as "request accepted", never as "delivered".
 */
export type ReceiptDeliveryPhase = 'NEVER' | 'PENDING' | 'ACCEPTED' | 'FAILED';

export function receiptDeliveryPhase(
  status: ReceiptDeliveryState | null | undefined,
): ReceiptDeliveryPhase {
  if (status === 'QUEUED' || status === 'SENDING') return 'PENDING';
  if (status === 'SENT') return 'ACCEPTED';
  if (status === 'FAILED') return 'FAILED';
  return 'NEVER';
}

/** Copy keys (feature-local localization) for each phase. */
export const RECEIPT_DELIVERY_PHASE_LABEL: Record<ReceiptDeliveryPhase, string> = {
  NEVER: 'Not sent yet',
  PENDING: 'Sending',
  ACCEPTED: 'Send request accepted',
  FAILED: 'Failed to send',
};

/** Safe, actionable reasons for the provider failure categories Runtime exposes. */
const FAILURE_REASON: Record<string, string> = {
  TARGET_INVALID: 'This number is not registered on WhatsApp. Check the number and try again.',
  DEVICE_DISCONNECTED: 'The business WhatsApp device is disconnected. Try again shortly.',
  QUOTA_EXHAUSTED: 'The WhatsApp sending quota is used up. Contact your administrator.',
  AUTHENTICATION_FAILED: 'WhatsApp sending is not set up correctly. Contact your administrator.',
  PROVIDER_UNAVAILABLE: 'WhatsApp sending is temporarily unavailable. Try again shortly.',
  DOCUMENT_URL_UNAVAILABLE: 'The receipt document could not be prepared. Try again shortly.',
};

export function receiptDeliveryFailureReason(category: string | null): string {
  return (category && FAILURE_REASON[category]) || 'WhatsApp did not accept the message. Try again.';
}

/**
 * Where a retry of an attempt goes. A customer-number attempt is retried to the customer number;
 * an attempt to another number reuses that attempt's number on Runtime without revealing it here.
 */
export function retryTargetOf(
  attempt: Pick<ReceiptDeliveryAttempt, 'deliveryId' | 'customerDestination'>,
): Pick<ReceiptDeliveryRequest, 'retryOfDeliveryId'> {
  return attempt.customerDestination ? {} : { retryOfDeliveryId: attempt.deliveryId };
}

export function newReceiptDeliveryKey(saleId: string): string {
  return `receipt-delivery-${saleId}-${crypto.randomUUID()}`;
}

/** "+6281231233123" -> "+62 812 3123 3123": easy to verify at a glance. */
export function formatWhatsappNumber(e164: string): string {
  const match = /^\+62(\d{3})(\d{3,4})(\d{0,5})$/.exec(e164);
  if (!match) return e164;
  return ['+62', match[1], match[2], match[3]].filter(Boolean).join(' ');
}
