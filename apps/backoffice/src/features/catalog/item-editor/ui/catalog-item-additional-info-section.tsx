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
            hint="Opsional"
          />
        </div>
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
