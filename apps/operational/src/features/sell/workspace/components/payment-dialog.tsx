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



export type PaymentDialogStep = 'edit' | 'review' | 'leave';
export type PaymentAllocationMode = 'FULL' | 'SPLIT';

export function usePaymentAllocationMode(open: boolean) {
  const [mode, setMode] = useState<PaymentAllocationMode>('FULL');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMode('FULL');
  }
  return [mode, setMode] as const;
}

/**
 * Keeps the confirmation step inside the payment dialog so Escape, overlay and focus handling stay
 * with one DS dialog. It resets to editing whenever the dialog is reopened.
 */
export function usePaymentDialogStep(open: boolean) {
  const [step, setStep] = useState<PaymentDialogStep>('edit');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep('edit');
  }
  return [step, setStep] as const;
}

/**
 * Facts explaining one applied Promotion or discount, read from the Sale's own adjustment
 * snapshot. Shared by the Payment Dialog and the Transaction Detail so both explain a discount in
 * the same words; it never looks up the current Promotion.
 */
export function DiscountDetailsContent({ details, locale }: { details: DiscountDetails; locale: string }) {
  const { copy } = useOperationalLocalization();
  const when = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  return (
    <div className="space-y-1">
      <p className="font-semibold">
        {details.name ?? copy(details.source === 'PROMOTION' ? 'Promotion' : 'Manual discount')}
      </p>
      {details.percentage ? (
        <p>
          {copy('Discount')}: {details.percentage}%
        </p>
      ) : null}
      {details.scope ? (
        <p>
          {copy(
            details.scope === 'TRANSACTION'
              ? 'Whole transaction'
              : details.scope === 'ITEM'
                ? 'Item-level'
                : 'Category-level',
          )}
        </p>
      ) : null}
      {details.effectiveFrom ? (
        <p>
          {copy('Start')}: {when(details.effectiveFrom)}
        </p>
      ) : null}
      {details.effectiveUntil ? (
        <p>
          {copy('End')}: {when(details.effectiveUntil)}
        </p>
      ) : null}
      {details.reason ? <p>{details.reason}</p> : null}
    </div>
  );
}

export function DiscountInfoTooltip({ label, content }: { label: string; content: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <PortalDropdown
      open={open}
      onOpenChange={setOpen}
      placement="top-start"
      offset={6}
      minWidth={220}
      contentRole="dialog"
      contentPadding={false}
      contentClassName="max-w-72 border-0 bg-[var(--color-tooltip)] px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
      trigger={() => (
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          className="grid size-4 shrink-0 place-items-center rounded-full text-[var(--color-danger)] outline-none transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-200"
        >
          <Info className="size-3.5" />
        </button>
      )}
    >
      {content}
    </PortalDropdown>
  );
}

export function ReferencePaymentDialog({
  open,
  onClose,
  onEditOrder,
  sale,
  lines,
  total,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  locale,
  customer,
  paymentRoutes,
  isPaymentRoutesLoading,
  method,
  paymentRouteId,
  appliedAmount,
  paymentReference,
  tender,
  payNow,
  onPayNowChange,
  onMethod,
  onPaymentRoute,
  onAppliedAmount,
  onPaymentReference,
  onTender,
  onTransitionPayment,
  quickTender,
  isSubmitting,
  paymentError,
  onConfirmPayment,
  onQueue,
  onQueueWithBalance,
  loyaltyRedemption,
  loyaltyPointBalance,
  isLoyaltyBalanceLoading,
  canRedeemLoyalty,
  loyaltyPoints,
  isLoyaltyMutating,
  onLoyaltyPointsChange,
  onApplyLoyalty,
  onRemoveLoyalty,
  adjustmentSlot,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Returns from Payment to editing the order. Offered only while Runtime still allows changing
   * the Sale (OPEN, nothing pending); Payment never locks the order by itself.
   */
  onEditOrder?: () => void;
  sale: Sale | null;
  lines: readonly CartDisplayLine[];
  total: string;
  gross: string;
  discountAmount: string;
  discountLabel: string;
  taxAmount: string;
  taxLabel: string;
  locale: string;
  customer: SaleCustomer | null;
  paymentRoutes: readonly PaymentRoute[];
  isPaymentRoutesLoading: boolean;
  method: PaymentMethod;
  paymentRouteId: string;
  appliedAmount: string;
  paymentReference: string;
  tender: string;
  payNow: boolean;
  onPayNowChange: (payNow: boolean) => void;
  onMethod: (method: PaymentMethod) => void;
  onPaymentRoute: (paymentRouteId: string) => void;
  onAppliedAmount: (amount: string) => void;
  onPaymentReference: (reference: string) => void;
  onTender: (amount: string) => void;
  onTransitionPayment: (payment: Payment, status: TerminalPaymentStatus) => void;
  quickTender: readonly string[];
  isSubmitting: boolean;
  /** Why the last payment attempt was not recorded; cleared when the payment is edited. */
  paymentError: string | null;
  /** Sends the confirmed payment to Runtime. Resolves once Runtime has answered. */
  onConfirmPayment: (allocation: string) => Promise<void>;
  onQueue: () => void;
  /** Queues a partly paid transaction so the rest is collected from the queue. */
  onQueueWithBalance: () => void;
  loyaltyRedemption: Sale['loyaltyRedemption'];
  loyaltyPointBalance: string | null;
  isLoyaltyBalanceLoading: boolean;
  canRedeemLoyalty: boolean;
  loyaltyPoints: string;
  isLoyaltyMutating: boolean;
  onLoyaltyPointsChange: (value: string) => void;
  onApplyLoyalty: (points: string) => Promise<unknown>;
  onRemoveLoyalty: () => void;
  /** Applied promotions and discounts for the authoritative Sale being paid. */
  adjustmentSlot?: ReactNode;
}) {
  const { copy, label } = useOperationalLocalization();
  const { showToast } = useToast();
  const [step, setStep] = usePaymentDialogStep(open);
  const [allocationMode, setAllocationMode] = usePaymentAllocationMode(open);
  const [loyaltyEditorOpen, setLoyaltyEditorOpen] = useState(false);
  useEffect(() => {
    if (!open) setLoyaltyEditorOpen(false);
  }, [open]);
  const format = (amount: string) => money(amount, locale);
  const routesForMethod = paymentRoutes.filter((route) => route.paymentMethod === method);
  const activeRoute =
    routesForMethod.find((route) => route.id === paymentRouteId) ?? routesForMethod[0] ?? null;
  const isCash = method === 'CASH';
  const hasDiscount = !createDecimal(discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(taxAmount).equals(createDecimal('0'));
  const canonicalLoyaltyPoints = wholePointValue(loyaltyPoints);
  const validLoyaltyPointInput =
    canonicalLoyaltyPoints !== null &&
    createDecimal(canonicalLoyaltyPoints).greaterThan(createDecimal('0'));
  const canSubmitLoyalty = canRedeemLoyalty && validLoyaltyPointInput && !isLoyaltyMutating;
  const legacyLoyaltyRedemption = loyaltyRedemption as
    | (NonNullable<Sale['loyaltyRedemption']> & {
        requestedPoints?: string;
        redemptionAmount?: string;
      })
    | null
    | undefined;
  const redeemedPoints =
    loyaltyRedemption?.points ?? legacyLoyaltyRedemption?.requestedPoints ?? null;
  const redeemedAmount =
    loyaltyRedemption?.amount ?? legacyLoyaltyRedemption?.redemptionAmount ?? null;
  const hasLoyaltyRedemption = Boolean(redeemedPoints && redeemedAmount);
  const wholePointBalance = wholePointValue(loyaltyPointBalance);
  const hasKnownPointBalance = wholePointBalance !== null;
  const pointBalancePositive =
    wholePointBalance !== null && createDecimal(wholePointBalance).greaterThan(createDecimal('0'));
  const applyLoyalty = async () => {
    if (!canSubmitLoyalty) return;
    try {
      if (
        hasKnownPointBalance &&
        createDecimal(canonicalLoyaltyPoints!).greaterThan(createDecimal(wholePointBalance!))
      ) {
        showToast({
          title: copy('Insufficient loyalty points'),
          description: copy('The requested points exceed the member point balance.'),
          variant: 'danger',
        });
        return;
      }
      await onApplyLoyalty(canonicalLoyaltyPoints!);
      setLoyaltyEditorOpen(false);
    } catch (error) {
      showToast({
        title: copy('Could not apply loyalty points'),
        description: cashierTransactionErrorMessage(error, locale),
        variant: 'danger',
      });
    }
  };
  const editLoyalty = () => {
    onLoyaltyPointsChange(wholePointValue(redeemedPoints) ?? '');
    setLoyaltyEditorOpen(true);
  };
  const startLoyalty = () => {
    onLoyaltyPointsChange('');
    setLoyaltyEditorOpen(true);
  };
  const cancelLoyaltyEditor = () => {
    onLoyaltyPointsChange('');
    setLoyaltyEditorOpen(false);
  };
  const removeLoyalty = () => {
    setLoyaltyEditorOpen(false);
    onRemoveLoyalty();
  };
  const customerBadge = customerStatus(customer);
  const payments = sale?.payments ?? [];
  const progress = sale
    ? paymentProgress(sale)
    : { paidAmount: '0.0000', pendingAmount: '0.0000', remainingAmount: total };
  const amountScale = amountFractionDigits(progress.remainingAmount);
  const normalizedAllocation =
    allocationMode === 'FULL'
      ? currencyInputFromAmount(progress.remainingAmount)
      : normalizeCurrencyPaymentInput(appliedAmount);
  const intent = paymentIntent(
    { totalAmount: sale?.totalAmount ?? total, payments },
    normalizedAllocation,
  );
  const allocationPositive = isPositiveDecimal(normalizedAllocation);
  const overAllocated =
    allocationPositive &&
    createDecimal(normalizedAllocation).greaterThan(createDecimal(progress.remainingAmount));
  const hasPending = payments.some((payment) => payment.status === 'PENDING');
  const hasPaymentActivity = payments.length > 0;
  const hasRecordedMoney = payments.some(
    (payment) => payment.status === 'SUCCEEDED' || payment.status === 'PENDING',
  );
  const normalizedTender = normalizeCurrencyPaymentInput(tender || normalizedAllocation);
  const cashShort =
    isCash &&
    allocationPositive &&
    createDecimal(normalizedTender).lessThan(createDecimal(normalizedAllocation));
  const cashChange =
    isCash && allocationPositive && !cashShort
      ? createDecimal(normalizedTender).minus(createDecimal(normalizedAllocation)).toFixed(4)
      : '0';
  const fullyPaid = sale ? hasSuccessfulCheckout(sale) : false;
  // An all-INSTANT Sale has no queue to defer to: payment is collected now, in as many parts as needed.
  const instantOnly = sale ? isInstantOnly(sale) : false;
  const collectsPayment = (payNow || instantOnly) && !fullyPaid;
  const canPay =
    lines.length > 0 &&
    Boolean(activeRoute) &&
    allocationPositive &&
    !overAllocated &&
    !hasPending &&
    !cashShort &&
    !isSubmitting;
  const canQueue = lines.length > 0 && !isSubmitting;
  const methods: Array<{ value: PaymentMethod; icon: ReactNode }> = [
    { value: 'CASH', icon: <Banknote className="size-[15px]" /> },
    { value: 'BANK_TRANSFER', icon: <CreditCard className="size-[15px]" /> },
    { value: 'QRIS', icon: <QrCode className="size-[15px]" /> },
    { value: 'WALLET', icon: <ShoppingBag className="size-[15px]" /> },
  ];
  const normalizedQuickTender = [normalizedAllocation, ...quickTender]
    .map((amount) => normalizeCurrencyPaymentInput(amount))
    .filter(isPositiveDecimal)
    .filter((amount, index, list) => list.indexOf(amount) === index)
    .slice(0, 6);
  const completes = intent.outcome !== 'LEAVES_BALANCE';

  // Leaving is only guarded once money is recorded and the transaction is not settled yet.
  const requestClose = () => {
    if (isSubmitting) return;
    if (step !== 'edit') {
      setStep('edit');
      return;
    }
    // Leaving a partly paid all-INSTANT Sale keeps it open; there is no queue to collect from later.
    if (hasRecordedMoney && !fullyPaid && !instantOnly) {
      setStep('leave');
      return;
    }
    onClose();
  };
  const confirmPayment = async () => {
    await onConfirmPayment(normalizedAllocation);
    setStep('edit');
  };

  const title =
    step === 'review'
      ? copy('Confirm payment')
      : step === 'leave'
        ? copy('Payment is not finished')
        : copy('POS payment');

  const editFooter = (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      <DButton variant="ghost" className="h-12 px-3 text-sm" onClick={requestClose}>
        {copy(hasRecordedMoney && !fullyPaid ? 'Leave payment' : 'Cancel')}
      </DButton>
      {collectsPayment ? (
        <DButton
          size="lg"
          disabled={!canPay}
          onClick={() => setStep('review')}
          rightIcon={<ChevronRight className="size-4" aria-hidden="true" />}
          className="w-full justify-center whitespace-nowrap"
        >
          {copy('Pay')} {format(normalizedAllocation || '0')}
        </DButton>
      ) : (
        <DButton
          size="lg"
          disabled={!canQueue}
          loading={isSubmitting}
          onClick={onQueue}
          className="w-full justify-center whitespace-nowrap"
        >
          {copy(instantOnly ? 'Complete transaction' : 'Add to queue')}
        </DButton>
      )}
    </div>
  );

  const footer =
    step === 'review' ? (
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <DButton variant="outline" disabled={isSubmitting} onClick={() => setStep('edit')}>
          {copy('Back to edit')}
        </DButton>
        <DButton
          disabled={!canPay && !isSubmitting}
          loading={isSubmitting}
          onClick={() => void confirmPayment()}
        >
          {copy(completes ? 'Confirm and complete' : 'Confirm payment')}
        </DButton>
      </div>
    ) : step === 'leave' ? (
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <DButton
          variant="outline"
          disabled={hasPending || isSubmitting}
          loading={isSubmitting}
          onClick={onQueueWithBalance}
        >
          {copy('Add to queue, collect later')}
        </DButton>
        <DButton onClick={() => setStep('edit')}>{copy('Continue payment')}</DButton>
      </div>
    ) : undefined;

  return (
    <DDialog
      title={title}
      description={
        sale ? `${copy('Transaction ID')}: ${transactionNumber(sale, locale)}` : undefined
      }
      open={open}
      onClose={requestClose}
      ariaLabel={title}
      closeOnEscape
      closeOnOverlay
      className={
        step === 'edit'
          ? 'pos-reference-dialog max-h-[94dvh] w-[calc(100vw-2rem)] !max-w-[1180px] overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl'
          : 'pos-reference-dialog max-h-[90dvh] w-[calc(100vw-2rem)] !max-w-[680px] overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl'
      }
      noPadding={step === 'edit'}
      footer={step === 'edit' ? undefined : footer}
    >
      {step === 'review' ? (
        <PaymentReview
          intent={intent}
          total={sale?.totalAmount ?? total}
          methodName={label(method)}
          accountName={activeRoute?.financialAccountName ?? label(method)}
          {...(!isCash && paymentReference.trim() ? { reference: paymentReference.trim() } : {})}
          {...(isCash ? { tendered: normalizedTender, change: cashChange } : {})}
          earlierPayments={payments}
          format={format}
          confirmReceived={!isCash}
        />
      ) : step === 'leave' ? (
        <PaymentLeaveNotice progress={progress} format={format} hasPending={hasPending} />
      ) : (
        <div className="grid min-h-0 gap-0 lg:h-[min(720px,calc(85dvh-5.5rem))] lg:grid-cols-[minmax(0,1fr)_440px] lg:overflow-hidden">
          <div className="min-h-0 space-y-3 overscroll-contain bg-[var(--color-surface)] p-4 lg:overflow-y-auto lg:border-r lg:border-[var(--color-border)] lg:pr-3">
            <section className="pos-pay-section">
              <div className="pos-pay-section__head border-b border-[var(--color-border)]">
                <div className="pos-pay-section__title">
                  <ShoppingBag
                    className="size-4 shrink-0 text-[var(--color-text-muted)]"
                    aria-hidden="true"
                  />
                  <span className="truncate">{copy('Order details')}</span>
                  <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                    {lines.length} {copy('items')}
                  </span>
                  {onEditOrder ? (
                    <button
                      type="button"
                      onClick={onEditOrder}
                      disabled={isSubmitting}
                      className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/8 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                      {copy('Return to order')}
                    </button>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="pos-pay-eyebrow">{copy('Subtotal')}</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {format(gross)}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]/70 bg-[var(--color-surface)]">
                {lines.map((line) => {
                  const discountPercentage = lineDiscountPercentage(line);
                  const discounted = isPositiveDecimal(line.lineDiscountAmount);
                  const discountedLineAmount = discounted
                    ? createDecimal(line.totalAmount)
                        .minus(createDecimal(line.lineDiscountAmount))
                        .toFixed(4)
                    : line.totalAmount;
                  const promotionTooltip = (
                    <DiscountDetailsContent
                      locale={locale}
                      details={{
                        source: 'PROMOTION',
                        scope: null,
                        name: line.promotion?.name ?? null,
                        percentage: discountPercentage,
                        effectiveFrom: line.promotion?.effectiveFrom ?? null,
                        effectiveUntil: line.promotion?.effectiveUntil ?? null,
                        reason: null,
                      }}
                    />
                  );
                  return (
                    <div key={line.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {line.itemNameSnapshot}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                            {quantity(line.quantity)} × {format(line.effectiveUnitPrice)}
                          </p>
                          {discounted ? (
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-danger)]">
                              <DiscountInfoTooltip
                                label={copy('Discount information')}
                                content={promotionTooltip}
                              />
                              <span>
                                {copy('Discount')} −{format(line.lineDiscountAmount)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          {discounted ? (
                            <p className="text-[10px] font-medium text-[var(--color-danger)] line-through decoration-[1.5px]">
                              {format(line.totalAmount)}
                            </p>
                          ) : null}
                          <p className="text-sm font-bold text-[var(--color-text)]">
                            {format(discountedLineAmount)}
                          </p>
                        </div>
                      </div>
                      <CartLineBreakdown
                        line={line}
                        heading={`${copy('Additional items')}: ${line.itemNameSnapshot}`}
                        baseLabel={copy('Item price')}
                        unitLabel={(index) => `${copy('Unit')} ${index}`}
                        format={format}
                        formatQuantity={quantity}
                        performedByLabel={copy('Performed by')}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {adjustmentSlot}

            {customer?.type === 'MEMBER' && (canRedeemLoyalty || hasLoyaltyRedemption) ? (
              <section className="pos-pay-section pos-pay-section--secondary">
                <div className="pos-pay-section__head items-start">
                  <div className="min-w-0">
                    <p className="pos-pay-section__title">
                      <Sparkles
                        className="size-4 shrink-0 text-[var(--color-warning)]"
                        aria-hidden="true"
                      />
                      {copy('Loyalty points')}
                    </p>
                    <p className="mt-1 pl-6 text-xs leading-5 text-[var(--color-text-muted)]">
                      {copy(
                        'Use member points for this transaction. Points are consumed only when the sale is finalized.',
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="pos-pay-eyebrow">{copy('Point balance')}</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-warning)]">
                      {isLoyaltyBalanceLoading
                        ? '…'
                        : `${pointQuantity(loyaltyPointBalance, locale)} PTS`}
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  {!hasLoyaltyRedemption && canRedeemLoyalty && !loyaltyEditorOpen ? (
                    <div className="rounded-xl bg-[var(--color-surface)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {copy('Available balance')}: {pointQuantity(loyaltyPointBalance, locale)}{' '}
                          {copy('points')}
                        </p>
                        <DButton
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!pointBalancePositive || isLoyaltyMutating}
                          onClick={startLoyalty}
                        >
                          {copy('Use loyalty points')}
                        </DButton>
                      </div>
                    </div>
                  ) : null}

                  {loyaltyEditorOpen && canRedeemLoyalty ? (
                    <div className="rounded-xl bg-[var(--color-surface)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold">{copy('Points to use')}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {copy('Available balance')}: {pointQuantity(loyaltyPointBalance, locale)}{' '}
                          {copy('points')}
                        </p>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                        <DInput
                          value={loyaltyPoints}
                          onChange={(value) => onLoyaltyPointsChange(value.replace(/\D/g, ''))}
                          inputMode="numeric"
                          disabled={isLoyaltyMutating}
                          placeholder="0"
                          autoFocus
                        />
                        <DButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!pointBalancePositive || isLoyaltyMutating}
                          onClick={() => onLoyaltyPointsChange(wholePointBalance!)}
                        >
                          {copy('Fill all')}
                        </DButton>
                        <DButton
                          type="button"
                          size="sm"
                          disabled={!canSubmitLoyalty}
                          loading={isLoyaltyMutating}
                          onClick={() => void applyLoyalty()}
                        >
                          {copy('Apply')}
                        </DButton>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-success)]">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {copy('Points are only consumed after the transaction is finalized.')}
                        </p>
                        <DButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isLoyaltyMutating}
                          onClick={cancelLoyaltyEditor}
                        >
                          {copy('Cancel')}
                        </DButton>
                      </div>
                    </div>
                  ) : hasLoyaltyRedemption ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-success)]/20 bg-[var(--color-success)]/[.06] px-3 py-2.5">
                      <CheckCircle2
                        className="size-4 shrink-0 text-[var(--color-success)]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{copy('Loyalty redemption')}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          {pointQuantity(redeemedPoints, locale)} {copy('points used')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-danger)]">
                        −{format(redeemedAmount!)}
                      </span>
                      {canRedeemLoyalty ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <DButton
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={copy('Edit')}
                            disabled={isLoyaltyMutating}
                            onClick={editLoyalty}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </DButton>
                          <DButton
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={copy('Remove')}
                            disabled={isLoyaltyMutating}
                            loading={isLoyaltyMutating}
                            onClick={removeLoyalty}
                          >
                            <Trash2
                              className="size-4 text-[var(--color-danger)]"
                              aria-hidden="true"
                            />
                          </DButton>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Once money is recorded the transaction is already being paid now. */}
            {!hasRecordedMoney ? (
              <section className="pos-pay-section pos-pay-section--primary">
                <div className="pos-pay-section__head">
                  <p className="pos-pay-section__title">
                    <Clock
                      className="size-4 shrink-0 text-[var(--color-brand)]"
                      aria-hidden="true"
                    />
                    {copy(instantOnly ? 'Payment' : 'Payment timing')}
                  </p>
                </div>
                <div className="pos-pay-section__body">
                  {instantOnly ? null : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        {
                          value: true,
                          title: copy('Pay now'),
                          description: copy('Choose a payment method before continuing.'),
                        },
                        {
                          value: false,
                          title: copy('Pay later'),
                          description: copy('Payment can be recorded after transaction creation.'),
                        },
                      ].map((option) => (
                        <label
                          key={String(option.value)}
                          className={`pos-choice ${payNow === option.value ? 'pos-choice--selected' : ''}`}
                        >
                          <DRadio
                            name="pos-payment-timing"
                            className="mt-0.5 shrink-0"
                            checked={payNow === option.value}
                            onChange={() => onPayNowChange(option.value)}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{option.title}</span>
                            <span className="mt-0.5 block text-xs leading-4 text-[var(--color-text-muted)]">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {collectsPayment ? (
                    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                      <DTabs
                        value={allocationMode}
                        defaultValue="FULL"
                        onValueChange={(value) => {
                          const next = value as PaymentAllocationMode;
                          setAllocationMode(next);
                          if (next === 'FULL') {
                            const remaining = currencyInputFromAmount(progress.remainingAmount);
                            onAppliedAmount(remaining);
                          } else {
                            onAppliedAmount('');
                          }
                        }}
                      >
                        <DTabsList className="grid w-full grid-cols-2 rounded-xl bg-[var(--color-surface-muted)] p-1">
                          <DTabsTrigger
                            value="FULL"
                            className="h-9 min-w-0 px-3 text-sm font-semibold"
                          >
                            {copy('Full payment')}
                          </DTabsTrigger>
                          <DTabsTrigger
                            value="SPLIT"
                            className="h-9 min-w-0 px-3 text-sm font-semibold"
                          >
                            {copy('Split payment')}
                          </DTabsTrigger>
                        </DTabsList>

                        <DTabsContent value="FULL" className="mt-2">
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-brand)]/[.045] px-3 py-2.5">
                            <span className="text-xs text-[var(--color-text)]">
                              {copy('Pay full remaining balance')}
                            </span>
                            <span className="shrink-0 text-base font-bold tabular-nums text-[var(--color-brand)]">
                              {format(progress.remainingAmount)}
                            </span>
                          </div>
                        </DTabsContent>

                        <DTabsContent value="SPLIT" className="mt-2">
                          <label className="block text-sm font-medium">
                            {copy('Payment amount')}
                            <PosCurrencyInput
                              aria-label={copy('Payment amount')}
                              className="mt-1.5 h-11 rounded-lg bg-[var(--color-surface)] text-right text-lg font-bold"
                              value={appliedAmount}
                              onChange={onAppliedAmount}
                              fractionDigits={amountScale}
                            />
                          </label>
                          {overAllocated ? (
                            <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
                              {copy('Payment allocation cannot exceed the remaining amount.')}{' '}
                              {copy('Remaining')}: {format(progress.remainingAmount)}
                            </p>
                          ) : (
                            <div className="mt-2">
                              <PaymentIntentHint
                                intent={intent}
                                format={format}
                                onPayRemaining={() => {
                                  const remaining = currencyInputFromAmount(
                                    progress.remainingAmount,
                                  );
                                  onAppliedAmount(remaining);
                                  setAllocationMode('FULL');
                                }}
                              />
                            </div>
                          )}
                        </DTabsContent>
                      </DTabs>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <div className="max-lg:contents lg:sticky lg:top-0 lg:flex lg:h-full lg:min-h-0 lg:w-[440px] lg:min-w-[440px] lg:flex-col lg:self-stretch lg:overflow-hidden lg:bg-[var(--color-surface-muted)]/60">
            <div className="shrink-0 space-y-3 bg-[var(--color-surface-muted)]/60 p-4 pb-3 lg:overflow-y-hidden lg:[scrollbar-gutter:stable]">
              {customer ? (
                <SaleCustomerStrip
                  initials={customerInitials(customer)}
                  name={customerDisplayName(customer, locale)}
                  detail={customerDisplayDetail(customer)}
                  badge={
                    customerBadge ? (
                      <Badge
                        variant={customerBadge.variant}
                        className="shrink-0 px-2 py-0 text-[10px]"
                      >
                        {copy(customerBadge.label)}
                      </Badge>
                    ) : null
                  }
                  aside={
                    customer.type === 'MEMBER' ? (
                      <>
                        <p className="pos-pay-eyebrow">{copy('Points')}</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-warning)]">
                          {isLoyaltyBalanceLoading
                            ? '…'
                            : `${pointQuantity(loyaltyPointBalance, locale)} PTS`}
                        </p>
                      </>
                    ) : null
                  }
                />
              ) : null}

              <div className="pos-pay-section p-4 shadow-sm">
                <p className="pos-pay-eyebrow">{copy('Payment total')}</p>
                <h3 className="mt-0.5 text-3xl font-bold leading-tight tabular-nums text-[var(--color-brand)]">
                  {format(total)}
                </h3>
                <div className="mt-3 space-y-1.5 border-t border-[var(--color-border)] pt-3 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-[var(--color-text-muted)]">{copy('Subtotal')}</span>
                    <span className="font-semibold tabular-nums">{format(gross)}</span>
                  </div>
                  {hasDiscount ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--color-text-muted)]">{discountLabel}</span>
                      <span className="font-semibold text-[var(--color-danger)]">
                        −{format(discountAmount)}
                      </span>
                    </div>
                  ) : null}
                  {hasLoyaltyRedemption ? (
                    <div className="flex justify-between gap-3">
                      <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <span className="size-2 rounded-full bg-[var(--color-warning)]" />
                        {copy('Loyalty redemption')}
                      </span>
                      <span className="font-semibold text-[var(--color-danger)]">
                        −{format(redeemedAmount!)}
                      </span>
                    </div>
                  ) : null}
                  {hasTax ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--color-text-muted)]">{taxLabel}</span>
                      <span className="font-semibold">{format(taxAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-[var(--color-border)] pt-2.5 text-sm font-bold">
                    <span className="font-bold">{copy('Net total')}</span>
                    <span className="font-bold">{format(total)}</span>
                  </div>
                </div>
                {hasPaymentActivity ? (
                  <div className="mt-3">
                    <PaymentProgressSummary
                      total={sale?.totalAmount ?? total}
                      progress={progress}
                      format={format}
                    />
                    {hasRecordedMoney && !fullyPaid ? (
                      <p className="mt-2 text-[11px] font-medium text-[var(--color-text-muted)]">
                        {copy(
                          'The transaction is not complete until the remaining amount is paid.',
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overscroll-contain bg-[var(--color-surface-muted)]/60 px-4 pb-4 lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
              {hasPaymentActivity && sale ? (
                <RecordedPaymentList
                  payments={payments}
                  totalAmount={sale.totalAmount}
                  progress={progress}
                  format={format}
                  isMutating={isSubmitting}
                  onTransition={onTransitionPayment}
                />
              ) : null}

              {collectsPayment ? (
                <>
                  <div className="pos-pay-section p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[var(--color-text)]">
                        {copy('Payment method')}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-success)]">
                        <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
                        {copy('Ready to pay')}
                      </span>
                    </div>
                    {hasRecordedMoney ? (
                      <p className="pos-pay-eyebrow mb-3">{copy('Next payment')}</p>
                    ) : null}
                    {paymentError ? (
                      <DAlert
                        variant="danger"
                        role="alert"
                        title={copy('Payment was not recorded')}
                        className="mb-3"
                      >
                        {paymentError} {copy('Nothing was added to the paid amount.')}
                      </DAlert>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      {methods.map((option) => {
                        const routeAvailable = paymentRoutes.some(
                          (route) => route.paymentMethod === option.value,
                        );
                        const disabled = isPaymentRoutesLoading || !routeAvailable || hasPending;
                        const selected = method === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            aria-pressed={selected}
                            onClick={() => onMethod(option.value)}
                            className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[13px] font-semibold sm:gap-2 sm:px-3 sm:text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                              selected
                                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/[.08] text-[var(--color-brand)] ring-1 ring-[var(--color-brand)]'
                                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/[.04]'
                            }`}
                          >
                            <span className="shrink-0">{option.icon}</span>
                            <span className="min-w-0">{label(option.value)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {hasPending ? (
                      <p className="mt-2 text-xs text-[var(--color-warning)]">
                        {copy('Confirm or cancel the waiting payment before adding another one.')}
                      </p>
                    ) : null}
                    {activeRoute ? (
                      <div className="mt-3">
                        <Select
                          label={copy('Settlement account')}
                          value={activeRoute.id}
                          options={routesForMethod.map((route) => ({
                            value: route.id,
                            label: route.financialAccountCode
                              ? `${route.financialAccountName} · ${route.financialAccountCode}`
                              : route.financialAccountName,
                          }))}
                          onChange={(value) => {
                            if (typeof value === 'string') onPaymentRoute(value);
                          }}
                          className="w-full"
                        />
                      </div>
                    ) : null}
                    {!isCash ? (
                      <div className="mt-3">
                        <DInput
                          aria-label={copy('Payment reference')}
                          label={copy('Payment reference')}
                          value={paymentReference}
                          onChange={onPaymentReference}
                          placeholder={copy('Optional reference')}
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-bold">{copy('Cash received')}</span>
                          <button
                            type="button"
                            disabled={!allocationPositive}
                            onClick={() => onTender(normalizedAllocation)}
                            className="rounded-full bg-[var(--color-brand)]/[.08] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/[.14] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {copy('Exact amount')} {format(normalizedAllocation || '0')}
                          </button>
                        </div>

                        <PosCurrencyInput
                          aria-label={copy('Cash received')}
                          className="h-12 rounded-lg bg-[var(--color-surface)] text-right text-lg font-bold"
                          value={tender}
                          onChange={onTender}
                          fractionDigits={amountScale}
                        />

                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {normalizedQuickTender
                            .filter((amount) => amount !== normalizedAllocation)
                            .slice(0, 5)
                            .map((amount) => (
                              <button
                                key={amount}
                                type="button"
                                onClick={() => onTender(amount)}
                                className={`h-9 rounded-md border px-1 text-xs font-semibold tabular-nums transition-colors ${normalizeCurrencyPaymentInput(tender) === amount ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]'}`}
                              >
                                {format(amount)}
                              </button>
                            ))}
                        </div>

                        <div
                          className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2.5 ${cashShort ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'}`}
                        >
                          <span className="text-sm font-bold">
                            {copy(cashShort ? 'Payment short' : 'Change')}
                          </span>
                          <span className="text-base font-bold tabular-nums">
                            {format(
                              cashShort
                                ? createDecimal(normalizedAllocation)
                                    .minus(createDecimal(normalizedTender || '0'))
                                    .toFixed(4)
                                : cashChange,
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 max-lg:sticky max-lg:bottom-0 max-lg:z-10 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.18)]">
              {editFooter}
            </div>
          </div>
        </div>
      )}
    </DDialog>
  );
}
