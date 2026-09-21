import { useQueries, useQuery } from '@tanstack/react-query';

import type { CatalogApi, Item } from '../../../modules/catalog/catalog-api';
import type { LoyaltyApi } from '../../../modules/loyalty/loyalty-api';

export function useCatalogItemEditorData({
  item,
  currency,
  effectiveAt,
  api,
  loyaltyApi,
  canViewPricing,
  canViewLoyalty,
}: {
  item: Item | null | undefined;
  currency: string;
  effectiveAt: string;
  api: CatalogApi;
  loyaltyApi: LoyaltyApi;
  canViewPricing: boolean;
  canViewLoyalty: boolean;
}) {
  const existingImage = useQuery({
    queryKey: ['catalog', 'image', item?.id ?? 'new'],
    queryFn: () => api.getItemImage(item!.id),
    enabled: Boolean(item),
    staleTime: 60_000,
  });

  const currentPrice = useQuery({
    queryKey: ['catalog', 'edit-price', item?.id ?? 'new', currency],
    queryFn: () => api.listDefaultPrices([item!.id], currency, effectiveAt),
    enabled: Boolean(item && canViewPricing),
  });

  const existingVariants = useQuery({
    queryKey: ['catalog', 'variants', item?.id ?? 'new'],
    queryFn: () => api.listVariants(item!.id),
    enabled: Boolean(item && canViewPricing),
  });

  const activeVariants = (existingVariants.data?.items ?? []).filter(
    (variant) => variant.status === 'ACTIVE',
  );

  const variantPrices = useQueries({
    queries: activeVariants.map((variant) => ({
      queryKey: ['catalog', 'edit-variant-price', item?.id ?? 'new', variant.id, currency],
      queryFn: () =>
        api.resolvePrice({
          catalogItemId: item!.id,
          catalogVariantId: variant.id,
          currency,
          effectiveAt,
        }),
      retry: false,
    })),
  });

  const variantPricesLoading =
    existingVariants.isLoading || variantPrices.some((query) => query.isLoading);

  const loyaltyConfiguration = useQuery({
    queryKey: ['loyalty', 'configuration'],
    queryFn: () => loyaltyApi.getConfiguration(),
    enabled: Boolean(item && canViewLoyalty),
  });

  const loyaltyRules = useQuery({
    queryKey: ['loyalty', 'earning-rules'],
    queryFn: () => loyaltyApi.listEarningRules(),
    enabled: Boolean(item && canViewLoyalty),
  });

  const loyaltyRule = loyaltyRules.data?.find(
    (candidate) => candidate.catalogItemId === item?.id,
  );

  return {
    existingImage,
    currentPrice,
    existingVariants,
    activeVariants,
    variantPrices,
    variantPricesLoading,
    loyaltyConfiguration,
    loyaltyRules,
    loyaltyRule,
  };
}
