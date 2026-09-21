import type { VariantSelectionMode } from './catalog.types';

export type CatalogSellingModel = 'DIRECT' | 'VARIANT_REQUIRED' | 'ITEM_AND_VARIANTS';

/**
 * Resolve the presentation selling model from Runtime-owned Catalog facts.
 *
 * This helper is intentionally framework-free so Backoffice and Operational can
 * share the same interpretation without duplicating policy in each application.
 */
export function resolveCatalogSellingModel(
  hasActiveVariants: boolean,
  variantSelectionMode: VariantSelectionMode,
): CatalogSellingModel {
  if (!hasActiveVariants) return 'DIRECT';

  return variantSelectionMode === 'OPTIONAL' ? 'ITEM_AND_VARIANTS' : 'VARIANT_REQUIRED';
}

/** Whether the parent item itself can be selected without a variant. */
export function catalogItemSellsDirectly(model: CatalogSellingModel) {
  return model !== 'VARIANT_REQUIRED';
}
