import { DCard } from '@digvation/ui';
import { CircleCheckBig } from 'lucide-react';

import { useDashboardI18n } from '../dashboard-i18n';
import { DashboardCardHeader } from './dashboard-card-header';

function percentage(finalized: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (finalized / total) * 100));
}

export function TransactionCompletionCard({
  finalized,
  total,
  voided,
}: {
  finalized: number;
  total: number;
  voided: number;
}) {
  const { locale, text } = useDashboardI18n();
  const rate = percentage(finalized, total);
  const pending = Math.max(0, total - finalized - voided);
  const integer = (value: number) =>
    new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US').format(value);

  return (
    <DCard
      variant="elevated"
      className="h-fit self-start rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)] xl:h-[326px]"
    >
      <DashboardCardHeader
        title={text('transactionCompletion')}
        subtitle={text('finalizedSalesToday')}
        icon={<CircleCheckBig aria-hidden="true" className="size-4" />}
      />

      <div className="mt-3 flex justify-center">
        <div className="relative h-[126px] w-full max-w-[230px]">
          <svg
            viewBox="0 0 120 72"
            className="h-full w-full"
            role="img"
            aria-label={`${rate.toFixed(0)}% ${text('finalizedOf')}`}
          >
            <defs>
              <linearGradient
                id="transactionCompletionGauge"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M 14 60 A 46 46 0 0 1 106 60"
              pathLength="100"
              fill="none"
              stroke="var(--color-surface-muted)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 14 60 A 46 46 0 0 1 106 60"
              pathLength="100"
              fill="none"
              stroke="url(#transactionCompletionGauge)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${rate} ${100 - rate}`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-1 text-center">
            <p className="text-[30px] font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
              {rate.toFixed(0)}%
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              {integer(finalized)} / {integer(total)} {text('finalizedOf')}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-4">
        {[
          [text('finalized'), finalized],
          [text('inProgress'), pending],
          [text('voided'), voided],
        ].map(([label, value]) => (
          <div key={String(label)} className="text-center">
            <p className="text-[9px] text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-text)]">
              {integer(Number(value))}
            </p>
          </div>
        ))}
      </div>
    </DCard>
  );
}
