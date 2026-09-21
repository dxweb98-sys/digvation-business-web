import type { CatalogItemType } from '@digvation/business-catalog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { referenceQueryPolicy } from '../../app/data/operational-cache-policy';
import type { SellingCatalogQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { CatalogItem, CatalogVariant } from './cashier-transaction.types';
import type { OperationalProjectionQuery } from './operational-projection-client';

export type CatalogItemTypeFilter = 'ALL' | CatalogItemType;

type OperationalSellingCatalogQuery = SellingCatalogQuery & OperationalProjectionQuery;

interface UseSellingCatalogOptions {
  query: OperationalSellingCatalogQuery;
  locale: string;
  sellingLocationId: string;
  currency: string;
}

export function useSellingCatalog({
  query,
  locale,
  sellingLocationId,
  currency,
}: UseSellingCatalogOptions) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState<CatalogItemTypeFilter>('SERVICE');
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
    enabled: Boolean(sellingLocationId && currency),
    ...referenceQueryPolicy,
  });

  const activeItems = useMemo(
    () => (catalogQuery.data?.items ?? []).filter((item) => item.lifecycle === 'ACTIVE'),
    [catalogQuery.data],
  );
  const items = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase(locale);
    return activeItems.filter((item) => {
      if (itemType !== 'ALL' && item.type !== itemType) return false;
      if (!normalizedSearch) return true;
      return `${item.name} ${item.code}`.toLocaleLowerCase(locale).includes(normalizedSearch);
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
    items,
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
  };
}
