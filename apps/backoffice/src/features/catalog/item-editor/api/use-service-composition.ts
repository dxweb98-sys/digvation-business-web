import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { CatalogApi, Item, Variant } from '../../api/catalog-api';
import {
  compositionDraftFromApi,
  compositionHasIssues,
  type ProductVariantRequirement,
  type ServiceCompositionDraft,
} from '../model/service-composition-draft';

export interface ComponentProductInfo {
  requirement: ProductVariantRequirement;
  variants: Variant[];
}

/**
 * Loads a Service's composition once, plus the variant rules of every Product it references, so
 * the editor can enforce Runtime's required-variant rule before save. Runtime stays authoritative.
 */
export function useServiceComposition({
  item,
  api,
  enabled,
  composition,
  variantKeys,
  hydrate,
}: {
  item: Item | null | undefined;
  api: CatalogApi;
  enabled: boolean;
  composition: ServiceCompositionDraft;
  variantKeys: readonly string[];
  hydrate: (draft: ServiceCompositionDraft) => void;
}) {
  const persisted = useQuery({
    queryKey: ['catalog', 'service-composition', item?.id ?? 'new'],
    queryFn: () => api.getServiceComposition(item!.id),
    enabled: Boolean(item && enabled),
  });

  useEffect(() => {
    if (persisted.data) hydrate(compositionDraftFromApi(persisted.data));
  }, [hydrate, persisted.data]);

  const productIds = useMemo(() => {
    const ids = new Set<string>();
    for (const component of composition.default) if (component.productId) ids.add(component.productId);
    for (const variant of Object.values(composition.variants))
      for (const component of variant.components) if (component.productId) ids.add(component.productId);
    return [...ids].sort();
  }, [composition]);

  const productQueries = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: ['catalog', 'composition-product', productId],
      queryFn: async (): Promise<ComponentProductInfo> => {
        const [product, variants] = await Promise.all([
          api.getItem(productId),
          api.listVariants(productId),
        ]);
        const active = variants.items.filter((variant) => variant.status === 'ACTIVE');
        return {
          variants: active,
          requirement: !active.length
            ? 'NONE'
            : product.variantSelectionMode === 'REQUIRED'
              ? 'REQUIRED'
              : 'OPTIONAL',
        };
      },
      enabled,
      staleTime: 30_000,
    })),
  });

  const infoByProduct = useMemo(() => {
    const map = new Map<string, ComponentProductInfo>();
    productIds.forEach((productId, index) => {
      const data = productQueries[index]?.data;
      if (data) map.set(productId, data);
    });
    return map;
  }, [productIds, productQueries]);

  const requirementOf = useCallback(
    (productId: string): ProductVariantRequirement =>
      infoByProduct.get(productId)?.requirement ?? 'NONE',
    [infoByProduct],
  );

  return {
    loading: persisted.isLoading,
    error: persisted.error,
    version: persisted.data?.version ?? null,
    infoByProduct,
    requirementOf,
    hasIssues: enabled && compositionHasIssues(composition, variantKeys, requirementOf),
  };
}
