import { DCard } from '@digvation/ui';
import { ReceiptText } from 'lucide-react';

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
  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <DashboardCardHeader
        title={title}
        subtitle={`${total.toLocaleString('id-ID')} transactions · ${periodLabel}`}
        icon={<ReceiptText aria-hidden="true" className="size-4" />}
        actionHref={seeAllHref}
      />

      <div className="mt-3 space-y-0.5">
        {transactions.length ? (
          transactions.map((transaction, index) => (
            <div
              key={String(
                transaction.saleNumber ?? transaction.invoiceNumber ?? index,
              )}
              className="flex items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-sky)] text-[var(--color-brand)]">
                <ReceiptText aria-hidden="true" className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {String(
                      transaction.saleNumber ?? transaction.invoiceNumber ?? '—',
                    )}
                  </p>
                  <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {String(transaction.saleStatus ?? '—')}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-muted)]">
                  {formatDateTime(transaction.occurredAt)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">
                {formatMoney(transaction.total)}
              </p>
            </div>
          ))
        ) : (
          <div className="flex min-h-44 items-center justify-center text-center text-xs text-[var(--color-text-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </DCard>
  );
}
