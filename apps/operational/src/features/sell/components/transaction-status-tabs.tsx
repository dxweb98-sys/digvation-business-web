import { CheckCircle2, CircleDotDashed, Clock3, XCircle } from 'lucide-react';
import { useState } from 'react';

import { DButton } from '@digvation/ui';

const STATUS_OPTIONS = [
  { id: 'DRAFT', label: 'Draft', count: 12, icon: CircleDotDashed },
  { id: 'IN_PROGRESS', label: 'On Progress', count: 5, icon: Clock3 },
  { id: 'COMPLETED', label: 'Completed', count: 18, icon: CheckCircle2 },
  { id: 'CANCELED', label: 'Canceled', count: 2, icon: XCircle },
] as const;

export function TransactionStatusTabs() {
  const [selectedStatus, setSelectedStatus] =
    useState<(typeof STATUS_OPTIONS)[number]['id']>('DRAFT');

  return (
    <section aria-label="Daily transaction status" className="overflow-x-auto pb-0.5">
      <div className="inline-flex min-w-max rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-panel)]">
        {STATUS_OPTIONS.map(({ id, label, count, icon: Icon }) => {
          const isSelected = selectedStatus === id;
          return (
            <DButton
              variant="ghost"
              key={id}
              type="button"
              onClick={() => setSelectedStatus(id)}
              aria-pressed={isSelected}
              className={`inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-bold transition-colors ${
                isSelected
                  ? 'bg-[var(--color-brand)] text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? 'bg-white/20' : 'bg-[var(--color-surface-muted)]'}`}
              >
                {count}
              </span>
            </DButton>
          );
        })}
      </div>
    </section>
  );
}
