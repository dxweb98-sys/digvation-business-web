import { DAccordion, DAccordionItem, DBadge, DButton } from '@digvation/ui';
import { Pencil } from 'lucide-react';

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
export function TransactionPaymentsSection({
  sale,
  onCorrectPayment,
}: {
  sale: Sale;
  /** A contextual action of this section; omitted unless the viewer may correct payments. */
  onCorrectPayment?: (() => void) | undefined;
}) {
  const { copy, formatMoney, formatDate } = useTransactionHistoryLocalization();
  const dateTime = (value: string) =>
    formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  const corrections = sale.paymentCorrections ?? [];
  const signed = (amount: string, currency: string) =>
    amount.startsWith('-')
      ? `−${formatMoney(amount.slice(1), currency)}`
      : `+${formatMoney(amount, currency)}`;
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
        {composition.received.length ? (
          <dl className="-mt-2.5 divide-y divide-[var(--color-border)]">
            {composition.received.map((entry) => {
              // The payment facts behind one effective route; a single one carries its own detail.
              const facts = composition.applied.filter(
                (payment) =>
                  payment.method === entry.method &&
                  (payment.financePaymentRouteId ?? null) === entry.paymentRouteId &&
                  (payment.financeFinancialAccountId ?? null) === entry.financialAccountId,
              );
              const only = facts.length === 1 ? facts[0]! : null;
              const name = entry.financialAccountName ?? copy(PAYMENT_METHOD_LABELS[entry.method]);
              const detail = [
                entry.financialAccountName ? copy(PAYMENT_METHOD_LABELS[entry.method]) : null,
                only?.providerReference ? `${copy('Reference')} ${only.providerReference}` : null,
                only && hasValue(only.tenderedAmount)
                  ? `${copy('Cash received')} ${formatMoney(only.tenderedAmount!, only.currency)}`
                  : null,
                only && hasValue(only.changeAmount)
                  ? `${copy('Change')} ${formatMoney(only.changeAmount!, only.currency)}`
                  : null,
              ].filter(Boolean);
              return (
                <div
                  key={`${entry.method}|${entry.paymentRouteId}|${entry.financialAccountId}`}
                  className="flex items-start justify-between gap-4 py-2.5"
                >
                  <dt className="min-w-0">
                    <span className="block break-words text-sm font-medium text-[var(--color-text)]">
                      {name}
                    </span>
                    {detail.length ? (
                      <span className="mt-0.5 block break-words text-xs text-[var(--color-text-muted)]">
                        {detail.join(' · ')}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">
                    {formatMoney(entry.receivedAmount, sale.currency)}
                  </dd>
                </div>
              );
            })}
            {composition.received.length ? (
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

        {onCorrectPayment ? (
          <DButton
            variant="ghost"
            size="sm"
            className="-ml-2 mt-1"
            leftIcon={<Pencil aria-hidden="true" className="size-3.5" />}
            onClick={onCorrectPayment}
          >
            {copy('Payment correction')}
          </DButton>
        ) : null}

        {corrections.length ? (
          <DAccordion
            type="single"
            variant="default"
            className="mt-3 border-t border-[var(--color-border)]"
          >
            <DAccordionItem
              value="history"
              title={
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  {copy('Correction history')} ({corrections.length})
                </span>
              }
            >
              <ul className="divide-y divide-[var(--color-border)]">
                {corrections.map((correction) => (
                  <li
                    key={correction.id}
                    className="py-2.5 text-sm"
                    data-testid="payment-correction"
                  >
                    <ul className="space-y-1.5">
                      {correction.movements.map((movement) => (
                        <li
                          key={movement.paymentId}
                          className="flex items-start justify-between gap-4"
                        >
                          <span className="min-w-0">
                            <span className="block break-words font-medium text-[var(--color-text)]">
                              {movement.financialAccountName ??
                                copy(PAYMENT_METHOD_LABELS[movement.method])}
                            </span>
                            <span className="mt-0.5 block break-words text-xs text-[var(--color-text-muted)]">
                              {copy(PAYMENT_METHOD_LABELS[movement.method])} ·{' '}
                              {copy(
                                movement.leg === 'OUT' ? 'Correction reduced' : 'Correction added',
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">
                            {signed(movement.amount, sale.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <dl className="mt-2 space-y-0.5 text-xs text-[var(--color-text-muted)]">
                      <div className="flex gap-1.5">
                        <dt>{copy('Correction reason')}:</dt>
                        <dd className="min-w-0 break-words text-[var(--color-text)]">
                          {correction.reason}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>{copy('Corrected by')}:</dt>
                        <dd className="min-w-0 break-words text-[var(--color-text)]">
                          {correction.createdBy ?? '—'}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt>{copy('Corrected on')}:</dt>
                        <dd className="text-[var(--color-text)]">
                          {dateTime(correction.createdAt)}
                        </dd>
                      </div>
                    </dl>
                    {correction.correctsCorrectionId ? (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {copy('Corrects an earlier correction')}
                      </p>
                    ) : null}
                    {correction.afterSettlement ? (
                      <p className="mt-1 text-xs font-medium text-[var(--color-warning)]">
                        {copy('Correction after reconciliation')} —{' '}
                        {copy('Correction after reconciliation note')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DAccordionItem>
          </DAccordion>
        ) : null}

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
                      {refund.refund ? (
                        <>
                          {/* A manual refund names where the money actually left, not the payment. */}
                          <span className="block font-medium">{destination(refund)}</span>
                          <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                            {[
                              copy(PAYMENT_METHOD_LABELS[refund.method]),
                              copy('Manual refund'),
                              refund.refund.externalReference,
                              refund.refund.note,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </>
                      ) : source ? (
                        `${copy('Refund of')} ${destination(source)}`
                      ) : (
                        copy(PAYMENT_METHOD_LABELS[refund.method])
                      )}
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
