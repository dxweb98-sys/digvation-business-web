import type { CatalogItem, CatalogVariant } from './cashier-transaction.types';

/**
 * Items the cashier can put on a Sale on their own. COMPONENT_ONLY Products exist only as Service
 * composition components: Runtime never projects them for selling, and this keeps a management
 * fallback list from offering them either. Services that use them stay selectable.
 */
export function isStandaloneSellable(item: Pick<CatalogItem, 'lifecycle' | 'productUsage'>) {
  return item.lifecycle === 'ACTIVE' && item.productUsage !== 'COMPONENT_ONLY';
}

/**
 * Catalog search stays item-level: an item matches by its own name or code, or by the name or
 * code of one of its ACTIVE variants (already part of the Operational projection, so search needs
 * no request). Inactive variants never make an item match.
 */
export function catalogItemMatchesSearch(
  item: Pick<CatalogItem, 'name' | 'code'> & {
    variants?: readonly Pick<CatalogVariant, 'name' | 'code' | 'status'>[] | undefined;
  },
  normalizedSearch: string,
  locale: string,
): boolean {
  if (!normalizedSearch) return true;
  const matches = (...values: string[]) =>
    values.join(' ').toLocaleLowerCase(locale).includes(normalizedSearch);
  if (matches(item.name, item.code)) return true;
  return (item.variants ?? []).some(
    (variant) => variant.status === 'ACTIVE' && matches(variant.name, variant.code),
  );
}

/**
 * What the catalog grid shows for the chosen category and search. The grid stays item-level:
 * an item is listed once, whichever of its variants matched.
 */
export function visibleCatalogItems<
  T extends Pick<CatalogItem, 'name' | 'code' | 'categoryId'> & {
    variants?: readonly Pick<CatalogVariant, 'name' | 'code' | 'status'>[] | undefined;
  },
>(items: readonly T[], filter: { search: string; categoryId: string; locale: string }): T[] {
  const needle = filter.search.trim().toLocaleLowerCase(filter.locale);
  return items.filter(
    (item) =>
      (!filter.categoryId || item.categoryId === filter.categoryId) &&
      catalogItemMatchesSearch(item, needle, filter.locale),
  );
}
