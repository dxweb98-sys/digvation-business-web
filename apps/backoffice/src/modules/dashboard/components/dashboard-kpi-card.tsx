import { DCard } from '@digvation/ui';
import type { ReactNode } from 'react';

export function DashboardKpiCard({
  label,
  value,
  context,
  delta,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  context?: string;
  delta?: number | null;
  icon: ReactNode;
  emphasis?: boolean;
}) {
  const deltaLabel =
    delta == null
      ? null
      : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

  return (
    <DCard
      variant="elevated"
      className={[
        'min-h-[116px] rounded-[var(--radius-card)] border p-4 shadow-[0_14px_34px_-30px_var(--color-text)]',
        emphasis
          ? 'border-transparent bg-[var(--color-brand)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={[
              'text-xs font-medium',
              emphasis ? 'text-white/75' : 'text-[var(--color-text-muted)]',
            ].join(' ')}
          >
            {label}
          </p>
          <p className="mt-2 truncate text-[22px] font-semibold tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={[
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            emphasis
              ? 'bg-white/14 text-white'
              : 'bg-[var(--color-surface-muted)] text-[var(--color-brand)]',
          ].join(' ')}
        >
          {icon}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <span className={emphasis ? 'text-white/70' : 'text-[var(--color-text-muted)]'}>
          {context ?? '—'}
        </span>
        {deltaLabel ? (
          <span
            className={[
              'rounded-full px-2 py-0.5 font-semibold tabular-nums',
              emphasis
                ? 'bg-white/14 text-white'
                : delta! >= 0
                  ? 'bg-[var(--color-accent-mint)] text-[var(--color-text)]'
                  : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
            ].join(' ')}
          >
            {deltaLabel}
          </span>
        ) : null}
      </div>
    </DCard>
  );
}
