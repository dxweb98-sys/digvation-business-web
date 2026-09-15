import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { SellingCatalogQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { CatalogItem, CatalogVariant } from './cashier-transaction.types';

export type CatalogItemTypeFilter = 'ALL' | 'PRODUCT' | 'SERVICE';

interface UseSellingCatalogOptions {
  query: SellingCatalogQuery;
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
  const categoriesQuery = useQuery({
    queryKey: cashierTransactionKeys.categories(),
    queryFn: ({ signal }) => query.listCatalogCategories(signal),
    staleTime: 300_000,
  });
  const itemsQuery = useQuery({
    queryKey: cashierTransactionKeys.items(sellingLocationId, currency),
    queryFn: ({ signal }) => {
      if (query.listSellingCatalogItems && sellingLocationId && currency) {
        return query.listSellingCatalogItems(
          { sellingLocationId, currency },
          signal,
        );
      }
      return query.listCatalogItems(signal);
    },
    enabled: Boolean(sellingLocationId && currency),
    staleTime: 300_000,
  });

  const activeItems = useMemo(
    () => (itemsQuery.data?.items ?? []).filter((item) => item.lifecycle === 'ACTIVE'),
    [itemsQuery.data],
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
    const page = await queryClient.fetchQuery({
      queryKey: cashierTransactionKeys.variants(item.id),
      queryFn: ({ signal }) => query.listCatalogVariants(item.id, signal),
      staleTime: 300_000,
    });
    return page.items.filter((variant) => variant.status === 'ACTIVE');
  };

  return {
    items,
    categories: (categoriesQuery.data?.items ?? []).filter(
      (category) => category.status === 'ACTIVE',
    ),
    search,
    itemType,
    error: itemsQuery.error ?? categoriesQuery.error,
    isLoading: itemsQuery.isLoading || categoriesQuery.isLoading,
    setSearch,
    setItemType,
    loadActiveVariants,
  };
}
