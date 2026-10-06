import { createDecimal } from '@digvation/pos-money';
import { DAlert, DButton, DButton as Button, DDialog as Dialog, DInput } from '@digvation-labs/ui';
import { Banknote, CreditCard, QrCode, ShoppingBag } from 'lucide-react';
import { type ReactNode } from 'react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { paymentIntent, paymentProgress } from '../transaction/model/sale-presentation';
import type {
  Payment,
  PaymentMethod,
  PaymentRoute,
  Sale,
} from '../transaction/model/cashier-transaction.types';
import {
  amountFractionDigits,
  currencyInputFromAmount,
  normalizeCurrencyPaymentInput,
  PosCurrencyInput,
} from '../lib/pos-controls';
import {
  PaymentIntentHint,
  PaymentProgressSummary,
  PaymentReview,
  RecordedPaymentList,
} from './payment-confirmation';
import { type TerminalPaymentStatus, hasSuccessfulPayment } from './sale-payment-status';
import { money, transactionNumber, isPositiveDecimal } from '../transaction/model/sale-display';
import { usePaymentDialogStep } from './payment-dialog-state';

export function ReferenceBalancePaymentDialog({
  sale,
  availableToPay,
  locale,
  paymentRoutes,
  isPaymentRoutesLoading,
  method,
  paymentRouteId,
  appliedAmount,
  paymentReference,
  tender,
  isMutating,
  paymentError,
  onClose,
  onMethod,
  onPaymentRoute,
  onAppliedAmount,
  onPaymentReference,
  onTender,
  onTransitionPayment,
  onPay,
}: {
  sale: Sale | null;
  availableToPay: string | null;
  locale: string;
  paymentRoutes: readonly PaymentRoute[];
  isPaymentRoutesLoading: boolean;
  method: PaymentMethod;
  paymentRouteId: string;
  appliedAmount: string;
  paymentReference: string;
  tender: string;
  isMutating: boolean;
  paymentError: string | null;
  onClose: () => void;
  onMethod: (method: PaymentMethod) => void;
  onPaymentRoute: (paymentRouteId: string) => void;
  onAppliedAmount: (amount: string) => void;
  onPaymentReference: (reference: string) => void;
  onTender: (amount: string) => void;
  onTransitionPayment: (payment: Payment, status: TerminalPaymentStatus) => void;
  /** Sends the confirmed payment to Runtime. Resolves once Runtime has answered. */
  onPay: () => Promise<void>;
}) {
  const { copy, label } = useOperationalLocalization();
  const [step, setStep] = usePaymentDialogStep(sale !== null);
  const routesForMethod = paymentRoutes.filter((route) => route.paymentMethod === method);
  const activeRoute =
    routesForMethod.find((route) => route.id === paymentRouteId) ?? routesForMethod[0] ?? null;
  if (!sale) return null;

  const format = (amount: string) => money(amount, locale);
  const progress = paymentProgress(sale);
  const remainingToAllocate = availableToPay ?? progress.remainingAmount;
  const amountScale = amountFractionDigits(remainingToAllocate);
  const normalizedAllocation = appliedAmount
    ? normalizeCurrencyPaymentInput(appliedAmount)
    : currencyInputFromAmount(remainingToAllocate);
  const intent = paymentIntent(sale, normalizedAllocation);
  const allocationPositive = isPositiveDecimal(normalizedAllocation);
  const overAllocated =
    allocationPositive &&
    createDecimal(normalizedAllocation).greaterThan(createDecimal(remainingToAllocate));
  const hasPending = sale.payments.some((payment) => payment.status === 'PENDING');
  const isCash = method === 'CASH';
  const normalizedTender = normalizeCurrencyPaymentInput(tender || normalizedAllocation);
  const cashShort =
    isCash &&
    allocationPositive &&
    createDecimal(normalizedTender).lessThan(createDecimal(normalizedAllocation));
  const cashChange =
    isCash && allocationPositive && !cashShort
      ? createDecimal(normalizedTender).minus(createDecimal(normalizedAllocation)).toFixed(4)
      : '0';
  const canPay =
    allocationPositive &&
    !overAllocated &&
    !hasPending &&
    Boolean(activeRoute) &&
    !cashShort &&
    !isMutating;
  const completes = intent.outcome !== 'LEAVES_BALANCE';
  const methods: Array<{ value: PaymentMethod; icon: ReactNode }> = [
    { value: 'CASH', icon: <Banknote className="size-4" /> },
    { value: 'BANK_TRANSFER', icon: <CreditCard className="size-4" /> },
    { value: 'QRIS', icon: <QrCode className="size-4" /> },
    { value: 'WALLET', icon: <ShoppingBag className="size-4" /> },
  ];
  // The transaction stays in the queue with its balance, so closing needs no guard.
  const requestClose = () => {
    if (isMutating) return;
    if (step === 'review') {
      setStep('edit');
      return;
    }
    onClose();
  };
  const confirmPayment = async () => {
    await onPay();
    setStep('edit');
  };

  return (
    <Dialog
      open
      onClose={requestClose}
      title={
        step === 'review'
          ? copy('Confirm payment')
          : copy(hasSuccessfulPayment(sale) ? 'Pay balance' : 'Pay')
      }
      description={transactionNumber(sale, locale)}
      ariaLabel={copy('Payment')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        step === 'review' ? (
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <DButton variant="outline" disabled={isMutating} onClick={() => setStep('edit')}>
              {copy('Back to edit')}
            </DButton>
            <DButton
              disabled={!canPay && !isMutating}
              loading={isMutating}
              onClick={() => void confirmPayment()}
            >
              {copy(completes ? 'Confirm and complete' : 'Confirm payment')}
            </DButton>
          </div>
        ) : (
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="ghost" onClick={requestClose}>
              {copy('Close')}
            </Button>
            <Button disabled={!canPay} onClick={() => setStep('review')}>
              {copy('Pay')} {format(normalizedAllocation || '0')}
            </Button>
          </div>
        )
      }
    >
      {step === 'review' ? (
        <PaymentReview
          intent={intent}
          total={sale.totalAmount}
          methodName={label(method)}
          accountName={activeRoute?.financialAccountName ?? label(method)}
          {...(!isCash && paymentReference.trim() ? { reference: paymentReference.trim() } : {})}
          {...(isCash ? { tendered: normalizedTender, change: cashChange } : {})}
          earlierPayments={sale.payments}
          format={format}
          confirmReceived={!isCash}
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <PaymentProgressSummary total={sale.totalAmount} progress={progress} format={format} />

          <RecordedPaymentList
            payments={sale.payments}
            totalAmount={sale.totalAmount}
            progress={progress}
            format={format}
            isMutating={isMutating}
            onTransition={onTransitionPayment}
          />

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            {sale.payments.length ? (
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {copy('Next payment')}
              </p>
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
            <label className="block text-sm font-medium">
              {copy('Payment amount')}
              <PosCurrencyInput
                aria-label={copy('Payment amount')}
                className="mt-1.5 h-11 rounded-lg text-right text-lg font-bold"
                value={appliedAmount}
                onChange={onAppliedAmount}
                fractionDigits={amountScale}
              />
            </label>
            {overAllocated ? (
              <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
                {copy('Payment allocation cannot exceed the remaining amount.')} {copy('Remaining')}
                : {format(remainingToAllocate)}
              </p>
            ) : (
              <div className="mt-2">
                <PaymentIntentHint
                  intent={intent}
                  format={format}
                  onPayRemaining={() =>
                    onAppliedAmount(currencyInputFromAmount(remainingToAllocate))
                  }
                />
              </div>
            )}

            <p className="mt-4 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {copy('Payment method')}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {methods.map((option) => {
                const routeAvailable = paymentRoutes.some(
                  (route) => route.paymentMethod === option.value,
                );
                const disabled = isPaymentRoutesLoading || !routeAvailable || hasPending;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={method === option.value}
                    onClick={() => onMethod(option.value)}
                    className={`flex h-11 items-center justify-center gap-1 rounded-xl border text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${method === option.value ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'}`}
                  >
                    {option.icon}
                    <span className="pos-payment-method-label">{label(option.value)}</span>
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
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {copy('Settlement account')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {routesForMethod.map((route) => (
                    <button
                      key={route.id}
                      type="button"
                      aria-pressed={activeRoute.id === route.id}
                      onClick={() => onPaymentRoute(route.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${activeRoute.id === route.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10' : 'border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 hover:bg-[var(--color-surface-muted)]'}`}
                    >
                      <span className="block truncate text-sm font-semibold">
                        {route.financialAccountName}
                      </span>
                      {route.financialAccountCode ? (
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--color-text-muted)]">
                          {route.financialAccountCode}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!isCash ? (
              <DInput
                aria-label={copy('Payment reference')}
                label={copy('Payment reference')}
                value={paymentReference}
                onChange={onPaymentReference}
                placeholder={copy('Optional reference')}
                className="mt-3"
              />
            ) : null}
          </div>

          {isCash ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <label className="block text-sm font-medium">
                {copy('Cash received')}
                <PosCurrencyInput
                  aria-label={copy('Cash received')}
                  className="mt-1.5 h-11 rounded-lg text-right text-lg font-bold"
                  value={tender}
                  onChange={onTender}
                  fractionDigits={amountScale}
                />
              </label>
              <div
                className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 ${cashShort ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'}`}
              >
                <span className="text-sm font-bold">
                  {copy(cashShort ? 'Payment short' : 'Change')}
                </span>
                <span className="text-sm font-bold tabular-nums">
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
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
