import { DCard } from '@digvation/ui';
import { CreditCard } from 'lucide-react';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { useDashboardI18n } from '../dashboard-i18n';
import type { DashboardAnalyticsPoint } from '../dashboard.types';
import { DashboardCardHeader } from './dashboard-card-header';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const SEGMENT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316'] as const;

export function PaymentMixCard({
  title,
  points,
  emptyMessage,
  formatValue,
  seeAllHref,
}: {
  title: string;
  points: readonly DashboardAnalyticsPoint[];
  emptyMessage: string;
  formatValue(value: number): string;
  seeAllHref?: string;
}) {
  const { copy } = useBackofficeLocalization();
  const { text } = useDashboardI18n();
  const sorted = [...points]
    .sort((a, b) => numeric(b.value) - numeric(a.value))
    .slice(0, 4);
  const total = sorted.reduce((sum, point) => sum + numeric(point.value), 0);

  let cursor = 0;
  const stops = sorted.map((point, index) => {
    const value = numeric(point.value);
    const ratio = total > 0 ? (value / total) * 100 : 0;
    const from = cursor;
    cursor += ratio;
    return `${SEGMENT_COLORS[index % SEGMENT_COLORS.length]} ${from.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  const donut = stops.length
    ? `conic-gradient(${stops.join(', ')})`
    : 'conic-gradient(var(--color-surface-muted) 0 100%)';

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <DashboardCardHeader
        title={title}
        subtitle={text('paymentShare')}
        icon={<CreditCard aria-hidden="true" className="size-4" />}
        actionHref={seeAllHref}
        tone="mint"
      />

      {sorted.length ? (
        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="relative mx-auto size-[136px]">
            <div className="absolute inset-0 rounded-full" style={{ background: donut }} />
            <div className="absolute inset-[23px] flex flex-col items-center justify-center rounded-full bg-[var(--color-surface)] text-center">
              <p className="text-sm font-semibold tracking-tight tabular-nums">
                {formatValue(total)}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {text('totalValue')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {sorted.map((point, index) => {
              const value = numeric(point.value);
              const ratio = total > 0 ? (value / total) * 100 : 0;
              const label = copy(point.label);
              return (
                <div key={point.label} className="flex items-start gap-3">
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="line-clamp-2 text-xs font-medium leading-4"
                        title={label}
                      >
                        {label}
                      </p>
                      <p className="shrink-0 text-xs font-semibold tabular-nums">
                        {ratio.toFixed(1)}%
                      </p>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                      {formatValue(value)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex min-h-44 items-center justify-center text-center text-xs text-[var(--color-text-muted)]">
          {emptyMessage}
        </div>
      )}
    </DCard>
  );
}
