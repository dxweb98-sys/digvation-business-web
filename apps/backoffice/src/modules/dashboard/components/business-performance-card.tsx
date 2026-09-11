import { DCard } from '@digvation/ui';
import { ChartNoAxesCombined } from 'lucide-react';

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
  const height = 40;

  return values
    .map((value, index) => {
      const x =
        values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 10) - 5;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function areaFor(values: readonly number[]): string {
  const line = pathFor(values);
  if (!line) return '';
  const firstX = values.length === 1 ? 50 : 0;
  const lastX = values.length === 1 ? 50 : 100;
  return `${line} L ${lastX} 40 L ${firstX} 40 Z`;
}

function pointPosition(values: readonly number[], index: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 100;
  const height = 40;
  const value = values[index] ?? 0;
  return {
    x:
      values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - ((value - min) / range) * (height - 10) - 5,
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
        'rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
        value >= 0
          ? 'bg-[var(--color-accent-mint)] text-[var(--color-brand)]'
          : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
      ].join(' ')}
    >
      {value >= 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

function axisLabels(trend: readonly DashboardAnalyticsPoint[]): string[] {
  if (!trend.length) return [];
  if (trend.length <= 3) return trend.map((point) => point.label);
  const middle = Math.floor((trend.length - 1) / 2);
  return [trend[0]!.label, trend[middle]!.label, trend[trend.length - 1]!.label];
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
  const revenueArea = areaFor(revenueValues);
  const transactionPath = pathFor(transactionValues);
  const labels = axisLabels(trend);

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-32px_var(--color-text)] sm:p-6"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-mint)] text-[var(--color-brand)]">
            <ChartNoAxesCombined aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Revenue and transaction movement for the selected branch
            </p>
          </div>
        </div>

        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[var(--color-surface-muted)] p-1">
          {periodOptions.map((option) => {
            const active = period === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={[
                  'shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors',
                  active
                    ? 'bg-[var(--color-brand)] text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--color-brand)]" />
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Revenue
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {formatMoney(revenue)}
            </p>
            <Delta value={revenueChange} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--color-text-muted)]" />
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Transactions
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {new Intl.NumberFormat('id-ID').format(transactions)}
            </p>
            <Delta value={transactionChange} />
          </div>
        </div>
      </div>

      <div className="relative mt-5 min-h-[250px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 pb-8 pt-4 sm:min-h-[280px]">
        <div className="pointer-events-none absolute inset-x-3 bottom-8 top-4 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((line) => (
            <span
              key={line}
              className="block border-t border-dashed border-[var(--color-border)]"
            />
          ))}
        </div>

        {trend.length ? (
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="relative z-10 h-[210px] w-full overflow-visible sm:h-[235px]"
            role="img"
            aria-label={`${title} trend`}
          >
            <defs>
              <linearGradient id="dashboardRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {revenueArea ? <path d={revenueArea} fill="url(#dashboardRevenueArea)" /> : null}
            {revenuePath ? (
              <path
                d={revenuePath}
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="1.7"
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
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
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
                        r="1.8"
                        fill="var(--color-brand)"
                      />
                      <circle
                        cx={transactionPoint.x}
                        cy={transactionPoint.y}
                        r="1.6"
                        fill="var(--color-text-muted)"
                      />
                    </>
                  );
                })()}
              </>
            ) : null}
          </svg>
        ) : (
          <div className="relative z-10 flex h-[210px] items-center justify-center text-center text-xs text-[var(--color-text-muted)] sm:h-[235px]">
            No activity has been recorded for this period yet.
          </div>
        )}

        {labels.length ? (
          <div className="absolute inset-x-4 bottom-2 flex items-center justify-between text-[9px] text-[var(--color-text-muted)]">
            {labels.map((label, index) => (
              <span key={`${label}:${index}`}>{label}</span>
            ))}
          </div>
        ) : null}
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
