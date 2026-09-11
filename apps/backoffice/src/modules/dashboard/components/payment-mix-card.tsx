import { DCard } from '@digvation/ui';

import type { DashboardAnalyticsPoint } from '../dashboard.types';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PaymentMixCard({
  title,
  points,
  emptyMessage,
  formatValue,
}: {
  title: string;
  points: readonly DashboardAnalyticsPoint[];
  emptyMessage: string;
  formatValue(value: number): string;
}) {
  const sorted = [...points]
    .sort((a, b) => numeric(b.value) - numeric(a.value))
    .slice(0, 4);
  const total = sorted.reduce((sum, point) => sum + numeric(point.value), 0);

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {formatValue(total)} total
        </span>
      </div>

      {sorted.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {sorted.map((point) => {
            const value = numeric(point.value);
            const ratio = total > 0 ? (value / total) * 100 : 0;
            return (
              <div
                key={point.label}
                className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-3"
              >
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  {point.label}
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {formatValue(value)}
                </p>
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  {ratio.toFixed(1)}%
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-28 items-center justify-center text-center text-xs text-[var(--color-text-muted)]">
          {emptyMessage}
        </div>
      )}
    </DCard>
  );
}
