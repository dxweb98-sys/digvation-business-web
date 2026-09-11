import { DCard } from '@digvation/ui';
import { ChartNoAxesCombined } from 'lucide-react';

import type { DashboardAnalyticsPoint } from '../dashboard.types';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pointCoordinates(values: readonly number[]) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  return values.map((value, index) => ({
    x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100,
    y: 38 - ((value - min) / range) * 28 - 5,
  }));
}

function smoothPath(values: readonly number[]): string {
  const points = pointCoordinates(values);
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let path = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const controlX = (previous.x + current.x) / 2;
    path += ` C ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlX.toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }
  return path;
}

function areaPath(values: readonly number[]): string {
  const path = smoothPath(values);
  const points = pointCoordinates(values);
  if (!path || !points.length) return '';
  return `${path} L ${points[points.length - 1]!.x.toFixed(2)} 40 L ${points[0]!.x.toFixed(2)} 40 Z`;
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
  const revenuePath = smoothPath(revenueValues);
  const revenueArea = areaPath(revenueValues);
  const transactionPath = smoothPath(transactionValues);
  const labels = axisLabels(trend);

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)] sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-mint)] text-[var(--color-brand)]">
            <ChartNoAxesCombined aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Revenue and transaction movement
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

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Revenue
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[24px] font-semibold tracking-tight tabular-nums">
              {formatMoney(revenue)}
            </p>
            <Delta value={revenueChange} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Transactions
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[24px] font-semibold tracking-tight tabular-nums">
              {new Intl.NumberFormat('id-ID').format(transactions)}
            </p>
            <Delta value={transactionChange} />
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-[200px] overflow-hidden rounded-2xl bg-[linear-gradient(180deg,var(--color-surface-muted),transparent)] px-3 pb-8 pt-3 sm:h-[220px]">
        <div className="pointer-events-none absolute inset-x-3 bottom-8 top-3 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
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
            className="relative z-10 h-full w-full overflow-visible pb-5"
            role="img"
            aria-label={`${title} trend`}
          >
            <defs>
              <linearGradient id="dashboardRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.20" />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {revenueArea ? (
              <path d={revenueArea} fill="url(#dashboardRevenueArea)" />
            ) : null}
            {revenuePath ? (
              <path
                d={revenuePath}
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="1.8"
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
          </svg>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center pb-5 text-center text-xs text-[var(--color-text-muted)]">
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
