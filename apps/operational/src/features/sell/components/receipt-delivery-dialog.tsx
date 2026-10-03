import { DAlert, DButton, DDialog, DInput, DSkeleton } from '@digvation-labs/ui';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { cashierTransactionErrorMessage, isApiErrorCode } from '../cashier-transaction-errors';
import { sanitizePhoneInput, toCanonicalPhone } from '../customer-input';
import type {
  OperationalReceiptDeliveryCommands,
  ReceiptDeliveryAttempt,
  ReceiptDeliveryIndicator,
  ReceiptDeliveryRequest,
} from '../operational-projection-client';
import {
  formatWhatsappNumber,
  newReceiptDeliveryKey,
  RECEIPT_DELIVERY_PHASE_LABEL,
  receiptDeliveryFailureReason,
  receiptDeliveryPhase,
  type ReceiptDeliveryPhase,
} from '../receipt-delivery';

/** The completed transaction a receipt is sent for. Only what sending needs; no receipt content. */
export interface ReceiptDeliveryTarget {
  readonly saleId: string;
  /** Display transaction number. */
  readonly reference: string;
  readonly customerName: string | null;
  /** Full customer number when the operator may already see it; null for a summary-only reader. */
  readonly customerPhone: string | null;
}

export const receiptDeliveryStatusKey = (saleId: string | null) =>
  ['operational-receipt-delivery', saleId] as const;

type DestinationMode = 'CUSTOMER' | 'LAST' | 'NEW';

const PENDING_POLL_MS = 2_000;

const localCopy: Record<string, { 'id-ID': string; 'en-US': string }> = {
  'Send receipt': { 'id-ID': 'Kirim struk', 'en-US': 'Send receipt' },
  'Last status': { 'id-ID': 'Status terakhir', 'en-US': 'Last status' },
  'Not sent yet': { 'id-ID': 'Belum pernah dikirim', 'en-US': 'Not sent yet' },
  Sending: { 'id-ID': 'Mengirim…', 'en-US': 'Sending…' },
  'Send request accepted': {
    'id-ID': 'Permintaan pengiriman berhasil',
    'en-US': 'Send request accepted',
  },
  'Failed to send': { 'id-ID': 'Gagal mengirim', 'en-US': 'Failed to send' },
  'Accepted by the WhatsApp service. Delivery to the customer is not confirmed.': {
    'id-ID': 'Diterima layanan WhatsApp. Sampainya pesan ke pelanggan belum terkonfirmasi.',
    'en-US': 'Accepted by the WhatsApp service. Delivery to the customer is not confirmed.',
  },
  'by {name}': { 'id-ID': 'oleh {name}', 'en-US': 'by {name}' },
  'Earlier attempts': { 'id-ID': 'Percobaan sebelumnya', 'en-US': 'Earlier attempts' },
  'Destination WhatsApp number': {
    'id-ID': 'Nomor WhatsApp tujuan',
    'en-US': 'Destination WhatsApp number',
  },
  'Customer number': { 'id-ID': 'Nomor pelanggan', 'en-US': 'Customer number' },
  'Number used last time': { 'id-ID': 'Nomor pengiriman terakhir', 'en-US': 'Number used last time' },
  'Change number': { 'id-ID': 'Ubah nomor', 'en-US': 'Change number' },
  'Use customer number': { 'id-ID': 'Pakai nomor pelanggan', 'en-US': 'Use customer number' },
  'Phone placeholder': { 'id-ID': 'Contoh: 0812 3456 7890', 'en-US': 'Example: 0812 3456 7890' },
  'Enter a valid WhatsApp number, for example 0812 3456 7890.': {
    'id-ID': 'Masukkan nomor WhatsApp yang valid, contoh 0812 3456 7890.',
    'en-US': 'Enter a valid WhatsApp number, for example 0812 3456 7890.',
  },
  'The previous receipt was sent to {number}.': {
    'id-ID': 'Struk sebelumnya dikirim ke {number}.',
    'en-US': 'The previous receipt was sent to {number}.',
  },
  'This number is used only for this receipt and does not change the customer or transaction data.': {
    'id-ID': 'Nomor ini hanya dipakai untuk pengiriman struk ini dan tidak mengubah data pelanggan atau transaksi.',
    'en-US': 'This number is used only for this receipt and does not change the customer or transaction data.',
  },
  'WhatsApp receipt delivery is not available in this installation.': {
    'id-ID': 'Pengiriman struk WhatsApp belum tersedia di instalasi ini.',
    'en-US': 'WhatsApp receipt delivery is not available in this installation.',
  },
  'Delivery status could not be loaded.': {
    'id-ID': 'Status pengiriman tidak dapat dimuat.',
    'en-US': 'Delivery status could not be loaded.',
  },
  Cancel: { 'id-ID': 'Batal', 'en-US': 'Cancel' },
  Close: { 'id-ID': 'Tutup', 'en-US': 'Close' },
  'Send WhatsApp': { 'id-ID': 'Kirim WhatsApp', 'en-US': 'Send WhatsApp' },
  Resend: { 'id-ID': 'Kirim ulang', 'en-US': 'Resend' },
  'Try again': { 'id-ID': 'Coba lagi', 'en-US': 'Try again' },
  'Send to new number': { 'id-ID': 'Kirim ke nomor baru', 'en-US': 'Send to new number' },
  'This number is not registered on WhatsApp. Check the number and try again.': {
    'id-ID': 'Nomor ini tidak terdaftar di WhatsApp. Periksa nomor lalu coba lagi.',
    'en-US': 'This number is not registered on WhatsApp. Check the number and try again.',
  },
  'The business WhatsApp device is disconnected. Try again shortly.': {
    'id-ID': 'Perangkat WhatsApp usaha sedang terputus. Coba lagi sebentar lagi.',
    'en-US': 'The business WhatsApp device is disconnected. Try again shortly.',
  },
  'The WhatsApp sending quota is used up. Contact your administrator.': {
    'id-ID': 'Kuota pengiriman WhatsApp habis. Hubungi administrator.',
    'en-US': 'The WhatsApp sending quota is used up. Contact your administrator.',
  },
  'WhatsApp sending is not set up correctly. Contact your administrator.': {
    'id-ID': 'Pengiriman WhatsApp belum diatur dengan benar. Hubungi administrator.',
    'en-US': 'WhatsApp sending is not set up correctly. Contact your administrator.',
  },
  'WhatsApp sending is temporarily unavailable. Try again shortly.': {
    'id-ID': 'Pengiriman WhatsApp sedang tidak tersedia. Coba lagi sebentar lagi.',
    'en-US': 'WhatsApp sending is temporarily unavailable. Try again shortly.',
  },
  'The receipt document could not be prepared. Try again shortly.': {
    'id-ID': 'Dokumen struk belum dapat disiapkan. Coba lagi sebentar lagi.',
    'en-US': 'The receipt document could not be prepared. Try again shortly.',
  },
  'WhatsApp did not accept the message. Try again.': {
    'id-ID': 'WhatsApp tidak menerima pesan ini. Coba lagi.',
    'en-US': 'WhatsApp did not accept the message. Try again.',
  },
};

/** Short labels for the low-emphasis queue card line. */
const INDICATOR_COPY: Record<ReceiptDeliveryPhase, { 'id-ID': string; 'en-US': string }> = {
  NEVER: { 'id-ID': 'Belum dikirim', 'en-US': 'Not sent' },
  PENDING: { 'id-ID': 'Mengirim', 'en-US': 'Sending' },
  ACCEPTED: { 'id-ID': 'Permintaan berhasil', 'en-US': 'Request accepted' },
  FAILED: { 'id-ID': 'Gagal dikirim', 'en-US': 'Failed' },
};

/** Receipt preview button: names what opening the flow will do, and never claims delivery. */
const PREVIEW_ACTION_COPY: Record<ReceiptDeliveryPhase, { 'id-ID': string; 'en-US': string }> = {
  NEVER: { 'id-ID': 'Kirim via WhatsApp', 'en-US': 'Send via WhatsApp' },
  PENDING: { 'id-ID': 'Mengirim WhatsApp…', 'en-US': 'Sending WhatsApp…' },
  ACCEPTED: { 'id-ID': 'Kirim ulang WhatsApp', 'en-US': 'Resend via WhatsApp' },
  FAILED: { 'id-ID': 'Gagal · Coba lagi', 'en-US': 'Failed · Try again' },
};

export function receiptDeliveryPreviewLabel(
  phase: ReceiptDeliveryPhase,
  locale: 'id-ID' | 'en-US',
): string {
  return PREVIEW_ACTION_COPY[phase][locale];
}

const PHASE_ICON: Record<ReceiptDeliveryPhase, typeof Clock> = {
  NEVER: Send,
  PENDING: Clock,
  ACCEPTED: CheckCircle2,
  FAILED: AlertCircle,
};

const PHASE_TONE: Record<ReceiptDeliveryPhase, string> = {
  NEVER: 'text-[var(--color-text-muted)]',
  PENDING: 'text-[var(--color-text)]',
  ACCEPTED: 'text-[var(--color-success)]',
  FAILED: 'text-[var(--color-danger)]',
};

/**
 * Secondary text on a completed queue card answering "was this receipt sent?" without opening
 * anything. Deliberately quiet: it must not compete with the payment and queue status badges.
 */
export function ReceiptDeliveryIndicatorLine({
  indicator,
}: {
  indicator: ReceiptDeliveryIndicator | null | undefined;
}) {
  const { locale } = useOperationalLocalization();
  const phase = receiptDeliveryPhase(indicator?.status);
  const tone =
    phase === 'FAILED'
      ? 'text-[var(--color-danger)]'
      : phase === 'ACCEPTED'
        ? 'text-[var(--color-success)]'
        : 'text-[var(--color-text-muted)]';
  return (
    <p className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">
      {locale === 'en-US' ? 'WA receipt' : 'Struk WA'} ·{' '}
      <span className={phase === 'NEVER' ? undefined : `font-medium ${tone}`}>
        {INDICATOR_COPY[phase][locale]}
      </span>
      {indicator && phase !== 'NEVER' ? (
        <span className="tabular-nums"> · {indicator.destinationMasked.replace(/^\+\d+\s/, '')}</span>
      ) : null}
    </p>
  );
}

/**
 * The one receipt-delivery flow of Operational. The completed-queue action and the receipt preview
 * both open it, so both read the same delivery history and request through the same contract.
 *
 * The destination chosen here applies to a single attempt. Runtime never writes it to the
 * transaction customer snapshot or to a Member/Customer record.
 */
export function ReceiptDeliveryDialog({
  target,
  commands,
  onClose,
  onDeliveryChanged,
}: {
  target: ReceiptDeliveryTarget | null;
  commands: OperationalReceiptDeliveryCommands;
  onClose: () => void;
  /** Called whenever the latest attempt or its outcome changes, so list indicators follow. */
  onDeliveryChanged?: (saleId: string) => void;
}) {
  const { locale, formatDateTime } = useOperationalLocalization();
  const text = (value: string, params: Record<string, string> = {}) =>
    Object.entries(params).reduce(
      (result, [key, param]) => result.replace(`{${key}}`, param),
      localCopy[value]?.[locale] ?? value,
    );
  const saleId = target?.saleId ?? null;
  const statusQuery = useQuery({
    queryKey: receiptDeliveryStatusKey(saleId),
    queryFn: () => commands.getReceiptDeliveryStatus(saleId!),
    enabled: Boolean(saleId),
    staleTime: 1_000,
    refetchInterval: (query) =>
      receiptDeliveryPhase(query.state.data?.delivery?.status) === 'PENDING'
        ? PENDING_POLL_MS
        : false,
  });

  const [modeChoice, setModeChoice] = useState<DestinationMode | null>(null);
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  // A synchronous guard: a double click lands before React re-renders the disabled button.
  const inFlight = useRef(false);
  const [openedFor, setOpenedFor] = useState<string | null>(saleId);
  if (openedFor !== saleId) {
    setOpenedFor(saleId);
    setModeChoice(null);
    setPhone('');
    setFieldError(null);
    setRequestError(null);
  }

  const status = statusQuery.data ?? null;
  const latest = status?.delivery ?? null;
  // The first observation is the state the list already shows; later changes are news to it.
  const deliveryKey = statusQuery.data
    ? `${saleId}:${latest?.deliveryId ?? ''}:${latest?.status ?? ''}`
    : null;
  const observedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!deliveryKey || !saleId) return;
    const previous = observedKey.current;
    observedKey.current = deliveryKey;
    if (previous && previous !== deliveryKey && previous.startsWith(`${saleId}:`))
      onDeliveryChanged?.(saleId);
  }, [deliveryKey, saleId, onDeliveryChanged]);
  const phase = receiptDeliveryPhase(latest?.status);
  const earlier = status?.history.slice(1) ?? [];
  const defaultMode: DestinationMode = latest && !latest.customerDestination ? 'LAST' : 'CUSTOMER';
  const mode = modeChoice ?? defaultMode;
  const available = status?.available ?? false;
  const customerDisplay = target?.customerPhone
    ? formatWhatsappNumber(target.customerPhone)
    : (status?.customerDestinationMasked ?? null);

  const startNewNumber = () => {
    setModeChoice('NEW');
    setPhone(target?.customerPhone ? formatWhatsappNumber(target.customerPhone) : '');
    setFieldError(null);
    setRequestError(null);
  };

  const submit = async () => {
    if (!target || inFlight.current) return;
    let request: ReceiptDeliveryRequest = {
      channel: 'WHATSAPP',
      idempotencyKey: newReceiptDeliveryKey(target.saleId),
    };
    if (mode === 'NEW') {
      const destination = toCanonicalPhone(phone);
      if (!destination) {
        setFieldError(text('Enter a valid WhatsApp number, for example 0812 3456 7890.'));
        return;
      }
      request = { ...request, destination };
    } else if (mode === 'LAST' && latest) {
      request = { ...request, retryOfDeliveryId: latest.deliveryId };
    }

    inFlight.current = true;
    setSubmitting(true);
    setFieldError(null);
    setRequestError(null);
    try {
      await commands.requestReceiptDelivery(target.saleId, request);
      setModeChoice(null);
      setPhone('');
      await statusQuery.refetch();
    } catch (error) {
      if (isApiErrorCode(error, 'RECEIPT_DELIVERY_DESTINATION_INVALID'))
        setFieldError(text('Enter a valid WhatsApp number, for example 0812 3456 7890.'));
      else setRequestError(cashierTransactionErrorMessage(error, locale));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const busy = isSubmitting || phase === 'PENDING';
  const primaryLabel =
    mode === 'NEW'
      ? latest
        ? text('Send to new number')
        : text('Send WhatsApp')
      : phase === 'FAILED'
        ? text('Try again')
        : phase === 'ACCEPTED'
          ? text('Resend')
          : text('Send WhatsApp');

  const attemptLine = (attempt: ReceiptDeliveryAttempt) =>
    [
      attempt.destinationMasked,
      formatDateTime(attempt.requestedAt),
      attempt.requestedByName ? text('by {name}', { name: attempt.requestedByName }) : null,
    ]
      .filter(Boolean)
      .join(', ');

  const PhaseIcon = PHASE_ICON[phase];

  return (
    <DDialog
      open={Boolean(target)}
      title={text('Send receipt')}
      description={target?.reference ?? ''}
      onClose={onClose}
      ariaLabel={text('Send receipt')}
      closeOnEscape={!isSubmitting}
      closeOnOverlay={!isSubmitting}
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DButton variant="outline" disabled={isSubmitting} onClick={onClose}>
            {phase === 'NEVER' ? text('Cancel') : text('Close')}
          </DButton>
          {available ? (
            <DButton
              leftIcon={<Send className="size-3.5" />}
              loading={busy}
              disabled={busy || statusQuery.isPending}
              onClick={() => void submit()}
            >
              {primaryLabel}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="mt-4 space-y-4">
        {target?.customerName ? (
          <p className="truncate text-sm font-semibold">{target.customerName}</p>
        ) : null}

        {statusQuery.isPending ? (
          <DSkeleton className="h-16 w-full rounded-xl" />
        ) : statusQuery.isError ? (
          <DAlert variant="danger">{text('Delivery status could not be loaded.')}</DAlert>
        ) : (
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-3 py-3">
            <p className="text-xs text-[var(--color-text-muted)]">{text('Last status')}</p>
            <div role="status" aria-atomic="true" className="mt-1">
              <p className={`flex items-center gap-1.5 text-sm font-semibold ${PHASE_TONE[phase]}`}>
                <PhaseIcon className="size-4 shrink-0" aria-hidden="true" />
                {text(RECEIPT_DELIVERY_PHASE_LABEL[phase])}
              </p>
              {latest ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{attemptLine(latest)}</p>
              ) : null}
              {phase === 'ACCEPTED' ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {text('Accepted by the WhatsApp service. Delivery to the customer is not confirmed.')}
                </p>
              ) : null}
              {phase === 'FAILED' && latest ? (
                <p className="mt-1 text-xs text-[var(--color-danger)]">
                  {text(receiptDeliveryFailureReason(latest.failureCategory))}
                </p>
              ) : null}
            </div>
            {earlier.length ? (
              <details className="mt-2 text-xs text-[var(--color-text-muted)]">
                <summary className="cursor-pointer select-none font-medium">
                  {text('Earlier attempts')} ({earlier.length})
                </summary>
                <ul className="mt-1.5 space-y-1">
                  {earlier.map((attempt) => (
                    <li key={attempt.deliveryId}>
                      {text(RECEIPT_DELIVERY_PHASE_LABEL[receiptDeliveryPhase(attempt.status)])}:{' '}
                      {attemptLine(attempt)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        )}

        {status && !available ? (
          <DAlert variant="neutral">
            {text('WhatsApp receipt delivery is not available in this installation.')}
          </DAlert>
        ) : null}

        {available ? (
          mode === 'NEW' ? (
            <div className="space-y-2">
              {latest ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {text('The previous receipt was sent to {number}.', {
                    number: latest.destinationMasked,
                  })}
                </p>
              ) : null}
              <DInput
                label={text('Destination WhatsApp number')}
                placeholder={text('Phone placeholder')}
                value={phone}
                onChange={(value) => {
                  setPhone(sanitizePhoneInput(value));
                  setFieldError(null);
                }}
                inputMode="tel"
                autoComplete="off"
                autoFocus
                disabled={isSubmitting}
                error={fieldError ?? undefined}
              />
              {customerDisplay ? (
                <DButton
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => {
                    setModeChoice('CUSTOMER');
                    setFieldError(null);
                  }}
                >
                  {text('Use customer number')}
                </DButton>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-0 grow basis-40">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {text(mode === 'LAST' ? 'Number used last time' : 'Customer number')}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
                  {mode === 'LAST' ? latest?.destinationMasked : (customerDisplay ?? '—')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {mode === 'LAST' && customerDisplay ? (
                  <DButton
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setModeChoice('CUSTOMER')}
                  >
                    {text('Use customer number')}
                  </DButton>
                ) : null}
                <DButton variant="outline" size="sm" disabled={busy} onClick={startNewNumber}>
                  {text('Change number')}
                </DButton>
              </div>
            </div>
          )
        ) : null}

        {available ? (
          <p className="text-xs leading-5 text-[var(--color-text-muted)]">
            {text(
              'This number is used only for this receipt and does not change the customer or transaction data.',
            )}
          </p>
        ) : null}

        {requestError ? <DAlert variant="danger">{requestError}</DAlert> : null}
      </div>
    </DDialog>
  );
}
