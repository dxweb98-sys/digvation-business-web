import { ApiError } from '@digvation/business-api';
import { DAlert, DButton as Button, DDialog as Dialog, useToast } from '@digvation-labs/ui';
import { DTextarea } from '@digvation/ui';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  cashierTransactionErrorMessage,
  isSaleVersionConflict,
} from '../transaction/api/cashier-transaction-errors';
import type { PaymentCorrectionInput } from '../transaction/api/cashier-transaction.adapter';
import type { PaymentRoute, Sale } from '../transaction/model/cashier-transaction.types';
import { money, transactionNumber } from '../transaction/model/sale-display';
import { PosCurrencyInput, currencyInputFromAmount } from '../lib/pos-controls';
import {
  correctionRows,
  correctionState,
  paymentCompositionOf,
  paymentCorrectionInput,
} from './payment-correction-draft';

/** Runtime's payment-correction refusals an operator can act on, in the operator's words. */
function correctionErrorCopy(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case 'PAYMENT_CORRECTION_NOT_NET_ZERO':
      return 'The total paid must stay the same.';
    case 'PAYMENT_CORRECTION_EXCEEDS_SOURCE':
      return 'A route cannot give away more than was recorded on it.';
    case 'PAYMENT_CORRECTION_ROUTE_INVALID':
      return 'A payment route is no longer available. Reload and choose again.';
    case 'PAYMENT_CORRECTION_SALE_VOIDED':
    case 'SALE_ALREADY_REVERSED':
      return 'This transaction can no longer have its payments corrected.';
    case 'FORBIDDEN':
    case 'PAYMENT_CORRECTION_FORBIDDEN':
      return 'You are not allowed to correct payments.';
    default:
      return null;
  }
}

/**
 * Corrects how a payment was recorded, never how much was paid. The operator edits the CORRECT
 * composition per route; the signed changes are derived and must net to zero. Runtime validates
 * the derived correction again and is the only authority on the result.
 */
export function ReferencePaymentCorrectionDialog({
  sale,
  locale,
  paymentRoutes,
  onClose,
  onCorrect,
  onCorrected,
  onReload,
}: {
  sale: Sale | null;
  locale: string;
  /** The location's active payment routes, so money can be attributed to a route not yet used. */
  paymentRoutes: readonly PaymentRoute[];
  onClose: () => void;
  /** Sends the one correction command; only Runtime's Sale is ever shown afterwards. */
  onCorrect: (
    saleId: string,
    input: PaymentCorrectionInput,
    idempotencyKey: string,
  ) => Promise<Sale>;
  onCorrected: (sale: Sale) => void;
  /** Reloads the persisted Sale after it changed elsewhere. */
  onReload: (saleId: string) => Promise<Sale>;
}) {
  const { copy, label } = useOperationalLocalization();
  const { showToast } = useToast();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  // One idempotency key per exact request, so a retry of the same correction never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);

  if (!sale) return null;
  const format = (amount: string) => money(amount, locale);
  const rows = correctionRows(sale, paymentRoutes);
  const composition = paymentCompositionOf(sale);
  const state = correctionState(rows, targets);
  const trimmedReason = reason.trim();
  const ready = state.ok && trimmedReason.length >= 3 && !conflict && !saving;
  const textOf = (routeId: string, current: string) =>
    targets[routeId] ?? currencyInputFromAmount(current);

  const save = () => {
    if (!state.ok || !ready) return;
    const request = paymentCorrectionInput(sale, trimmedReason, state.moves);
    const signature = JSON.stringify(request);
    const key =
      attempt?.request === signature
        ? attempt.key
        : `cashier-payment-correction-${crypto.randomUUID()}`;
    setAttempt({ request: signature, key });
    setSaving(true);
    setSaveError(null);
    void onCorrect(sale.id, request, key)
      .then((updated) => {
        showToast({
          title: copy('Payment correction saved'),
          description: transactionNumber(updated, locale),
          variant: 'success',
        });
        onCorrected(updated);
      })
      .catch((error: unknown) => {
        // The typed values stay exactly as they were; only Runtime's refusal is explained.
        setSaving(false);
        const known = correctionErrorCopy(error);
        setSaveError(
          known
            ? copy(known)
            : error instanceof ApiError
              ? cashierTransactionErrorMessage(error, locale)
              : copy('The payment correction could not be saved. Try again.'),
        );
        if (isSaleVersionConflict(error)) setConflict(true);
      });
  };
  const reload = () => {
    setReloading(true);
    void onReload(sale.id)
      .then(() => {
        // The composition changed under the draft: start the targets again from what Runtime holds.
        setTargets({});
        setConflict(false);
        setSaveError(null);
      })
      .catch((error: unknown) => setSaveError(cashierTransactionErrorMessage(error, locale)))
      .finally(() => setReloading(false));
  };
  const close = () => {
    if (!saving) onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title={copy('Payment correction')}
      description={transactionNumber(sale, locale)}
      ariaLabel={copy('Payment correction')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={close}>
            {copy('Cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={saving} onClick={save}>
            {copy('Save correction')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          {copy('Payment correction explanation')}
        </p>

        <section aria-label={copy('Recorded now')}>
          <h3 className="text-sm font-semibold">{copy('Recorded now')}</h3>
          <ul className="mt-1 divide-y divide-[var(--color-border)]">
            {composition.entries.map((entry, index) => (
              <li
                key={entry.paymentRouteId ?? `${entry.method}-${index}`}
                className="flex justify-between gap-4 py-1.5 text-sm"
              >
                <span className="min-w-0 break-words">
                  {entry.financialAccountName ?? label(entry.method)}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {format(entry.effectiveAmount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{copy('Total paid')}</span>
            <span className="tabular-nums">{format(composition.totalPaid)}</span>
          </p>
        </section>

        <section aria-label={copy('Correct recording')}>
          <h3 className="text-sm font-semibold">{copy('Correct recording')}</h3>
          <ul className="mt-1 space-y-2">
            {rows.map((row) => (
              <li key={row.routeId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 text-sm">
                  <span className="block break-words font-medium">{row.name}</span>
                  <span className="block text-xs text-[var(--color-text-muted)]">
                    {label(row.method)}
                  </span>
                </span>
                <PosCurrencyInput
                  aria-label={row.name}
                  className="w-40 text-right"
                  value={textOf(row.routeId, row.current)}
                  disabled={saving}
                  fractionDigits={0}
                  onChange={(value) =>
                    setTargets((previous) => ({ ...previous, [row.routeId]: value }))
                  }
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={copy('Correction changes')}>
          <h3 className="text-sm font-semibold">{copy('Correction changes')}</h3>
          {state.ok ? (
            <ul className="mt-1 divide-y divide-[var(--color-border)]">
              {state.moves.map((move) => (
                <li key={move.row.routeId} className="flex justify-between gap-4 py-1.5 text-sm">
                  <span className="min-w-0 break-words">{move.row.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {move.delta.startsWith('-')
                      ? `−${format(move.delta.slice(1))}`
                      : `+${format(move.delta)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : state.reason === 'NOT_NET_ZERO' ? (
            <DAlert
              variant="warning"
              role="alert"
              title={copy('The total paid must stay the same.')}
            >
              {copy('Correction difference')}:{' '}
              {state.net.startsWith('-')
                ? `−${format(state.net.slice(1))}`
                : `+${format(state.net)}`}
            </DAlert>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Nothing to change yet.')}
            </p>
          )}
        </section>

        <label className="block text-sm font-medium">
          {copy('Reason')}
          <DTextarea
            className="mt-1.5 h-10 rounded-lg"
            value={reason}
            disabled={saving}
            onChange={setReason}
            placeholder={copy('Correction reason placeholder')}
          />
        </label>

        {saveError ? (
          <DAlert variant="danger" role="alert">
            {saveError}
            {conflict ? (
              <>
                {' '}
                <Button size="sm" variant="outline" loading={reloading} onClick={reload}>
                  {copy('Reload latest transaction')}
                </Button>
              </>
            ) : null}
          </DAlert>
        ) : null}
      </div>
    </Dialog>
  );
}
