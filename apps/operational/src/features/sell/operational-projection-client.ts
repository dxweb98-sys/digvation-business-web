import type { ApiClient } from '@digvation/business-api';

import type {
  SaleTransactionPort,
  SellingCatalogDisplayInput,
  StartSaleInput,
} from './cashier-transaction.adapter';
import type {
  ApiPage,
  OperationalCatalogProjection,
  Sale,
} from './cashier-transaction.types';

const OPERATIONAL_PREFIX = '/api/v1/operational';

export interface OperationalProjectionQuery {
  getOperationalCatalog?(
    input: SellingCatalogDisplayInput,
    signal?: AbortSignal,
  ): Promise<OperationalCatalogProjection>;
}

export type OperationalAwareTransactionPort = SaleTransactionPort & OperationalProjectionQuery;

export function attachOperationalProjection(
  client: ApiClient,
  adapter: SaleTransactionPort,
): OperationalAwareTransactionPort {
  const operational = adapter as OperationalAwareTransactionPort;

  operational.getOperationalCatalog = (input, signal) => {
    const query = new URLSearchParams({
      locationId: input.sellingLocationId,
      currency: input.currency,
    });
    return client.get<OperationalCatalogProjection>(
      `${OPERATIONAL_PREFIX}/catalog?${query.toString()}`,
      { signal },
    );
  };

  operational.listSales = (signal) =>
    client.get<ApiPage<Sale>>(`${OPERATIONAL_PREFIX}/queue`, { signal });

  operational.startSale = (input: StartSaleInput, idempotencyKey: string) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.queueSale = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/queue`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  return operational;
}
