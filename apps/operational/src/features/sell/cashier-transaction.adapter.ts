import type { ApiClient } from '@digvation/pos-api';

import type {
  ApiPage,
  CatalogCategory,
  CatalogItem,
  CatalogVariant,
  ContributionPreview,
  DiscountType,
  Employee,
  FulfillmentStatus,
  PaymentMethod,
  PaymentRoute,
  PaymentStatus,
  ResolvedPrice,
  QueueSale,
  Sale,
  SaleCustomerSelection,
  SellingLocation,
} from './cashier-transaction.types';

const API_PREFIX = '/api/v1';
const PAGE_SIZE = 100;

export interface CreateSaleInput {
  sellingLocationId: string;
  currency: string;
}

export interface StartSaleInput extends CreateSaleInput {
  /** The Sale is created together with the Customer it belongs to. */
  customer: SaleCustomerSelection;
  lines: Array<{
    catalogItemId: string;
    catalogVariantId?: string;
    quantity: string;
  }>;
}

export interface SetSaleCustomerInput {
  expectedVersion: number;
  customer: SaleCustomerSelection;
}

export interface AddSaleLineInput {
  expectedVersion: number;
  catalogItemId: string;
  catalogVariantId?: string;
  quantity: string;
}

export interface LoyaltyRedemptionInput {
  expectedVersion: number;
  points: string;
}

export interface SaleTaxConfiguration {
  enabled: boolean;
  /** Decimal fraction from Runtime; "0.11" means 11%. */
  rate: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SetSaleLineQuantityInput {
  expectedVersion: number;
  quantity: string;
}

/** Deliberate pre-finalization replacement; Runtime remains money authority. */
export interface CorrectSaleLineInput {
  expectedVersion: number;
  catalogItemId: string;
  catalogVariantId?: string;
  quantity: string;
  reason: string;
}
export interface CorrectionPreview {
  saleId: string;
  saleVersion: number;
  currency: string;
  currentTotalAmount: string;
  correctedTotalAmount: string;
  netSuccessfulPaidAmount: string;
  remainingPaymentAmount: string;
  overpaymentAmount: string;
  replacement: { itemName: string; variantName: string | null; quantity: string };
}

export interface PriceOverrideInput {
  expectedVersion: number;
  amount: string;
  reason: string;
}

export interface DiscountInput {
  expectedVersion: number;
  type: DiscountType;
  value: string;
  reason: string;
}

export interface AssignmentInput {
  expectedVersion: number;
  employeeIds: string[];
}

export interface ContributionInput {
  expectedVersion: number;
  contributors: Array<{ employeeId: string; shareRate?: string }>;
}

export interface ServicePerformersInput {
  expectedVersion: number;
  performers: Array<{ employeeId: string; shareRate?: string }>;
}

export interface ServiceWorkUnitsInput {
  expectedVersion: number;
  /** One entry per unit of quantity, in unit order; shares are fractions summing to 1. */
  units: Array<{ performers: Array<{ employeeId: string; shareRate: string }> }>;
}

export interface FulfillmentInput {
  expectedVersion: number;
  status: Exclude<FulfillmentStatus, 'WAITING'>;
}

export interface CreatePaymentInput {
  expectedVersion: number;
  method: PaymentMethod;
  paymentRouteId?: string;
  appliedAmount: string;
  tenderedAmount?: string;
  providerReference?: string;
}

export interface PaymentTransitionInput {
  expectedVersion: number;
  status: Exclude<PaymentStatus, 'PENDING'>;
}

export interface OpenSalePaymentCompensationInput {
  expectedVersion: number;
  amount: string;
}

export interface SellingCatalogDisplayInput {
  sellingLocationId: string;
  currency: string;
}

export interface SellingCatalogQuery {
  listSellingLocations(signal?: AbortSignal): Promise<ApiPage<SellingLocation>>;
  listCatalogCategories(signal?: AbortSignal): Promise<ApiPage<CatalogCategory>>;
  listCatalogItems(signal?: AbortSignal): Promise<ApiPage<CatalogItem>>;
  listSellingCatalogItems?(
    input: SellingCatalogDisplayInput,
    signal?: AbortSignal,
  ): Promise<ApiPage<CatalogItem>>;
  listCatalogVariants(
    catalogItemId: string,
    signal?: AbortSignal,
  ): Promise<ApiPage<CatalogVariant>>;
  resolvePrice(
    input: {
      catalogItemId: string;
      catalogVariantId?: string;
      sellingLocationId: string;
      currency: string;
      effectiveAt: string;
    },
    signal?: AbortSignal,
  ): Promise<ResolvedPrice>;
}

export interface EmployeeQuery {
  listEmployees(signal?: AbortSignal): Promise<ApiPage<Employee>>;
}
export interface PaymentRouteQuery {
  listPaymentRoutes(
    input: { sellingLocationId: string; currency: string },
    signal?: AbortSignal,
  ): Promise<ApiPage<PaymentRoute>>;
}

export interface OpenSalesQuery {
  listSales(signal?: AbortSignal): Promise<ApiPage<QueueSale>>;
}

export interface SaleTransactionClient {
  getTaxConfiguration(signal?: AbortSignal): Promise<SaleTaxConfiguration>;
  getSale(saleId: string, signal?: AbortSignal): Promise<Sale>;
  createSale(input: CreateSaleInput, idempotencyKey: string): Promise<Sale>;
  startSale(input: StartSaleInput, idempotencyKey: string): Promise<Sale>;
  setSaleCustomer(
    saleId: string,
    input: SetSaleCustomerInput,
    idempotencyKey: string,
  ): Promise<Sale>;
  addSaleLine(saleId: string, input: AddSaleLineInput, idempotencyKey: string): Promise<Sale>;
  applyLoyaltyRedemption(
    saleId: string,
    input: LoyaltyRedemptionInput,
    idempotencyKey: string,
  ): Promise<Sale>;
  removeLoyaltyRedemption(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale>;
  setSaleLineQuantity(
    saleId: string,
    saleLineId: string,
    input: SetSaleLineQuantityInput,
  ): Promise<Sale>;
  removeSaleLine(saleId: string, saleLineId: string, expectedVersion: number): Promise<Sale>;
  correctSaleLine?(
    saleId: string,
    saleLineId: string,
    input: CorrectSaleLineInput,
    idempotencyKey: string,
  ): Promise<Sale>;
  previewSaleLineCorrection?(
    saleId: string,
    saleLineId: string,
    input: Omit<CorrectSaleLineInput, 'reason'>,
  ): Promise<CorrectionPreview>;
  setSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    input: PriceOverrideInput,
  ): Promise<Sale>;
  clearSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    expectedVersion: number,
  ): Promise<Sale>;
  setSaleLineDiscount(saleId: string, saleLineId: string, input: DiscountInput): Promise<Sale>;
  clearSaleLineDiscount(saleId: string, saleLineId: string, expectedVersion: number): Promise<Sale>;
  setSaleDiscount(saleId: string, input: DiscountInput): Promise<Sale>;
  clearSaleDiscount(saleId: string, expectedVersion: number): Promise<Sale>;
  setSaleLinePerformers?(
    saleId: string,
    saleLineId: string,
    input: ServicePerformersInput,
  ): Promise<Sale>;
  setSaleLineWorkUnits?(
    saleId: string,
    saleLineId: string,
    input: ServiceWorkUnitsInput,
  ): Promise<Sale>;
  setSaleLineAssignments(saleId: string, saleLineId: string, input: AssignmentInput): Promise<Sale>;
  setSaleLineContributions(
    saleId: string,
    saleLineId: string,
    input: ContributionInput,
  ): Promise<Sale>;
  getSaleLineContributionPreview(
    saleId: string,
    saleLineId: string,
    signal?: AbortSignal,
  ): Promise<ContributionPreview>;
  transitionSaleLineFulfillment(
    saleId: string,
    saleLineId: string,
    input: FulfillmentInput,
  ): Promise<Sale>;
  queueSale(saleId: string, expectedVersion: number, idempotencyKey: string): Promise<Sale>;
  startSaleWork(saleId: string, expectedVersion: number, idempotencyKey: string): Promise<Sale>;
  createSalePayment(
    saleId: string,
    input: CreatePaymentInput,
    idempotencyKey: string,
  ): Promise<Sale>;
  transitionSalePayment(
    saleId: string,
    paymentId: string,
    input: PaymentTransitionInput,
  ): Promise<Sale>;
  compensateOpenSalePayment?(
    saleId: string,
    paymentId: string,
    input: OpenSalePaymentCompensationInput,
    idempotencyKey: string,
  ): Promise<Sale>;
  finalizeSale(saleId: string, expectedVersion: number, idempotencyKey: string): Promise<Sale>;
  voidSale(saleId: string, expectedVersion: number, idempotencyKey: string): Promise<Sale>;
}

export interface SaleTransactionPort
  extends
    SellingCatalogQuery,
    EmployeeQuery,
    PaymentRouteQuery,
    OpenSalesQuery,
    SaleTransactionClient {}

function pagePath(path: string): string {
  return `${path}?limit=${PAGE_SIZE}&offset=0`;
}

export class HttpCashierTransactionAdapter
  implements
    SellingCatalogQuery,
    EmployeeQuery,
    PaymentRouteQuery,
    OpenSalesQuery,
    SaleTransactionClient
{
  public constructor(private readonly client: ApiClient) {}

  public listSellingLocations(signal?: AbortSignal): Promise<ApiPage<SellingLocation>> {
    return this.client.get<ApiPage<SellingLocation>>(pagePath(`${API_PREFIX}/locations`), {
      signal,
    });
  }

  public listCatalogCategories(signal?: AbortSignal): Promise<ApiPage<CatalogCategory>> {
    return this.client.get<ApiPage<CatalogCategory>>(pagePath(`${API_PREFIX}/catalog/categories`), {
      signal,
    });
  }

  public listPaymentRoutes(
    input: { sellingLocationId: string; currency: string },
    signal?: AbortSignal,
  ): Promise<ApiPage<PaymentRoute>> {
    const query = new URLSearchParams({
      sellingLocationId: input.sellingLocationId,
      currency: input.currency,
    });
    return this.client.get<ApiPage<PaymentRoute>>(
      `${API_PREFIX}/sales/payment-routes?${query.toString()}`,
      { signal },
    );
  }

  public listCatalogItems(signal?: AbortSignal): Promise<ApiPage<CatalogItem>> {
    return this.client.get<ApiPage<CatalogItem>>(pagePath(`${API_PREFIX}/catalog/items`), {
      signal,
    });
  }

  public listSellingCatalogItems(
    input: SellingCatalogDisplayInput,
    signal?: AbortSignal,
  ): Promise<ApiPage<CatalogItem>> {
    const query = new URLSearchParams({
      locationId: input.sellingLocationId,
      currency: input.currency,
      limit: String(PAGE_SIZE),
      offset: '0',
    });
    return this.client.get<ApiPage<CatalogItem>>(
      `${API_PREFIX}/catalog/items/selling?${query.toString()}`,
      { signal },
    );
  }

  public listCatalogVariants(
    catalogItemId: string,
    signal?: AbortSignal,
  ): Promise<ApiPage<CatalogVariant>> {
    return this.client.get<ApiPage<CatalogVariant>>(
      pagePath(`${API_PREFIX}/catalog/items/${catalogItemId}/variants`),
      { signal },
    );
  }

  public resolvePrice(
    input: {
      catalogItemId: string;
      catalogVariantId?: string;
      sellingLocationId: string;
      currency: string;
      effectiveAt: string;
    },
    signal?: AbortSignal,
  ): Promise<ResolvedPrice> {
    const query = new URLSearchParams({
      catalogItemId: input.catalogItemId,
      locationId: input.sellingLocationId,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
    });
    if (input.catalogVariantId) query.set('catalogVariantId', input.catalogVariantId);
    return this.client.get<ResolvedPrice>(`${API_PREFIX}/pricing/resolve?${query.toString()}`, {
      signal,
    });
  }

  public listEmployees(signal?: AbortSignal): Promise<ApiPage<Employee>> {
    return this.client.get<ApiPage<Employee>>(pagePath(`${API_PREFIX}/employees`), { signal });
  }

  public listSales(signal?: AbortSignal): Promise<ApiPage<QueueSale>> {
    return this.client.get<ApiPage<QueueSale>>(pagePath(`${API_PREFIX}/sales`), { signal });
  }

  public getTaxConfiguration(signal?: AbortSignal): Promise<SaleTaxConfiguration> {
    return this.client.get<SaleTaxConfiguration>(`${API_PREFIX}/sales/configuration/tax`, {
      signal,
    });
  }

  public getSale(saleId: string, signal?: AbortSignal): Promise<Sale> {
    return this.client.get<Sale>(`${API_PREFIX}/sales/${saleId}`, { signal });
  }

  public createSale(input: CreateSaleInput, idempotencyKey: string): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  public startSale(input: StartSaleInput, idempotencyKey: string): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/start`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  public setSaleCustomer(
    saleId: string,
    input: SetSaleCustomerInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/customer`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  public addSaleLine(
    saleId: string,
    input: AddSaleLineInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/lines`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  public applyLoyaltyRedemption(
    saleId: string,
    input: LoyaltyRedemptionInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/loyalty-redemption`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
  public removeLoyaltyRedemption(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/loyalty-redemption/remove`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }
  public setSaleLineQuantity(
    saleId: string,
    saleLineId: string,
    input: SetSaleLineQuantityInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/quantity`,
      input,
    );
  }

  public removeSaleLine(
    saleId: string,
    saleLineId: string,
    expectedVersion: number,
  ): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/remove`, {
      expectedVersion,
    });
  }

  public correctSaleLine(
    saleId: string,
    saleLineId: string,
    input: CorrectSaleLineInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/correct`,
      input,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public previewSaleLineCorrection(
    saleId: string,
    saleLineId: string,
    input: Omit<CorrectSaleLineInput, 'reason'>,
  ): Promise<CorrectionPreview> {
    return this.client.post<CorrectionPreview>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/correction-preview`,
      input,
    );
  }

  public setSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    input: PriceOverrideInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/price-override`,
      input,
    );
  }

  public clearSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    expectedVersion: number,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/price-override/remove`,
      { expectedVersion },
    );
  }

  public setSaleLineDiscount(
    saleId: string,
    saleLineId: string,
    input: DiscountInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/discount`,
      input,
    );
  }

  public clearSaleLineDiscount(
    saleId: string,
    saleLineId: string,
    expectedVersion: number,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/discount/remove`,
      { expectedVersion },
    );
  }

  public setSaleDiscount(saleId: string, input: DiscountInput): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/discount`, input);
  }

  public clearSaleDiscount(saleId: string, expectedVersion: number): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/discount/remove`, {
      expectedVersion,
    });
  }

  public setSaleLinePerformers(
    saleId: string,
    saleLineId: string,
    input: ServicePerformersInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/performers`,
      input,
    );
  }

  public setSaleLineWorkUnits(
    saleId: string,
    saleLineId: string,
    input: ServiceWorkUnitsInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/work-units`,
      input,
    );
  }

  public setSaleLineAssignments(
    saleId: string,
    saleLineId: string,
    input: AssignmentInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/assignments`,
      input,
    );
  }

  public setSaleLineContributions(
    saleId: string,
    saleLineId: string,
    input: ContributionInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/contributions`,
      input,
    );
  }

  public getSaleLineContributionPreview(
    saleId: string,
    saleLineId: string,
    signal?: AbortSignal,
  ): Promise<ContributionPreview> {
    return this.client.get<ContributionPreview>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/contributions`,
      { signal },
    );
  }

  public transitionSaleLineFulfillment(
    saleId: string,
    saleLineId: string,
    input: FulfillmentInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/lines/${saleLineId}/fulfillment`,
      input,
    );
  }

  public queueSale(saleId: string, expectedVersion: number, idempotencyKey: string): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/queue`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public startSaleWork(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/start-work`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public createSalePayment(
    saleId: string,
    input: CreatePaymentInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(`${API_PREFIX}/sales/${saleId}/payments`, input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  public transitionSalePayment(
    saleId: string,
    paymentId: string,
    input: PaymentTransitionInput,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/payments/${paymentId}/status`,
      input,
    );
  }

  public compensateOpenSalePayment(
    saleId: string,
    paymentId: string,
    input: OpenSalePaymentCompensationInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/payments/${paymentId}/compensate-open`,
      input,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public finalizeSale(
    saleId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/finalize`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public voidSale(saleId: string, expectedVersion: number, idempotencyKey: string): Promise<Sale> {
    return this.client.post<Sale>(
      `${API_PREFIX}/sales/${saleId}/void`,
      { expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }
}
