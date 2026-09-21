import { DBadge, DRadio } from '@digvation/ui';

import type { VariantSelectionMode } from '../api/catalog-api';
import { sellingModelCopy, type SellingModel } from '../model/catalog-selling';

export function SellingModelBadge({ model }: { model: SellingModel }) {
  return (
    <DBadge variant={model === 'DIRECT' ? 'secondary' : 'info'}>
      {sellingModelCopy[model].label}
    </DBadge>
  );
}

export function SellingModeChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: VariantSelectionMode;
  onChange: (value: VariantSelectionMode) => void;
  disabled?: boolean;
}) {
  const options: Array<{ value: VariantSelectionMode; model: SellingModel }> = [
    { value: 'REQUIRED', model: 'VARIANT_REQUIRED' },
    { value: 'OPTIONAL', model: 'ITEM_AND_VARIANTS' },
  ];

  return (
    <fieldset className="grid gap-2.5 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Cara item dijual</legend>
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={`flex min-h-20 cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
              checked
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/[0.035] shadow-[inset_0_0_0_1px_var(--color-brand)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]/50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <DRadio
              name="variant-selection-mode"
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--color-text)]">
                {sellingModelCopy[option.model].label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--color-text-muted)]">
                {sellingModelCopy[option.model].description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
