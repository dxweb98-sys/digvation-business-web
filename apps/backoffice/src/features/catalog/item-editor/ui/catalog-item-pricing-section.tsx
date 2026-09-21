import { DCurrencyInput } from '@digvation/ui';

import { CatalogSection } from '../../ui/catalog-shared';
import {
  sellingModelCopy,
  sellsItemItself,
  type SellingModel,
} from '../../model/catalog-selling';
import {
  SellingModeChoice,
  SellingModelBadge,
} from '../../ui/catalog-selling';
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
  const {
    variantSelectionMode,
    defaultPrice,
  } = editor.form;
  const { saving } = editor.ui;
  const { setFormField } = editor.actions;

  return (
    <CatalogSection
      title="Penjualan & harga"
      description={
        hasVariants
          ? 'Tentukan apakah item juga bisa dijual tanpa memilih varian.'
          : sellingModelCopy.DIRECT.description
      }
      actions={hasVariants ? <SellingModelBadge model={model} /> : undefined}
    >
      <div className="space-y-4">
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
                ? 'flex flex-col gap-3 rounded-xl border border-(--color-border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
                : ''
            }
          >
            {hasVariants ? (
              <div className="min-w-0">
                <p className="text-sm font-semibold">Tanpa varian</p>
                <p className="text-xs text-(--color-text-muted)">
                  Pilihan jual tersendiri, dengan harganya sendiri.
                </p>
              </div>
            ) : null}

            <div className="w-full sm:max-w-xs">
              {canEditPrice ? (
                <DCurrencyInput
                  label={`${hasVariants ? 'Harga tanpa varian' : 'Harga jual'} (${currency})`}
                  value={defaultPrice}
                  onValueChange={(value) => setFormField('defaultPrice', value)}
                  placeholder="Contoh: 100000"
                  error={itemPriceError}
                  hint={!fresh && currentPriceLoading ? 'Memuat harga saat ini...' : undefined}
                />
              ) : (
                <div>
                  <p className="text-xs text-(--color-text-muted)">
                    {hasVariants ? 'Harga tanpa varian' : 'Harga jual'}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {defaultPrice ? formatMoney(defaultPrice, currency) : 'Belum diatur'}
                  </p>
                  <p className="mt-1 text-xs text-(--color-text-muted)">
                    Anda tidak memiliki akses untuk mengubah harga.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-(--color-text-muted)">
            Harga ditentukan oleh setiap varian di bawah.
            {storedItemPrice
              ? ` Harga item ${formatMoney(storedItemPrice, currency)} tetap tersimpan di riwayat, tetapi tidak dijual.`
              : ''}
          </p>
        )}
      </div>
    </CatalogSection>
  );
}
