import { DInput, DSelect as Select } from '@digvation-labs/ui';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { RefundDisbursementInput } from '../../transaction/api/cashier-transaction.adapter';
import type { PaymentRoute } from '../../transaction/model/cashier-transaction.types';
import { money } from '../../transaction/model/sale-display';
import {
  REFUND_METHODS,
  refundRoutes,
  type RefundDisbursementDraft,
} from '../model/refund-disbursement-draft';

const accountLabel = (route: PaymentRoute) =>
  route.financialAccountCode
    ? `${route.financialAccountName} · ${route.financialAccountCode}`
    : route.financialAccountName;

/**
 * How a refund is returned: the operator chooses cash or bank transfer and the account the money
 * leaves from, with an optional reference and note. It is a manually recorded refund; nothing is
 * sent back through a payment provider.
 */
export function RefundDisbursementPicker({
  amount,
  routes,
  value,
  onChange,
  locale,
  disabled = false,
}: {
  amount: string;
  routes: readonly PaymentRoute[];
  value: RefundDisbursementDraft | null;
  onChange: (next: RefundDisbursementDraft) => void;
  locale: string;
  disabled?: boolean;
}) {
  const { copy, label } = useOperationalLocalization();
  const available = refundRoutes(routes);
  if (!available.length)
    return (
      <p className="text-sm text-[var(--color-danger)]" role="alert">
        {copy('No active cash or bank-transfer account is available for refunds at this location.')}
      </p>
    );
  const forMethod = available.filter((route) => route.paymentMethod === value?.method);
  const choose = (method: RefundDisbursementInput['method']) => {
    const route = available.find((entry) => entry.paymentMethod === method);
    if (route)
      onChange({
        method,
        paymentRouteId: route.id,
        externalReference: value?.externalReference ?? '',
        note: value?.note ?? '',
      });
  };
  return (
    <section aria-label={copy('Refund')} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-semibold text-[var(--color-text)]">{copy('Refund')}</p>
        <p className="font-semibold tabular-nums text-[var(--color-warning)]">
          {money(amount, locale)}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">
          {copy('Returned through')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {REFUND_METHODS.map((method) => {
            const selected = value?.method === method;
            return (
              <button
                key={method}
                type="button"
                aria-pressed={selected}
                disabled={disabled || !available.some((route) => route.paymentMethod === method)}
                onClick={() => choose(method)}
                className={`h-10 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/[.08] text-[var(--color-brand)] ring-1 ring-[var(--color-brand)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-brand)]/40'
                }`}
              >
                {label(method)}
              </button>
            );
          })}
        </div>
      </div>
      {value && forMethod.length ? (
        <Select
          label={copy('From account')}
          value={value.paymentRouteId}
          disabled={disabled}
          options={forMethod.map((route) => ({ value: route.id, label: accountLabel(route) }))}
          onChange={(next) => {
            if (typeof next === 'string') onChange({ ...value, paymentRouteId: next });
          }}
          className="w-full"
        />
      ) : null}
      {value ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <DInput
            label={copy('Reference (optional)')}
            value={value.externalReference}
            maxLength={160}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, externalReference: next })}
          />
          <DInput
            label={copy('Note (optional)')}
            value={value.note}
            maxLength={500}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, note: next })}
          />
        </div>
      ) : null}
      <p className="text-xs text-[var(--color-text-muted)]">
        {copy(
          'The refund is recorded manually: hand the money over yourself from the chosen account.',
        )}
      </p>
    </section>
  );
}
