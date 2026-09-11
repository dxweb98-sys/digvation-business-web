import { DCard } from '@digvation/ui';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface RankingCardItem {
  label: string;
  secondary?: string;
  value: string;
  delta?: number | null;
}

export function RankingCard({
  title,
  subtitle,
  items,
  emptyMessage,
  icon,
}: {
  title: string;
  subtitle?: string;
  items: readonly RankingCardItem[];
  emptyMessage: string;
  icon?: ReactNode;
}) {
  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-brand)]">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${item.label}:${index}`}
              className="flex items-center gap-3 rounded-xl border-b border-[var(--color-border)] px-1 py-2.5 last:border-b-0"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[11px] font-semibold text-[var(--color-brand)]">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.label}</p>
                {item.secondary ? (
                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                    {item.secondary}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{item.value}</p>
                {item.delta != null ? (
                  <span
                    className={[
                      'mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums',
                      item.delta >= 0
                        ? 'text-[var(--color-brand)]'
                        : 'text-[var(--color-text-muted)]',
                    ].join(' ')}
                  >
                    {item.delta >= 0 ? (
                      <ArrowUpRight aria-hidden="true" className="size-3" />
                    ) : (
                      <ArrowDownRight aria-hidden="true" className="size-3" />
                    )}
                    {Math.abs(item.delta).toFixed(1)}%
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="flex min-h-44 items-center justify-center text-center text-xs text-[var(--color-text-muted)]">
            {emptyMessage}
          </div>
        )}
      </div>
    </DCard>
  );
}
