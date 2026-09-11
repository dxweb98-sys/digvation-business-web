import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useDashboardI18n } from '../dashboard-i18n';

const tones = {
  sky: 'bg-blue-50 text-blue-600',
  mint: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  warm: 'bg-orange-50 text-orange-600',
} as const;

export function DashboardCardHeader({
  title,
  subtitle,
  icon,
  actionHref,
  actionLabel,
  tone = 'sky',
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  tone?: keyof typeof tones;
}) {
  const { text } = useDashboardI18n();
  const resolvedActionLabel = actionLabel ?? text('seeAll');

  return (
    <div className="-mx-5 flex min-h-[58px] items-center gap-3 border-b border-[var(--color-border)] px-5 pb-4">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actionHref ? (
        <Link
          to={actionHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-accent-sky)]"
        >
          {resolvedActionLabel}
          <ArrowUpRight aria-hidden="true" className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}
