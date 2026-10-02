import { DButton, DCurrencyInput, DDialog, DInfoNote, DSelect } from '@digvation/ui';
import { useState } from 'react';

import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { isRefundAmountValid, type RefundablePayment } from '../model/transaction-actions';
import { paymentDestinationLabel } from '../model/transaction-summary';

/** `1500.0000` → `1500`, `12.5000` → `12.5`: the editable form of an exact amount. */
const editableAmount = (amount: string) => amount.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

export function TransactionRefundDialog({
  open,
  refundable,
  onClose,
  onRefund,
}: {
  open: boolean;
  refundable: readonly RefundablePayment[];
  onClose: () => void;
  /** Resolves `null` on success, else the message to show. */
  onRefund: (paymentId: string, amount: string) => Promise<string | null>;
}) {
  const { copy, formatMoney } = useTransactionHistoryLocalization();
  const single = refundable.length === 1 ? refundable[0]! : null;
  const [paymentId, setPaymentId] = useState(single?.payment.id ?? '');
  const selected = refundable.find((option) => option.payment.id === paymentId) ?? null;
  const [amount, setAmount] = useState(single ? editableAmount(single.maxAmount) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Boolean(selected && isRefundAmountValid(amount, selected.maxAmount));
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
    setError(await onRefund(selected.payment.id, amount.trim()));
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
            selected && amount && !valid
              ? copy('Enter an amount up to the refundable balance.')
              : (error ?? undefined)
          }
        />
        <DInfoNote>
          {copy(
            'Only cash payments can be refunded here. Payments through a provider are refunded in that provider’s own flow.',
          )}
        </DInfoNote>
      </div>
    </DDialog>
  );
}
