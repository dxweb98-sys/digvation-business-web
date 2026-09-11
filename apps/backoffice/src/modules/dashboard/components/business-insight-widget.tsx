import { DCard } from '@digvation/ui';
import { Lightbulb } from 'lucide-react';

import type { DashboardDataset } from '../dashboard.types';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function BusinessInsightWidget({
  current,
  previous,
  currency = 'IDR',
  formatMoney,
}: {
  current: DashboardDataset | undefined;
  previous: DashboardDataset | undefined;
  currency?: string;
  formatMoney(value: string, currency: string): string;
}) {
  const revenue = numeric(current?.summary.finalRevenue);
  const transactions = numeric(current?.summary.transactionCount);
  const average = numeric(current?.summary.averageTransactionValue);
  const previousRevenue = numeric(previous?.summary.finalRevenue);
  const previousTransactions = numeric(previous?.summary.transactionCount);
  const revenueChange = change(revenue, previousRevenue);
  const transactionChange = change(transactions, previousTransactions);
  const paymentPoints = [
    ...(current?.analytics.breakdowns?.paymentMethod ??
      current?.analytics.breakdown ??
      []),
  ];
  paymentPoints.sort((a, b) => numeric(b.value) - numeric(a.value));
  const dominantPayment = paymentPoints[0];

  const insights = [
    revenueChange === null
      ? revenue > 0
        ? `Revenue reached ${formatMoney(String(revenue), currency)} with no comparable revenue in the previous period.`
        : 'No revenue activity was recorded this month.'
      : `Revenue is ${Math.abs(revenueChange).toFixed(1)}% ${revenueChange >= 0 ? 'higher' : 'lower'} than the previous month.`,
    transactionChange === null
      ? transactions > 0
        ? `${transactions.toLocaleString('id-ID')} transactions were recorded while the previous month had none.`
        : 'No transactions were recorded in either comparison month.'
      : `Transaction volume is ${Math.abs(transactionChange).toFixed(1)}% ${transactionChange >= 0 ? 'higher' : 'lower'} than the previous month.`,
    transactions > 0
      ? `Average transaction value is ${formatMoney(String(average), currency)}.`
      : null,
    dominantPayment
      ? `${dominantPayment.label} is the leading payment method this month.`
      : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-mint)] text-[var(--color-brand)]">
          <Lightbulb aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Business insight</h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            This month compared with the previous month
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => (
          <div
            key={insight}
            className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-3 text-xs leading-5 text-[var(--color-text-muted)]"
          >
            {insight}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-4 text-[var(--color-text-muted)]">
        Generated from report aggregates only. No external AI request or model cost is used.
      </p>
    </DCard>
  );
}
