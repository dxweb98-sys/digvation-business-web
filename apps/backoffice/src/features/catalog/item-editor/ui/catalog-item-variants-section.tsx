import { CatalogSection } from '../../ui/catalog-shared';
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
  const showVariants = fresh ? canCreateVariants : canViewPricing && hasVariants;

  if (!showVariants && !(!fresh && canViewPricing && variantPricesLoading)) {
    return null;
  }

  return (
    <CatalogSection
      title="Daftar Varian Item"
      count={variants.length}
      description={
        fresh
          ? 'Setiap varian memiliki harga final dan dapat diedit satu per satu.'
          : inactiveVariantCount
            ? `${inactiveVariantCount} varian nonaktif tidak ditampilkan di editor ini.`
            : 'Harga setiap varian tetap dikelola secara individual.'
      }
    >
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
          canAddVariants={fresh && canCreateVariants}
          seed={
            sellsItemItself(model) && hasVariants
              ? { label: 'Pakai harga tanpa varian', amount: defaultPrice }
              : null
          }
          showIssues={showIssues}
        />
      )}
    </CatalogSection>
  );
}
