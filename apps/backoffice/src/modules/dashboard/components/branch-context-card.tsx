import { DCard } from '@digvation/ui';
import { ChevronDown, Store } from 'lucide-react';

import type { DashboardLocationOption } from '../dashboard.types';

export function BranchContextCard({
  locations,
  selectedId,
  mainLocationId,
  onChange,
}: {
  locations: readonly DashboardLocationOption[];
  selectedId: string;
  mainLocationId: string | null;
  onChange(value: string): void;
}) {
  const selected = locations.find((location) => location.id === selectedId);
  const selectedIsMain = Boolean(
    selected && mainLocationId && selected.id === mainLocationId,
  );

  return (
    <DCard
      variant="elevated"
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[0_14px_34px_-32px_var(--color-text)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-mint)] text-[var(--color-brand)]">
          <Store aria-hidden="true" className="size-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Selected branch
            </p>
            {selectedIsMain ? (
              <span className="rounded-full bg-[var(--color-accent-mint)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-brand)]">
                Main Branch
              </span>
            ) : null}
          </div>

          <div className="relative mt-0.5">
            <select
              aria-label="Selected branch"
              value={selectedId}
              onChange={(event) => onChange(event.target.value)}
              className="w-full appearance-none bg-transparent py-1 pr-8 text-sm font-semibold text-[var(--color-text)] outline-none"
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name ?? location.displayName ?? location.code}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
          </div>
        </div>
      </div>
    </DCard>
  );
}
