import { DCard } from '@digvation/ui';
import { Package, Users } from 'lucide-react';

import { DashboardCardHeader } from './dashboard-card-header';

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
  kind,
  seeAllHref,
}: {
  title: string;
  subtitle?: string;
  items: readonly RankingCardItem[];
  emptyMessage: string;
  kind: 'items' | 'employees';
  seeAllHref?: string;
}) {
  const Icon = kind === 'items' ? Package : Users;

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <DashboardCardHeader
        title={title}
        subtitle={subtitle}
        icon={<Icon aria-hidden="true" className="size-4" />}
        actionHref={seeAllHref}
        tone={kind === 'items' ? 'violet' : 'warm'}
      />

      <div className="mt-3 space-y-0.5">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${item.label}:${index}`}
              className="flex items-start gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[11px] font-semibold text-[var(--color-brand)]">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--color-text)]"
                  title={item.label}
                >
                  {item.label}
                </p>
                {item.secondary ? (
                  <p
                    className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[var(--color-text-muted)]"
                    title={item.secondary}
                  >
                    {item.secondary}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--color-text)]">
                  {item.value}
                </p>
                {item.delta != null ? (
                  <span
                    className={[
                      'mt-0.5 inline-block text-[10px] font-semibold tabular-nums',
                      Math.abs(item.delta) < 0.05
                        ? 'text-[var(--color-text-muted)]'
                        : item.delta > 0
                          ? 'text-emerald-600'
                          : 'text-red-600',
                    ].join(' ')}
                  >
                    {Math.abs(item.delta) < 0.05
                      ? '0.0%'
                      : `${item.delta > 0 ? '+' : '-'}${Math.abs(item.delta).toFixed(1)}%`}
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
