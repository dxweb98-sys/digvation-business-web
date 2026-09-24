import type { Sale } from './transaction-history-api';

export function TransactionFinancialSummary({
  sale,
  copy,
  formatMoney,
}: {
  sale: Sale;
  copy: (value: string) => string;
  formatMoney: (amount: string, currency: string) => string;
}) {
  const loyaltyLabel = sale.loyaltyRedemption
    ? `${copy('Loyalty redemption')} (${sale.loyaltyRedemption.points} ${copy('points')})`
    : null;

  return (
    <section aria-label={copy('Summary')}>
      <h3 className="text-base font-semibold">{copy('Summary')}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <FinancialRow
          label={copy('Subtotal')}
          value={formatMoney(sale.grossAmount, sale.currency)}
        />
        <FinancialRow
          label={copy('Discount')}
          value={`−${formatMoney(sale.discountAmount, sale.currency)}`}
          muted
        />
        {loyaltyLabel ? (
          <FinancialRow
            label={loyaltyLabel}
            value={`−${formatMoney(sale.loyaltyRedemption!.amount, sale.currency)}`}
            muted
          />
        ) : null}
        <FinancialRow label={copy('Tax')} value={formatMoney(sale.taxAmount, sale.currency)} />
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-3 text-base font-semibold text-[var(--color-text)]">
          <dt>{copy('Total')}</dt>
          <dd className="tabular-nums">{formatMoney(sale.totalAmount, sale.currency)}</dd>
        </div>
      </dl>
    </section>
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
