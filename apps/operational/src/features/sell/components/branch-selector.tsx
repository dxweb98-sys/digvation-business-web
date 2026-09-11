import { MapPin } from 'lucide-react';

import { DSelect } from '@digvation-labs/ui';

import type { SellingLocation } from '../cashier-transaction.types';

interface BranchSelectorProps {
  locations: readonly SellingLocation[];
  value: string;
  isLoading: boolean;
  onChange: (locationId: string) => void;
}

export function BranchSelector({ locations, value, isLoading, onChange }: BranchSelectorProps) {
  return (
    <div className="w-full max-w-xs">
      <label
        htmlFor="branch"
        className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]"
      >
        Branch
      </label>
      <div className="relative mt-1">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <DSelect
          id="branch"
          value={value}
          clearable={false}
          onChange={(locationId) => {
            if (typeof locationId === 'string') onChange(locationId);
          }}
          disabled={isLoading || locations.length === 0}
          className="h-9 w-full bg-[var(--color-surface)] pl-9 text-xs font-medium"
        >
          <option value="">Select Branch</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </DSelect>
      </div>
    </div>
  );
}
