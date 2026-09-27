import { DCheckbox, DInput, DSelect, DTextarea } from '@digvation/ui';

import type {
  LoyaltyConfiguration,
  LoyaltyEarningRule,
} from '../../../../modules/loyalty/loyalty-api';
import type { Category, Item } from '../../api/catalog-api';
import type { SellingModel } from '../../model/catalog-selling';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { CatalogItemLoyaltySection } from './catalog-item-loyalty-section';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemAdditionalInfoSection({
  editor,
  fresh,
  categoryOptions,
  validDefaultDuration,
  canViewLoyalty,
  loyaltyRule,
  loyaltyConfiguration,
  loyaltyLoading,
  canConfigureLoyalty,
  loyaltyDraftValid,
}: {
  editor: CatalogItemEditor;
  fresh: boolean;
  categoryOptions: Category[];
  validDefaultDuration: boolean;
  model: SellingModel;
  canViewLoyalty: boolean;
  loyaltyRule: LoyaltyEarningRule | undefined;
  loyaltyConfiguration: LoyaltyConfiguration | undefined;
  loyaltyLoading: boolean;
  canConfigureLoyalty: boolean;
  loyaltyDraftValid: boolean;
}) {
  const {
    type,
    categoryId,
    description,
    defaultDurationMinutes,
    directlySellable,
    requireAdditionalItemAtSale,
  } = editor.form;
  const { setFormField } = editor.actions;

  return (
    <section aria-label="Informasi Tambahan" className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label="Tipe"
          value={type}
          onChange={(value) => setFormField('type', value as Item['type'])}
          disabled={!fresh}
          options={[
            { label: 'Produk', value: 'PRODUCT' },
            { label: 'Layanan / Jasa', value: 'SERVICE' },
          ]}
        />

        <DSelect
          label="Kategori"
          value={categoryId}
          onChange={(value) => setFormField('categoryId', value as string | null)}
          clearable
          options={categoryOptions.map((category) => ({
            label: category.status === 'ACTIVE' ? category.name : `${category.name} · Nonaktif`,
            value: category.id,
          }))}
        />
      </div>

      {type === 'SERVICE' ? (
        <div className="mt-4 max-w-sm">
          <DInput
            label="Durasi Layanan (menit)"
            value={defaultDurationMinutes}
            onChange={(value) => setFormField('defaultDurationMinutes', value)}
            type="number"
            min={1}
            placeholder="30"
            error={validDefaultDuration ? undefined : 'Durasi harus berupa angka bulat positif.'}
            hint="Opsional"
          />
        </div>
      ) : null}

      <fieldset className="mt-4" aria-label="Item tambahan saat transaksi">
        <legend className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
          Item tambahan saat transaksi
        </legend>
        <label className="flex items-start gap-3">
          <DCheckbox
            checked={requireAdditionalItemAtSale}
            onChange={() =>
              setFormField('requireAdditionalItemAtSale', !requireAdditionalItemAtSale)
            }
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--color-text)]">
              Wajib menggunakan item tambahan saat transaksi
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
              Operator harus memilih minimal satu item tambahan sebelum{' '}
              {type === 'SERVICE' ? 'jasa' : 'produk'} dapat dimasukkan ke keranjang. Jika tidak
              dicentang, item tambahan tetap bisa dipakai secara opsional.
            </span>
          </span>
        </label>
      </fieldset>

      {type === 'PRODUCT' ? (
        <fieldset className="mt-4" aria-label="Penggunaan Produk">
          <legend className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
            Penggunaan Produk
          </legend>
          <label className="flex items-start gap-3">
            <DCheckbox
              checked={directlySellable}
              onChange={() => setFormField('directlySellable', !directlySellable)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-text)]">
                Dapat dijual langsung
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                {directlySellable
                  ? 'Produk tersedia di kasir dan dapat dipakai sebagai komponen jasa.'
                  : 'Produk hanya digunakan sebagai komponen jasa.'}
              </span>
            </span>
          </label>
        </fieldset>
      ) : null}

      {canViewLoyalty ? (
        <CatalogItemLoyaltySection
          editor={editor}
          loyaltyRule={loyaltyRule}
          configuration={loyaltyConfiguration}
          loading={loyaltyLoading}
          canConfigure={canConfigureLoyalty}
          loyaltyDraftValid={loyaltyDraftValid}
        />
      ) : null}

      <div className="mt-5 border-t border-[var(--color-border)] pt-5">
        <DTextarea
          label="Deskripsi"
          value={description}
          onChange={(value) => setFormField('description', value)}
          placeholder="Deskripsi item (opsional)"
          className="min-h-28"
        />
      </div>
    </section>
  );
}
