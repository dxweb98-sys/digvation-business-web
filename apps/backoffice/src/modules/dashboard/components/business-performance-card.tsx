import { DCard } from '@digvation/ui';

import type { DashboardAnalyticsPoint } from '../dashboard.types';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pathFor(values: readonly number[]): string {
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

function pointPosition(values: readonly number[], index: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 100;
  const height = 36;
  const value = values[index] ?? 0;
  return {
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - ((value - min) / range) * (height - 6) - 3,
  };
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
  period,
  periodOptions,
  onPeriodChange,
  revenue,
  transactions,
  previousRevenue,
  previousTransactions,
  trend,
  formatMoney,
}: {
  title: string;
  period: string;
  periodOptions: readonly { value: string; label: string }[];
  onPeriodChange(value: string): void;
  revenue: number;
  transactions: number;
  previousRevenue: number;
  previousTransactions: number;
  trend: readonly DashboardAnalyticsPoint[];
  formatMoney(value: number): string;
}) {
  const revenueChange = change(revenue, previousRevenue);
  const transactionChange = change(transactions, previousTransactions);
  const revenueValues = trend.map((point) => numeric(point.value));
  const transactionValues = trend.map((point) => Number(point.count ?? 0));
  const revenuePath = pathFor(revenueValues);
  const transactionPath = pathFor(transactionValues);

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-32px_var(--color-text)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Revenue and transaction movement
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">Activity period</span>
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 pr-8 text-[11px] font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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

      <div className="mt-5 h-[156px] overflow-hidden rounded-xl bg-[linear-gradient(180deg,var(--color-surface-muted),transparent)] px-2 py-3">
        {trend.length ? (
          <svg
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={`${title} trend`}
          >
            {revenuePath ? (
              <path
                d={revenuePath}
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {transactionPath ? (
              <path
                d={transactionPath}
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {trend.length === 1 ? (
              <>
                {(() => {
                  const revenuePoint = pointPosition(revenueValues, 0);
                  const transactionPoint = pointPosition(transactionValues, 0);
                  return (
                    <>
                      <circle
                        cx={revenuePoint.x}
                        cy={revenuePoint.y}
                        r="1.7"
                        fill="var(--color-brand)"
                      />
                      <circle
                        cx={transactionPoint.x}
                        cy={transactionPoint.y}
                        r="1.5"
                        fill="var(--color-text-muted)"
                      />
                    </>
                  );
                })()}
              </>
            ) : null}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
            No activity data for this period.
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] font-medium text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-brand)]" />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-text-muted)]" />
          Transactions
        </span>
      </div>
    </DCard>
  );
}
