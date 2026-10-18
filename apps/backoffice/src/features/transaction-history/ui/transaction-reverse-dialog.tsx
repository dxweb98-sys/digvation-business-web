import { DButton, DCheckbox, DDialog, DInfoNote, DInput, DSelect, DTextarea } from '@digvation/ui';
import { useState } from 'react';

import type { CorrectionRoute, RefundPayout } from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { PAYMENT_METHOD_LABELS } from '../model/transaction-summary';

/** Only these methods can physically pay money out through a manual refund. */
const PAYOUT_METHODS = new Set(['CASH', 'BANK_TRANSFER']);

/**
 * One confirmed step: reverses the completed transaction and, when received money is still held,
 * records in the same step that it was really returned through the chosen route. Runtime records
 * the refund and the reversal together or not at all.
 */
export function TransactionReverseDialog({
  open,
  refundAmount,
  currency,
  routes,
  routesLoading,
  onClose,
  onReverse,
}: {
  open: boolean;
  /** Received money still held, returned with the reversal; `null` when nothing remains. */
  refundAmount: string | null;
  currency: string;
  /** Active payment routes of the Sale's location; only CASH and BANK_TRANSFER can pay out. */
  routes: readonly CorrectionRoute[];
  routesLoading: boolean;
  onClose: () => void;
  /** Resolves `null` on success, else the message to show. */
  onReverse: (reason: string, payout?: RefundPayout) => Promise<string | null>;
}) {
  const { copy, formatMoney } = useTransactionHistoryLocalization();
  const [reason, setReason] = useState('');
  const [routeId, setRouteId] = useState('');
  const [reference, setReference] = useState('');
  const [returned, setReturned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payoutRoutes = routes.filter((route) => PAYOUT_METHODS.has(route.paymentMethod));
  const chosen = payoutRoutes.find((route) => route.id === routeId) ?? null;
  const refunds = refundAmount !== null;
  const valid = Boolean(reason.trim()) && (!refunds || (chosen !== null && returned));

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const payout: RefundPayout | undefined =
      refunds && chosen
        ? {
            method: chosen.paymentMethod as 'CASH' | 'BANK_TRANSFER',
            paymentRouteId: chosen.id,
            ...(chosen.paymentMethod === 'BANK_TRANSFER' && reference.trim()
              ? { externalReference: reference.trim() }
              : {}),
          }
        : undefined;
    setError(await onReverse(reason.trim(), payout));
    setSaving(false);
  };

  return (
    <DDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={copy('Reverse transaction')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            {copy('Cancel')}
          </DButton>
          <DButton
            variant="danger"
            onClick={() => void submit()}
            disabled={!valid || saving}
            loading={saving}
          >
            {copy(refunds ? 'Return money and reverse' : 'Reverse transaction')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-3">
        {refunds ? (
          <>
            <p className="text-sm text-[var(--color-text-muted)]">
              {copy('Received money to return')}:{' '}
              <span className="font-medium text-[var(--color-text)]">
                {formatMoney(refundAmount, currency)}
              </span>
            </p>
            <DSelect
              label={copy('Return the money through')}
              value={routeId}
              placeholder={copy('Choose the account the money leaves from')}
              options={payoutRoutes.map((route) => ({
                value: route.id,
                label: `${copy(
                  PAYMENT_METHOD_LABELS[route.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS],
                )} · ${route.financialAccountName}`,
              }))}
              disabled={saving || routesLoading}
              onChange={(value) => {
                setRouteId(String(value ?? ''));
                setError(null);
              }}
            />
            {!routesLoading && payoutRoutes.length === 0 ? (
              <DInfoNote>
                {copy('No cash or bank transfer route is available for this location.')}
              </DInfoNote>
            ) : null}
            {chosen?.paymentMethod === 'BANK_TRANSFER' ? (
              <DInput
                label={copy('Transfer reference')}
                value={reference}
                onChange={(value) => setReference(value)}
                disabled={saving}
              />
            ) : null}
          </>
        ) : null}
        <DTextarea
          label={copy('Reason')}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError(null);
          }}
          placeholder={copy('For example, Customer returned the item')}
          maxLength={500}
          error={error ?? undefined}
          disabled={saving}
        />
        {refunds ? (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--color-border)] p-3">
            <DCheckbox
              checked={returned}
              onChange={() => {
                setReturned((value) => !value);
                setError(null);
              }}
              disabled={saving}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="block font-medium text-[var(--color-text)]">
                {copy('The money was really returned to the customer.')}
              </span>
              <span className="block text-[var(--color-text-muted)]">
                {copy(
                  'Record a refund only when money was really returned to the customer. A payment entered by mistake is not a refund.',
                )}
              </span>
            </span>
          </label>
        ) : null}
      </div>
    </DDialog>
  );
}
