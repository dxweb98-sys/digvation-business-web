import { DBadge, DCurrencyInput } from '@digvation/ui';

import {
  sellingModelCopy,
  sellsItemItself,
  type SellingModel,
} from '../../model/catalog-selling';
import { SellingModeChoice } from '../../ui/catalog-selling';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemPricingSection({
  editor,
  model,
  currency,
  fresh,
  canEditPrice,
  currentPriceLoading,
  itemPriceError,
  storedItemPrice,
  formatMoney,
}: {
  editor: CatalogItemEditor;
  model: SellingModel;
  currency: string;
  fresh: boolean;
  canEditPrice: boolean;
  currentPriceLoading: boolean;
  itemPriceError: string | undefined;
  storedItemPrice: string | null;
  formatMoney: (amount: string, currency: string) => string;
}) {
  const { variantSelectionMode, defaultPrice } = editor.form;
  const { saving } = editor.ui;
  const { setFormField } = editor.actions;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
          Pilih cara item dijual
        </p>
        <SellingModeChoice
          value={variantSelectionMode}
          onChange={(value) => setFormField('variantSelectionMode', value)}
          disabled={!canEditPrice || saving}
        />
      </div>

      {sellsItemItself(model) ? (
        <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <DBadge variant="secondary">Default</DBadge>
              <p className="text-sm font-semibold text-[var(--color-text)]">Item utama</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              Item dapat dijual tanpa memilih varian. Varian menjadi pilihan tambahan.
            </p>
          </div>

          {canEditPrice ? (
            <DCurrencyInput
              label="Harga default"
              aria-label={`Harga tanpa varian (${currency})`}
              value={defaultPrice}
              onValueChange={(value) => setFormField('defaultPrice', value)}
              placeholder="Contoh: 100000"
              error={itemPriceError}
              hint={!fresh && currentPriceLoading ? 'Memuat harga saat ini...' : undefined}
            />
          ) : (
            <div className="md:text-right">
              <p className="text-xs text-[var(--color-text-muted)]">Harga default</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text)]">
                {defaultPrice
                  ? formatMoney(defaultPrice, currency)
                  : storedItemPrice
                    ? formatMoney(storedItemPrice, currency)
                    : 'Belum diatur'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <DBadge variant="info">Varian wajib</DBadge>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Harga ditentukan per varian
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {sellingModelCopy.VARIANT_REQUIRED.description}
            {storedItemPrice
              ? ` Harga default ${formatMoney(
                  storedItemPrice,
                  currency,
                )} tetap tersimpan tetapi tidak digunakan selama mode ini aktif.`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}
