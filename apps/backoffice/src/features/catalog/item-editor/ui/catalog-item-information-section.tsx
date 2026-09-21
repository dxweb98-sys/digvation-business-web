import { DCurrencyInput, DInput, DSelect } from '@digvation/ui';

import type { CatalogItemImage, Category, Item } from '../../api/catalog-api';
import {
  sellingModelCopy,
  sellsItemItself,
  type SellingModel,
} from '../../model/catalog-selling';
import { SellingModelBadge } from '../../ui/catalog-selling';
import { CatalogPanel } from '../../ui/catalog-shared';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { CatalogItemImageField } from './catalog-item-image-field';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemInformationSection({
  editor,
  fresh,
  categoryOptions,
  canManageImage,
  existingImage,
  model,
  currency,
  showPricing,
  canEditPrice,
  currentPriceLoading,
  itemPriceError,
  storedItemPrice,
  formatMoney,
}: {
  editor: CatalogItemEditor;
  fresh: boolean;
  categoryOptions: Category[];
  canManageImage: boolean;
  existingImage: CatalogItemImage | null | undefined;
  model: SellingModel;
  currency: string;
  showPricing: boolean;
  canEditPrice: boolean;
  currentPriceLoading: boolean;
  itemPriceError: string | undefined;
  storedItemPrice: string | null;
  formatMoney: (amount: string, currency: string) => string;
}) {
  const { code, name, type, categoryId, lifecycle, defaultPrice } = editor.form;
  const { file, removeRequested } = editor.image;
  const { saving } = editor.ui;
  const { setFormField, selectImage, requestImageRemoval } = editor.actions;

  const categoryName = categoryId
    ? (categoryOptions.find((category) => category.id === categoryId)?.name ?? 'Kategori dipilih')
    : 'Belum ada kategori';

  return (
    <CatalogPanel className="p-5" ariaLabel="Informasi Item">
      <div
        className={
          showPricing
            ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-stretch'
            : 'grid gap-5'
        }
      >
        <div className="flex min-w-0 gap-5">
          {canManageImage ? (
            <CatalogItemImageField
              itemName={name}
              existingImage={existingImage}
              selectedFile={file}
              removeRequested={removeRequested}
              disabled={saving}
              onFileChange={selectImage}
              onRemove={requestImageRemoval}
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <DInput
              label="Nama Item"
              value={name}
              onChange={(value) => setFormField('name', value)}
              placeholder="Contoh: Hair Color Treatment"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <DInput
                label="Kode Item"
                value={code}
                onChange={(value) => setFormField('code', value)}
                disabled={!fresh}
                hint={fresh ? 'Kosongkan untuk kode otomatis.' : 'Terkunci'}
              />

              <DSelect
                label="Status"
                value={lifecycle}
                onChange={(value) => setFormField('lifecycle', value as Item['lifecycle'])}
                options={[
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'Aktif Dijual', value: 'ACTIVE' },
                  { label: 'Nonaktif', value: 'INACTIVE' },
                ]}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
              <span>{type === 'SERVICE' ? 'Jasa / Layanan' : 'Produk'}</span>
              <span>•</span>
              <span className="font-medium text-[var(--color-brand)]">{categoryName}</span>
            </div>
          </div>
        </div>

        {showPricing ? (
          <div className="flex min-h-32 flex-col justify-center border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {sellsItemItself(model) ? 'Harga Default' : 'Harga per Varian'}
              </span>
              <SellingModelBadge model={model} />
            </div>

            {sellsItemItself(model) ? (
              canEditPrice ? (
                <div className="mt-2.5">
                  <DCurrencyInput
                    label="Harga default"
                    aria-label={`Harga tanpa varian (${currency})`}
                    value={defaultPrice}
                    onValueChange={(value) => setFormField('defaultPrice', value)}
                    placeholder="Contoh: 100000"
                    error={itemPriceError}
                    hint={!fresh && currentPriceLoading ? 'Memuat harga saat ini...' : undefined}
                  />
                </div>
              ) : (
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-text)]">
                  {defaultPrice
                    ? formatMoney(defaultPrice, currency)
                    : storedItemPrice
                      ? formatMoney(storedItemPrice, currency)
                      : 'Belum diatur'}
                </p>
              )
            ) : (
              <div className="mt-2">
                <p className="text-xl font-semibold text-[var(--color-text)]">Mengikuti varian</p>
                {storedItemPrice ? (
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    Harga default {formatMoney(storedItemPrice, currency)} tetap tersimpan, tetapi
                    tidak dipakai selama mode ini aktif.
                  </p>
                ) : null}
              </div>
            )}

            <p className="mt-1.5 max-w-xs text-xs leading-5 text-[var(--color-text-muted)]">
              {sellingModelCopy[model].description}
            </p>
          </div>
        ) : null}
      </div>
    </CatalogPanel>
  );
}
