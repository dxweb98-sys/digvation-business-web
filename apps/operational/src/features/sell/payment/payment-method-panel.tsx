import { createDecimal } from '@digvation/pos-money';
import { DAlert, DInput, DSelect as Select } from '@digvation-labs/ui';
import { Banknote, CreditCard, QrCode, ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { normalizeCurrencyPaymentInput, PosCurrencyInput } from '../lib/pos-controls';
import type { PaymentMethod, PaymentRoute } from '../transaction/model/cashier-transaction.types';
import { isPositiveDecimal } from '../transaction/model/sale-display';

type Format = (amount: string) => string;

const paymentMethodOptions: Array<{ value: PaymentMethod; icon: ReactNode }> = [
  { value: 'CASH', icon: <Banknote className="size-[15px]" /> },
  { value: 'BANK_TRANSFER', icon: <CreditCard className="size-[15px]" /> },
  { value: 'QRIS', icon: <QrCode className="size-[15px]" /> },
  { value: 'WALLET', icon: <ShoppingBag className="size-[15px]" /> },
];

/**
 * The next payment's method and settlement account. `children` holds what the method needs next:
 * a reference for non-cash payments, or the cash received.
 */
export function PaymentMethodPanel({
  method,
  onMethod,
  paymentRoutes,
  isPaymentRoutesLoading,
  activeRoute,
  routesForMethod,
  onPaymentRoute,
  hasPending,
  hasRecordedMoney,
  paymentError,
  children,
}: {
  method: PaymentMethod;
  onMethod: (method: PaymentMethod) => void;
  paymentRoutes: readonly PaymentRoute[];
  isPaymentRoutesLoading: boolean;
  activeRoute: PaymentRoute | null;
  routesForMethod: readonly PaymentRoute[];
  onPaymentRoute: (paymentRouteId: string) => void;
  hasPending: boolean;
  hasRecordedMoney: boolean;
  paymentError: string | null;
  children: ReactNode;
}) {
  const { copy, label } = useOperationalLocalization();
  return (
    <div className="pos-pay-section p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--color-text)]">{copy('Payment method')}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-success)]">
          <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
          {copy('Ready to pay')}
        </span>
      </div>
      {hasRecordedMoney ? <p className="pos-pay-eyebrow mb-3">{copy('Next payment')}</p> : null}
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
        {paymentMethodOptions.map((option) => {
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
      {children}
    </div>
  );
}

/** Optional reference of a non-cash payment, such as a transfer or QRIS reference. */
export function PaymentReferenceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (reference: string) => void;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="mt-3">
      <DInput
        aria-label={copy('Payment reference')}
        label={copy('Payment reference')}
        value={value}
        onChange={onChange}
        placeholder={copy('Optional reference')}
        className="w-full"
      />
    </div>
  );
}

/** Cash received for the next payment, with quick amounts and the resulting change or shortfall. */
export function PaymentCashTender({
  allocation,
  allocationPositive,
  tender,
  normalizedTender,
  onTender,
  quickTender,
  amountScale,
  cashShort,
  cashChange,
  format,
}: {
  /** Normalized amount this payment applies to the Sale. */
  allocation: string;
  allocationPositive: boolean;
  tender: string;
  normalizedTender: string;
  onTender: (amount: string) => void;
  quickTender: readonly string[];
  amountScale: number;
  cashShort: boolean;
  cashChange: string;
  format: Format;
}) {
  const { copy } = useOperationalLocalization();
  const normalizedQuickTender = [allocation, ...quickTender]
    .map((amount) => normalizeCurrencyPaymentInput(amount))
    .filter(isPositiveDecimal)
    .filter((amount, index, list) => list.indexOf(amount) === index)
    .slice(0, 6);
  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{copy('Cash received')}</span>
        <button
          type="button"
          disabled={!allocationPositive}
          onClick={() => onTender(allocation)}
          className="rounded-full bg-[var(--color-brand)]/[.08] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/[.14] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copy('Exact amount')} {format(allocation || '0')}
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
          .filter((amount) => amount !== allocation)
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
        <span className="text-sm font-bold">{copy(cashShort ? 'Payment short' : 'Change')}</span>
        <span className="text-base font-bold tabular-nums">
          {format(
            cashShort
              ? createDecimal(allocation)
                  .minus(createDecimal(normalizedTender || '0'))
                  .toFixed(4)
              : cashChange,
          )}
        </span>
      </div>
    </div>
  );
}
