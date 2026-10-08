import { DAlert, DBadge as Badge, DButton } from '@digvation-labs/ui';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import {
  type AppliedPaymentComposition,
  type SaleSettlement,
  isSucceededRefund,
  refundedAmount,
  aggregateDiscountRows,
  saleDiscountRows,
  saleTaxLabel,
} from '../model/sale-presentation';
import type { Payment, Sale } from '../model/cashier-transaction.types';
import {
  SaleCustomerStrip,
  SaleEffectivePaymentList,
  SaleFinancialSummary,
  SalePaymentCorrectionList,
  SalePaymentComposition,
  SalePaymentList,
  SaleRefundList,
  StatusPill,
} from './sale-detail-presentation';
import { statusMeta, queueStatus, queueStatusTone } from '../../queue/queue-status';
import { paymentAccountLabel } from '../../payment/sale-payment-status';
import type { groupWorkflowIssues } from '../../queue/workflow-issues';
import { money } from '../model/sale-display';
import { paymentCompositionOf } from '../../payment/payment-correction-draft';
import {
  customerDisplayName,
  customerDisplayDetail,
  customerInitials,
  customerStatus,
} from '../../customer/model/sale-customer-display';
import { pointQuantity, saleEarnedPoints } from '../model/sale-points';

/** Customer identity, invoice/date, status, earned points and the cancellation reason. */
function ReferenceTransactionSummaryContext({
  sale,
  locale,
  transactionDate,
  cancellationReason,
}: {
  sale: Sale;
  locale: string;
  transactionDate: string;
  cancellationReason: string | undefined;
}) {
  const { copy, label } = useOperationalLocalization();
  const status = queueStatus(sale);
  const customer = sale.customer ?? null;
  const earnedPoints = saleEarnedPoints(sale);
  return (
    <div>
      <SaleCustomerStrip
        initials={customerInitials(customer)}
        name={customerDisplayName(customer, locale)}
        detail={customerDisplayDetail(customer)}
        badge={
          customerStatus(customer) ? (
            <Badge
              variant={customerStatus(customer)!.variant}
              className="shrink-0 px-2 py-0 text-[10px]"
            >
              {copy(customerStatus(customer)!.label)}
            </Badge>
          ) : null
        }
        aside={
          // Invoice (when it exists) above the transaction date, on the right of the
          // customer identity. It is rendered here once and nowhere else.
          <div className="flex flex-col items-end gap-0.5">
            {sale.invoiceNumber ? (
              <span
                className="max-w-[9.5rem] break-all font-mono text-xs font-semibold leading-4 text-[var(--color-text)] sm:max-w-none"
                data-testid="transaction-invoice-number"
              >
                {sale.invoiceNumber}
              </span>
            ) : null}
            <span className="text-xs text-[var(--color-text-muted)]">{transactionDate}</span>
          </div>
        }
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-1">
        <StatusPill
          tone={
            sale.status === 'VOIDED' || status === 'CANCELED' ? 'danger' : queueStatusTone(status)
          }
          icon={status ? statusMeta[status].icon : null}
        >
          {status ? label(statusMeta[status].value) : label('OPEN')}
        </StatusPill>
      </div>
      {earnedPoints ? (
        <div
          className="mt-2.5 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-success)]/10 px-3 py-2 text-xs"
          data-testid="transaction-points-earned"
        >
          <span className="font-semibold text-[var(--color-text)]">{copy('Points earned')}</span>
          <span className="font-bold text-[var(--color-success)]">
            +{pointQuantity(earnedPoints, locale)}
          </span>
        </div>
      ) : null}
      {sale.status === 'VOIDED' && cancellationReason ? (
        <div className="mt-2 border-l-2 border-[var(--color-danger)] pl-2.5 text-xs">
          <p className="font-semibold text-[var(--color-danger)]">{copy('Cancellation reason')}</p>
          <p className="mt-0.5 text-[var(--color-text-muted)]">{cancellationReason}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The financial summary column: totals, discounts, loyalty redemption, tax, applied payment
 * composition and payment attempts (including recorded manual refunds, which are payments of the
 * account the money left, not of the original payment).
 */
export function ReferenceTransactionSummary({
  sale,
  locale,
  composition,
  unappliedPayments,
  settlement,
  hasDiscount,
  hasTax,
  transactionDate,
  cancellationReason,
  showRightContext,
  onCorrectPayment,
}: {
  sale: Sale;
  locale: string;
  composition: AppliedPaymentComposition<Payment>;
  unappliedPayments: readonly Payment[];
  settlement: SaleSettlement;
  hasDiscount: boolean;
  hasTax: boolean;
  transactionDate: string;
  cancellationReason: string | undefined;
  showRightContext: boolean;
  /** Opens the payment correction; absent when the session or the Sale does not allow it. */
  onCorrectPayment?: (() => void) | undefined;
}) {
  const { copy, label } = useOperationalLocalization();
  const format = (amount: string) => money(amount, locale);
  const discountRows = aggregateDiscountRows(saleDiscountRows(sale));
  const summaryDiscounts =
    discountRows.length === 0 && hasDiscount
      ? [
          {
            id: 'sale-discount',
            source: 'MANUAL_DISCOUNT' as const,
            scope: 'TRANSACTION' as const,
            saleLineId: null,
            label: copy('Promotions and discounts'),
            amount: sale.discountAmount,
            percentage: null,
            reason: null,
            identity: 'SALE-DISCOUNT',
          },
        ]
      : discountRows;
  const legacyLoyaltyRedemption = sale.loyaltyRedemption as
    | (NonNullable<Sale['loyaltyRedemption']> & {
        requestedPoints?: string;
        redemptionAmount?: string;
      })
    | null
    | undefined;
  const redeemedPoints =
    sale.loyaltyRedemption?.points ?? legacyLoyaltyRedemption?.requestedPoints ?? null;
  const redeemedAmount =
    sale.loyaltyRedemption?.amount ?? legacyLoyaltyRedemption?.redemptionAmount ?? null;
  const hasLoyaltyRedemption = Boolean(redeemedPoints && redeemedAmount);
  const corrections = sale.paymentCorrections ?? [];
  const effective = paymentCompositionOf(sale);
  const signed = (movementAmount: string) =>
    movementAmount.startsWith('-')
      ? `−${format(movementAmount.slice(1))}`
      : `+${format(movementAmount)}`;
  // Succeeded manual refunds are money returned, not payment attempts; attempts keep the rest.
  const refunds = unappliedPayments.filter(isSucceededRefund);
  const paymentAttempts = unappliedPayments.filter((payment) => !isSucceededRefund(payment));
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  return (
    <SaleFinancialSummary
      title={copy('Order summary')}
      context={
        showRightContext ? (
          <ReferenceTransactionSummaryContext
            sale={sale}
            locale={locale}
            transactionDate={transactionDate}
            cancellationReason={cancellationReason}
          />
        ) : null
      }
      labels={{
        subtotal: copy('Subtotal'),
        total: copy('Total'),
        paid: copy(refunds.length ? 'Net paid amount' : 'Paid amount'),
        balance: copy('Balance due'),
        settled: copy('Paid'),
        cashReceived: copy('Cash received'),
        change: copy('Change'),
        discount: copy('Discount'),
        discountContext: (row) =>
          `${copy(row.source === 'PROMOTION' ? 'Promotion' : 'Manual discount')} · ${copy(
            row.scope === 'TRANSACTION'
              ? 'Whole transaction'
              : row.scope === 'ITEM'
                ? 'Item-level'
                : 'Category-level',
          )}`,
      }}
      gross={sale.grossAmount}
      discounts={summaryDiscounts}
      adjustments={
        hasLoyaltyRedemption
          ? [
              {
                id: 'loyalty-redemption',
                label: copy('Loyalty redemption'),
                detail: `${pointQuantity(redeemedPoints, locale)} ${copy('points used')}`,
                amount: redeemedAmount!,
              },
            ]
          : []
      }
      tax={hasTax ? { label: saleTaxLabel(sale, copy('Tax')), amount: sale.taxAmount } : null}
      total={sale.totalAmount}
      settlement={settlement}
      format={format}
      payment={
        composition.components.length
          ? {
              title: copy('Payment received'),
              aside: composition.isSplit ? (
                <StatusPill tone="brand">
                  {copy('Split Payment')} · {composition.components.length} {copy('methods')}
                </StatusPill>
              ) : undefined,
              content: (
                <SalePaymentComposition
                  components={composition.components.map((item) => {
                    const name = paymentAccountLabel(item, (method) => label(method));
                    const methodName = label(item.method);
                    return {
                      id: item.id,
                      name,
                      method: name === methodName ? null : methodName,
                      reference: item.providerReference,
                      amount: format(item.appliedAmount),
                    };
                  })}
                />
              ),
            }
          : null
      }
      corrections={
        corrections.length ? (
          <SalePaymentCorrectionList
            heading={copy('Payment correction')}
            corrections={corrections.map((correction) => ({
              id: correction.id,
              movements: correction.movements.map((movement) => ({
                id: movement.paymentId,
                name: movement.financialAccountName ?? label(movement.method),
                detail: `${label(movement.method)} · ${copy(
                  movement.leg === 'OUT' ? 'Correction reduced' : 'Correction added',
                )}`,
                amount: signed(movement.amount),
              })),
              reasonLabel: copy('Reason'),
              reason: correction.reason,
              byLabel: copy('Corrected by'),
              by: correction.createdBy,
              at: dateTime(correction.createdAt),
              afterSettlementLabel: correction.afterSettlement
                ? copy('Correction after reconciliation')
                : null,
            }))}
          />
        ) : null
      }
      effectivePayment={
        corrections.length ? (
          <SaleEffectivePaymentList
            heading={copy('Effective payment')}
            entries={effective.entries.map((entry, index) => ({
              id: entry.paymentRouteId ?? `${entry.method}-${index}`,
              name: entry.financialAccountName ?? label(entry.method),
              method: label(entry.method),
              amount: format(entry.effectiveAmount),
            }))}
          />
        ) : null
      }
      paymentActions={
        onCorrectPayment ? (
          <DButton variant="outline" size="sm" onClick={onCorrectPayment}>
            {copy('Payment correction')}
          </DButton>
        ) : null
      }
      refunds={
        refunds.length ? (
          <SaleRefundList
            heading={copy('Refund')}
            refunds={refunds.map((item) => ({
              id: item.id,
              name: paymentAccountLabel(item, (method) => label(method)),
              detail: `${label(item.method)} · ${copy('Refund movement')}`,
              note:
                [
                  dateTime(item.terminalAt ?? item.updatedAt),
                  item.refund?.externalReference,
                  item.refund?.note,
                ]
                  .filter(Boolean)
                  .join(' · ') || null,
              amount: format(refundedAmount(item)),
            }))}
          />
        ) : null
      }
      paymentAttempts={
        paymentAttempts.length ? (
          <>
            <h4 className="text-sm font-semibold text-[var(--color-text)]">
              {copy('Payment attempts')}
            </h4>
            <SalePaymentList
              emptyLabel={copy('No payment recorded yet.')}
              payments={paymentAttempts.map((item) => ({
                id: item.id,
                method: paymentAccountLabel(item, (method) => label(method)),
                status: (
                  <StatusPill tone={item.status === 'PENDING' ? 'warning' : 'neutral'}>
                    {label(item.status)}
                  </StatusPill>
                ),
                detail: dateTime(item.terminalAt ?? item.updatedAt),
                amount: format(item.appliedAmount),
              }))}
            />
          </>
        ) : null
      }
    />
  );
}

/** Why the transaction cannot be completed yet, grouped by cause. */
export function ReferenceCompletionIssues({
  groups,
}: {
  groups: ReturnType<typeof groupWorkflowIssues>;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <DAlert variant="warning" title={copy('Not ready to complete')}>
      <div className="space-y-1.5 text-[var(--color-text-muted)]">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="font-medium text-[var(--color-text)]">{group.label}</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              {group.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DAlert>
  );
}
