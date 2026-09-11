import { DCard } from '@digvation/ui';

import type { DashboardAnalyticsPoint } from '../dashboard.types';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pathFor(points: readonly DashboardAnalyticsPoint[]): string {
  const values = points.map((point) => numeric(point.value));
  if (!values.length) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 100;
  const height = 36;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <span
      className={[
        'rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold tabular-nums',
        value >= 0
          ? 'text-[var(--color-brand)]'
          : 'text-[var(--color-text-muted)]',
      ].join(' ')}
    >
      {value >= 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function BusinessPerformanceCard({
  title,
  periodLabel,
  revenue,
  transactions,
  previousRevenue,
  previousTransactions,
  trend,
  formatMoney,
}: {
  title: string;
  periodLabel: string;
  revenue: number;
  transactions: number;
  previousRevenue: number;
  previousTransactions: number;
  trend: readonly DashboardAnalyticsPoint[];
  formatMoney(value: number): string;
}) {
  const revenueChange = change(revenue, previousRevenue);
  const transactionChange = change(transactions, previousTransactions);
  const path = pathFor(trend);

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-32px_var(--color-text)] sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
          {periodLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--color-surface-muted)] p-3">
          <p className="text-[11px] text-[var(--color-text-muted)]">Revenue</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-tight tabular-nums">
              {formatMoney(revenue)}
            </p>
            <Delta value={revenueChange} />
          </div>
        </div>
        <div className="rounded-xl bg-[var(--color-surface-muted)] p-3">
          <p className="text-[11px] text-[var(--color-text-muted)]">Transactions</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-tight tabular-nums">
              {new Intl.NumberFormat('id-ID').format(transactions)}
            </p>
            <Delta value={transactionChange} />
          </div>
        </div>
      </div>

      <div className="mt-5 h-[138px] overflow-hidden rounded-xl bg-[linear-gradient(180deg,var(--color-surface-muted),transparent)] px-2 py-3">
        {path ? (
          <svg
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={`${title} trend`}
          >
            <path
              d={path}
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
            No trend data for this period.
          </div>
        )}
      </div>
    </DCard>
  );
}
