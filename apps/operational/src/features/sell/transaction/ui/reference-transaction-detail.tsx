import { createDecimal } from '@digvation/pos-money';
import { DAlert, DBadge as Badge, DButton, DDialog as Dialog } from '@digvation-labs/ui';
import { CheckCircle2, PlayCircle, Printer, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { additionPerformedBy, saleLineAdditions, saleLineBase } from '../model/sale-line-additions';
import { saleLineWorkStatus } from '../../queue/queued-sale-work';
import { correctionSourceOf } from '../../adjustment/sale-adjustment-access';
import {
  appliedPaymentComposition,
  saleDiscountRows,
  aggregateDiscountRows,
  lineDiscountRows,
  saleSettlement,
  saleTaxLabel,
} from '../model/sale-presentation';
import type { Employee, Sale, SaleLine } from '../model/cashier-transaction.types';
import {
  SaleCustomerStrip,
  SaleDetailSection,
  SaleFinancialSummary,
  SaleLineAdditions,
  SaleLineItem,
  SaleLineItemList,
  SalePaymentComposition,
  SalePaymentList,
  StatusPill,
} from './sale-detail-presentation';
import { serviceWorkUnitCount } from '../../performer/service-performers-dialog';
import { receiptDeliveryPreviewLabel } from '../../receipt/receipt-delivery-dialog';
import { receiptDeliveryPhase } from '../../receipt/receipt-delivery';
import type { ReceiptDeliveryState } from '../api/operational-projection-client';
import { servicePerformerSummary } from '../../performer/service-performer-summary';
import {
  type QueueStatus,
  statusMeta,
  queueStatus,
  queueStatusTone,
} from '../../queue/queue-status';
import { paymentAccountLabel } from '../../payment/sale-payment-status';
import {
  employeeAssignmentIssues,
  workflowIssues,
  groupWorkflowIssues,
} from '../../queue/workflow-issues';
import { money, formatDurationMinutes, quantity, transactionNumber } from '../model/sale-display';
import {
  customerDisplayName,
  customerDisplayDetail,
  customerInitials,
  customerStatus,
} from '../../customer/model/sale-customer-display';
import { pointQuantity, saleEarnedPoints } from '../model/sale-points';
import { ReceiptContent } from '../../receipt/receipt-content';
import { DiscountDetailsContent, DiscountInfoTooltip } from './discount-details';
import { ServicePerformers } from '../../performer/service-performer-credits';

function useRetainedValue<T>(value: T | null): T | null {
  // Keep the last value while a DS dialog plays its close transition.
  const [retained, setRetained] = useState<T | null>(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}

function useValueShownWhileOpen<T extends string | boolean | null | undefined>(
  open: boolean,
  value: T,
): T {
  // The parent clears what it derives from the shown Sale (receipt mode, branch, delivery) in the
  // same batch that closes the dialog. A closing dialog keeps what it showed while open, so its
  // exit never swaps the receipt for another view; the next opening shows the live values.
  const [shown, setShown] = useState<T>(value);
  if (open && value !== shown) setShown(value);
  return open ? value : shown;
}

function useOpeningKey(open: boolean): number {
  // A retained, closed DS dialog needs an extra effect pass to reopen; a fresh one is shown in the
  // same render as the state that opens it. Only an opening changes the key, never a close.
  const [openings, setOpenings] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenings(openings + 1);
  }
  return openings;
}

/** The line status a transaction state already implies, so it is not repeated per item. */
const impliedLineWorkStatus: Partial<Record<QueueStatus, string>> = {
  QUEUED: 'WAITING',
  PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
};

const fulfillmentTone: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  WAITING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELED: 'danger',
};

export const referenceTransactionDetailLayout = {
  dialog: 'pos-reference-transaction-dialog lg:!max-w-[1060px]',
  body: 'pos-transaction-detail-story',
  orderColumn: 'pos-transaction-detail-order',
  summaryColumn: 'pos-transaction-detail-summary',
} as const;

export const referenceTransactionDetailPresentation = {
  showTopTotal: false,
  showRightContext: true,
  emphasizePrimaryStatus: true,
} as const;

export function ReferenceTransactionDetail({
  sale: currentSale,
  locale,
  employees,
  businessName,
  branchName: currentBranchName,
  branchAddress: currentBranchAddress = null,
  cashierName,
  cancellationReason: currentCancellationReason,
  showPaymentReceipt: currentShowPaymentReceipt,
  onClose,
  onViewReceipt,
  onSendReceipt,
  deliveryStatus,
  onAssign,
  onStartLineWork,
  onComplete,
  isMutating,
}: {
  sale: Sale | null;
  locale: string;
  employees: readonly Employee[];
  businessName: string;
  branchName: string;
  branchAddress?: string | null;
  cashierName: string;
  cancellationReason?: string;
  showPaymentReceipt: boolean;
  onClose: () => void;
  onNewSale: () => void;
  onViewReceipt: (sale: Sale) => void;
  /** Opens the shared receipt-delivery flow; the preview never sends on its own. */
  onSendReceipt?: (sale: Sale) => void;
  deliveryStatus?: {
    available: boolean;
    delivery: { status: ReceiptDeliveryState } | null;
  };
  onAssign: (line: SaleLine) => void;
  onStartLineWork: (line: SaleLine) => void;
  onComplete: () => void;
  isMutating: boolean;
}) {
  const { copy, label, locale: copyLocale } = useOperationalLocalization();
  const [receiptPaper, setReceiptPaper] = useState<'58' | '80'>('80');
  const sale = useRetainedValue(currentSale);
  const openingKey = useOpeningKey(currentSale !== null);
  const showPaymentReceipt = useValueShownWhileOpen(
    currentSale !== null,
    currentShowPaymentReceipt,
  );
  const branchName = useValueShownWhileOpen(currentSale !== null, currentBranchName);
  const branchAddress = useValueShownWhileOpen(currentSale !== null, currentBranchAddress);
  const cancellationReason = useValueShownWhileOpen(
    currentSale !== null,
    currentCancellationReason,
  );
  const deliveryAvailable = useValueShownWhileOpen(
    currentSale !== null,
    deliveryStatus?.available ?? false,
  );
  const deliveryState = useValueShownWhileOpen(
    currentSale !== null,
    deliveryStatus?.delivery?.status,
  );
  if (!sale) return null;
  const open = currentSale !== null;
  const status = queueStatus(sale);
  const customer = sale.customer ?? null;
  const activeLines = sale.lines.filter((line) => !line.removedAt);
  const receiptAvailable = appliedPaymentComposition(sale).components.length > 0;
  const showReceipt = showPaymentReceipt && receiptAvailable;
  const settlement = saleSettlement(sale);
  const composition = appliedPaymentComposition(sale);
  const unappliedPayments = sale.payments
    .filter((payment) => !composition.components.includes(payment))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const hasDiscount = !createDecimal(sale.discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(sale.taxAmount).equals(createDecimal('0'));
  const completionIssues = status === 'PROGRESS' ? workflowIssues(sale, locale) : [];
  const completionIssueGroups = groupWorkflowIssues(sale, completionIssues, locale);
  const transactionDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(sale.finalizedAt ?? sale.updatedAt));
  const identity = transactionNumber(sale, locale);
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
  const earnedPoints = saleEarnedPoints(sale);
  const receiptDeliveryLabel = receiptDeliveryPreviewLabel(
    receiptDeliveryPhase(deliveryState),
    copyLocale,
  );

  return (
    <>
      <Dialog
        key={openingKey}
        open={open}
        onClose={onClose}
        title={copy(showReceipt ? 'Preview receipt' : 'Transaction details')}
        description={identity}
        ariaLabel={copy(showReceipt ? 'Preview receipt' : 'Transaction details')}
        closeOnEscape
        closeOnOverlay
        noPadding
        size="xl"
        className={`pos-reference-dialog ${referenceTransactionDetailLayout.dialog} w-full overflow-hidden`}
        footer={
          showReceipt ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  id="pos-receipt-paper-label"
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  {copy('Paper width')}
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="pos-receipt-paper-label"
                  className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1"
                >
                  {(['58', '80'] as const).map((paper) => (
                    <button
                      key={paper}
                      type="button"
                      role="radio"
                      aria-checked={receiptPaper === paper}
                      onClick={() => setReceiptPaper(paper)}
                      className={`min-h-8 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/30 ${
                        receiptPaper === paper
                          ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                    >
                      {paper} mm
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <DButton variant="ghost" onClick={onClose}>
                  {copy('Close')}
                </DButton>
                {deliveryAvailable && onSendReceipt ? (
                  <DButton variant="outline" onClick={() => onSendReceipt(sale)}>
                    {receiptDeliveryLabel}
                  </DButton>
                ) : null}
                <DButton
                  variant="primary"
                  leftIcon={<Printer className="size-3.5" />}
                  onClick={() => window.print()}
                >
                  {copy('Print')}
                </DButton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              <DButton variant="ghost" className="justify-center" onClick={onClose}>
                {copy('Close')}
              </DButton>
              {receiptAvailable ? (
                <DButton
                  rightIcon={<Printer className="size-3.5" />}
                  variant="outline"
                  className="justify-center"
                  onClick={() => onViewReceipt(sale)}
                >
                  {copy('View receipt')}
                </DButton>
              ) : null}
              {status === 'PROGRESS' ? (
                <DButton
                  variant="primary"
                  className="order-first col-span-2 justify-center sm:order-none"
                  disabled={completionIssues.length > 0}
                  loading={isMutating}
                  leftIcon={<CheckCircle2 className="size-3.5" />}
                  onClick={onComplete}
                >
                  {copy('Complete transaction')}
                </DButton>
              ) : null}
            </div>
          )
        }
      >
        {showReceipt ? (
          // The receipt sits as paper on a muted desk; the dialog body is the only scroll region.
          <div className="pos-receipt-desk">
            <div
              className={`pos-receipt-preview pos-receipt-print--${receiptPaper} bg-white text-slate-950`}
            >
              <ReceiptContent
                sale={sale}
                activeLines={activeLines}
                customer={customer}
                locale={locale}
                businessName={businessName}
                branchName={branchName}
                branchAddress={branchAddress}
                cashierName={cashierName}
                transactionDate={transactionDate}
                hasDiscount={hasDiscount}
                hasTax={hasTax}
              />
            </div>
          </div>
        ) : (
          <div className={referenceTransactionDetailLayout.body}>
            <div className="pos-detail-columns">
              <div className={`pos-detail-column ${referenceTransactionDetailLayout.orderColumn}`}>
                <SaleDetailSection
                  title={copy('Order')}
                  icon={<ShoppingBag className="size-4" />}
                  aside={`${activeLines.length} ${copy('items')}`}
                >
                  <SaleLineItemList>
                    {activeLines.map((line) => {
                      const isTrackedService =
                        line.itemTypeSnapshot === 'SERVICE' &&
                        line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
                        line.fulfillment !== null;
                      const requiresEmployeeAttribution =
                        line.employeeAssignmentModeSnapshot !== 'NONE' ||
                        line.allowEmployeeContributionSnapshot;
                      const attributed = isTrackedService && requiresEmployeeAttribution;
                      const plannedUnits = line.workUnits?.length ?? 0;
                      const needsAttention =
                        attributed &&
                        (employeeAssignmentIssues(line, locale).length > 0 ||
                          (plannedUnits > 0 && plannedUnits !== serviceWorkUnitCount(line)));
                      const durationLabel = formatDurationMinutes(
                        line.defaultDurationMinutesSnapshot,
                        locale,
                      );
                      const workSummary = attributed
                        ? servicePerformerSummary(line, employees, locale)
                        : null;
                      const editable = attributed && status === 'PROGRESS';
                      // The transaction's own state already says "in progress"; a line only
                      // repeats it when it differs (waiting, completed, canceled).
                      const showWorkStatus =
                        saleLineWorkStatus(line) !== null &&
                        saleLineWorkStatus(line) !==
                          (status ? impliedLineWorkStatus[status] : undefined);
                      // The transaction is already IN_PROGRESS, but this specific tracked
                      // Service has not been started yet: it needs its own explicit action.
                      const canStartLineWork =
                        status === 'PROGRESS' &&
                        line.itemTypeSnapshot === 'SERVICE' &&
                        line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
                        line.fulfillment?.status === 'WAITING';
                      const additions = saleLineAdditions(line);
                      const lineBase = saleLineBase(line, additions);
                      return (
                        <SaleLineItem
                          key={line.id}
                          name={line.itemNameSnapshot}
                          variant={
                            [
                              line.variantNameSnapshot,
                              line.soldByEmployeeNameSnapshot
                                ? `${copy('Sold by')} ${line.soldByEmployeeNameSnapshot}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || null
                          }
                          pricing={`${quantity(line.quantity)} × ${format(line.effectiveUnitPrice)}`}
                          amount={format(line.grossAmount)}
                          discountsHeading={copy('Discounts and promotions')}
                          discounts={lineDiscountRows(sale, line, copy('Discount')).map((row) => ({
                            id: row.id,
                            title: row.title,
                            note: row.note,
                            amount: format(row.amount),
                            info: (
                              <DiscountInfoTooltip
                                label={copy('Discount details')}
                                content={
                                  <DiscountDetailsContent details={row.details} locale={locale} />
                                }
                              />
                            ),
                          }))}
                          usage={
                            additions.length ? (
                              <SaleLineAdditions
                                heading={copy('Additional items')}
                                baseLabel={copy('Item price')}
                                base={{
                                  pricing: `${quantity(line.quantity)} × ${format(lineBase.unitPrice)}`,
                                  amount: format(lineBase.amount),
                                }}
                                rows={additions.map((addition) => ({
                                  id: addition.id,
                                  name: addition.name,
                                  pricing: `${quantity(addition.quantity)} × ${format(addition.unitPrice)}`,
                                  amount: format(addition.amount),
                                  performedBy: additionPerformedBy(addition, employees, copy),
                                }))}
                              />
                            ) : null
                          }
                          earning={
                            line.loyaltyEarning
                              ? `${
                                  line.loyaltyEarning.state === 'FINALIZED'
                                    ? `${copy('Points earned')}: `
                                    : `${copy('Point preview')}: `
                                }+${pointQuantity(line.loyaltyEarning.pointsEarned, locale)} ${copy('points')}`
                              : null
                          }
                          context={
                            showWorkStatus ||
                            line.workLineage ||
                            correctionSourceOf(sale, line) ||
                            durationLabel ? (
                              <>
                                {showWorkStatus ? (
                                  <StatusPill
                                    tone={fulfillmentTone[saleLineWorkStatus(line)!] ?? 'neutral'}
                                  >
                                    {label(saleLineWorkStatus(line)!)}
                                  </StatusPill>
                                ) : null}
                                {line.workLineage ? (
                                  <span>
                                    Pekerjaan tercatat pada {line.workLineage.sourceItemName}
                                  </span>
                                ) : null}
                                {correctionSourceOf(sale, line) ? (
                                  <span>
                                    Koreksi dari {correctionSourceOf(sale, line)!.itemNameSnapshot}
                                  </span>
                                ) : null}
                                {durationLabel ? <span>{durationLabel}</span> : null}
                              </>
                            ) : null
                          }
                          detail={
                            workSummary ? (
                              <ServicePerformers
                                itemName={line.itemNameSnapshot}
                                summary={workSummary}
                                needsAttention={needsAttention}
                                editable={editable}
                                disabled={isMutating}
                                onEdit={() => onAssign(line)}
                              />
                            ) : null
                          }
                          action={
                            canStartLineWork ? (
                              <DButton
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2.5 text-[11px]"
                                leftIcon={<PlayCircle className="size-3.5" />}
                                loading={isMutating}
                                onClick={() => onStartLineWork(line)}
                              >
                                {copy('Start work')}
                              </DButton>
                            ) : null
                          }
                        />
                      );
                    })}
                  </SaleLineItemList>
                </SaleDetailSection>
              </div>
              <div
                className={`pos-detail-column ${referenceTransactionDetailLayout.summaryColumn}`}
              >
                <SaleFinancialSummary
                  title={copy('Order summary')}
                  context={
                    referenceTransactionDetailPresentation.showRightContext ? (
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
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {transactionDate}
                              </span>
                            </div>
                          }
                        />
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 px-1">
                          <StatusPill
                            tone={
                              sale.status === 'VOIDED' || status === 'CANCELED'
                                ? 'danger'
                                : queueStatusTone(status)
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
                            <span className="font-semibold text-[var(--color-text)]">
                              {copy('Points earned')}
                            </span>
                            <span className="font-bold text-[var(--color-success)]">
                              +{pointQuantity(earnedPoints, locale)}
                            </span>
                          </div>
                        ) : null}
                        {sale.status === 'VOIDED' && cancellationReason ? (
                          <div className="mt-2 border-l-2 border-[var(--color-danger)] pl-2.5 text-xs">
                            <p className="font-semibold text-[var(--color-danger)]">
                              {copy('Cancellation reason')}
                            </p>
                            <p className="mt-0.5 text-[var(--color-text-muted)]">
                              {cancellationReason}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null
                  }
                  labels={{
                    subtotal: copy('Subtotal'),
                    total: copy('Total'),
                    paid: copy('Paid amount'),
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
                  tax={
                    hasTax
                      ? { label: saleTaxLabel(sale, copy('Tax')), amount: sale.taxAmount }
                      : null
                  }
                  total={sale.totalAmount}
                  settlement={settlement}
                  format={format}
                  payment={
                    composition.components.length
                      ? {
                          title: copy('Payment'),
                          aside: composition.isSplit ? (
                            <StatusPill tone="brand">
                              {copy('Split Payment')} · {composition.components.length}{' '}
                              {copy('methods')}
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
                  paymentAttempts={
                    unappliedPayments.length ? (
                      <>
                        <h4 className="text-sm font-semibold text-[var(--color-text)]">
                          {copy('Payment attempts')}
                        </h4>
                        <SalePaymentList
                          emptyLabel={copy('No payment recorded yet.')}
                          payments={unappliedPayments.map((item) => ({
                            id: item.id,
                            method: paymentAccountLabel(item, (method) => label(method)),
                            status: (
                              <StatusPill tone={item.status === 'PENDING' ? 'warning' : 'neutral'}>
                                {label(item.status)}
                              </StatusPill>
                            ),
                            detail: new Intl.DateTimeFormat(locale, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(item.terminalAt ?? item.updatedAt)),
                            amount: format(item.appliedAmount),
                          }))}
                        />
                      </>
                    ) : null
                  }
                />
                {completionIssues.length ? (
                  <DAlert variant="warning" title={copy('Not ready to complete')}>
                    <div className="space-y-1.5 text-[var(--color-text-muted)]">
                      {completionIssueGroups.map((group) => (
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
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {open && showReceipt
        ? createPortal(
            <div className={`pos-receipt-print pos-receipt-print--${receiptPaper}`}>
              <ReceiptContent
                sale={sale}
                activeLines={activeLines}
                customer={customer}
                locale={locale}
                businessName={businessName}
                branchName={branchName}
                branchAddress={branchAddress}
                cashierName={cashierName}
                transactionDate={transactionDate}
                hasDiscount={hasDiscount}
                hasTax={hasTax}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
