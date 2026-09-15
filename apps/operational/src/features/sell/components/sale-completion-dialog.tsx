import { createDecimal, formatMoney } from '@digvation/pos-money';
import {
  DButton,
  DCurrencyInput,
  DDecimalInput,
  DDialog,
  DInput,
  DSelect,
} from '@digvation-labs/ui';
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import type { DiscountInput } from '../cashier-transaction.adapter';
import type {
  DiscountType,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../cashier-transaction.types';
import { actionBlockMessage, type SaleWorkspaceViewModel } from '../sale-workspace-view-model';

interface SaleCompletionDialogProps {
  viewModel: SaleWorkspaceViewModel;
  locale: string;
  isBusy: boolean;
  onClose: () => void;
  onSetOrderDiscount: (input: Omit<DiscountInput, 'expectedVersion'>) => void;
  onClearOrderDiscount: () => void;
  onCreatePayment: (
    method: PaymentMethod,
    appliedAmount: string,
    tenderedAmount?: string,
    providerReference?: string,
  ) => void;
  onTransitionPayment: (payment: Payment, status: Exclude<PaymentStatus, 'PENDING'>) => void;
  onFinalize: () => void;
  onVoid: () => void;
}

function discountToFormValue(type: DiscountType, value: string | null): string {
  if (!value) return '';
  return type === 'PERCENTAGE' ? createDecimal(value).times(100).toFixed() : value;
}

function discountToApiValue(type: DiscountType, value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) return null;
  const decimal = createDecimal(trimmed);
  if (decimal.isNegative()) return null;
  if (type === 'PERCENTAGE') {
    if (decimal.greaterThan(100)) return null;
    return decimal.dividedBy(100).toFixed(18).replace(/0+$/, '').replace(/\.$/, '');
  }
  return trimmed;
}

export function SaleCompletionDialog({
  viewModel,
  locale,
  isBusy,
  onClose,
  onSetOrderDiscount,
  onClearOrderDiscount,
  onCreatePayment,
  onTransitionPayment,
  onFinalize,
  onVoid,
}: SaleCompletionDialogProps) {
  const sale = viewModel.sale;
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [appliedAmount, setAppliedAmount] = useState(viewModel.availableToPay);
  const [tenderedAmount, setTenderedAmount] = useState(viewModel.availableToPay);
  const [providerReference, setProviderReference] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>(
    sale?.orderDiscountType ?? 'PERCENTAGE',
  );
  const [discountValue, setDiscountValue] = useState(
    discountToFormValue(sale?.orderDiscountType ?? 'PERCENTAGE', sale?.orderDiscountValue ?? null),
  );
  const [discountReason, setDiscountReason] = useState(sale?.orderDiscountReason ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  if (!sale) return null;

  const paymentDisabled = viewModel.paymentMutation.state !== 'AVAILABLE' || isBusy;
  const monetaryDisabled = viewModel.monetaryMutation.state !== 'AVAILABLE' || isBusy;
  const finalizeDisabled = viewModel.finalizeMutation.state !== 'AVAILABLE' || isBusy;
  const voidDisabled = viewModel.voidMutation.state !== 'AVAILABLE' || isBusy;

  const createPayment = () => {
    setFormError(null);
    if (
      !/^\d+(?:\.\d{1,4})?$/.test(appliedAmount.trim()) ||
      createDecimal(appliedAmount).lessThanOrEqualTo(0)
    ) {
      setFormError('Payment amount must be greater than zero with at most four decimals.');
      return;
    }
    if (method === 'CASH') {
      if (!/^\d+(?:\.\d{1,4})?$/.test(tenderedAmount.trim())) {
        setFormError('Cash tendered amount is required.');
        return;
      }
      if (createDecimal(tenderedAmount).lessThan(createDecimal(appliedAmount))) {
        setFormError('Tendered cash cannot be below the applied amount.');
        return;
      }
    }
    onCreatePayment(
      method,
      appliedAmount.trim(),
      method === 'CASH' ? tenderedAmount.trim() : undefined,
      method === 'CASH' || providerReference.trim() === '' ? undefined : providerReference.trim(),
    );
  };

  const applyOrderDiscount = () => {
    setFormError(null);
    const value = discountToApiValue(discountType, discountValue);
    if (!value || discountReason.trim() === '') {
      setFormError('Order discount value and reason are required. Percentage uses 0â€“100%.');
      return;
    }
    onSetOrderDiscount({ type: discountType, value, reason: discountReason.trim() });
  };

  const completionMessage =
    viewModel.primaryMode === 'PAID_WORK_REMAINING'
      ? 'Payment complete Â· service work still needs attention.'
      : viewModel.primaryMode === 'READY_TO_FINALIZE'
        ? 'Domain readiness is complete. Finalization can be submitted.'
        : viewModel.primaryMode === 'FINALIZED'
          ? 'This Sale is finalized and immutable.'
          : viewModel.primaryMode === 'VOIDED'
            ? 'This Sale is voided and terminal.'
            : 'This workspace can stay open while payment and operational work progress independently.';

  return (
    <DDialog
      open
      onClose={onClose}
      ariaLabel="Sale Completion"
      overlayClassName="bg-slate-950/35"
      className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:rounded-[var(--radius-card)]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            Sale Completion
          </p>
          <h2 className="mt-2 text-xl font-bold">Sale {sale.id.slice(0, 8)}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{completionMessage}</p>
        </div>
        <DButton
          variant="ghost"
          aria-label="Close Sale Completion"
          onClick={onClose}
          className="px-3"
        >
          <X className="size-5" />
        </DButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-background)] p-4 sm:p-5">
        {formError ? (
          <div className="mb-5 rounded-[var(--radius-control)] bg-[var(--color-accent-coral)]/25 px-4 py-3 text-sm font-semibold">
            {formError}
          </div>
        ) : null}

        {sale.status === 'FINALIZED' || sale.status === 'VOIDED' ? (
          <div
            className={`mb-4 flex items-start gap-3 rounded-[var(--radius-card)] border p-4 ${
              sale.status === 'FINALIZED'
                ? 'border-[var(--color-success)]/25 bg-[var(--color-success)]/10'
                : 'border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10'
            }`}
          >
            {sale.status === 'FINALIZED' ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--color-success)]" />
            ) : (
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-[var(--color-danger)]" />
            )}
            <div>
              <p className="text-sm font-bold">
                {sale.status === 'FINALIZED' ? 'Sale finalized' : 'Sale voided'}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                {completionMessage}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="space-y-4">
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4" />
                <h3 className="font-bold">Payment</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Method
                  <DSelect
                    aria-label="Payment method"
                    value={method}
                    disabled={paymentDisabled}
                    clearable={false}
                    onChange={(value) => {
                      if (typeof value === 'string') setMethod(value as PaymentMethod);
                    }}
                    className="mt-1.5"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="WALLET">Wallet</option>
                    <option value="QRIS">QRIS</option>
                  </DSelect>
                </label>
                <label className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Applied amount
                  <DCurrencyInput
                    aria-label="Payment applied amount"
                    value={appliedAmount}
                    disabled={paymentDisabled}
                    onValueChange={setAppliedAmount}
                    className="mt-1.5"
                  />
                </label>
                {method === 'CASH' ? (
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] sm:col-span-2">
                    Tendered cash
                    <DCurrencyInput
                      aria-label="Cash tendered amount"
                      value={tenderedAmount}
                      disabled={paymentDisabled}
                      onValueChange={setTenderedAmount}
                      className="mt-1.5"
                    />
                  </label>
                ) : (
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] sm:col-span-2">
                    Provider reference (optional)
                    <DInput
                      aria-label="Payment provider reference"
                      value={providerReference}
                      disabled={paymentDisabled}
                      onChange={setProviderReference}
                      className="mt-1.5"
                    />
                  </label>
                )}
              </div>
              {viewModel.paymentMutation.state === 'DISABLED' ? (
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  {actionBlockMessage(viewModel.paymentMutation.reason)}
                </p>
              ) : null}
              <DButton className="mt-4 w-full" disabled={paymentDisabled} onClick={createPayment}>
                <Banknote className="mr-2 size-4" /> Add payment
              </DButton>
            </article>

            {sale.payments.length > 0 ? (
              <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="font-bold">Payment attempts</h3>
                <div className="mt-4 space-y-3">
                  {sale.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold">{payment.method.replace('_', ' ')}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {payment.status}
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums">
                          {formatMoney(payment.appliedAmount, sale.currency, locale)}
                        </p>
                      </div>
                      {payment.status === 'PENDING' && sale.status === 'OPEN' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <DButton
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => onTransitionPayment(payment, 'SUCCEEDED')}
                          >
                            Mark succeeded
                          </DButton>
                          <DButton
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => onTransitionPayment(payment, 'FAILED')}
                          >
                            Failed
                          </DButton>
                          <DButton
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => onTransitionPayment(payment, 'CANCELLED')}
                          >
                            Cancel
                          </DButton>
                          <DButton
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => onTransitionPayment(payment, 'EXPIRED')}
                          >
                            Expire
                          </DButton>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <h3 className="font-bold">Order discount</h3>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                One active ORDER discount is supported by backend v0.3.0.
              </p>
              <div className="mt-4 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                <DSelect
                  aria-label="Order discount type"
                  value={discountType}
                  disabled={monetaryDisabled}
                  clearable={false}
                  onChange={(value) => {
                    if (typeof value !== 'string') return;
                    setDiscountType(value as DiscountType);
                    setDiscountValue('');
                  }}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed amount</option>
                </DSelect>
                <DDecimalInput
                  aria-label="Order discount value"
                  value={discountValue}
                  disabled={monetaryDisabled}
                  onValueChange={setDiscountValue}
                  placeholder={discountType === 'PERCENTAGE' ? '10 (%)' : '50000'}
                />
              </div>
              <DInput
                aria-label="Order discount reason"
                value={discountReason}
                disabled={monetaryDisabled}
                onChange={setDiscountReason}
                placeholder="Reason"
                className="mt-2"
              />
              <div className="mt-4 flex gap-2">
                <DButton
                  variant="secondary"
                  disabled={monetaryDisabled}
                  onClick={applyOrderDiscount}
                >
                  Apply order discount
                </DButton>
                {sale.orderDiscountType ? (
                  <DButton
                    variant="ghost"
                    disabled={monetaryDisabled}
                    onClick={onClearOrderDiscount}
                  >
                    Remove
                  </DButton>
                ) : null}
              </div>
            </article>
          </div>

          <aside className="space-y-4">
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <h3 className="font-bold">Settlement</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-text-muted)]">Sale total</dt>
                  <dd className="font-bold tabular-nums">
                    {formatMoney(sale.totalAmount, sale.currency, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-text-muted)]">Paid</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(viewModel.paidAmount, sale.currency, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-text-muted)]">Pending</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(viewModel.pendingAmount, sale.currency, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-3 text-base">
                  <dt className="font-bold">Available to pay</dt>
                  <dd className="font-bold tabular-nums">
                    {formatMoney(viewModel.availableToPay, sale.currency, locale)}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                {viewModel.domainReadiness.ready ? (
                  <BadgeCheck className="size-4 text-[var(--color-success)]" />
                ) : (
                  <CircleAlert className="size-4 text-[var(--color-warning)]" />
                )}
                <h3 className="font-bold">Domain readiness</h3>
              </div>
              {viewModel.domainReadiness.ready ? (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  Exact settlement and operational requirements are ready for backend finalization.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {viewModel.domainReadiness.blockers.map((blocker, index) => (
                    <li
                      key={`${blocker.code}-${blocker.saleLineId ?? index}`}
                      className="flex gap-2 text-[var(--color-text-muted)]"
                    >
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {blocker.message}
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <h3 className="font-bold">Complete Sale</h3>
              {viewModel.finalizeMutation.state === 'DISABLED' ? (
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                  {actionBlockMessage(viewModel.finalizeMutation.reason)}
                </p>
              ) : null}
              <DButton className="mt-4 w-full" disabled={finalizeDisabled} onClick={onFinalize}>
                <CheckCircle2 className="mr-2 size-4" /> Finalize Sale
              </DButton>
              <DButton
                variant="ghost"
                className="mt-2 w-full text-[var(--color-danger)]"
                disabled={voidDisabled}
                onClick={onVoid}
              >
                <Trash2 className="mr-2 size-4" /> Void unpaid Sale
              </DButton>
              {viewModel.voidMutation.state === 'DISABLED' ? (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {actionBlockMessage(viewModel.voidMutation.reason)}
                </p>
              ) : null}
            </article>

            {viewModel.synchronization !== 'CLEAN' ? (
              <article className="rounded-[var(--radius-card)] bg-[var(--color-accent-yellow)]/30 p-4 text-sm">
                <div className="flex items-center gap-2 font-bold">
                  <RefreshCcw className="size-4" /> Synchronization attention
                </div>
                <p className="mt-2 text-[var(--color-text-muted)]">{viewModel.synchronization}</p>
              </article>
            ) : null}
          </aside>
        </div>
      </div>
    </DDialog>
  );
}
