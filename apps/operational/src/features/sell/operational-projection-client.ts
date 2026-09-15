import type { ApiClient } from '@digvation/business-api';

import type {
  AddSaleLineInput,
  CreatePaymentInput,
  SaleTransactionPort,
  SetSaleLineQuantityInput,
  SellingCatalogDisplayInput,
  StartSaleInput,
} from './cashier-transaction.adapter';
import type {
  ApiPage,
  Employee,
  OperationalCatalogProjection,
  PaymentRoute,
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

  operational.listEmployees = (signal) =>
    client.get<ApiPage<Employee>>(`${OPERATIONAL_PREFIX}/employees`, { signal });

  operational.listPaymentRoutes = (input, signal) => {
    const query = new URLSearchParams({
      sellingLocationId: input.sellingLocationId,
      currency: input.currency,
    });
    return client.get<ApiPage<PaymentRoute>>(
      `${OPERATIONAL_PREFIX}/payment-routes?${query.toString()}`,
      { signal },
    );
  };

  operational.listSales = (signal, sellingLocationId?: string) => {
    const query = new URLSearchParams();
    if (sellingLocationId) query.set('sellingLocationId', sellingLocationId);
    const suffix = query.size ? `?${query.toString()}` : '';
    return client.get<ApiPage<Sale>>(`${OPERATIONAL_PREFIX}/queue${suffix}`, { signal });
  };

  operational.startSale = (input: StartSaleInput, idempotencyKey: string) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.getSale = (saleId, signal) =>
    client.get<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}`, { signal });

  operational.addSaleLine = (
    saleId: string,
    input: AddSaleLineInput,
    idempotencyKey: string,
  ) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/lines`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.setSaleLineQuantity = (
    saleId: string,
    saleLineId: string,
    input: SetSaleLineQuantityInput,
  ) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/quantity`,
      input,
    );

  operational.removeSaleLine = (saleId, saleLineId, expectedVersion) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/remove`,
      { expectedVersion },
    );

  operational.setSaleLinePerformers = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/performers`,
      input,
    );

  operational.transitionSaleLineFulfillment = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/fulfillment`,
      input,
    );

  operational.createSalePayment = (
    saleId: string,
    input: CreatePaymentInput,
    idempotencyKey: string,
  ) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/payments`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.queueSale = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/queue`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  operational.startSaleWork = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/start-work`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  operational.finalizeSale = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/finalize`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  operational.voidSale = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/void`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  return operational;
}
