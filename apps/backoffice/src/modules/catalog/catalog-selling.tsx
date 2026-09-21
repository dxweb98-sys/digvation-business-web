import {
  catalogItemSellsDirectly,
  resolveCatalogSellingModel,
  type CatalogSellingModel,
  type VariantSelectionMode,
} from '@digvation/business-catalog';
import { DBadge, DRadio } from '@digvation/ui';

export type SellingModel = CatalogSellingModel;

/**
 * Compatibility names retained for current Catalog callers while the shared Catalog
 * package becomes the cross-app owner of selling semantics.
 */
export const sellingModel = resolveCatalogSellingModel;
export const sellsItemItself = catalogItemSellsDirectly;

export const sellingModelCopy: Record<SellingModel, { label: string; description: string }> = {
  DIRECT: {
    label: 'Dijual langsung',
    description: 'Item dijual dengan satu harga, tanpa memilih varian.',
  },
  VARIANT_REQUIRED: {
    label: 'Wajib pilih varian',
    description: 'Kasir harus memilih salah satu varian. Item tidak dijual tanpa varian.',
  },
  ITEM_AND_VARIANTS: {
    label: 'Bisa tanpa varian',
    description: 'Item juga dijual tanpa varian dengan harganya sendiri, selain setiap varian.',
  },
};

export function SellingModelBadge({ model }: { model: SellingModel }) {
  return (
    <DBadge variant={model === 'DIRECT' ? 'secondary' : 'info'}>
      {sellingModelCopy[model].label}
    </DBadge>
  );
}

/** Choice between "variant required" and "item also sold without a variant". */
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
    <fieldset className="grid gap-2 sm:grid-cols-2" disabled={disabled}>
      <legend className="sr-only">Cara item dijual</legend>
      {options.map((option) => {
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
              checked
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]'
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
              <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                {sellingModelCopy[option.model].description}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
