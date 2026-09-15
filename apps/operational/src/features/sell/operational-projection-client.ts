import type { ApiClient } from '@digvation/business-api';

import type {
  AddSaleLineInput,
  CreatePaymentInput,
  CreateSaleInput,
  SaleTransactionPort,
  SetSaleLineQuantityInput,
  SellingCatalogDisplayInput,
  StartSaleInput,
} from './cashier-transaction.adapter';
import type {
  ApiPage,
  ContributionPreview,
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

  operational.createSale = (input: CreateSaleInput, idempotencyKey: string) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/empty`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

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

  operational.setSaleLinePriceOverride = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/price-override`,
      input,
    );

  operational.clearSaleLinePriceOverride = (saleId, saleLineId, expectedVersion) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/price-override/remove`,
      { expectedVersion },
    );

  operational.setSaleLineDiscount = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/discount`,
      input,
    );

  operational.clearSaleLineDiscount = (saleId, saleLineId, expectedVersion) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/discount/remove`,
      { expectedVersion },
    );

  operational.setSaleDiscount = (saleId, input) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/discount`, input);

  operational.clearSaleDiscount = (saleId, expectedVersion) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/discount/remove`, {
      expectedVersion,
    });

  operational.setSaleLinePerformers = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/performers`,
      input,
    );

  operational.setSaleLineAssignments = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/assignments`,
      input,
    );

  operational.setSaleLineContributions = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/contributions`,
      input,
    );

  operational.getSaleLineContributionPreview = (saleId, saleLineId, signal) =>
    client.get<ContributionPreview>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/contributions`,
      { signal },
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

  operational.transitionSalePayment = (saleId, paymentId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/payments/${paymentId}/status`,
      input,
    );

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
