import { createDecimal } from '@digvation/pos-money';
import { DDialog } from '@digvation-labs/ui';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { CartDisplayLine } from '../cart/cart-draft';
import { paymentIntent, paymentProgress } from '../transaction/model/sale-presentation';
import type {
  Payment,
  PaymentMethod,
  PaymentRoute,
  Sale,
  SaleCustomer,
} from '../transaction/model/cashier-transaction.types';
import {
  amountFractionDigits,
  currencyInputFromAmount,
  normalizeCurrencyPaymentInput,
} from '../lib/pos-controls';
import { PaymentLeaveNotice, PaymentReview, RecordedPaymentList } from './payment-confirmation';
import { isInstantOnly } from '../transaction/model/sale-lifecycle';
import { hasSuccessfulCheckout, type TerminalPaymentStatus } from './sale-payment-status';
import { money, transactionNumber, isPositiveDecimal } from '../transaction/model/sale-display';
import {
  type PaymentAllocationMode,
  usePaymentAllocationMode,
  usePaymentDialogStep,
} from './payment-dialog-state';
import {
  PaymentEditFooter,
  PaymentLeaveFooter,
  PaymentReviewFooter,
} from './payment-dialog-footers';
import { PaymentAllocationTabs } from './payment-allocation-tabs';
import {
  PaymentCashTender,
  PaymentMethodPanel,
  PaymentReferenceField,
} from './payment-method-panel';
import { PaymentLoyaltySection } from './payment-loyalty-section';
import { PaymentOrderDetails } from './payment-order-details';
import { PaymentTimingSection } from './payment-timing-section';
import { PaymentCustomerSummary, PaymentTotalSummary } from './payment-summary-panel';
import { usePaymentLoyaltyEditor } from './use-payment-loyalty-editor';

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
  const [step, setStep] = usePaymentDialogStep(open);
  const [allocationMode, setAllocationMode] = usePaymentAllocationMode(open);
  const loyalty = usePaymentLoyaltyEditor({
    open,
    locale,
    loyaltyRedemption,
    loyaltyPointBalance,
    loyaltyPoints,
    canRedeemLoyalty,
    isLoyaltyMutating,
    onLoyaltyPointsChange,
    onApplyLoyalty,
    onRemoveLoyalty,
  });
  const format = (amount: string) => money(amount, locale);
  const routesForMethod = paymentRoutes.filter((route) => route.paymentMethod === method);
  const activeRoute =
    routesForMethod.find((route) => route.id === paymentRouteId) ?? routesForMethod[0] ?? null;
  const isCash = method === 'CASH';
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
  const review: ComponentProps<typeof PaymentReview> = {
    intent,
    total: sale?.totalAmount ?? total,
    methodName: label(method),
    accountName: activeRoute?.financialAccountName ?? label(method),
    ...(!isCash && paymentReference.trim() ? { reference: paymentReference.trim() } : {}),
    ...(isCash ? { tendered: normalizedTender, change: cashChange } : {}),
    earlierPayments: payments,
    format,
    confirmReceived: !isCash,
  };
  // Recording the payment settles the live balance before finalize or queue answers. Until that
  // confirmation finishes, and while the dialog closes after it, the review shows what was confirmed.
  const [confirmedReview, setConfirmedReview] = useState<typeof review | null>(null);
  const shownReview = confirmedReview && (isSubmitting || !open) ? confirmedReview : review;
  const completes = shownReview.intent.outcome !== 'LEAVES_BALANCE';

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
    setConfirmedReview(review);
    await onConfirmPayment(normalizedAllocation);
    setStep('edit');
  };

  const changeAllocationMode = (next: PaymentAllocationMode) => {
    setAllocationMode(next);
    if (next === 'FULL') {
      const remaining = currencyInputFromAmount(progress.remainingAmount);
      onAppliedAmount(remaining);
    } else {
      onAppliedAmount('');
    }
  };
  const payRemaining = () => {
    const remaining = currencyInputFromAmount(progress.remainingAmount);
    onAppliedAmount(remaining);
    setAllocationMode('FULL');
  };

  const title =
    step === 'review'
      ? copy('Confirm payment')
      : step === 'leave'
        ? copy('Payment is not finished')
        : copy('POS payment');

  const editFooter = (
    <PaymentEditFooter
      onCancel={requestClose}
      leavesPayment={hasRecordedMoney && !fullyPaid}
      collectsPayment={collectsPayment}
      canPay={canPay}
      onPay={() => setStep('review')}
      payAmountLabel={format(normalizedAllocation || '0')}
      canQueue={canQueue}
      isSubmitting={isSubmitting}
      onQueue={onQueue}
      instantOnly={instantOnly}
    />
  );

  const footer =
    step === 'review' ? (
      <PaymentReviewFooter
        canPay={canPay}
        isSubmitting={isSubmitting}
        completes={completes}
        onBack={() => setStep('edit')}
        onConfirm={() => void confirmPayment()}
      />
    ) : step === 'leave' ? (
      <PaymentLeaveFooter
        hasPending={hasPending}
        isSubmitting={isSubmitting}
        onQueueWithBalance={onQueueWithBalance}
        onContinue={() => setStep('edit')}
      />
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
        <PaymentReview {...shownReview} />
      ) : step === 'leave' ? (
        <PaymentLeaveNotice progress={progress} format={format} hasPending={hasPending} />
      ) : (
        <div className="grid min-h-0 gap-0 lg:h-[min(720px,calc(85dvh-5.5rem))] lg:grid-cols-[minmax(0,1fr)_440px] lg:overflow-hidden">
          <div className="min-h-0 space-y-3 overscroll-contain bg-[var(--color-surface)] p-4 lg:overflow-y-auto lg:border-r lg:border-[var(--color-border)] lg:pr-3">
            <PaymentOrderDetails
              lines={lines}
              gross={gross}
              locale={locale}
              format={format}
              {...(onEditOrder ? { onEditOrder } : {})}
              isSubmitting={isSubmitting}
            />

            {adjustmentSlot}

            {customer?.type === 'MEMBER' && (canRedeemLoyalty || loyalty.hasRedemption) ? (
              <PaymentLoyaltySection
                loyalty={loyalty}
                loyaltyPoints={loyaltyPoints}
                onLoyaltyPointsChange={onLoyaltyPointsChange}
                loyaltyPointBalance={loyaltyPointBalance}
                isLoyaltyBalanceLoading={isLoyaltyBalanceLoading}
                isLoyaltyMutating={isLoyaltyMutating}
                canRedeemLoyalty={canRedeemLoyalty}
                locale={locale}
                format={format}
              />
            ) : null}

            {/* Once money is recorded the transaction is already being paid now. */}
            {!hasRecordedMoney ? (
              <PaymentTimingSection
                instantOnly={instantOnly}
                payNow={payNow}
                onPayNowChange={onPayNowChange}
              >
                {collectsPayment ? (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <PaymentAllocationTabs
                      allocationMode={allocationMode}
                      onAllocationModeChange={changeAllocationMode}
                      remainingAmount={progress.remainingAmount}
                      appliedAmount={appliedAmount}
                      onAppliedAmount={onAppliedAmount}
                      amountScale={amountScale}
                      overAllocated={overAllocated}
                      intent={intent}
                      onPayRemaining={payRemaining}
                      partialLabel={copy('Split payment')}
                      format={format}
                    />
                  </div>
                ) : null}
              </PaymentTimingSection>
            ) : null}
          </div>

          <div className="max-lg:contents lg:sticky lg:top-0 lg:flex lg:h-full lg:min-h-0 lg:w-[440px] lg:min-w-[440px] lg:flex-col lg:self-stretch lg:overflow-hidden lg:bg-[var(--color-surface-muted)]/60">
            <div className="shrink-0 space-y-3 bg-[var(--color-surface-muted)]/60 p-4 pb-3 lg:overflow-y-hidden lg:[scrollbar-gutter:stable]">
              {customer ? (
                <PaymentCustomerSummary
                  customer={customer}
                  locale={locale}
                  loyaltyPointBalance={loyaltyPointBalance}
                  isLoyaltyBalanceLoading={isLoyaltyBalanceLoading}
                />
              ) : null}

              <PaymentTotalSummary
                total={total}
                saleTotal={sale?.totalAmount ?? total}
                gross={gross}
                discountAmount={discountAmount}
                discountLabel={discountLabel}
                taxAmount={taxAmount}
                taxLabel={taxLabel}
                hasLoyaltyRedemption={loyalty.hasRedemption}
                redeemedAmount={loyalty.redeemedAmount}
                progress={progress}
                hasPaymentActivity={hasPaymentActivity}
                hasRecordedMoney={hasRecordedMoney}
                fullyPaid={fullyPaid}
                format={format}
              />
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
                <PaymentMethodPanel
                  method={method}
                  onMethod={onMethod}
                  paymentRoutes={paymentRoutes}
                  isPaymentRoutesLoading={isPaymentRoutesLoading}
                  activeRoute={activeRoute}
                  routesForMethod={routesForMethod}
                  onPaymentRoute={onPaymentRoute}
                  hasPending={hasPending}
                  hasRecordedMoney={hasRecordedMoney}
                  paymentError={paymentError}
                >
                  {!isCash ? (
                    <PaymentReferenceField value={paymentReference} onChange={onPaymentReference} />
                  ) : (
                    <PaymentCashTender
                      allocation={normalizedAllocation}
                      allocationPositive={allocationPositive}
                      tender={tender}
                      normalizedTender={normalizedTender}
                      onTender={onTender}
                      quickTender={quickTender}
                      amountScale={amountScale}
                      cashShort={cashShort}
                      cashChange={cashChange}
                      format={format}
                    />
                  )}
                </PaymentMethodPanel>
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
