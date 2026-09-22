import { createDecimal } from '@digvation/pos-money';
import { DAlert, DButton } from '@digvation-labs/ui';
import { CheckCircle2, Clock, Info, SplitSquareHorizontal, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { Payment, PaymentMethod, PaymentStatus } from '../cashier-transaction.types';
import type { PaymentIntent, PaymentProgress } from '../sale-presentation';

type Format = (amount: string) => string;
type TerminalPaymentStatus = Exclude<PaymentStatus, 'PENDING'>;

function isPositive(amount: string) {
  return createDecimal(amount || '0').greaterThan(0);
}

export function paymentAccountName(
  payment: Pick<Payment, 'method' | 'financeFinancialAccountNameSnapshot'>,
  methodLabel: (method: PaymentMethod) => string,
): string {
  return payment.financeFinancialAccountNameSnapshot?.trim() || methodLabel(payment.method);
}

/** Total, what Runtime has already recorded, and what is still open. */
export function PaymentProgressSummary({
  total,
  progress,
  format,
}: {
  total: string;
  progress: PaymentProgress;
  format: Format;
}) {
  const { copy } = useOperationalLocalization();
  const hasPending = isPositive(progress.pendingAmount);
  const settled = !isPositive(progress.remainingAmount) && !hasPending;
  return (
    <div className="pos-payment-progress" role="group" aria-label={copy('Payment progress')}>
      <div>
        <p className="pos-payment-progress__label">{copy('Total')}</p>
        <p className="pos-payment-progress__value">{format(total)}</p>
      </div>
      <div>
        <p className="pos-payment-progress__label">{copy('Already paid')}</p>
        <p className="pos-payment-progress__value text-[var(--color-success)]">
          {format(progress.paidAmount)}
        </p>
        {hasPending ? (
          <p className="mt-0.5 text-[11px] font-medium text-[var(--color-warning)]">
            + {format(progress.pendingAmount)} {copy('waiting')}
          </p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="pos-payment-progress__label">{copy('Remaining')}</p>
        <p
          className={`pos-payment-progress__value ${settled ? 'text-[var(--color-success)]' : 'text-[var(--color-brand)]'}`}
        >
          {format(progress.remainingAmount)}
        </p>
      </div>
    </div>
  );
}

/** Live explanation of what the amount being prepared will do. */
export function PaymentIntentHint({
  intent,
  format,
  onPayRemaining,
}: {
  intent: PaymentIntent;
  format: Format;
  onPayRemaining: () => void;
}) {
  const { copy } = useOperationalLocalization();
  if (!isPositive(intent.amount)) return null;
  const hasEarlierPayment = isPositive(intent.paidAmount) || isPositive(intent.pendingAmount);

  if (intent.outcome === 'LEAVES_BALANCE') {
    return (
      <div
        className="pos-payment-intent pos-payment-intent--split"
        role="status"
        aria-live="polite"
      >
        <SplitSquareHorizontal className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{copy('Split payment')}</p>
          <p className="mt-0.5 text-[var(--color-text-muted)]">
            {format(intent.remainingAfter)} {copy('will remain to pay with another method.')}
          </p>
        </div>
        <button type="button" className="pos-payment-intent__action" onClick={onPayRemaining}>
          {copy(hasEarlierPayment ? 'Pay remaining' : 'Pay full amount')}
        </button>
      </div>
    );
  }

  return (
    <div className="pos-payment-intent pos-payment-intent--full" role="status" aria-live="polite">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {copy(hasEarlierPayment ? 'Pays the remaining balance' : 'Full payment')}
        </p>
        <p className="mt-0.5 text-[var(--color-text-muted)]">
          {copy('This payment completes the transaction.')}
        </p>
      </div>
    </div>
  );
}

/** The confirmation step shown before a payment is sent to Runtime. */
export function PaymentReview({
  intent,
  total,
  methodName,
  accountName,
  reference,
  tendered,
  change,
  earlierPayments,
  format,
  confirmReceived = false,
}: {
  intent: PaymentIntent;
  total: string;
  methodName: string;
  accountName: string;
  reference?: string;
  tendered?: string;
  change?: string;
  earlierPayments: readonly Payment[];
  format: Format;
  /** Non-cash money is recorded as received the moment it is confirmed. */
  confirmReceived?: boolean;
}) {
  const { copy, label } = useOperationalLocalization();
  const completes = intent.outcome !== 'LEAVES_BALANCE';
  const recorded = earlierPayments.filter((payment) => payment.status === 'SUCCEEDED');
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">
                {copy(completes ? 'You are receiving' : 'You are receiving part of the total')}
              </p>
              <p className="mt-1 text-3xl font-bold leading-tight tabular-nums text-[var(--color-brand)]">
                {format(intent.amount)}
              </p>
            </div>
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${
                completes
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
              }`}
            >
              {completes ? (
                <CheckCircle2 className="size-5" aria-hidden />
              ) : (
                <SplitSquareHorizontal className="size-5" aria-hidden />
              )}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--color-surface-muted)]/55 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {methodName}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">
                {accountName}
              </p>
            </div>

            {tendered ? (
              <div className="rounded-xl bg-[var(--color-surface-muted)]/55 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {copy('Cash received')}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold tabular-nums">{format(tendered)}</p>
                  {change && isPositive(change) ? (
                    <p className="text-xs font-semibold text-[var(--color-success)]">
                      {copy('Change')} {format(change)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : reference ? (
              <div className="rounded-xl bg-[var(--color-surface-muted)]/55 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Reference
                </p>
                <p className="mt-1 truncate font-mono text-xs font-medium text-[var(--color-text)]">
                  {reference}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <dl className="divide-y divide-[var(--color-border)]">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-[var(--color-text-muted)]">{copy('Transaction total')}</dt>
            <dd className="text-sm font-semibold tabular-nums">{format(total)}</dd>
          </div>

          {recorded.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="min-w-0 truncate text-sm text-[var(--color-text-muted)]">
                {copy('Received')} · {paymentAccountName(payment, label)}
              </dt>
              <dd className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-success)]">
                −{format(payment.appliedAmount)}
              </dd>
            </div>
          ))}

          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm font-medium">{copy('This payment')}</dt>
            <dd className="text-sm font-bold tabular-nums text-[var(--color-brand)]">
              −{format(intent.amount)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 bg-[var(--color-surface-muted)]/45 px-4 py-3">
            <dt className="text-sm font-bold">{copy('Remaining after this payment')}</dt>
            <dd
              className={`text-base font-bold tabular-nums ${
                completes ? 'text-[var(--color-success)]' : 'text-[var(--color-brand)]'
              }`}
            >
              {format(intent.remainingAfter)}
            </dd>
          </div>
        </dl>
      </section>

      <div
        className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm ${
          completes
            ? 'bg-[var(--color-success)]/[.08] text-[var(--color-success)]'
            : 'bg-[var(--color-brand)]/[.08] text-[var(--color-brand)]'
        }`}
        role="status"
      >
        {completes ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <SplitSquareHorizontal className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <p className="min-w-0 flex-1 font-semibold">
          {completes
            ? copy('This payment completes the transaction.')
            : `${format(intent.remainingAfter)} ${copy('will remain. You will continue with another payment method.')}`}
        </p>
      </div>

      {confirmReceived ? (
        <DAlert variant="warning" role="note" title={copy('Check the money has arrived')}>
          {copy('Confirm only after the payment is visible in')} {accountName}.{' '}
          {copy('It is recorded as received immediately.')}
        </DAlert>
      ) : null}
    </div>
  );
}

const statusTone: Record<PaymentStatus, string> = {
  SUCCEEDED: 'pos-payment-row--paid',
  PENDING: 'pos-payment-row--waiting',
  FAILED: 'pos-payment-row--void',
  CANCELLED: 'pos-payment-row--void',
  EXPIRED: 'pos-payment-row--void',
};

const statusCopy: Record<PaymentStatus, string> = {
  SUCCEEDED: 'Received',
  PENDING: 'Waiting for payment',
  FAILED: 'Failed · not counted',
  CANCELLED: 'Cancelled · not counted',
  EXPIRED: 'Expired · not counted',
};

/** Payments Runtime has recorded for this transaction, with their real status. */
export function RecordedPaymentList({
  payments,
  totalAmount,
  progress,
  format,
  isMutating,
  onTransition,
}: {
  payments: readonly Payment[];
  totalAmount: string;
  progress: PaymentProgress;
  format: Format;
  isMutating: boolean;
  onTransition: (payment: Payment, status: TerminalPaymentStatus) => void;
}) {
  const { copy, label } = useOperationalLocalization();
  if (!payments.length) return null;
  const hasRecorded = payments.some((payment) => payment.status === 'SUCCEEDED');

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
      <div className="border-b border-[var(--color-border)] px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {copy('Payments recorded')}
        </p>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {payments.map((payment) => {
          const accountName = paymentAccountName(payment, label);
          const methodName = label(payment.method);
          const pending = payment.status === 'PENDING';
          const receivingCompletes =
            pending &&
            createDecimal(progress.paidAmount)
              .plus(createDecimal(payment.appliedAmount))
              .equals(createDecimal(totalAmount));
          let icon: ReactNode = <XCircle className="size-4" aria-hidden />;
          if (payment.status === 'SUCCEEDED')
            icon = <CheckCircle2 className="size-4" aria-hidden />;
          if (pending) icon = <Clock className="size-4" aria-hidden />;
          return (
            <li key={payment.id} className={`pos-payment-row ${statusTone[payment.status]}`}>
              <span className="pos-payment-row__icon">{icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{accountName}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      {accountName !== methodName ? `${methodName} · ` : ''}
                      <span className="pos-payment-row__status">
                        {copy(statusCopy[payment.status])}
                      </span>
                    </p>
                    {payment.providerReference ? (
                      <p className="mt-0.5 break-all font-mono text-[11px] text-[var(--color-text-muted)]">
                        {payment.providerReference}
                      </p>
                    ) : null}
                  </div>
                  <p className="pos-payment-row__amount shrink-0 text-sm font-bold tabular-nums">
                    {format(payment.appliedAmount)}
                  </p>
                </div>
                {payment.method === 'CASH' && payment.tenderedAmount ? (
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {copy('Cash received')}: {format(payment.tenderedAmount)}
                    {isPositive(payment.changeAmount ?? '0')
                      ? ` · ${copy('Change')}: ${format(payment.changeAmount ?? '0')}`
                      : ''}
                  </p>
                ) : null}
                {pending ? (
                  <>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                      {copy('Check that this payment was received before confirming it.')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <DButton
                        size="sm"
                        disabled={isMutating}
                        onClick={() => onTransition(payment, 'SUCCEEDED')}
                      >
                        {copy(
                          receivingCompletes ? 'Received · complete payment' : 'Payment received',
                        )}
                      </DButton>
                      <DButton
                        size="sm"
                        variant="outline"
                        disabled={isMutating}
                        onClick={() => onTransition(payment, 'FAILED')}
                      >
                        {copy('Not received')}
                      </DButton>
                      <DButton
                        size="sm"
                        variant="ghost"
                        disabled={isMutating}
                        onClick={() => onTransition(payment, 'CANCELLED')}
                      >
                        {copy('Cancel this payment')}
                      </DButton>
                    </div>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {hasRecorded ? (
        <p className="flex gap-1.5 border-t border-[var(--color-border)] px-4 py-2.5 text-[11px] leading-4 text-[var(--color-text-muted)]">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          {copy(
            'Received payments cannot be edited or removed here. If one is wrong, do not record it again; tell your manager so it can be corrected.',
          )}
        </p>
      ) : null}
    </section>
  );
}

/** Shown when the operator tries to leave a checkout that already has money recorded. */
export function PaymentLeaveNotice({
  progress,
  format,
  hasPending,
}: {
  progress: PaymentProgress;
  format: Format;
  hasPending: boolean;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="space-y-3">
      <DAlert variant="warning">
        {format(progress.paidAmount)} {copy('is already recorded for this transaction.')}{' '}
        {format(progress.remainingAmount)} {copy('is still unpaid.')}
      </DAlert>
      <p className="text-sm text-[var(--color-text-muted)]">
        {copy(
          hasPending
            ? 'A payment is waiting for confirmation. Confirm or cancel it before leaving the payment.'
            : 'Continue with another payment method, or add the transaction to the queue and collect the rest later. Recorded payments stay on the transaction.',
        )}
      </p>
    </div>
  );
}
