import { DInput, DSelect, DTextarea } from '@digvation/ui';

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
  } = editor.form;
  const { setFormField } = editor.actions;

  return (
    <section aria-label="Informasi Tambahan" className="p-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Klasifikasi Item</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
          Tentukan jenis dan kategori item agar mudah dikelola dan ditemukan.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              label:
                category.status === 'ACTIVE'
                  ? category.name
                  : `${category.name} · Nonaktif`,
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
              error={
                validDefaultDuration
                  ? undefined
                  : 'Durasi harus berupa angka bulat positif.'
              }
              hint="Opsional. Digunakan sebagai estimasi durasi layanan."
            />
          </div>
        ) : null}
      </div>

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
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Deskripsi Item</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
          Tambahkan informasi yang membantu pengguna memahami produk atau layanan ini.
        </p>
        <div className="mt-3">
          <DTextarea
            label="Deskripsi"
            value={description}
            onChange={(value) => setFormField('description', value)}
            placeholder="Deskripsi item (opsional)"
            className="min-h-28"
          />
        </div>
      </div>
    </section>
  );
}
