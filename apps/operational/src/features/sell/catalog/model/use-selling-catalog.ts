import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { referenceQueryPolicy } from '../../../../app/data/operational-cache-policy';
import type { SellingCatalogQuery } from '../../transaction/api/cashier-transaction.adapter';
import { cashierTransactionKeys } from '../../transaction/api/cashier-transaction-keys';
import type {
  CatalogItem,
  CatalogVariant,
} from '../../transaction/model/cashier-transaction.types';
import { catalogItemMatchesSearch, isStandaloneSellable } from './selling-catalog-eligibility';
import type { OperationalProjectionQuery } from '../../transaction/api/operational-projection-client';

export type CatalogItemTypeFilter = 'ALL' | 'PRODUCT' | 'SERVICE';

type OperationalSellingCatalogQuery = SellingCatalogQuery & OperationalProjectionQuery;

interface UseSellingCatalogOptions {
  query: OperationalSellingCatalogQuery;
  locale: string;
  sellingLocationId: string;
  currency: string;
  enabledSelling?: { readonly PRODUCT: boolean; readonly SERVICE: boolean };
}

export function useSellingCatalog({
  query,
  locale,
  sellingLocationId,
  currency,
  enabledSelling,
}: UseSellingCatalogOptions) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const canSellProducts = enabledSelling?.PRODUCT ?? true;
  const canSellServices = enabledSelling?.SERVICE ?? true;
  const [selectedItemType, setSelectedItemType] = useState<CatalogItemTypeFilter>('SERVICE');
  // An entitlement refresh can remove the previously selected selling mode.
  const itemType: CatalogItemTypeFilter =
    selectedItemType === 'SERVICE' && !canSellServices
      ? canSellProducts
        ? 'PRODUCT'
        : 'ALL'
      : selectedItemType === 'PRODUCT' && !canSellProducts
        ? canSellServices
          ? 'SERVICE'
          : 'ALL'
        : selectedItemType;
  const setItemType = (next: CatalogItemTypeFilter) => {
    if ((next === 'PRODUCT' && !canSellProducts) || (next === 'SERVICE' && !canSellServices))
      return;
    setSelectedItemType(next);
  };
  const catalogQuery = useQuery({
    queryKey: cashierTransactionKeys.operationalCatalog(sellingLocationId, currency),
    queryFn: async ({ signal }) => {
      if (query.getOperationalCatalog) {
        return query.getOperationalCatalog({ sellingLocationId, currency }, signal);
      }

      const [categoriesPage, itemsPage] = await Promise.all([
        query.listCatalogCategories(signal),
        query.listSellingCatalogItems && sellingLocationId && currency
          ? query.listSellingCatalogItems({ sellingLocationId, currency }, signal)
          : query.listCatalogItems(signal),
      ]);
      return { categories: categoriesPage.items, items: itemsPage.items };
    },
    enabled: Boolean(sellingLocationId && currency && (canSellProducts || canSellServices)),
    ...referenceQueryPolicy,
  });

  const activeItems = useMemo(
    () =>
      (catalogQuery.data?.items ?? []).filter(
        (item) =>
          isStandaloneSellable(item) &&
          (item.type === 'PRODUCT' ? canSellProducts : canSellServices),
      ),
    [catalogQuery.data, canSellProducts, canSellServices],
  );
  const items = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return activeItems.filter((item) => {
      if (itemType !== 'ALL' && item.type !== itemType) return false;
      return catalogItemMatchesSearch(item, normalizedSearch, locale);
    });
  }, [activeItems, itemType, locale, search]);

  const loadActiveVariants = async (item: CatalogItem): Promise<CatalogVariant[]> => {
    if (item.variants) return item.variants.filter((variant) => variant.status === 'ACTIVE');

    const page = await queryClient.fetchQuery({
      queryKey: cashierTransactionKeys.variants(item.id),
      queryFn: ({ signal }) => query.listCatalogVariants(item.id, signal),
      staleTime: referenceQueryPolicy.staleTime,
      gcTime: referenceQueryPolicy.gcTime,
    });
    return page.items.filter((variant) => variant.status === 'ACTIVE');
  };

  return {
    /** Page-visible items: narrowed by this page's own type filter and search. */
    items,
    /**
     * Every active standalone sellable item, untouched by the page's presentation filters. Flows
     * that pick an item on their own (adjusting or correcting a transaction) search this set.
     */
    activeItems,
    categories: (catalogQuery.data?.categories ?? []).filter(
      (category) => category.status === 'ACTIVE',
    ),
    search,
    itemType,
    error: catalogQuery.error,
    isLoading: catalogQuery.isLoading,
    setSearch,
    setItemType,
    loadActiveVariants,
    /** Any sellable item by id, regardless of the current search or type filter. */
    findItem: (itemId: string) => activeItems.find((item) => item.id === itemId) ?? null,
  };
}
