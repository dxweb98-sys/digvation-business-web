import { DCard } from '@digvation/ui';
import { ChartNoAxesCombined } from 'lucide-react';

import { useDashboardI18n } from '../dashboard-i18n';
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
    x: values.length === 1 ? 50 : 3 + (index / (values.length - 1)) * 94,
    y: 32 - ((value - min) / range) * 23,
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
  return `${path} L ${points[points.length - 1]!.x.toFixed(2)} 36 L ${points[0]!.x.toFixed(2)} 36 Z`;
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span
      className={[
        'rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums',
        positive
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-rose-50 text-rose-600',
      ].join(' ')}
    >
      {positive ? '↗ ' : '↘ '}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function axisLabels(trend: readonly DashboardAnalyticsPoint[]): string[] {
  if (!trend.length) return [];
  if (trend.length <= 4) return trend.map((point) => point.label);
  const oneThird = Math.floor((trend.length - 1) / 3);
  const twoThird = Math.floor(((trend.length - 1) * 2) / 3);
  return [
    trend[0]!.label,
    trend[oneThird]!.label,
    trend[twoThird]!.label,
    trend[trend.length - 1]!.label,
  ];
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
  const { locale, text } = useDashboardI18n();
  const revenueChange = change(revenue, previousRevenue);
  const transactionChange = change(transactions, previousTransactions);
  const revenueValues = trend.map((point) => numeric(point.value));
  const transactionValues = trend.map((point) => Number(point.count ?? 0));
  const revenuePath = smoothPath(revenueValues);
  const revenueArea = areaPath(revenueValues);
  const transactionPath = smoothPath(transactionValues);
  const transactionArea = areaPath(transactionValues);
  const revenuePoints = pointCoordinates(revenueValues);
  const transactionPoints = pointCoordinates(transactionValues);
  const labels = axisLabels(trend);
  const integer = new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US');

  return (
    <DCard
      variant="elevated"
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)] xl:h-[326px]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ChartNoAxesCombined aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              {text('transactionMovement')}
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
                  'shrink-0 rounded-lg px-3 py-1.5 text-[9px] font-semibold transition-colors',
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-7 border-t border-[var(--color-border)] pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {text('revenue')}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="truncate text-[18px] font-semibold tracking-tight tabular-nums">
              {formatMoney(revenue)}
            </p>
            <Delta value={revenueChange} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {text('transactions')}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[18px] font-semibold tracking-tight tabular-nums">
              {integer.format(transactions)}
            </p>
            <Delta value={transactionChange} />
          </div>
        </div>
      </div>

      <div className="relative mt-2 h-[142px] overflow-hidden rounded-xl bg-[linear-gradient(180deg,var(--color-surface-muted),transparent)] px-2 pb-6 pt-2">
        <div className="pointer-events-none absolute inset-x-2 bottom-6 top-2 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <span key={line} className="block border-t border-dashed border-[var(--color-border)]" />
          ))}
        </div>

        {trend.length ? (
          <svg
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            className="relative z-10 h-full w-full overflow-visible pb-3"
            role="img"
            aria-label={title}
          >
            <defs>
              <linearGradient id="dashboardRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="dashboardTransactionArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            {revenueArea ? <path d={revenueArea} fill="url(#dashboardRevenueArea)" /> : null}
            {transactionArea ? <path d={transactionArea} fill="url(#dashboardTransactionArea)" /> : null}
            {revenuePath ? (
              <path
                d={revenuePath}
                fill="none"
                stroke="#3b82f6"
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
                stroke="#10b981"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {revenuePoints.map((point, index) => (
              <circle key={`r:${index}`} cx={point.x} cy={point.y} r="0.9" fill="#3b82f6" />
            ))}
            {transactionPoints.map((point, index) => (
              <circle key={`t:${index}`} cx={point.x} cy={point.y} r="0.8" fill="#10b981" />
            ))}
          </svg>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center pb-3 text-center text-[11px] text-[var(--color-text-muted)]">
            {text('noActivity')}
          </div>
        )}

        {labels.length ? (
          <div className="absolute inset-x-3 bottom-1.5 flex items-center justify-between text-[8px] text-[var(--color-text-muted)]">
            {labels.map((label, index) => (
              <span key={`${label}:${index}`}>{label}</span>
            ))}
          </div>
        ) : null}
      </div>
    </DCard>
  );
}
