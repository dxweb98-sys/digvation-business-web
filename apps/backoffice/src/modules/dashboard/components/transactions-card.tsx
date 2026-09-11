import { DCard } from '@digvation/ui';
import { ReceiptText } from 'lucide-react';

import type { DashboardRow } from '../dashboard.types';

export function TransactionsCard({
  title,
  periodLabel,
  total,
  transactions,
  emptyMessage,
  formatDateTime,
  formatMoney,
}: {
  title: string;
  periodLabel: string;
  total: number;
  transactions: readonly DashboardRow[];
  emptyMessage: string;
  formatDateTime(value: DashboardRow[string] | undefined): string;
  formatMoney(value: DashboardRow[string] | undefined): string;
}) {
  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-brand)]">
            <ReceiptText aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              {total.toLocaleString('id-ID')} transactions
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">
          {periodLabel}
        </span>
      </div>

      <div className="mt-4 space-y-0.5">
        {transactions.length ? (
          transactions.map((transaction, index) => (
            <div
              key={String(
                transaction.saleNumber ?? transaction.invoiceNumber ?? index,
              )}
              className="flex items-center gap-3 border-b border-[var(--color-border)] px-1 py-2.5 last:border-b-0"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-brand)]">
                <ReceiptText aria-hidden="true" className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-medium">
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
              <p className="shrink-0 text-sm font-semibold tabular-nums">
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
