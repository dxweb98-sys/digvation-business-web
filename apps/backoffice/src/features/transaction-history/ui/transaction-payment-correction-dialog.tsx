import { DButton, DCurrencyInput, DDialog, DInfoNote, DSelect, DTextarea } from '@digvation/ui';
import { useState } from 'react';

import type {
  CorrectionRoute,
  PaymentCorrectionRequest,
  Sale,
} from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { isRefundAmountValid } from '../model/transaction-actions';
import { PAYMENT_METHOD_LABELS } from '../model/transaction-summary';

/**
 * Moves recorded money from one payment route to another. This is the same Runtime command
 * Operational uses; it only states the two sides of one net-zero move — what leaves a route and
 * what arrives on another — and Runtime validates routes, capacity and the sum again.
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
  const entries = (sale.paymentComposition?.entries ?? []).filter(
    (entry) => entry.paymentRouteId !== null,
  );
  const held = new Map(entries.map((entry) => [entry.paymentRouteId!, entry]));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per exact request, so a retry of the same correction never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);

  const source = from ? held.get(from) : undefined;
  const sourceAmount = source?.effectiveAmount ?? '0';
  const valid =
    Boolean(from && to && from !== to) &&
    isRefundAmountValid(amount, sourceAmount) &&
    reason.trim().length >= 3;
  const routeName = (id: string) => {
    const entry = held.get(id);
    const route = routes.find((candidate) => candidate.id === id);
    return entry?.financialAccountName ?? route?.financialAccountName ?? id;
  };
  const targets = [
    ...new Map([
      ...entries.map((entry) => [entry.paymentRouteId!, entry.method] as const),
      ...routes.map((route) => [route.id, route.paymentMethod] as const),
    ]).entries(),
  ].filter(([id]) => id !== from);

  const submit = async () => {
    if (!valid || saving) return;
    const request: PaymentCorrectionRequest = {
      expectedVersion: sale.version,
      reason: reason.trim(),
      moves: [
        { paymentRouteId: from, delta: `-${amount.trim()}` },
        { paymentRouteId: to, delta: amount.trim() },
      ],
    };
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
      <div className="space-y-3">
        <DInfoNote>{copy('Payment correction explanation')}</DInfoNote>
        <DSelect
          label={copy('Move from')}
          value={from}
          placeholder={copy('Choose a route')}
          options={entries
            .filter((entry) => entry.effectiveAmount !== '0.0000')
            .map((entry) => ({
              value: entry.paymentRouteId!,
              label: `${entry.financialAccountName ?? copy(PAYMENT_METHOD_LABELS[entry.method])} · ${formatMoney(entry.effectiveAmount, sale.currency)}`,
            }))}
          disabled={saving}
          onChange={(value) => {
            const next = String(value ?? '');
            setFrom(next);
            if (next === to) setTo('');
            setAmount('');
            setError(null);
          }}
        />
        <DSelect
          label={copy('Move to')}
          value={to}
          placeholder={copy('Choose a route')}
          options={targets.map(([id]) => ({ value: id, label: routeName(id) }))}
          disabled={saving || !from}
          onChange={(value) => {
            setTo(String(value ?? ''));
            setError(null);
          }}
        />
        <DCurrencyInput
          label={copy('Amount to move')}
          value={amount}
          onValueChange={(value) => {
            setAmount(value);
            setError(null);
          }}
          disabled={!from || saving}
          hint={
            source
              ? `${copy('Recorded on this route')} ${formatMoney(source.effectiveAmount, sale.currency)}`
              : undefined
          }
          error={
            from && amount && !isRefundAmountValid(amount, sourceAmount)
              ? copy('Enter an amount up to what the route holds.')
              : undefined
          }
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
