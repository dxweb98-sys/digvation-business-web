import { DCard } from '@digvation/ui';
import type { ReactNode } from 'react';

const toneStyle = {
  sky: {
    icon: 'bg-blue-50 text-blue-600',
    delta: 'bg-blue-50 text-blue-600',
    stroke: '#3b82f6',
  },
  mint: {
    icon: 'bg-emerald-50 text-emerald-600',
    delta: 'bg-emerald-50 text-emerald-600',
    stroke: '#10b981',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-600',
    delta: 'bg-violet-50 text-violet-600',
    stroke: '#8b5cf6',
  },
  warm: {
    icon: 'bg-orange-50 text-orange-600',
    delta: 'bg-orange-50 text-orange-600',
    stroke: '#f97316',
  },
} as const;

function sparkline(start: number, end: number) {
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const range = Math.max(1, max - min);
  const y = (value: number) => 36 - ((value - min) / range) * 22;
  const startY = start === end ? 28 : y(start);
  const endY = start === end ? 28 : y(end);
  const direction = endY < startY ? -1 : 1;
  const midY = Math.max(8, Math.min(39, (startY + endY) / 2 + direction * 3));
  const path = `M 2 ${startY.toFixed(2)} C 18 ${startY.toFixed(2)}, 27 ${midY.toFixed(2)}, 38 ${midY.toFixed(2)} S 61 ${endY.toFixed(2)}, 78 ${endY.toFixed(2)}`;
  return {
    path,
    area: `${path} L 78 46 L 2 46 Z`,
    endY,
  };
}

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
  tone?: keyof typeof toneStyle;
}) {
  const visual = toneStyle[tone];
  const deltaLabel =
    delta == null ? null : `${delta >= 0 ? '↗ ' : '↘ '}${Math.abs(delta).toFixed(1)}%`;
  const { path, area, endY } = sparkline(trendStart, trendEnd);
  const gradientId = `dashboard-kpi-${tone}`;

  return (
    <DCard
      variant="elevated"
      className="min-h-[118px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_14px_34px_-30px_var(--color-text)]"
    >
      <div className="flex h-full min-w-0 items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${visual.icon}`}
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)]">
            {label}
          </p>
          <p className="mt-1 truncate text-[21px] font-semibold tracking-[-0.025em] tabular-nums text-[var(--color-text)]">
            {value}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-[10px]">
            {deltaLabel ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums ${visual.delta}`}
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
          viewBox="0 0 80 48"
          className="h-12 w-[76px] shrink-0 self-end overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={visual.stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={visual.stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={path}
            fill="none"
            stroke={visual.stroke}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="78" cy={endY} r="2.8" fill={visual.stroke} />
          <circle cx="78" cy={endY} r="5.5" fill={visual.stroke} opacity="0.10" />
        </svg>
      </div>
    </DCard>
  );
}
