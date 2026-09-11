import { DCard } from '@digvation/ui';
import { CircleCheckBig } from 'lucide-react';

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
  const rate = percentage(finalized, total);
  const pending = Math.max(0, total - finalized - voided);

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)] sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-mint)] text-[var(--color-brand)]">
          <CircleCheckBig aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Transaction completion
          </h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Finalized sales today
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="relative h-[140px] w-full max-w-[245px]">
          <svg
            viewBox="0 0 120 72"
            className="h-full w-full"
            role="img"
            aria-label={`${rate.toFixed(0)} percent of today's transactions are finalized`}
          >
            <defs>
              <linearGradient id="transactionCompletionGauge" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-brand)" />
                <stop offset="100%" stopColor="var(--color-accent-mint-strong, var(--color-brand))" />
              </linearGradient>
            </defs>
            <path
              d="M 14 60 A 46 46 0 0 1 106 60"
              pathLength="100"
              fill="none"
              stroke="var(--color-surface-muted)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 14 60 A 46 46 0 0 1 106 60"
              pathLength="100"
              fill="none"
              stroke="url(#transactionCompletionGauge)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${rate} ${100 - rate}`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-2 text-center">
            <p className="text-[34px] font-semibold tracking-tight tabular-nums">
              {rate.toFixed(0)}%
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              {finalized.toLocaleString('id-ID')} of {total.toLocaleString('id-ID')} finalized
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2.5">
          <p className="text-[9px] text-[var(--color-text-muted)]">Finalized</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {finalized.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2.5">
          <p className="text-[9px] text-[var(--color-text-muted)]">In progress</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {pending.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2.5">
          <p className="text-[9px] text-[var(--color-text-muted)]">Voided</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {voided.toLocaleString('id-ID')}
          </p>
        </div>
      </div>
    </DCard>
  );
}
