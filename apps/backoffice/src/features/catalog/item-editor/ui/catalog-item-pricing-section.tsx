import { DBadge, DCurrencyInput } from '@digvation/ui';

import { sellingModelCopy, sellsItemItself, type SellingModel } from '../../model/catalog-selling';
import { SellingModeChoice } from '../../ui/catalog-selling';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemPricingSection({
  editor,
  model,
  currency,
  fresh,
  hasVariants,
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
  hasVariants: boolean;
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
    <div className="space-y-3">
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
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <DBadge variant="secondary">Default</DBadge>
              <p className="text-sm font-semibold text-[var(--color-text)]">Item utama</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              Dijual tanpa memilih varian.
              {hasVariants
                ? ' Varian di bawah menjadi pilihan tambahan.'
                : ' Anda bisa menambahkan varian kapan saja tanpa menghilangkan opsi default ini.'}
            </p>
          </div>

          <div className="w-full sm:max-w-72">
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
              <div className="sm:text-right">
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text)]">
                  {defaultPrice ? formatMoney(defaultPrice, currency) : 'Belum diatur'}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  Anda tidak memiliki akses untuk mengubah harga.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/35 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <DBadge variant="info">Varian wajib</DBadge>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Opsi default tidak dijual
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {sellingModelCopy.VARIANT_REQUIRED.description}
            {storedItemPrice
              ? ` Harga default ${formatMoney(
                  storedItemPrice,
                  currency,
                )} tetap tersimpan di riwayat tetapi tidak digunakan selama mode ini aktif.`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}
