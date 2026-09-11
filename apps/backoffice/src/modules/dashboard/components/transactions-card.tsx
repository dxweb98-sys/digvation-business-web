import { DCard } from '@digvation/ui';
import { ReceiptText } from 'lucide-react';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { useDashboardI18n } from '../dashboard-i18n';
import type { DashboardRow } from '../dashboard.types';
import { DashboardCardHeader } from './dashboard-card-header';

export function TransactionsCard({
  title,
  periodLabel,
  total,
  transactions,
  emptyMessage,
  formatDateTime,
  formatMoney,
  seeAllHref,
}: {
  title: string;
  periodLabel: string;
  total: number;
  transactions: readonly DashboardRow[];
  emptyMessage: string;
  formatDateTime(value: DashboardRow[string] | undefined): string;
  formatMoney(value: DashboardRow[string] | undefined): string;
  seeAllHref?: string;
}) {
  const { copy } = useBackofficeLocalization();
  const { locale, text } = useDashboardI18n();
  const integer = new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US');

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <DashboardCardHeader
        title={title}
        subtitle={`${integer.format(total)} ${text('transactions').toLowerCase()} · ${periodLabel}`}
        icon={<ReceiptText aria-hidden="true" className="size-4" />}
        actionHref={seeAllHref}
        tone="sky"
      />

      <div className="mt-3 space-y-0.5">
        {transactions.length ? (
          transactions.map((transaction, index) => {
            const transactionNumber = String(
              transaction.saleNumber ?? transaction.invoiceNumber ?? '—',
            );
            const occurredAt = formatDateTime(transaction.occurredAt);
            return (
              <div
                key={String(
                  transaction.saleNumber ?? transaction.invoiceNumber ?? index,
                )}
                className="flex items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <ReceiptText aria-hidden="true" className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className="truncate text-sm font-semibold text-[var(--color-text)]"
                      title={transactionNumber}
                    >
                      {transactionNumber}
                    </p>
                    <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {copy(String(transaction.saleStatus ?? '—'))}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-[10px] text-[var(--color-text-muted)]"
                    title={occurredAt}
                  >
                    {occurredAt}
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--color-text)]">
                  {formatMoney(transaction.total)}
                </p>
              </div>
            );
          })
        ) : (
          <div className="flex min-h-44 items-center justify-center text-center text-xs text-[var(--color-text-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </DCard>
  );
}
