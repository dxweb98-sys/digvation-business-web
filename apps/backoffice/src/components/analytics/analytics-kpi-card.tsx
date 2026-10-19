import { DCard } from '@digvation/ui';
import type { ReactNode } from 'react';

export function AnalyticsKpiCard({
  label,
  value,
  icon,
  context,
  flat = false,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  context?: ReactNode;
  /** Outlined without elevation, for cards placed inside a dialog or another surface. */
  flat?: boolean;
}) {
  return (
    <DCard
      variant={flat ? 'outlined' : 'elevated'}
      className={`group h-[108px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 ${
        flat
          ? ''
          : 'shadow-[0_10px_28px_-24px_var(--color-text)] transition-shadow duration-200 hover:shadow-[0_14px_32px_-22px_var(--color-text)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-xs font-medium leading-5 text-[var(--color-text-muted)]">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 truncate text-xl font-semibold tracking-[-0.025em] text-[var(--color-text)] tabular-nums xl:text-2xl">
        {value}
      </p>
      {context ? (
        <p className="mt-0.5 truncate text-[11px] leading-4 text-[var(--color-text-muted)]">
          {context}
        </p>
      ) : null}
    </DCard>
  );
}
