import type { ApiClient } from '@digvation/business-api';

import type {
  AddSaleLineInput,
  ReplaceLinePreview,
  ReplaceSaleLineInput,
  CreatePaymentInput,
  CreateSaleInput,
  SaleTransactionPort,
  SetSaleCustomerInput,
  SetSaleLineQuantityInput,
  SellingCatalogDisplayInput,
  StartSaleInput,
} from './cashier-transaction.adapter';
import type {
  ApiPage,
  ComponentCandidate,
  ContributionPreview,
  Employee,
  OperationalCatalogProjection,
  PaymentRoute,
  QueueSale,
  Sale,
} from './cashier-transaction.types';

const OPERATIONAL_PREFIX = '/api/v1/operational';

function idempotencyHeaders(operation: string) {
  return { headers: { 'Idempotency-Key': `cashier-${operation}-${crypto.randomUUID()}` } };
}

export interface OperationalProjectionQuery {
  /** Products (including component-only ones) the operator may add to a Service. */
  getComponentCandidates?(
    input: SellingCatalogDisplayInput & { q?: string },
    signal?: AbortSignal,
  ): Promise<{ items: ComponentCandidate[] }>;
  getOperationalCatalog?(
    input: SellingCatalogDisplayInput,
    signal?: AbortSignal,
  ): Promise<OperationalCatalogProjection>;
}

export interface OperationalPromotionCommands {
  setPromotionCode(
    saleId: string,
    input: { expectedVersion: number; code: string },
    idempotencyKey: string,
  ): Promise<Sale>;
  refreshPromotionEligibility(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale>;
  clearPromotionCode(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale>;
}

/**
 * Receipt delivery is requested for a captured transaction and handled outside
 * it. Without a target Runtime uses the transaction's customer snapshot; a
 * target redirects that one attempt and never changes transaction or Customer data.
 */
export interface OperationalReceiptDeliveryCommands {
  requestReceiptDelivery(
    saleId: string,
    request: ReceiptDeliveryRequest,
  ): Promise<{ deliveryId: string; channel: 'WHATSAPP'; state: ReceiptDeliveryState }>;
  getReceiptDeliveryStatus(saleId: string): Promise<OperationalReceiptDeliveryStatus>;
}

export type ReceiptDeliveryState = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';

export interface ReceiptDeliveryRequest {
  readonly channel: 'WHATSAPP';
  /** One key per send intent: repeating it never delivers twice. */
  readonly idempotencyKey: string;
  readonly destination?: string;
  readonly retryOfDeliveryId?: string;
}

/** One attempt. The destination arrives masked; delivery history never reveals the number. */
export interface ReceiptDeliveryAttempt {
  readonly deliveryId: string;
  /** SENT: the WhatsApp provider accepted the request. Not a delivery confirmation. */
  readonly status: ReceiptDeliveryState;
  readonly destinationMasked: string;
  readonly customerDestination: boolean;
  readonly attemptCount: number;
  readonly failureCategory: string | null;
  readonly requestedAt: string;
  readonly sentAt: string | null;
  readonly failedAt: string | null;
  readonly requestedByName: string | null;
  readonly retryAllowed: boolean;
}

export interface OperationalReceiptDeliveryStatus {
  readonly available: boolean;
  readonly customerDestinationMasked: string | null;
  readonly delivery: ReceiptDeliveryAttempt | null;
  readonly history: readonly ReceiptDeliveryAttempt[];
}

/** Latest attempt of a completed transaction, as listed beside the queue. */
export interface ReceiptDeliveryIndicator {
  readonly status: ReceiptDeliveryState;
  readonly destinationMasked: string;
  readonly requestedAt: string;
}

export interface OperationalQueuePage extends ApiPage<QueueSale> {
  readonly receiptDeliveries?: Readonly<Record<string, ReceiptDeliveryIndicator>>;
}

export type OperationalAwareTransactionPort = SaleTransactionPort &
  OperationalProjectionQuery &
  OperationalPromotionCommands &
  OperationalReceiptDeliveryCommands;

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

  operational.getComponentCandidates = (input, signal) => {
    const query = new URLSearchParams({
      locationId: input.sellingLocationId,
      currency: input.currency,
    });
    if (input.q) query.set('q', input.q);
    return client.get<{ items: ComponentCandidate[] }>(
      `${OPERATIONAL_PREFIX}/component-candidates?${query.toString()}`,
      { signal },
    );
  };

  operational.listServicePerformers = (signal) =>
    client.get<ApiPage<Employee>>(`${OPERATIONAL_PREFIX}/employees`, { signal });

  operational.listProductSalespeople = (signal) =>
    client.get<ApiPage<Employee>>(`${OPERATIONAL_PREFIX}/product-salespeople`, { signal });

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
    return client.get<OperationalQueuePage>(`${OPERATIONAL_PREFIX}/queue${suffix}`, { signal });
  };

  operational.createSale = (input: CreateSaleInput, idempotencyKey: string) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/empty`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.startSale = (input: StartSaleInput, idempotencyKey: string) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.setSaleCustomer = (
    saleId: string,
    input: SetSaleCustomerInput,
    idempotencyKey: string,
  ) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/customer`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.requestReceiptDelivery = (
    saleId: string,
    { idempotencyKey, ...body }: ReceiptDeliveryRequest,
  ) =>
    client.post<{ deliveryId: string; channel: 'WHATSAPP'; state: ReceiptDeliveryState }>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/receipt-deliveries`,
      body,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  operational.getReceiptDeliveryStatus = (saleId: string) =>
    client.get<OperationalReceiptDeliveryStatus>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/receipt-deliveries/latest`,
    );

  operational.getSale = (saleId, signal) =>
    client.get<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}`, { signal });

  operational.addSaleLine = (saleId: string, input: AddSaleLineInput, idempotencyKey: string) =>
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/lines`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.replaceSaleLine = (
    saleId: string,
    saleLineId: string,
    input: ReplaceSaleLineInput,
    idempotencyKey: string,
  ) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/replace`,
      input,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );

  operational.previewReplaceSaleLine = (
    saleId: string,
    saleLineId: string,
    input: ReplaceSaleLineInput,
  ) =>
    client.post<ReplaceLinePreview>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/replace-preview`,
      input,
    );

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
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/remove`, {
      expectedVersion,
    });

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
    client.post<Sale>(`${OPERATIONAL_PREFIX}/transactions/${saleId}/promo-code`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });

  operational.refreshPromotionEligibility = (saleId, expectedVersion, idempotencyKey) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/promotions/refresh`,
      { expectedVersion },
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

  operational.setSaleLineWorkUnits = (saleId, saleLineId, input) =>
    client.post<Sale>(
      `${OPERATIONAL_PREFIX}/transactions/${saleId}/lines/${saleLineId}/work-units`,
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
