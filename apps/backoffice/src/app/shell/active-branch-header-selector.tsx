import { DBadge, DButton, DDropdown } from '@digvation/ui';
import { Building2, Check, ChevronDown } from 'lucide-react';

import { useBusinessLocation } from '../providers/business-location-context';
import { useDashboardI18n } from '../../modules/dashboard/dashboard-i18n';

export function ActiveBranchHeaderSelector() {
  const { locations, selectedLocationId, mainLocationId, isReady, selectLocation } =
    useBusinessLocation();
  const { text } = useDashboardI18n();

  if (!isReady) return null;

  const selected = locations.find((location) => location.id === selectedLocationId);
  if (!selected) return null;

  const selectedName = selected.name ?? selected.displayName ?? selected.code;
  const selectedIsMain = selected.id === mainLocationId;

  return (
    <DDropdown
      placement="bottom-start"
      contentPadding={false}
      closeOnItemClick
      minWidth={280}
      trigger={() => (
        <DButton
          variant="ghost"
          type="button"
          className="h-11 max-w-[min(380px,62vw)] justify-start gap-2 rounded-[var(--radius-control)] px-2.5"
          leftIcon={
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent-sky)] text-[var(--color-brand)]">
              <Building2 className="size-4" />
            </span>
          }
        >
          <span className="min-w-0 text-left">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              {text('activeBranch')}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-2">
              <span
                className="truncate text-sm font-semibold text-[var(--color-text)]"
                title={selectedName}
              >
                {selectedName}
              </span>
              {selectedIsMain ? (
                <DBadge variant="outline" className="hidden shrink-0 lg:inline-flex">
                  {text('mainBranch')}
                </DBadge>
              ) : null}
              <ChevronDown className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
            </span>
          </span>
        </DButton>
      )}
    >
      <div className="w-[min(360px,calc(100vw-24px))] p-1.5">
        {locations.map((location) => {
          const active = location.id === selectedLocationId;
          const isMain = location.id === mainLocationId;
          const name = location.name ?? location.displayName ?? location.code;
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => selectLocation(location.id)}
              className="flex w-full items-start gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-brand)]">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="line-clamp-2 text-sm font-medium leading-5 text-[var(--color-text)]"
                  title={name}
                >
                  {name}
                </span>
                <span className="mt-0.5 block text-[10px] text-[var(--color-text-muted)]">
                  {isMain ? text('mainBranch') : location.code}
                </span>
              </span>
              {active ? <Check className="mt-1 size-4 shrink-0 text-[var(--color-brand)]" /> : null}
            </button>
          );
        })}
      </div>
    </DDropdown>
  );
}
