import { ApiError } from '@digvation/business-api';
import {
  correctionDraftState,
  paymentCorrectionRequest,
  startCorrectionDraft,
  type CorrectionDraft,
} from '@digvation/pos-money';
import { CorrectionCompositionEditor } from '@digvation/business-payment-correction-ui';
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
import { PosCurrencyInput } from '../lib/pos-controls';
import { correctionEffectiveEntries, correctionRouteInfos } from './payment-correction-draft';

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
 * composition of the routes in use; the composition model (shared with Backoffice) balances two
 * routes, reports what is left to allocate across more, and derives the net-zero changes. Runtime
 * validates the derived correction again and is the only authority on the result.
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
  /** The location's active payment routes, so a route not yet used can be added. */
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
  const [draft, setDraft] = useState<CorrectionDraft | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  // One idempotency key per exact request, so a retry of the same correction never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);

  if (!sale) return null;
  const format = (amount: string) => money(amount, locale);
  const infos = correctionRouteInfos(sale, paymentRoutes);
  const current = draft ?? startCorrectionDraft(correctionEffectiveEntries(sale));
  const state = correctionDraftState(current);
  const trimmedReason = reason.trim();
  const ready = state.ok && trimmedReason.length >= 3 && !conflict && !saving;
  const update = (next: CorrectionDraft) => setDraft(next);
  const baseline = startCorrectionDraft(correctionEffectiveEntries(sale));

  const save = () => {
    if (!state.ok || !ready) return;
    const request = paymentCorrectionRequest({
      expectedVersion: sale.version,
      reason: trimmedReason,
      moves: state.moves,
    });
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
        // The composition changed under the draft: start again from what Runtime holds.
        setDraft(null);
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
        <p className="text-sm text-[var(--color-text-muted)]">
          {copy('Payment correction explanation')}
        </p>

        <CorrectionCompositionEditor
          baseline={baseline}
          draft={current}
          routes={infos}
          disabled={saving}
          density="comfortable"
          formatMoney={format}
          methodLabel={(method) => (method ? label(method as never) : '')}
          onDraftChange={update}
          labels={{
            recordedNow: copy('Recorded now'),
            totalPaid: copy('Total paid'),
            correctRecording: copy('Correct recording'),
            total: copy('Total'),
            addPaymentMethod: copy('Add payment method'),
            removePaymentMethod: copy('Remove payment method'),
            twoRouteHint: copy('Two route balance hint'),
            leftToAllocate: copy('Left to allocate'),
            allocatedBeyondTotal: copy('Allocated beyond the total paid'),
            changes: copy('Correction changes'),
            changesTitle: copy('Changes to record'),
            totalChanges: copy('Total changes'),
            nothingToChange: copy('Nothing to change yet.'),
          }}
          renderAmountInput={({ name, value, disabled, onChange }) => (
            <PosCurrencyInput
              aria-label={name}
              className="w-40 text-right"
              value={value}
              disabled={disabled}
              fractionDigits={0}
              onChange={onChange}
            />
          )}
        />

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
