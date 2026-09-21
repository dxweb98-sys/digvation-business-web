import { CatalogSection } from '../../ui/catalog-shared';
import {
  sellsItemItself,
  type SellingModel,
} from '../../model/catalog-selling';
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
  const {
    variants,
    defaultPrice,
  } = editor.form;
  const { showIssues } = editor.ui;
  const { setFormField } = editor.actions;
  const hasVariants = variants.length > 0;
  const showVariants = fresh ? canCreateVariants : canViewPricing && hasVariants;

  if (!showVariants && !(!fresh && canViewPricing && variantPricesLoading)) {
    return null;
  }

  return (
    <CatalogSection
      title="Varian"
      count={variants.length}
      description={
        fresh
          ? 'Opsional. Setiap varian dijual dengan harga finalnya sendiri.'
          : `Setiap varian dijual dengan harga finalnya sendiri. Tambah atau nonaktifkan varian dari detail item.${
              inactiveVariantCount
                ? ` ${inactiveVariantCount} varian nonaktif tidak ditampilkan.`
                : ''
            }`
      }
    >
      {variantPricesLoading && !fresh ? (
        <p className="text-sm text-(--color-text-muted)">Memuat varian...</p>
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
