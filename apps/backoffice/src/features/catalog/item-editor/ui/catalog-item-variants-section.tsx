import { sellsItemItself, type SellingModel } from '../../model/catalog-selling';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { VariantPriceEditor } from './catalog-variant-price-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemVariantsSection({
  editor,
  model,
  currency,
  fresh,
  canViewPricing,
  canEditPrice,
  canCreateVariants,
  variantPricesLoading,
  inactiveVariantCount,
}: {
  editor: CatalogItemEditor;
  model: SellingModel;
  currency: string;
  fresh: boolean;
  canViewPricing: boolean;
  canEditPrice: boolean;
  canCreateVariants: boolean;
  variantPricesLoading: boolean;
  inactiveVariantCount: number;
}) {
  const { variants, defaultPrice } = editor.form;
  const { showIssues } = editor.ui;
  const { setFormField } = editor.actions;
  const hasVariants = variants.length > 0;
  const showVariants = canCreateVariants || (canViewPricing && hasVariants);

  if (!showVariants && !(!fresh && canViewPricing && variantPricesLoading)) {
    return null;
  }

  return (
    <div className="mt-3">
      {inactiveVariantCount ? (
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          {inactiveVariantCount} varian nonaktif tidak ditampilkan di editor ini.
        </p>
      ) : null}

      {variantPricesLoading && !fresh ? (
        <div className="rounded-xl border border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
          Memuat varian...
        </div>
      ) : (
        <VariantPriceEditor
          drafts={variants}
          onChange={(value) => setFormField('variants', value)}
          currency={currency}
          canPrice={canEditPrice}
          canAddVariants={canCreateVariants}
          variantRequired={model === 'VARIANT_REQUIRED'}
          seed={
            sellsItemItself(model) && hasVariants
              ? { label: 'Pakai harga tanpa varian', amount: defaultPrice }
              : null
          }
          showIssues={showIssues}
        />
      )}
    </div>
  );
}
