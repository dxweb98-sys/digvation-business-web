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

function idempotencyHeaders(operation: string) {
  return { headers: { 'Idempotency-Key': `cashier-${operation}-${crypto.randomUUID()}` } };
}

export interface OperationalProjectionQuery {
  getOperationalCatalog?(
    input: SellingCatalogDisplayInput,
    signal?: AbortSignal,
  ): Promise<OperationalCatalogProjection>;
  setPromotionCode(
    saleId: string,
    input: { expectedVersion: number; code: string },
    idempotencyKey: string,
  ): Promise<Sale>;
  clearPromotionCode(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale>;
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
      idempotencyHeaders('line-discount'),
    );

  operational.clearSaleLineDiscount = (saleId, saleLineId, expectedVersion) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/discount/remove`,
      { expectedVersion },
      idempotencyHeaders('line-discount-remove'),
    );

  operational.setSaleDiscount = (saleId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/discount`,
      input,
      idempotencyHeaders('order-discount'),
    );

  operational.clearSaleDiscount = (saleId, expectedVersion) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/discount/remove`,
      { expectedVersion },
      idempotencyHeaders('order-discount-remove'),
    );

  operational.setPromotionCode = (saleId, input, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/promo-code`,
      input,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  operational.clearPromotionCode = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/promo-code/remove`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

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
