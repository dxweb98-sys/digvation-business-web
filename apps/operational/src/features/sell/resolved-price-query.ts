import type { QueryClient } from '@tanstack/react-query';

import { isApiErrorCode } from './cashier-transaction-errors';
import type { SellingCatalogQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { OperationalCatalogProjection, ResolvedPrice } from './cashier-transaction.types';
import type { OperationalProjectionQuery } from './operational-projection-client';

const RESOLVED_PRICE_STALE_TIME_MS = 90_000;

type OperationalSellingCatalogQuery = SellingCatalogQuery & OperationalProjectionQuery;

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

function operationalCatalog(
  queryClient: QueryClient,
  input: Pick<ResolvePriceInput, 'sellingLocationId' | 'currency'>,
): OperationalCatalogProjection | undefined {
  return queryClient.getQueryData<OperationalCatalogProjection>(
    cashierTransactionKeys.operationalCatalog(input.sellingLocationId, input.currency),
  );
}

function projectedPrice(
  queryClient: QueryClient,
  input: ResolvePriceInput,
): ResolvedPrice | null | undefined {
  const projection = operationalCatalog(queryClient, input);
  if (!projection) return undefined;
  const item = projection.items.find((candidate) => candidate.id === input.catalogItemId);
  if (!item) return null;
  if (!input.catalogVariantId) return item.resolvedPrice ?? null;
  const variant = item.variants?.find((candidate) => candidate.id === input.catalogVariantId);
  return variant?.resolvedPrice ?? null;
}

/** Reuses the Operational projection price without issuing another pricing request. */
export function fetchResolvedPrice(
  queryClient: QueryClient,
  query: OperationalSellingCatalogQuery,
  input: ResolvePriceInput,
): Promise<ResolvedPrice> {
  if (query.getOperationalCatalog) {
    const price = projectedPrice(queryClient, input);
    if (price) {
      queryClient.setQueryData(
        cashierTransactionKeys.resolvedPrice(
          input.catalogItemId,
          input.catalogVariantId ?? null,
          input.sellingLocationId,
          input.currency,
        ),
        price,
      );
      return Promise.resolve(price);
    }
    return Promise.reject(
      new Error('Operational catalog has no current price for this selection.'),
    );
  }

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

/** Reads all selectable variant prices from the same Operational Catalog projection. */
export async function fetchResolvedVariantPrices(
  queryClient: QueryClient,
  query: OperationalSellingCatalogQuery,
  input: ResolveVariantPricesInput,
): Promise<ResolvedVariantPrices> {
  if (query.getOperationalCatalog) {
    const projection = operationalCatalog(queryClient, input);
    const item = projection?.items.find((candidate) => candidate.id === input.catalogItemId);
    const entries = input.catalogVariantIds.map((catalogVariantId) => {
      const price = item?.variants?.find(
        (variant) => variant.id === catalogVariantId,
      )?.resolvedPrice;
      return { catalogVariantId, amount: price?.amount ?? null } as const;
    });
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
