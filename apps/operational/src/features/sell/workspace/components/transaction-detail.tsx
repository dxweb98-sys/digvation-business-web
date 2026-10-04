import { useAuth } from '@digvation/pos-auth';
import { ApiClient } from '@digvation/business-api';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import {
  DAlert,
  DBadge as Badge,
  DButton,
  DButton as Button,
  DConfirmDialog,
  DDialog,
  DDialog as Dialog,
  DDropdown as Dropdown,
  DInput,
  DRadio,
  DSearchInput as SearchInput,
  DSelect as Select,
  DSkeleton as Skeleton,
  useToast,
} from '@digvation-labs/ui';
import {
  DAvatar,
  DDropdown as PortalDropdown,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  DTextarea,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  Info,
  Minus,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  Send,
  QrCode,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import {
  QUEUE_REFRESH_INTERVAL_MS,
  liveQueryPolicy,
} from '../../../../app/data/operational-cache-policy';
import {
  operationalCopy,
  resolveOperationalLocale,
  useOperationalLocalization,
} from '../../../../app/localization/operational-localization';
import { useOperationalAccessContext } from '../../../../modules/operational/operational-access-api';
import { resolveReceiptLocation } from '../../../../modules/operational/operational-location-selection';
import { cashierTransactionKeys } from '../../cashier-transaction-keys';
import {
  cashierTransactionErrorMessage,
  correctionErrorMessage,
} from '../../cashier-transaction-errors';
import type { ReplaceLinePreview, ReplaceSaleLineInput } from '../../cashier-transaction.adapter';
import { replacementLinesOf } from '../../cart-draft';
import { visibleCatalogItems } from '../../selling-catalog-eligibility';
import { saleLineConfiguration } from '../../sale-line-additions';
import {
  ItemConfigurator,
  type ItemConfiguration,
  type ItemConfiguratorState,
} from '../../components/item-configurator';
import { AddTransactionItemDialog, CatalogItemAutocomplete } from '../../components/transaction-item-dialog';
import { CustomerMemberApi, type MemberLookupResult } from '../../customer-member-api';
import type { CartDisplayLine } from '../../cart-draft';
import {
  createCashierTransactionAdapter,
  isLocalCashierDemoEnabled,
} from '../../cashier-transaction-adapter-factory';
import { hasStartableQueuedWork, saleLineWorkStatus } from '../../queued-sale-work';
import { correctionSourceOf, saleLineAdjustmentMode } from '../../sale-adjustment-access';
import {
  appliedPaymentComposition,
  employeeDisplayName,
  formatServiceDuration,
  lineDiscountPercentage,
  saleDiscountRows,
  aggregateDiscountRows,
  lineTaxLabel,
  cashTenderNote,
  type DiscountDetails,
  discountPresentation,
  lineDiscountRows,
  paymentIntent,
  paymentProgress,
  saleSettlement,
  saleTaxLabel,
  transactionDiscountLabel,
} from '../../sale-presentation';
import type {
  CatalogItem,
  ComponentCandidate,
  CompletedSaleSummary,
  Employee,
  Payment,
  PaymentMethod,
  PaymentRoute,
  PaymentStatus,
  QueueSale,
  Sale,
  SaleCustomer,
  SaleLine,
} from '../../cashier-transaction.types';
import type { CatalogItemTypeFilter } from '../../use-selling-catalog';
import type { useCashierTransactionWorkspace } from '../../use-cashier-transaction-workspace';

import {
  amountFractionDigits,
  currencyInputFromAmount,
  normalizeCurrencyPaymentInput,
  PosCurrencyInput,
  PosNumericInput,
} from '../../components/pos-controls';
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
} from '../../components/sale-detail-presentation';
import { additionPerformedBy, saleLineAdditions, saleLineBase } from '../../sale-line-additions';
import { CartLineBreakdown } from '../../components/cart-line-breakdown';
import {
  PaymentIntentHint,
  PaymentLeaveNotice,
  PaymentProgressSummary,
  PaymentReview,
  RecordedPaymentList,
} from '../../components/payment-confirmation';
import { SaleAdjustmentControls } from '../../components/sale-adjustment-controls';
import { SaleLineTaskDialog } from '../../components/sale-line-task-dialog';
import {
  ServicePerformersDialog,
  serviceWorkUnitAllocations,
  serviceWorkUnitCount,
} from '../../components/service-performers-dialog';
import {
  formatPercent,
  formatUnitRanges,
  groupAllocations,
  resolveAllocation,
  type PerformerAllocation,
  type ServiceLineWorkPlan,
} from '../../service-performer-allocation';
import {
  isCompletedSaleSummary,
  presentableTransaction,
  restrictedQueueSummary,
  useCanReadCompletedSaleDetails,
} from '../../completed-sale-visibility';
import {
  activeMemberOf,
  needsMemberIdentityLookup,
  presentedCustomer,
} from '../../member-cart-presentation';
import { CustomerMemberDialog } from '../../components/customer-member-dialog';
import {
  WalkInCustomerEditDialog,
  type WalkInCustomerEditTarget,
} from '../../components/walk-in-customer-edit-dialog';
import {
  ReceiptDeliveryDialog,
  ReceiptDeliveryIndicatorLine,
  receiptDeliveryPreviewLabel,
  receiptDeliveryStatusKey,
  type ReceiptDeliveryTarget,
} from '../../components/receipt-delivery-dialog';
import { receiptDeliveryPhase } from '../../receipt-delivery';
import type {
  ReceiptDeliveryIndicator,
  ReceiptDeliveryState,
} from '../../operational-projection-client';
import { useCustomerPickerSession } from '../../customer-picker-session';
import { canAdjustOrder } from '../../sale-adjustment-access';
import {
  completeSettledCheckout,
  hasTrackedWork,
  isFullySettled,
  isInstantOnly,
} from '../../sale-lifecycle';


import {
  CANCELED_SALE_REASONS_KEY,
  PerformerCredits,
  ServicePerformers,
  VISIBLE_AVATARS,
  VISIBLE_PERFORMER_GROUPS,
  copyFor,
  customerDisplayDetail,
  customerDisplayName,
  customerInitials,
  customerStatus,
  employeeAssignmentIssues,
  financialSummary,
  formatDurationMinutes,
  groupWorkflowIssues,
  hasSuccessfulCheckout,
  hasSuccessfulPayment,
  isPositiveDecimal,
  money,
  paymentAccountLabel,
  pointQuantity,
  processIssues,
  quantity,
  queueStatus,
  readCancellationReasons,
  readQueuedSaleEntries,
  receiptPointSummary,
  saleEarnedPoints,
  servicePerformerSummary,
  statusMeta,
  successfulPayments,
  transactionNumber,
  wholePointValue,
  workflowIssues,
  writeCancellationReason,
  writeQueuedSaleEntries,
  type FulfillmentDestination,
  type QueueStatus,
  type QueuedSaleEntry,
  type TerminalPaymentStatus,
} from '../presentation/workspace-presentation';

export {
  ReferenceQueueCard,
  RestrictedCompletedQueueCard,
} from './selling-sections';

import {
  ReferenceCatalogCard,
  ReferenceCartPanel,
  ReferenceFloatingCart,
  ReferenceQueueBoard,
  ReferenceQueueCard,
  ReferenceTypeButton,
  RestrictedCompletedQueueCard,
} from './selling-sections';



import {
  DiscountDetailsContent,
  DiscountInfoTooltip,
  ReferencePaymentDialog,
  usePaymentDialogStep,
} from './payment-dialog';
export { ReferencePaymentDialog } from './payment-dialog';


export function useRetainedValue<T>(value: T | null): T | null {
  // Keep the last value while a DS dialog plays its close transition.
  const [retained, setRetained] = useState<T | null>(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}

/** The line status a transaction state already implies, so it is not repeated per item. */
export const impliedLineWorkStatus: Partial<Record<QueueStatus, string>> = {
  QUEUED: 'WAITING',
  PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
};

export const fulfillmentTone: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
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

export function queueStatusTone(status: QueueStatus | null) {
  if (status === 'QUEUED') return 'warning' as const;
  if (status === 'PROGRESS') return 'brand' as const;
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELED') return 'danger' as const;
  return 'neutral' as const;
}

export function ReferenceTransactionDetail({
  sale: currentSale,
  locale,
  employees,
  businessName,
  branchName,
  branchAddress = null,
  cashierName,
  cancellationReason,
  showPaymentReceipt,
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
    receiptDeliveryPhase(deliveryStatus?.delivery?.status),
    copyLocale,
  );

  return (
    <>
      <Dialog
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
                {deliveryStatus?.available && onSendReceipt ? (
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


export function ReceiptContent({
  sale,
  activeLines,
  customer,
  locale,
  businessName,
  branchName,
  branchAddress = null,
  cashierName,
  transactionDate,
  hasDiscount,
  hasTax,
}: {
  sale: Sale;
  activeLines: readonly SaleLine[];
  customer: SaleCustomer | null;
  locale: string;
  businessName: string;
  branchName: string;
  branchAddress?: string | null;
  cashierName: string;
  transactionDate: string;
  hasDiscount: boolean;
  hasTax: boolean;
}) {
  const { copy, label } = useOperationalLocalization();
  const discountRows = aggregateDiscountRows(saleDiscountRows(sale));
  const composition = appliedPaymentComposition(sale);
  const settlement = saleSettlement(sale);
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
  // The transaction's point summary, stated once. Runtime's finalized loyalty summary is the single
  // authority; a Sale without one (earlier history) falls back to its finalized earning alone.
  const receiptPoints = receiptPointSummary(sale, customer);
  return (
    <>
      <header className="text-center">
        <h2 className="text-lg font-black tracking-tight">{businessName}</h2>
        <p className="mt-1 text-xs text-slate-500">{branchName}</p>
        {branchAddress?.trim() ? (
          <p className="mt-0.5 text-[11px] text-slate-500">{branchAddress.trim()}</p>
        ) : null}
        <div className="my-4 border-t border-dashed border-slate-300" />
        <p className="font-mono text-xs font-semibold">{transactionNumber(sale, locale)}</p>
        <p className="mt-1 text-[11px] text-slate-500">{transactionDate}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          {copy('Cashier')}: {cashierName}
        </p>
      </header>

      {/*
        One stacked hierarchy for 80 mm and 58 mm alike: who the customer is, then (for a member)
        this Sale's point summary. Customer identity and points never compete side by side.
      */}
      <section className="mt-4 space-y-3 text-xs" aria-label={copy('Customer')}>
        <div>
          <p className="font-semibold">{copy('Customer')}</p>
          <p className="mt-1 break-words">{customerDisplayName(customer, locale)}</p>
          {customerDisplayDetail(customer) ? (
            // A phone or reference is one token: it keeps the full width and never breaks per character.
            <p className="whitespace-nowrap text-slate-500">{customerDisplayDetail(customer)}</p>
          ) : null}
        </div>
        {receiptPoints ? (
          <div data-testid="receipt-points">
            <p className="font-semibold">{copy('Points')}</p>
            <dl className="mt-1 space-y-0.5 tabular-nums">
              {receiptPoints.balanceAfter !== null ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{copy('Receipt point balance')}</dt>
                  <dd className="font-bold">{pointQuantity(receiptPoints.balanceAfter, locale)}</dd>
                </div>
              ) : null}
              {receiptPoints.earnedPoints ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{copy('Points gained')}</dt>
                  <dd className="font-semibold">
                    +{pointQuantity(receiptPoints.earnedPoints, locale)}
                  </dd>
                </div>
              ) : null}
              {receiptPoints.redeemedPoints ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{copy('Used')}</dt>
                  <dd className="font-semibold">
                    −{pointQuantity(receiptPoints.redeemedPoints, locale)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-2.5">
        {activeLines.map((line) => {
          const lineDiscounts = lineDiscountRows(sale, line, copy('Discount'));
          const additions = saleLineAdditions(line);
          const receiptBase = saleLineBase(line, additions);
          return (
            <div key={line.id} className="text-xs leading-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{line.itemNameSnapshot}</p>
                  {line.variantNameSnapshot ? (
                    <p className="mt-0.5 text-slate-500">{line.variantNameSnapshot}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-bold">{money(line.grossAmount, locale)}</p>
              </div>
              {additions.length ? (
                <>
                  <div className="mt-1 flex items-start justify-between gap-3 text-slate-500">
                    <span>
                      {quantity(line.quantity)} × {money(receiptBase.unitPrice, locale)}
                    </span>
                    <span className="shrink-0">{money(receiptBase.amount, locale)}</span>
                  </div>
                  {/* Customer receipt: only additions chosen during the transaction, as a breakdown of the line total. */}
                  {additions.map((addition) => (
                    <div key={addition.id} className="mt-1 pl-2">
                      <p className="break-words">+ {addition.name}</p>
                      <div className="flex items-start justify-between gap-3 text-slate-500">
                        <span>
                          {quantity(addition.quantity)} × {money(addition.unitPrice, locale)}
                        </span>
                        <span className="shrink-0">{money(addition.amount, locale)}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="mt-1 text-slate-500">
                  {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
                </p>
              )}
              {isPositiveDecimal(line.itemTaxAmount ?? '0') ? (
                <div className="mt-1 flex items-start justify-between gap-3 text-slate-500">
                  <span>{lineTaxLabel(line, copy('Tax'))}</span>
                  <span className="shrink-0">{money(line.itemTaxAmount ?? '0', locale)}</span>
                </div>
              ) : null}
              {lineDiscounts.length ? (
                <div className="mt-1 text-slate-500">
                  <p className="text-[10px] font-semibold">{copy('Discounts and promotions')}</p>
                  {lineDiscounts.map((discount) => (
                    <div key={discount.id} className="pl-2">
                      <p className="break-words">- {discount.title}</p>
                      {discount.note ? (
                        <p className="break-words text-[10px] leading-3">{discount.note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {line.loyaltyEarning?.state === 'FINALIZED' ? (
                <div className="mt-1 flex items-start justify-between gap-3 text-slate-500">
                  <span>{copy('Points earned')}</span>
                  <span className="shrink-0 font-medium text-slate-950">
                    +{pointQuantity(line.loyaltyEarning.pointsEarned, locale)}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">{copy('Subtotal')}</dt>
          <dd>{money(sale.grossAmount, locale)}</dd>
        </div>
        {hasTax ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{saleTaxLabel(sale, copy('Tax'))}</dt>
            <dd>{money(sale.taxAmount, locale)}</dd>
          </div>
        ) : null}
        {discountRows.length ? (
          <p className="pt-0.5 text-[10px] font-semibold text-slate-500">
            {copy('Discounts and promotions')}
          </p>
        ) : null}
        {discountRows.map((row) => {
          const text = discountPresentation(row, copy('Discount'));
          return (
            <div key={row.id} className="flex items-start justify-between gap-3 pl-2">
              <dt className="min-w-0 text-slate-500">
                {text.title}
                {text.note ? (
                  <span className="block break-words text-[10px] leading-3">{text.note}</span>
                ) : null}
              </dt>
              <dd className="shrink-0">−{money(row.amount, locale)}</dd>
            </div>
          );
        })}
        {hasDiscount && discountRows.length === 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">{copy('Discount')}</dt>
            <dd>−{money(sale.discountAmount, locale)}</dd>
          </div>
        ) : null}
        {hasLoyaltyRedemption ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="min-w-0 text-slate-500">
              {copy('Loyalty redemption')}
              <span className="block text-[10px] leading-3">
                {pointQuantity(redeemedPoints, locale)} {copy('points used')}
              </span>
            </dt>
            <dd className="shrink-0">−{money(redeemedAmount!, locale)}</dd>
          </div>
        ) : null}
        <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-sm font-black">
          <dt>{copy('Total').toUpperCase()}</dt>
          <dd>{money(sale.totalAmount, locale)}</dd>
        </div>
      </dl>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <section className="space-y-1.5 text-xs">
        <p className="flex justify-between gap-3 font-semibold">
          <span>{copy('Payment')}</span>
          {composition.isSplit ? <span>{copy('Split Payment')}</span> : null}
        </p>
        {composition.components.map((payment) => (
          <div key={payment.id} className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-slate-500">
              {paymentAccountLabel(payment, (method) => label(method))}
              {payment.providerReference ? (
                <span className="block break-all font-mono text-[10px]">
                  {payment.providerReference}
                </span>
              ) : null}
            </span>
            <span className="shrink-0">{money(payment.appliedAmount, locale)}</span>
          </div>
        ))}
        {composition.isSplit ? (
          <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
            <span>{copy('Total paid')}</span>
            <span>{money(composition.totalPaid, locale)}</span>
          </div>
        ) : null}
        {cashTenderNote(settlement) ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{copy('Cash received')}</span>
            <span>{money(settlement.cashTendered!, locale)}</span>
          </div>
        ) : null}
        {cashTenderNote(settlement)?.change ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">{copy('Change')}</span>
            <span>{money(settlement.cashChange!, locale)}</span>
          </div>
        ) : null}
      </section>

      <div className="my-4 border-t border-dashed border-slate-300" />
      <p className="text-center text-[11px] text-slate-500">
        {copy('Thank you for your purchase.')}
      </p>
      <div className="pos-receipt-tear" aria-hidden="true" />
    </>
  );
}

