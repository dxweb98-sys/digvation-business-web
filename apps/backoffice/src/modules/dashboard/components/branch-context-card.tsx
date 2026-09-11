import { DCard, DSelect } from '@digvation/ui';
import { Store } from 'lucide-react';

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
      <div className="flex items-start gap-3">
        <span className="mt-5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-sky)] text-[var(--color-brand)]">
          <Store aria-hidden="true" className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Selected branch
            </p>
            {selectedIsMain ? (
              <span className="rounded-full bg-[var(--color-accent-mint)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-brand)]">
                Main Branch
              </span>
            ) : null}
          </div>

          <DSelect
            label="Branch"
            value={selectedId}
            options={locations.map((location) => ({
              value: location.id,
              label: location.name ?? location.displayName ?? location.code,
            }))}
            onChange={(value) => onChange(String(value ?? ''))}
          />
        </div>
      </div>
    </DCard>
  );
}
