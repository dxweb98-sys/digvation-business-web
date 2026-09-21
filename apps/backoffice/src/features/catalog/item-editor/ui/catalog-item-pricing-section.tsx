import { DCurrencyInput } from '@digvation/ui';

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
      {hasVariants ? (
        <SellingModeChoice
          value={variantSelectionMode}
          onChange={(value) => setFormField('variantSelectionMode', value)}
          disabled={!canEditPrice || saving}
        />
      ) : null}

      {sellsItemItself(model) ? (
        <div
          className={
            hasVariants
              ? 'flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
              : 'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4'
          }
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {hasVariants ? 'Harga tanpa varian' : 'Harga jual'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {hasVariants
                ? 'Harga dasar saat kasir menjual item tanpa memilih varian.'
                : sellingModelCopy.DIRECT.description}
            </p>
          </div>

          <div className="w-full sm:max-w-72">
            {canEditPrice ? (
              <DCurrencyInput
                aria-label={`${hasVariants ? 'Harga tanpa varian' : 'Harga jual'} (${currency})`}
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
        <div className="rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          Harga jual ditentukan oleh setiap varian.
          {storedItemPrice
            ? ` Harga item ${formatMoney(
                storedItemPrice,
                currency,
              )} tetap tersimpan di riwayat dan tidak digunakan untuk penjualan saat mode ini aktif.`
            : ''}
        </div>
      )}
    </div>
  );
}
