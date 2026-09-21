import { DInput, DSelect, DTextarea } from '@digvation/ui';
import { Briefcase, Clock, Tag } from 'lucide-react';

import type {
  LoyaltyConfiguration,
  LoyaltyEarningRule,
} from '../../../../modules/loyalty/loyalty-api';
import type { Category, Item } from '../../api/catalog-api';
import { sellingModelCopy, type SellingModel } from '../../model/catalog-selling';
import { CatalogPanel, CatalogInfoTile } from '../../ui/catalog-shared';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { CatalogItemLoyaltySection } from './catalog-item-loyalty-section';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemAdditionalInfoSection({
  editor,
  fresh,
  categoryOptions,
  validDefaultDuration,
  model,
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
    <CatalogPanel className="p-5" ariaLabel="Informasi Tambahan">
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
        Informasi Tambahan
      </p>

      <div
        className={`mt-4 grid gap-3 sm:grid-cols-2 ${
          canViewLoyalty && !fresh ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        <CatalogInfoTile
          label="Tipe Produk / Item"
          icon={<Briefcase className="size-3.5" aria-hidden="true" />}
        >
          <div className="mt-2">
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
          </div>
        </CatalogInfoTile>

        <CatalogInfoTile
          label="Kategori"
          icon={<Tag className="size-3.5" aria-hidden="true" />}
        >
          <div className="mt-2">
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
        </CatalogInfoTile>

        <CatalogInfoTile
          label={type === 'SERVICE' ? 'Durasi Pengerjaan' : 'Mode Penjualan'}
          icon={<Clock className="size-3.5" aria-hidden="true" />}
        >
          <div className="mt-2">
            {type === 'SERVICE' ? (
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
                hint="Opsional."
              />
            ) : (
              <div className="pt-1">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {sellingModelCopy[model].label}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">
                  {sellingModelCopy[model].description}
                </p>
              </div>
            )}
          </div>
        </CatalogInfoTile>

        {canViewLoyalty && !fresh ? (
          <CatalogItemLoyaltySection
            editor={editor}
            loyaltyRule={loyaltyRule}
            configuration={loyaltyConfiguration}
            loading={loyaltyLoading}
            canConfigure={canConfigureLoyalty}
            loyaltyDraftValid={loyaltyDraftValid}
          />
        ) : null}
      </div>

      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
          Deskripsi Item
        </p>
        <div className="mt-2">
          <DTextarea
            label="Deskripsi"
            value={description}
            onChange={(value) => setFormField('description', value)}
            placeholder="Deskripsi item (opsional)"
            className="min-h-24"
          />
        </div>
      </div>
    </CatalogPanel>
  );
}
