import type { ReactNode } from 'react';

import type { Sale } from '../api/transaction-history-api';

/** Authoritative Runtime totals; nothing here is recalculated. */
export function TransactionFinancialSummary({
  sale,
  copy,
  formatMoney,
  formatQuantity = (value) => value,
  discountDetails,
}: {
  sale: Sale;
  copy: (value: string) => string;
  formatMoney: (amount: string, currency: string) => string;
  formatQuantity?: (value: string) => string;
  /** Explains the Discount row; never adds to it. */
  discountDetails?: ReactNode;
}) {
  const loyaltyLabel = sale.loyaltyRedemption
    ? `${copy('Loyalty redemption')} (${formatQuantity(sale.loyaltyRedemption.points)} ${copy('points')})`
    : null;

  return (
    <dl className="space-y-2.5 text-sm" aria-label={copy('Charges')}>
      <FinancialRow label={copy('Subtotal')} value={formatMoney(sale.grossAmount, sale.currency)} />
      <FinancialRow
        label={copy('Discount')}
        value={
          /[1-9]/.test(sale.discountAmount)
            ? `−${formatMoney(sale.discountAmount, sale.currency)}`
            : formatMoney(sale.discountAmount, sale.currency)
        }
        muted={/[1-9]/.test(sale.discountAmount)}
      />
      {discountDetails}
      {loyaltyLabel ? (
        <FinancialRow
          label={loyaltyLabel}
          value={`−${formatMoney(sale.loyaltyRedemption!.amount, sale.currency)}`}
          muted
        />
      ) : null}
      <FinancialRow label={copy('Tax')} value={formatMoney(sale.taxAmount, sale.currency)} />
      <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-2.5 font-semibold text-[var(--color-text)]">
        <dt>{copy('Total')}</dt>
        <dd className="tabular-nums">{formatMoney(sale.totalAmount, sale.currency)}</dd>
      </div>
    </dl>
  );
}

function FinancialRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={
          muted ? 'font-medium tabular-nums text-[var(--color-danger)]' : 'font-medium tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  );
}
