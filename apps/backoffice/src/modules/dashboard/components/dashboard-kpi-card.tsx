import { DCard } from '@digvation/ui';
import type { ReactNode } from 'react';

function sparklinePath(start: number, end: number): string {
  const values = [start, end];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const y = (value: number) => 26 - ((value - min) / range) * 18;
  const startY = y(start);
  const endY = y(end);
  return `M 3 ${startY.toFixed(2)} C 18 ${startY.toFixed(2)}, 34 ${endY.toFixed(2)}, 53 ${endY.toFixed(2)}`;
}

const toneClass = {
  sky: 'bg-[var(--color-accent-sky)] text-[var(--color-brand)]',
  mint: 'bg-[var(--color-accent-mint)] text-[var(--color-brand)]',
  violet:
    'bg-[var(--color-accent-lilac,var(--color-accent-sky))] text-[var(--color-brand)]',
  warm: 'bg-[var(--color-accent-peach,var(--color-accent-mint))] text-[var(--color-brand)]',
} as const;

export function DashboardKpiCard({
  label,
  value,
  context,
  delta,
  icon,
  trendStart = 0,
  trendEnd = 0,
  tone = 'sky',
}: {
  label: string;
  value: string;
  context?: string;
  delta?: number | null;
  icon: ReactNode;
  trendStart?: number;
  trendEnd?: number;
  tone?: keyof typeof toneClass;
}) {
  const deltaLabel =
    delta == null ? null : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
  const path = sparklinePath(trendStart, trendEnd);
  const positive = (delta ?? 0) >= 0;

  return (
    <DCard
      variant="elevated"
      className="min-h-[116px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_14px_34px_-30px_var(--color-text)]"
    >
      <div className="flex h-full items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${toneClass[tone]}`}
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)]">
            {label}
          </p>
          <p className="mt-1 truncate text-[22px] font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
            {value}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            {deltaLabel ? (
              <span
                className={[
                  'rounded-full px-2 py-0.5 font-semibold tabular-nums',
                  positive
                    ? 'bg-[var(--color-accent-mint)] text-[var(--color-brand)]'
                    : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
                ].join(' ')}
              >
                {deltaLabel}
              </span>
            ) : null}
            <span className="truncate text-[var(--color-text-muted)]">
              {context ?? '—'}
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 56 32"
          className="h-9 w-16 shrink-0 overflow-visible"
          aria-hidden="true"
        >
          <path
            d={path}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx="53"
            cy={trendStart === trendEnd ? 17 : trendEnd >= trendStart ? 8 : 26}
            r="2.5"
            fill="var(--color-brand)"
          />
        </svg>
      </div>
    </DCard>
  );
}
