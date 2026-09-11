import type { QueryClient } from '@tanstack/react-query';

import { isApiErrorCode } from './cashier-transaction-errors';
import type { SellingCatalogQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { ResolvedPrice } from './cashier-transaction.types';

const RESOLVED_PRICE_STALE_TIME_MS = 90_000;

interface ResolvePriceInput {
  catalogItemId: string;
  catalogVariantId?: string | undefined;
  sellingLocationId: string;
  currency: string;
}

interface ResolveVariantPricesInput extends Omit<ResolvePriceInput, 'catalogVariantId'> {
  catalogVariantIds: readonly string[];
}

export interface ResolvedVariantPrices {
  pricesByVariantId: Readonly<Record<string, string>>;
  unavailableVariantIds: readonly string[];
}

/** Reuses one bounded-staleness price resolution cache across Cashier interactions. */
export function fetchResolvedPrice(
  queryClient: QueryClient,
  query: SellingCatalogQuery,
  input: ResolvePriceInput,
): Promise<ResolvedPrice> {
  return queryClient.fetchQuery({
    queryKey: cashierTransactionKeys.resolvedPrice(
      input.catalogItemId,
      input.catalogVariantId ?? null,
      input.sellingLocationId,
      input.currency,
    ),
    queryFn: ({ signal }) =>
      query.resolvePrice(
        {
          catalogItemId: input.catalogItemId,
          ...(input.catalogVariantId ? { catalogVariantId: input.catalogVariantId } : {}),
          sellingLocationId: input.sellingLocationId,
          currency: input.currency,
          effectiveAt: new Date().toISOString(),
        },
        signal,
      ),
    staleTime: RESOLVED_PRICE_STALE_TIME_MS,
    retry: false,
  });
}

/** Keeps selectable variants usable when only part of the development price matrix exists. */
export async function fetchResolvedVariantPrices(
  queryClient: QueryClient,
  query: SellingCatalogQuery,
  input: ResolveVariantPricesInput,
): Promise<ResolvedVariantPrices> {
  const entries = await Promise.all(
    input.catalogVariantIds.map(async (catalogVariantId) => {
      try {
        const price = await fetchResolvedPrice(queryClient, query, {
          catalogItemId: input.catalogItemId,
          catalogVariantId,
          sellingLocationId: input.sellingLocationId,
          currency: input.currency,
        });
        return { catalogVariantId, amount: price.amount } as const;
      } catch (error) {
        if (isApiErrorCode(error, 'PRICE_NOT_FOUND')) {
          return { catalogVariantId, amount: null } as const;
        }
        throw error;
      }
    }),
  );

  return {
    pricesByVariantId: Object.fromEntries(
      entries.flatMap((entry) =>
        entry.amount === null ? [] : [[entry.catalogVariantId, entry.amount]],
      ),
    ),
    unavailableVariantIds: entries.flatMap((entry) =>
      entry.amount === null ? [entry.catalogVariantId] : [],
    ),
  };
}
