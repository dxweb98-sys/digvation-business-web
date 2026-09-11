import { createDecimal } from '@digvation/pos-money';

import type {
  AddSaleLineInput,
  AssignmentInput,
  ContributionInput,
  CreatePaymentInput,
  CreateSaleInput,
  DiscountInput,
  EmployeeQuery,
  FulfillmentInput,
  OpenSalesQuery,
  PaymentTransitionInput,
  PriceOverrideInput,
  SaleTransactionClient,
  SellingCatalogQuery,
  SetSaleLineQuantityInput,
  StartSaleInput,
} from './cashier-transaction.adapter';
import type {
  ApiPage,
  CatalogCategory,
  CatalogItem,
  CatalogVariant,
  ContributionPreview,
  Employee,
  EmployeeContribution,
  Payment,
  ResolvedPrice,
  Sale,
  SaleLine,
  SellingLocation,
} from './cashier-transaction.types';

const DEMO_CREATED_AT = '2026-09-04T09:00:00.000Z';

const locations: SellingLocation[] = [namedRecord('loc-demo-main', 'MAIN', 'Main Branch')];

const categories: CatalogCategory[] = [
  namedRecord('Hair', 'HAIR', 'Hair'),
  namedRecord('Treatment', 'TREATMENT', 'Treatment'),
  namedRecord('Retail', 'RETAIL', 'Retail'),
];

const items: CatalogItem[] = [
  serviceItem('svc-hair-cut', 'SVC-HAIRCUT', 'Hair Cut', 'Hair', 45, false),
  serviceItem('svc-creambath', 'SVC-CREAMBATH', 'Creambath', 'Treatment', 60, false),
  serviceItem('svc-facial-care', 'SVC-FACIAL', 'Facial Care', 'Treatment', 60, true),
  serviceItem('svc-hair-coloring', 'SVC-COLOR', 'Hair Coloring', 'Hair', 90, true),
  productItem('prd-shampoo', 'PRD-SHAMPOO', 'Shampoo', 'Retail', false),
  productItem('prd-hair-serum', 'PRD-SERUM', 'Hair Serum', 'Retail', true),
];

const variants: CatalogVariant[] = [
  variant('var-facial-basic', 'FACIAL-BASIC', 'Basic', 'svc-facial-care'),
  variant('var-facial-premium', 'FACIAL-PREMIUM', 'Premium', 'svc-facial-care'),
  variant('var-color-short', 'COLOR-SHORT', 'Short', 'svc-hair-coloring'),
  variant('var-color-medium', 'COLOR-MEDIUM', 'Medium', 'svc-hair-coloring'),
  variant('var-color-long', 'COLOR-LONG', 'Long', 'svc-hair-coloring'),
  variant('var-serum-50', 'SERUM-50', '50 ml', 'prd-hair-serum'),
  variant('var-serum-100', 'SERUM-100', '100 ml', 'prd-hair-serum'),
];

const employees: Employee[] = [
  employee('emp-001', 'EMP-001', 'Rina'),
  employee('emp-002', 'EMP-002', 'Sari'),
  employee('emp-003', 'EMP-003', 'Dimas'),
];

const basePrices = new Map<string, string>([
  ['svc-hair-cut', '75000.0000'],
  ['svc-creambath', '120000.0000'],
  ['svc-facial-care', '175000.0000'],
  ['svc-hair-coloring', '250000.0000'],
  ['prd-shampoo', '85000.0000'],
  ['prd-hair-serum', '95000.0000'],
]);

const variantPrices = new Map<string, string>([
  ['var-facial-basic', '175000.0000'],
  ['var-facial-premium', '250000.0000'],
  ['var-color-short', '250000.0000'],
  ['var-color-medium', '350000.0000'],
  ['var-color-long', '450000.0000'],
  ['var-serum-50', '95000.0000'],
  ['var-serum-100', '165000.0000'],
]);

interface DemoState {
  sales: Map<string, Sale>;
  saleCounter: number;
  lineCounter: number;
  paymentCounter: number;
}

const state: DemoState = {
  sales: new Map(),
  saleCounter: 1,
  lineCounter: 1,
  paymentCounter: 1,
};

function namedRecord(id: string, code: string, name: string) {
  return {
    id,
    code,
    name,
    status: 'ACTIVE' as const,
    version: 1,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  };
}

function serviceItem(
  id: string,
  code: string,
  name: string,
  categoryId: string,
  duration: number,
  hasVariants: boolean,
): CatalogItem {
  void hasVariants;
  return {
    id,
    code,
    name,
    type: 'SERVICE',
    categoryId,
    taxCategoryId: null,
    description: null,
    lifecycle: 'ACTIVE',
    fulfillmentBehavior: 'TRACKED',
    version: 1,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
    serviceDefinition: {
      defaultDurationMinutes: duration,
      employeeAssignmentMode: 'REQUIRED',
      allowEmployeeContribution: true,
    },
  };
}

function productItem(
  id: string,
  code: string,
  name: string,
  categoryId: string,
  hasVariants: boolean,
): CatalogItem {
  void hasVariants;
  return {
    id,
    code,
    name,
    type: 'PRODUCT',
    categoryId,
    taxCategoryId: null,
    description: null,
    lifecycle: 'ACTIVE',
    fulfillmentBehavior: 'INSTANT',
    version: 1,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
    serviceDefinition: null,
  };
}

function variant(id: string, code: string, name: string, catalogItemId: string): CatalogVariant {
  return {
    ...namedRecord(id, code, name),
    catalogItemId,
  };
}

function employee(id: string, code: string, displayName: string): Employee {
  return {
    id,
    code,
    displayName,
    status: 'ACTIVE',
    version: 1,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function page<T>(records: readonly T[]): ApiPage<T> {
  return { items: records.map((record) => clone(record)), limit: 100, offset: 0 };
}

function now(): string {
  return new Date().toISOString();
}

function requireSale(saleId: string): Sale {
  const sale = state.sales.get(saleId);
  if (!sale) throw new Error(`Sale ${saleId} was not found.`);
  return sale;
}

function requireOpenSale(saleId: string): Sale {
  const sale = requireSale(saleId);
  if (sale.status !== 'OPEN') throw new Error('Finalized or voided Sales cannot be changed.');
  return sale;
}

function requireLine(sale: Sale, saleLineId: string): SaleLine {
  const line = sale.lines.find((candidate) => candidate.id === saleLineId);
  if (!line) throw new Error(`Sale line ${saleLineId} was not found.`);
  return line;
}

function touch(sale: Sale): void {
  sale.version += 1;
  sale.updatedAt = now();
}

function decimal(value: string) {
  return createDecimal(value || '0');
}

function toMoney(value: ReturnType<typeof createDecimal>): string {
  return value.toDecimalPlaces(4).toFixed(4);
}

function discountAmount(
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | null,
  value: string | null,
  base: string,
) {
  if (!type || !value) return createDecimal('0');
  const baseAmount = decimal(base);
  const requested = type === 'PERCENTAGE' ? baseAmount.times(decimal(value)) : decimal(value);
  if (requested.lessThan(0)) return createDecimal('0');
  return requested.greaterThan(baseAmount) ? baseAmount : requested;
}

function recalculateLineBase(line: SaleLine): void {
  const gross = decimal(line.effectiveUnitPrice).times(decimal(line.quantity));
  const lineDiscount = discountAmount(line.discountType, line.discountValue, toMoney(gross));
  const afterLineDiscount = gross.minus(lineDiscount);
  line.grossAmount = toMoney(gross);
  line.lineDiscountAmount = toMoney(lineDiscount);
  line.discountedCustomerBaseAmount = toMoney(afterLineDiscount);
  line.includedTaxAmount = '0.0000';
  line.excludedTaxAmount = '0.0000';
  line.taxAmount = '0.0000';
}

function recalculateSale(sale: Sale): void {
  const active = sale.lines.filter((line) => line.removedAt === null);
  for (const line of active) recalculateLineBase(line);

  const gross = active.reduce(
    (sum, line) => sum.plus(decimal(line.grossAmount)),
    createDecimal('0'),
  );
  const lineDiscount = active.reduce(
    (sum, line) => sum.plus(decimal(line.lineDiscountAmount)),
    createDecimal('0'),
  );
  const afterLineDiscount = active.reduce(
    (sum, line) => sum.plus(decimal(line.discountedCustomerBaseAmount)),
    createDecimal('0'),
  );
  const orderDiscount = discountAmount(
    sale.orderDiscountType,
    sale.orderDiscountValue,
    toMoney(afterLineDiscount),
  );

  let allocated = createDecimal('0');
  active.forEach((line, index) => {
    let allocation = createDecimal('0');
    if (orderDiscount.greaterThan(0) && afterLineDiscount.greaterThan(0)) {
      allocation =
        index === active.length - 1
          ? orderDiscount.minus(allocated)
          : orderDiscount
              .times(decimal(line.discountedCustomerBaseAmount))
              .dividedBy(afterLineDiscount)
              .toDecimalPlaces(4);
      allocated = allocated.plus(allocation);
    }
    line.orderDiscountAllocationAmount = toMoney(allocation);
    const net = decimal(line.discountedCustomerBaseAmount).minus(allocation);
    line.netPreTaxAmount = toMoney(net);
    line.totalAmount = toMoney(net);
  });

  const total = active.reduce(
    (sum, line) => sum.plus(decimal(line.totalAmount)),
    createDecimal('0'),
  );
  sale.grossAmount = toMoney(gross);
  sale.orderDiscountAmount = toMoney(orderDiscount);
  sale.discountAmount = toMoney(lineDiscount.plus(orderDiscount));
  sale.netPreTaxAmount = toMoney(total);
  sale.taxAmount = '0.0000';
  sale.totalAmount = toMoney(total);
}

function resolvePriceRecord(
  catalogItemId: string,
  catalogVariantId: string | undefined,
  locationId: string,
  currency: string,
): ResolvedPrice {
  const amount = catalogVariantId
    ? variantPrices.get(catalogVariantId)
    : basePrices.get(catalogItemId);
  if (!amount) throw new Error('No demo price exists for the selected item/variant.');
  return {
    catalogPriceId: `demo-price-${catalogVariantId ?? catalogItemId}`,
    catalogItemId,
    catalogVariantId: catalogVariantId ?? null,
    locationId,
    currency,
    amount,
    effectiveAt: now(),
    sourceScope: { catalogVariantId: catalogVariantId ?? null, locationId },
  };
}

function contributionFacts(line: SaleLine, finalizedAt: string): EmployeeContribution[] {
  const base = decimal(line.totalAmount);
  return line.participations
    .filter((participation) => participation.assigned && participation.shareRate !== null)
    .map((participation) => {
      const employeeRecord = employees.find((employee) => employee.id === participation.employeeId);
      const rate = decimal(participation.shareRate ?? '0');
      return {
        saleId: line.saleId,
        saleLineId: line.id,
        employeeId: participation.employeeId,
        employeeCodeSnapshot: employeeRecord?.code ?? participation.employeeId,
        employeeDisplayNameSnapshot: employeeRecord?.displayName ?? 'Karyawan',
        shareRate: rate.toFixed(4),
        contributionBaseAmount: toMoney(base),
        contributionAmount: toMoney(base.times(rate)),
        finalizedAt,
      };
    });
}

function validateReadyToFinalize(sale: Sale): void {
  const active = sale.lines.filter((line) => line.removedAt === null);
  if (!active.length) throw new Error('Tambahkan setidaknya satu item.');
  if (sale.payments.some((payment) => payment.status === 'PENDING')) {
    throw new Error('Selesaikan pembayaran yang masih pending.');
  }
  const paid = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum.plus(decimal(payment.appliedAmount)), createDecimal('0'));
  if (!paid.equals(decimal(sale.totalAmount))) {
    throw new Error('Pembayaran berhasil harus sama dengan total transaksi.');
  }
  for (const line of active) {
    if (
      line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
      !line.participations.some((participation) => participation.assigned)
    ) {
      throw new Error(`${line.itemNameSnapshot}: pilih karyawan.`);
    }
    if (line.allowEmployeeContributionSnapshot) {
      const shares = line.participations
        .filter((participation) => participation.assigned && participation.shareRate !== null)
        .reduce(
          (sum, participation) => sum.plus(decimal(participation.shareRate ?? '0')),
          createDecimal('0'),
        );
      if (!shares.equals(1)) {
        throw new Error(`${line.itemNameSnapshot}: kontribusi karyawan harus tepat 100%.`);
      }
    }
  }
}

export class LocalDemoCashierTransactionAdapter
  implements SellingCatalogQuery, EmployeeQuery, OpenSalesQuery, SaleTransactionClient
{
  public async listSellingLocations(): Promise<ApiPage<SellingLocation>> {
    return page(locations);
  }

  public async listCatalogCategories(): Promise<ApiPage<CatalogCategory>> {
    return page(categories);
  }

  public async listCatalogItems(): Promise<ApiPage<CatalogItem>> {
    return page(items);
  }

  public async listCatalogVariants(catalogItemId: string): Promise<ApiPage<CatalogVariant>> {
    return page(variants.filter((candidate) => candidate.catalogItemId === catalogItemId));
  }

  public async resolvePrice(input: {
    catalogItemId: string;
    catalogVariantId?: string;
    sellingLocationId: string;
    currency: string;
    effectiveAt: string;
  }): Promise<ResolvedPrice> {
    return clone(
      resolvePriceRecord(
        input.catalogItemId,
        input.catalogVariantId,
        input.sellingLocationId,
        input.currency,
      ),
    );
  }

  public async listEmployees(): Promise<ApiPage<Employee>> {
    return page(employees);
  }

  public async listSales(): Promise<ApiPage<Sale>> {
    return page([...state.sales.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  public async getSale(saleId: string): Promise<Sale> {
    return clone(requireSale(saleId));
  }

  public async createSale(input: CreateSaleInput, idempotencyKey: string): Promise<Sale> {
    void idempotencyKey;
    const createdAt = now();
    const id = `SALE-DEMO-${String(state.saleCounter++).padStart(4, '0')}`;
    const sale: Sale = {
      id,
      sellingLocationId: input.sellingLocationId,
      currency: input.currency,
      status: 'OPEN',
      version: 1,
      grossAmount: '0.0000',
      discountAmount: '0.0000',
      netPreTaxAmount: '0.0000',
      taxAmount: '0.0000',
      totalAmount: '0.0000',
      orderDiscountType: null,
      orderDiscountValue: null,
      orderDiscountReason: null,
      orderDiscountAmount: '0.0000',
      finalizedAt: null,
      voidedAt: null,
      createdAt,
      updatedAt: createdAt,
      lines: [],
      payments: [],
    };
    state.sales.set(id, sale);
    return clone(sale);
  }

  public async startSale(input: StartSaleInput, idempotencyKey: string): Promise<Sale> {
    const saleCounter = state.saleCounter;
    const lineCounter = state.lineCounter;
    let createdSaleId: string | null = null;
    try {
      let sale = await this.createSale(input, idempotencyKey);
      createdSaleId = sale.id;
      for (const [index, line] of input.lines.entries()) {
        sale = await this.addSaleLine(
          sale.id,
          { ...line, expectedVersion: sale.version },
          `${idempotencyKey}:line:${index}`,
        );
      }
      const started = { ...sale, version: 1 };
      state.sales.set(started.id, started);
      return clone(started);
    } catch (error) {
      if (createdSaleId) state.sales.delete(createdSaleId);
      state.saleCounter = saleCounter;
      state.lineCounter = lineCounter;
      throw error;
    }
  }

  public async addSaleLine(
    saleId: string,
    input: AddSaleLineInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    void idempotencyKey;
    const sale = requireOpenSale(saleId);
    const item = items.find((candidate) => candidate.id === input.catalogItemId);
    if (!item) throw new Error('Catalog item was not found.');
    const variantRecord = input.catalogVariantId
      ? variants.find((candidate) => candidate.id === input.catalogVariantId)
      : undefined;
    if (input.catalogVariantId && !variantRecord) throw new Error('Variant was not found.');
    const price = resolvePriceRecord(
      item.id,
      input.catalogVariantId,
      sale.sellingLocationId,
      sale.currency,
    );
    const compatibleLine = sale.lines.find(
      (line) =>
        line.removedAt === null &&
        line.catalogItemId === item.id &&
        line.catalogVariantId === (input.catalogVariantId ?? null) &&
        line.catalogPriceId === price.catalogPriceId &&
        line.resolvedUnitPrice === price.amount &&
        line.effectiveUnitPrice === price.amount &&
        line.overrideAmount === null &&
        line.discountType === null &&
        line.fulfillment?.status !== 'IN_PROGRESS' &&
        line.fulfillment?.status !== 'COMPLETED' &&
        !line.participations.some((participation) => participation.assigned) &&
        line.contributions.length === 0,
    );
    if (compatibleLine) {
      compatibleLine.quantity = decimal(compatibleLine.quantity)
        .plus(decimal(input.quantity))
        .toFixed(4);
      compatibleLine.updatedAt = now();
      recalculateSale(sale);
      touch(sale);
      return clone(sale);
    }
    const lineId = `line-demo-${String(state.lineCounter++).padStart(4, '0')}`;
    const createdAt = now();
    const service = item.serviceDefinition;
    const line: SaleLine = {
      id: lineId,
      saleId,
      catalogItemId: item.id,
      catalogVariantId: input.catalogVariantId ?? null,
      catalogPriceId: price.catalogPriceId,
      itemCodeSnapshot: item.code,
      itemNameSnapshot: item.name,
      itemTypeSnapshot: item.type,
      variantCodeSnapshot: variantRecord?.code ?? null,
      variantNameSnapshot: variantRecord?.name ?? null,
      fulfillmentBehaviorSnapshot: item.fulfillmentBehavior,
      employeeAssignmentModeSnapshot: service?.employeeAssignmentMode ?? null,
      allowEmployeeContributionSnapshot: service?.allowEmployeeContribution ?? false,
      defaultDurationMinutesSnapshot: service?.defaultDurationMinutes ?? null,
      quantity: decimal(input.quantity).toFixed(4),
      currency: sale.currency,
      resolvedUnitPrice: price.amount,
      effectiveUnitPrice: price.amount,
      overrideAmount: null,
      overrideReason: null,
      discountType: null,
      discountValue: null,
      discountReason: null,
      grossAmount: '0.0000',
      lineDiscountAmount: '0.0000',
      orderDiscountAllocationAmount: '0.0000',
      discountedCustomerBaseAmount: '0.0000',
      includedTaxAmount: '0.0000',
      excludedTaxAmount: '0.0000',
      netPreTaxAmount: '0.0000',
      taxAmount: '0.0000',
      totalAmount: '0.0000',
      removedAt: null,
      createdAt,
      updatedAt: createdAt,
      fulfillment:
        item.fulfillmentBehavior === 'TRACKED'
          ? {
              saleId,
              saleLineId: lineId,
              status: 'WAITING',
              startedAt: null,
              completedAt: null,
              canceledAt: null,
            }
          : null,
      participations: [],
      contributions: [],
    };
    sale.lines.push(line);
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async setSaleLineQuantity(
    saleId: string,
    saleLineId: string,
    input: SetSaleLineQuantityInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.quantity = decimal(input.quantity).toFixed(4);
    line.updatedAt = now();
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async removeSaleLine(saleId: string, saleLineId: string): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.removedAt = now();
    line.updatedAt = line.removedAt;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async setSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    input: PriceOverrideInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.overrideAmount = decimal(input.amount).toFixed(4);
    line.overrideReason = input.reason;
    line.effectiveUnitPrice = line.overrideAmount;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async clearSaleLinePriceOverride(saleId: string, saleLineId: string): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.overrideAmount = null;
    line.overrideReason = null;
    line.effectiveUnitPrice = line.resolvedUnitPrice;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async setSaleLineDiscount(
    saleId: string,
    saleLineId: string,
    input: DiscountInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.discountType = input.type;
    line.discountValue = input.value;
    line.discountReason = input.reason;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async clearSaleLineDiscount(saleId: string, saleLineId: string): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.discountType = null;
    line.discountValue = null;
    line.discountReason = null;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async setSaleDiscount(saleId: string, input: DiscountInput): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    sale.orderDiscountType = input.type;
    sale.orderDiscountValue = input.value;
    sale.orderDiscountReason = input.reason;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async clearSaleDiscount(saleId: string): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    sale.orderDiscountType = null;
    sale.orderDiscountValue = null;
    sale.orderDiscountReason = null;
    recalculateSale(sale);
    touch(sale);
    return clone(sale);
  }

  public async setSaleLineAssignments(
    saleId: string,
    saleLineId: string,
    input: AssignmentInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    line.participations = input.employeeIds.map((employeeId) => ({
      saleId,
      saleLineId,
      employeeId,
      assigned: true,
      shareRate: input.employeeIds.length === 1 ? '1.0000' : null,
    }));
    touch(sale);
    return clone(sale);
  }

  public async setSaleLineContributions(
    saleId: string,
    saleLineId: string,
    input: ContributionInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    const shareByEmployee = new Map(
      input.contributors.map((contributor) => [
        contributor.employeeId,
        contributor.shareRate ?? null,
      ]),
    );
    line.participations = line.participations.map((participation) => ({
      ...participation,
      shareRate: shareByEmployee.get(participation.employeeId) ?? participation.shareRate,
    }));
    touch(sale);
    return clone(sale);
  }

  public async getSaleLineContributionPreview(
    saleId: string,
    saleLineId: string,
  ): Promise<ContributionPreview> {
    const sale = requireSale(saleId);
    const line = requireLine(sale, saleLineId);
    const base = decimal(line.totalAmount);
    return {
      saleId,
      saleLineId,
      version: sale.version,
      contributionBaseAmount: toMoney(base),
      preview: line.participations
        .filter((participation) => participation.assigned && participation.shareRate !== null)
        .map((participation) => ({
          employeeId: participation.employeeId,
          contributionAmount: toMoney(base.times(decimal(participation.shareRate ?? '0'))),
        })),
      facts: clone(line.contributions),
    };
  }

  public async transitionSaleLineFulfillment(
    saleId: string,
    saleLineId: string,
    input: FulfillmentInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const line = requireLine(sale, saleLineId);
    if (!line.fulfillment) throw new Error('This line does not use tracked fulfillment.');
    const at = now();
    line.fulfillment.status = input.status;
    if (input.status === 'IN_PROGRESS')
      line.fulfillment.startedAt = line.fulfillment.startedAt ?? at;
    if (input.status === 'COMPLETED') {
      line.fulfillment.startedAt = line.fulfillment.startedAt ?? at;
      line.fulfillment.completedAt = at;
      line.fulfillment.canceledAt = null;
    }
    if (input.status === 'CANCELED') {
      line.fulfillment.canceledAt = at;
      line.fulfillment.completedAt = null;
    }
    touch(sale);
    return clone(sale);
  }

  public async createSalePayment(
    saleId: string,
    input: CreatePaymentInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const applied = decimal(input.appliedAmount);
    const tendered = input.tenderedAmount ? decimal(input.tenderedAmount) : null;
    if (applied.lessThanOrEqualTo(0)) throw new Error('Payment amount must be greater than zero.');
    if (input.method === 'CASH' && (!tendered || tendered.lessThan(applied))) {
      throw new Error('Uang dibayar tidak boleh kurang dari nominal pembayaran.');
    }
    const at = now();
    const payment: Payment = {
      id: `payment-demo-${String(state.paymentCounter++).padStart(4, '0')}`,
      saleId,
      method: input.method,
      status: 'SUCCEEDED',
      currency: sale.currency,
      appliedAmount: applied.toFixed(4),
      tenderedAmount: tendered?.toFixed(4) ?? null,
      changeAmount: tendered ? toMoney(tendered.minus(applied)) : null,
      providerReference: input.providerReference ?? null,
      idempotencyKey,
      createdByActorId: 'demo-cashier',
      createdByActorKind: 'USER',
      settledByActorId: 'demo-cashier',
      settledByActorKind: 'USER',
      terminalAt: at,
      createdAt: at,
      updatedAt: at,
    };
    sale.payments.push(payment);
    touch(sale);
    return clone(sale);
  }

  public async transitionSalePayment(
    saleId: string,
    paymentId: string,
    input: PaymentTransitionInput,
  ): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    const payment = sale.payments.find((candidate) => candidate.id === paymentId);
    if (!payment) throw new Error('Payment was not found.');
    const at = now();
    payment.status = input.status;
    payment.updatedAt = at;
    payment.terminalAt = at;
    if (input.status === 'SUCCEEDED') {
      payment.settledByActorId = 'demo-cashier';
      payment.settledByActorKind = 'USER';
    }
    touch(sale);
    return clone(sale);
  }

  public async finalizeSale(saleId: string): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    validateReadyToFinalize(sale);
    const finalizedAt = now();
    sale.status = 'FINALIZED';
    sale.finalizedAt = finalizedAt;
    sale.lines
      .filter((line) => line.removedAt === null && line.allowEmployeeContributionSnapshot)
      .forEach((line) => {
        line.contributions = contributionFacts(line, finalizedAt);
      });
    touch(sale);
    return clone(sale);
  }

  public async voidSale(saleId: string): Promise<Sale> {
    const sale = requireOpenSale(saleId);
    if (sale.payments.some((payment) => ['PENDING', 'SUCCEEDED'].includes(payment.status))) {
      throw new Error('Transaksi dengan pembayaran aktif tidak dapat dibatalkan.');
    }
    sale.status = 'VOIDED';
    sale.voidedAt = now();
    touch(sale);
    return clone(sale);
  }
}

let demoAdapter: LocalDemoCashierTransactionAdapter | null = null;

export function getLocalDemoCashierTransactionAdapter(): LocalDemoCashierTransactionAdapter {
  demoAdapter ??= new LocalDemoCashierTransactionAdapter();
  return demoAdapter;
}
