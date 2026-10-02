import { DBadge } from '@digvation/ui';

import { RecordPanel, RecordPanelBody, RecordPanelHeader } from '../../../shared/ui/record-dialog';
import type { Payment, Sale } from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { transactionPaymentComposition } from '../model/transaction-payment-composition';
import {
  PAYMENT_ATTEMPT_STATUS_BADGES,
  PAYMENT_ATTEMPT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  paymentDestinationLabel,
  paymentSummary,
} from '../model/transaction-summary';
import { SummaryBadge } from './transaction-presentation';

const hasValue = (amount: string | null) => Boolean(amount && /[1-9]/.test(amount));

/**
 * How the transaction was actually paid. Only succeeded payments settle a sale; refunds are their
 * own negative facts linked to the payment they return; other attempts stay quietly apart.
 */
export function TransactionPaymentsSection({ sale }: { sale: Sale }) {
  const { copy, formatMoney } = useTransactionHistoryLocalization();
  const composition = transactionPaymentComposition(sale);
  const byId = new Map(sale.payments.map((payment) => [payment.id, payment]));
  const destination = (payment: Payment) => {
    const { label, isMethod } = paymentDestinationLabel(payment);
    return isMethod ? copy(label) : label;
  };

  return (
    <RecordPanel ariaLabel={copy('Payments')} padded={false}>
      <RecordPanelHeader
        title={copy('Payments')}
        trailing={<SummaryBadge summary={paymentSummary(sale)} />}
      />
      <RecordPanelBody>
        {composition.applied.length ? (
          <dl className="-mt-2.5 divide-y divide-[var(--color-border)]">
            {composition.applied.map((payment) => {
              const detail = [
                paymentDestinationLabel(payment).isMethod
                  ? null
                  : copy(PAYMENT_METHOD_LABELS[payment.method]),
                payment.providerReference
                  ? `${copy('Reference')} ${payment.providerReference}`
                  : null,
                hasValue(payment.tenderedAmount)
                  ? `${copy('Cash received')} ${formatMoney(payment.tenderedAmount!, payment.currency)}`
                  : null,
                hasValue(payment.changeAmount)
                  ? `${copy('Change')} ${formatMoney(payment.changeAmount!, payment.currency)}`
                  : null,
              ].filter(Boolean);
              return (
                <div key={payment.id} className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="min-w-0">
                    <span className="block break-words font-medium text-[var(--color-text)]">
                      {destination(payment)}
                    </span>
                    {detail.length ? (
                      <span className="mt-0.5 block break-words text-xs text-[var(--color-text-muted)]">
                        {detail.join(' · ')}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">
                    {formatMoney(payment.appliedAmount, payment.currency)}
                  </dd>
                </div>
              );
            })}
            {composition.isSplit || !composition.settled || composition.refunds.length ? (
              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm font-semibold">
                <dt>{copy('Total paid')}</dt>
                <dd className="tabular-nums">
                  {formatMoney(composition.totalPaid, sale.currency)}
                </dd>
              </div>
            ) : null}
            {hasValue(composition.balanceDue) ? (
              <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm font-semibold text-[var(--color-warning)]">
                <dt>{copy('Balance due')}</dt>
                <dd className="tabular-nums">
                  {formatMoney(composition.balanceDue, sale.currency)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('No payments recorded yet.')}
          </p>
        )}

        {composition.refunds.length ? (
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
              {copy('Refunds')}
            </p>
            <ul className="mt-1.5 divide-y divide-[var(--color-border)]">
              {composition.refunds.map((refund) => {
                const source = refund.refundOfPaymentId ? byId.get(refund.refundOfPaymentId) : null;
                return (
                  <li
                    key={refund.id}
                    className="flex items-start justify-between gap-4 py-2 text-sm"
                  >
                    <span className="min-w-0 break-words text-[var(--color-text)]">
                      {source
                        ? `${copy('Refund of')} ${destination(source)}`
                        : copy(PAYMENT_METHOD_LABELS[refund.method])}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--color-danger)]">
                      {formatMoney(refund.appliedAmount, refund.currency)}
                    </span>
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between gap-4 py-2 text-sm font-semibold">
                <span>{copy('Total refunded')}</span>
                <span className="tabular-nums">
                  {formatMoney(composition.totalRefunded, sale.currency)}
                </span>
              </li>
            </ul>
          </div>
        ) : null}

        {composition.notApplied.length ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">
              {copy('Other payment attempts')}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {copy('Not counted toward the transaction payment.')}
            </p>
            <ul className="mt-1.5 divide-y divide-[var(--color-border)]">
              {composition.notApplied.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-4 py-2 text-sm text-[var(--color-text-muted)]"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="break-words">{destination(payment)}</span>
                    <DBadge variant={PAYMENT_ATTEMPT_STATUS_BADGES[payment.status]}>
                      {copy(PAYMENT_ATTEMPT_STATUS_LABELS[payment.status])}
                    </DBadge>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(payment.appliedAmount, payment.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </RecordPanelBody>
    </RecordPanel>
  );
}
