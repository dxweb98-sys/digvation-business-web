import {
  correctionDraftState,
  paymentCorrectionRequest,
  startCorrectionDraft,
  type CorrectionDraft,
  type CorrectionRouteInfo,
} from '@digvation/business-money';
import { CorrectionCompositionEditor } from '@digvation/business-payment-correction-ui';
import { DButton, DCurrencyInput, DDialog, DInfoNote, DTextarea } from '@digvation/ui';
import { useState } from 'react';

import type {
  CorrectionRoute,
  PaymentCorrectionRequest,
  Sale,
} from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { effectivePaymentEntries } from '../model/transaction-payment-composition';
import { PAYMENT_METHOD_LABELS } from '../model/transaction-summary';

/**
 * Corrects how a payment was recorded, never how much was paid. It is the same composition editor
 * Operational uses (one shared model): the correct composition of the routes in use is edited, two
 * routes balance each other, more routes report what is left to allocate, and the net-zero changes
 * are derived. Runtime validates routes, capacity and the sum again and stays the authority.
 */
export function TransactionPaymentCorrectionDialog({
  open,
  sale,
  routes,
  onClose,
  onCorrect,
}: {
  open: boolean;
  sale: Sale;
  /** Active payment routes of the Sale's location. */
  routes: readonly CorrectionRoute[];
  onClose: () => void;
  /** Resolves `null` on success, else the message to show. */
  onCorrect: (request: PaymentCorrectionRequest, idempotencyKey: string) => Promise<string | null>;
}) {
  const { copy, formatMoney } = useTransactionHistoryLocalization();
  const entries = effectivePaymentEntries(sale).filter((entry) => entry.paymentRouteId !== null);
  const baseline = startCorrectionDraft(
    entries.map((entry) => ({ routeId: entry.paymentRouteId!, amount: entry.effectiveAmount })),
  );
  const infos: CorrectionRouteInfo[] = [
    ...new Map<string, CorrectionRouteInfo>([
      ...entries.map(
        (entry) =>
          [
            entry.paymentRouteId!,
            {
              routeId: entry.paymentRouteId!,
              name: entry.financialAccountName ?? entry.method,
              method: entry.method,
            },
          ] as const,
      ),
      ...routes.map(
        (route) =>
          [
            route.id,
            { routeId: route.id, name: route.financialAccountName, method: route.paymentMethod },
          ] as const,
      ),
    ]).values(),
  ];
  const methodLabel = (method: string | undefined) =>
    method ? copy(PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS]) : '';
  const money = (amount: string) => formatMoney(amount, sale.currency);

  const [typed, setTyped] = useState<CorrectionDraft | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per exact request, so a retry of the same correction never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);

  const draft = typed ?? baseline;
  const state = correctionDraftState(draft);
  const valid = state.ok && reason.trim().length >= 3;

  const submit = async () => {
    if (!state.ok || !valid || saving) return;
    const request = paymentCorrectionRequest({
      expectedVersion: sale.version,
      reason,
      moves: state.moves,
    });
    const signature = JSON.stringify(request);
    const key =
      attempt?.request === signature
        ? attempt.key
        : `backoffice-payment-correction-${crypto.randomUUID()}`;
    setAttempt({ request: signature, key });
    setSaving(true);
    setError(await onCorrect(request, key));
    setSaving(false);
  };

  return (
    <DDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={copy('Payment correction')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void submit()} disabled={!valid || saving} loading={saving}>
            {copy('Save correction')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        <DInfoNote>{copy('Payment correction explanation')}</DInfoNote>

        <CorrectionCompositionEditor
          baseline={baseline}
          draft={draft}
          routes={infos}
          disabled={saving}
          formatMoney={money}
          methodLabel={methodLabel}
          onDraftChange={(next) => {
            setTyped(next);
            setError(null);
          }}
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
            totalChanges: copy('Total changes'),
            nothingToChange: copy('Nothing to change yet.'),
          }}
          renderAmountInput={({ name, value, disabled, onChange }) => (
            <DCurrencyInput
              aria-label={name}
              className="w-40"
              value={value}
              disabled={disabled}
              onValueChange={onChange}
            />
          )}
        />

        <DTextarea
          label={copy('Correction reason')}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError(null);
          }}
          placeholder={copy('For example, the payment amount was entered wrongly')}
          error={error ?? undefined}
          disabled={saving}
        />
      </div>
    </DDialog>
  );
}
