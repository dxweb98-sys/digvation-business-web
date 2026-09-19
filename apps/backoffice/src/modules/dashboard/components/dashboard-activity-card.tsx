import { DCard } from '@digvation/ui';
import { Activity as ActivityIcon } from 'lucide-react';
import { Link } from 'react-router';

import { activityEventLabel } from '../../../app/localization/human-readable-labels';
import type { ActivityEvent } from '../../activity/activity-api';

export function DashboardActivityCard({
  title,
  events,
  loading,
  error,
  emptyMessage,
  errorMessage,
  seeAllLabel,
  locale,
  formatDateTime,
}: {
  title: string;
  events: readonly ActivityEvent[];
  loading: boolean;
  error: boolean;
  emptyMessage: string;
  errorMessage: string;
  seeAllLabel: string;
  locale: 'id' | 'en';
  formatDateTime(value: string): string;
}) {
  return (
    <DCard
      variant="elevated"
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <ActivityIcon aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        <Link
          to="/activity"
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          {seeAllLabel}
        </Link>
      </div>

      <div className="mt-4 divide-y divide-[var(--color-border)]">
        {loading ? (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">…</p>
        ) : error ? (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
            {errorMessage}
          </p>
        ) : events.length ? (
          events.map((event) => (
            <div key={event.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-semibold text-[var(--color-text)]">
                  {activityEventLabel(event.eventType, locale)}
                </p>
                <time className="shrink-0 text-[10px] text-[var(--color-text-muted)]">
                  {formatDateTime(event.occurredAt)}
                </time>
              </div>
              <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                {[event.actor?.displayName, event.locationName].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
            {emptyMessage}
          </p>
        )}
      </div>
    </DCard>
  );
}
