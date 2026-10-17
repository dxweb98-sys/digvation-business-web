import {
  DButton,
  DCurrencyInput,
  DDialog,
  DInfoNote,
  DInput,
  DSelect,
  DTextarea,
} from '@digvation/ui';
import { useState } from 'react';

import type { CorrectionRoute, RefundPayout } from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { isRefundAmountValid, type RefundablePayment } from '../model/transaction-actions';
import { PAYMENT_METHOD_LABELS, paymentDestinationLabel } from '../model/transaction-summary';
import { fromMoneyUnits, toMoneyUnits } from '../model/transaction-payment-composition';

/** Only these methods can physically pay money out through a manual refund. */
const PAYOUT_METHODS = new Set(['CASH', 'BANK_TRANSFER']);
const SAME_ROUTE = '__same_cash_route__';

/** `1500.0000` → `1500`, `12.5000` → `12.5`: the editable form of an exact amount. */
const editableAmount = (amount: string) => amount.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

export function TransactionRefundDialog({
  open,
  refundable,
  routes,
  routesLoading,
  onClose,
  onRefund,
}: {
  open: boolean;
  refundable: readonly RefundablePayment[];
  /** Active payment routes of the Sale's location; only CASH and BANK_TRANSFER can pay out. */
  routes: readonly CorrectionRoute[];
  routesLoading: boolean;
  onClose: () => void;
  /** Resolves `null` on success, else the message to show. */
  onRefund: (
    paymentId: string,
    amount: string,
    reason: string,
    payout?: RefundPayout,
  ) => Promise<string | null>;
}) {
  const { copy, formatMoney } = useTransactionHistoryLocalization();
  const single = refundable.length === 1 ? refundable[0]! : null;
  const [paymentId, setPaymentId] = useState(single?.payment.id ?? '');
  const selected = refundable.find((option) => option.payment.id === paymentId) ?? null;
  const [amount, setAmount] = useState(single ? editableAmount(single.maxAmount) : '');
  const [routeId, setRouteId] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payoutRoutes = routes.filter((route) => PAYOUT_METHODS.has(route.paymentMethod));
  const chosen = payoutRoutes.find((route) => route.id === routeId) ?? null;
  const isCashSource = selected?.payment.method === 'CASH';
  // A cash payment may return on its own cash route without a choice; every other payment names
  // the account the money really leaves from. It is never assumed from how the payment was received.
  const payoutReady = Boolean(chosen) || (isCashSource && routeId === SAME_ROUTE);
  const valid = Boolean(
    selected && isRefundAmountValid(amount, selected.maxAmount) && payoutReady && reason.trim(),
  );
  const amountValid = Boolean(selected && isRefundAmountValid(amount, selected.maxAmount));
  const remainingAfter =
    selected && amountValid
      ? fromMoneyUnits(toMoneyUnits(selected.maxAmount) - toMoneyUnits(amount.trim()))
      : null;
  const label = (option: RefundablePayment) => {
    const { label: destination, isMethod } = paymentDestinationLabel(option.payment);
    return `${isMethod ? copy(destination) : destination} · ${formatMoney(
      option.payment.appliedAmount,
      option.payment.currency,
    )}`;
  };

  const submit = async () => {
    if (!selected || !valid || saving) return;
    setSaving(true);
    const payout: RefundPayout | undefined = chosen
      ? {
          method: chosen.paymentMethod as 'CASH' | 'BANK_TRANSFER',
          paymentRouteId: chosen.id,
          ...(chosen.paymentMethod === 'BANK_TRANSFER' && reference.trim()
            ? { externalReference: reference.trim() }
            : {}),
        }
      : undefined;
    setError(await onRefund(selected.payment.id, amount.trim(), reason.trim(), payout));
    setSaving(false);
  };

  return (
    <DDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={copy('Refund payment')}
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
            {copy('Refund')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-3">
        {single ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('Payment to refund')}:{' '}
            <span className="font-medium text-[var(--color-text)]">{label(single)}</span>
          </p>
        ) : (
          <DSelect
            label={copy('Payment to refund')}
            value={paymentId}
            placeholder={copy('Select a payment')}
            options={refundable.map((option) => ({
              value: option.payment.id,
              label: label(option),
            }))}
            disabled={saving}
            onChange={(value) => {
              const next = refundable.find((option) => option.payment.id === String(value ?? ''));
              setPaymentId(next?.payment.id ?? '');
              setAmount(next ? editableAmount(next.maxAmount) : '');
              setRouteId('');
              setError(null);
            }}
          />
        )}
        <DCurrencyInput
          label={copy('Refund amount')}
          value={amount}
          onValueChange={(value) => {
            setAmount(value);
            setError(null);
          }}
          disabled={!selected || saving}
          hint={
            selected
              ? `${copy('Refundable up to')} ${formatMoney(selected.maxAmount, selected.payment.currency)}`
              : undefined
          }
          error={
            selected && amount && !amountValid
              ? copy('Enter an amount up to the refundable balance.')
              : (error ?? undefined)
          }
        />
        <DSelect
          label={copy('Return the money through')}
          value={routeId}
          placeholder={copy('Choose the account the money leaves from')}
          options={[
            ...(isCashSource
              ? [{ value: SAME_ROUTE, label: copy('Same cash route as the payment') }]
              : []),
            ...payoutRoutes.map((route) => ({
              value: route.id,
              label: `${copy(
                PAYMENT_METHOD_LABELS[route.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS],
              )} · ${route.financialAccountName}`,
            })),
          ]}
          disabled={!selected || saving || routesLoading}
          onChange={(value) => {
            setRouteId(String(value ?? ''));
            setError(null);
          }}
        />
        {!routesLoading && selected && payoutRoutes.length === 0 && !isCashSource ? (
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
        {chosen && selected && remainingAfter !== null ? (
          <DInfoNote>
            {copy('Money leaves from')}{' '}
            <span className="font-medium">{chosen.financialAccountName}</span>.{' '}
            {copy('The original payment keeps its own account.')}{' '}
            {copy('Still refundable on this payment after this refund')}:{' '}
            {formatMoney(remainingAfter, selected.payment.currency)}
          </DInfoNote>
        ) : null}
        <DTextarea
          label={copy('Refund reason')}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError(null);
          }}
          placeholder={copy('For example, the customer cancelled the order')}
          maxLength={500}
          disabled={saving}
        />
        <DInfoNote>
          {copy(
            'Record a refund only when money was really returned to the customer. A payment entered by mistake is not a refund.',
          )}
        </DInfoNote>
      </div>
    </DDialog>
  );
}
