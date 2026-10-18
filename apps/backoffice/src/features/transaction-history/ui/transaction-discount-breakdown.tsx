import type { DiscountBreakdown } from '../model/transaction-adjustments';
import {
  ADJUSTMENT_SCOPE_LABELS,
  ADJUSTMENT_SOURCE_LABELS,
} from '../model/transaction-adjustments';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';

/** The adjustments behind the Discount row, as an indented explanation under it. */
export function TransactionDiscountBreakdown({
  breakdown,
  currency,
}: {
  breakdown: DiscountBreakdown;
  currency: string;
}) {
  const { copy, formatMoney, formatQuantity } = useTransactionHistoryLocalization();
  if (!breakdown.entries.length && !breakdown.promotionCode) return null;

  return (
    <div
      role="group"
      aria-label={copy('Applied discounts')}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-3 py-2.5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
        {copy('Applied discounts')}
      </p>
      <ul className="mt-1.5 space-y-2">
        {breakdown.entries.map(({ adjustment, itemName }) => {
          const value =
            adjustment.type === 'PERCENTAGE'
              ? `${formatQuantity(adjustment.configuredValue)}%`
              : null;
          const source = copy(ADJUSTMENT_SOURCE_LABELS[adjustment.source]);
          // A label that already says what it is (e.g. "Diskon manual") needs no repeated source.
          const meta = [
            adjustment.label.trim().toLowerCase() === source.toLowerCase() ? null : source,
            itemName ?? copy(ADJUSTMENT_SCOPE_LABELS[adjustment.scope]),
            value,
          ].filter(Boolean);
          return (
            <li key={adjustment.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-medium text-[var(--color-text)]">
                  {adjustment.label}
                </p>
                <p className="break-words text-xs text-[var(--color-text-muted)]">
                  {meta.join(' · ')}
                </p>
                {adjustment.reason?.trim() ? (
                  <p className="break-words text-xs text-[var(--color-text-muted)]">
                    {copy('Reason')}: {adjustment.reason.trim()}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 tabular-nums text-[var(--color-danger)]">
                −{formatMoney(adjustment.actualAmount, currency)}
              </span>
            </li>
          );
        })}
      </ul>
      {breakdown.promotionCode ? (
        <p className="mt-2 break-all text-xs text-[var(--color-text-muted)]">
          {copy('Promo code')}:{' '}
          <span className="font-mono text-[var(--color-text)]">{breakdown.promotionCode}</span>
        </p>
      ) : null}
    </div>
  );
}
