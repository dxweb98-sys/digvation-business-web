import { createDecimal } from '@digvation/pos-money';

import type {
  AddSaleLineInput,
  AssignmentInput,
  ContributionInput,
  CreatePaymentInput,
  CreateSaleInput,
  DiscountInput,
  FulfillmentInput,
  PaymentTransitionInput,
  PriceOverrideInput,
  SaleTransactionPort,
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
  Payment,
  ResolvedPrice,
  Sale,
  SaleLine,
  SellingLocation,
} from './cashier-transaction.types';

interface DemoItem extends CatalogItem {
  prices: Record<string, string>;
}

const decimal = (value: string) => createDecimal(value);
const fixed = (value: ReturnType<typeof createDecimal>) => value.toFixed(4);
const clone = <T>(value: T): T => structuredClone(value);
const page = <T>(items: readonly T[]): ApiPage<T> => ({
  items: clone([...items]),
  limit: 100,
  offset: 0,
});

function timestamp() {
  return new Date().toISOString();
}

function record(id: string, code: string, name: string) {
  const time = timestamp();
  return {
    id,
    code,
    name,
    status: 'ACTIVE' as const,
    version: 1,
    createdAt: time,
    updatedAt: time,
  };
}

/**
 * Development-only in-memory implementation of the same Cashier transaction port
 * used by HTTP. It is a small local POS boundary, not UI-owned Sale/Payment state.
 */
export class LocalCashierTransactionAdapter implements SaleTransactionPort {
  private readonly location: SellingLocation = record('demo-branch-001', 'STUDIO', 'Studio Branch');
  private readonly categories: CatalogCategory[] = [
    record('demo-services', 'SERVICES', 'Services'),
    record('demo-products', 'PRODUCTS', 'Products'),
  ];
  private readonly employees: Employee[] = ['Ari', 'Bima', 'Citra'].map((displayName, index) => {
    const time = timestamp();
    return {
      id: `demo-employee-00${index + 1}`,
      code: `EMP-00${index + 1}`,
      displayName,
      status: 'ACTIVE',
      version: 1,
      createdAt: time,
      updatedAt: time,
    };
  });
  private readonly variants: CatalogVariant[] = [
    { ...record('demo-variant-short', 'SHORT', 'Short'), catalogItemId: 'demo-item-001' },
    { ...record('demo-variant-long', 'LONG', 'Long'), catalogItemId: 'demo-item-001' },
  ];
  private readonly items: DemoItem[] = this.createItems();
  private readonly sales = new Map<string, Sale>();
  private sequence = 1;

  public async listSellingLocations(): Promise<ApiPage<SellingLocation>> {
    return page([this.location]);
  }

  public async listCatalogCategories(): Promise<ApiPage<CatalogCategory>> {
    return page(this.categories);
  }

  public async listCatalogItems(): Promise<ApiPage<CatalogItem>> {
    return page(this.items);
  }

  public async listCatalogVariants(catalogItemId: string): Promise<ApiPage<CatalogVariant>> {
    return page(this.variants.filter((variant) => variant.catalogItemId === catalogItemId));
  }

  public async resolvePrice(input: {
    catalogItemId: string;
    catalogVariantId?: string;
    sellingLocationId: string;
    currency: string;
    effectiveAt: string;
  }): Promise<ResolvedPrice> {
    if (input.sellingLocationId !== this.location.id) throw new Error('Demo Branch was not found.');
    const item = this.item(input.catalogItemId);
    const variantId = input.catalogVariantId ?? null;
    const amount = item.prices[variantId ?? 'base'];
    if (!amount) throw new Error('Demo price was not found.');
    return clone({
      catalogPriceId: `demo-price-${item.id}-${variantId ?? 'base'}`,
      catalogItemId: item.id,
      catalogVariantId: variantId,
      locationId: this.location.id,
      currency: input.currency,
      amount,
      effectiveAt: input.effectiveAt,
      sourceScope: { catalogVariantId: variantId, locationId: this.location.id },
    });
  }

  public async listEmployees(): Promise<ApiPage<Employee>> {
    return page(this.employees);
  }

  public async listSales(): Promise<ApiPage<Sale>> {
    return page(
      [...this.sales.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  public async getSale(saleId: string): Promise<Sale> {
    return clone(this.sale(saleId));
  }

  public async createSale(input: CreateSaleInput, idempotencyKey: string): Promise<Sale> {
    void idempotencyKey;
    if (input.sellingLocationId !== this.location.id) throw new Error('Demo Branch was not found.');
    const time = timestamp();
    const sale: Sale = {
      id: `demo-sale-${this.sequence++}`,
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
      createdAt: time,
      updatedAt: time,
      lines: [],
      payments: [],
    };
    this.sales.set(sale.id, sale);
    return clone(sale);
  }

  public async startSale(input: StartSaleInput, idempotencyKey: string): Promise<Sale> {
    const sequence = this.sequence;
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
      this.sales.set(started.id, started);
      return clone(started);
    } catch (error) {
      if (createdSaleId) this.sales.delete(createdSaleId);
      this.sequence = sequence;
      throw error;
    }
  }

  public async addSaleLine(
    saleId: string,
    input: AddSaleLineInput,
    idempotencyKey: string,
  ): Promise<Sale> {
    void idempotencyKey;
    const sale = this.openSale(saleId, input.expectedVersion);
    const item = this.item(input.catalogItemId);
    const price = await this.resolvePrice({
      catalogItemId: item.id,
      ...(input.catalogVariantId ? { catalogVariantId: input.catalogVariantId } : {}),
      sellingLocationId: sale.sellingLocationId,
      currency: sale.currency,
      effectiveAt: timestamp(),
    });
    const variant = input.catalogVariantId
      ? (this.variants.find((candidate) => candidate.id === input.catalogVariantId) ?? null)
      : null;
    const compatibleLine = sale.lines.find(
      (line) =>
        line.removedAt === null &&
        line.catalogItemId === item.id &&
        line.catalogVariantId === price.catalogVariantId &&
        line.catalogPriceId === price.catalogPriceId &&
        line.resolvedUnitPrice === price.amount &&
        line.effectiveUnitPrice === price.amount &&
        line.overrideAmount === null &&
        line.discountType === null &&
        (line.fulfillment === null || line.fulfillment.status === 'WAITING') &&
        line.participations.length === 0 &&
        line.contributions.length === 0,
    );
    if (compatibleLine) {
      return this.save(sale, {
        lines: this.replaceLine(sale, compatibleLine.id, (line) => ({
          ...line,
          quantity: fixed(decimal(line.quantity).plus(decimal(input.quantity))),
        })),
      });
    }
    const time = timestamp();
    const line: SaleLine = {
      id: `demo-line-${sale.id}-${sale.lines.length + 1}`,
      saleId,
      catalogItemId: item.id,
      catalogVariantId: price.catalogVariantId,
      catalogPriceId: price.catalogPriceId,
      itemCodeSnapshot: item.code,
      itemNameSnapshot: item.name,
      itemTypeSnapshot: item.type,
      variantCodeSnapshot: variant?.code ?? null,
      variantNameSnapshot: variant?.name ?? null,
      fulfillmentBehaviorSnapshot: item.fulfillmentBehavior,
      employeeAssignmentModeSnapshot: item.serviceDefinition?.employeeAssignmentMode ?? null,
      allowEmployeeContributionSnapshot: item.serviceDefinition?.allowEmployeeContribution ?? false,
      defaultDurationMinutesSnapshot: item.serviceDefinition?.defaultDurationMinutes ?? null,
      quantity: this.validQuantity(input.quantity),
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
      createdAt: time,
      updatedAt: time,
      fulfillment:
        item.fulfillmentBehavior === 'TRACKED'
          ? {
              saleId,
              saleLineId: `demo-line-${sale.id}-${sale.lines.length + 1}`,
              status: 'WAITING',
              startedAt: null,
              completedAt: null,
              canceledAt: null,
            }
          : null,
      participations: [],
      contributions: [],
    };
    return this.save(sale, { lines: [...sale.lines, line] });
  }

  public async setSaleLineQuantity(
    saleId: string,
    saleLineId: string,
    input: SetSaleLineQuantityInput,
  ) {
    const sale = this.openSale(saleId, input.expectedVersion);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        quantity: this.validQuantity(input.quantity),
      })),
    });
  }

  public async removeSaleLine(saleId: string, saleLineId: string, expectedVersion: number) {
    const sale = this.openSale(saleId, expectedVersion);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({ ...line, removedAt: timestamp() })),
    });
  }

  public async setSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    input: PriceOverrideInput,
  ) {
    const sale = this.openSale(saleId, input.expectedVersion);
    const amount = this.validPositive(input.amount, 'Price override');
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        effectiveUnitPrice: amount,
        overrideAmount: amount,
        overrideReason: input.reason,
      })),
    });
  }

  public async clearSaleLinePriceOverride(
    saleId: string,
    saleLineId: string,
    expectedVersion: number,
  ) {
    const sale = this.openSale(saleId, expectedVersion);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        effectiveUnitPrice: line.resolvedUnitPrice,
        overrideAmount: null,
        overrideReason: null,
      })),
    });
  }

  public async setSaleLineDiscount(saleId: string, saleLineId: string, input: DiscountInput) {
    const sale = this.openSale(saleId, input.expectedVersion);
    this.validDiscount(input);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        discountType: input.type,
        discountValue: input.value,
        discountReason: input.reason,
      })),
    });
  }

  public async clearSaleLineDiscount(saleId: string, saleLineId: string, expectedVersion: number) {
    const sale = this.openSale(saleId, expectedVersion);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        discountType: null,
        discountValue: null,
        discountReason: null,
      })),
    });
  }

  public async setSaleDiscount(saleId: string, input: DiscountInput) {
    const sale = this.openSale(saleId, input.expectedVersion);
    this.validDiscount(input);
    return this.save(sale, {
      orderDiscountType: input.type,
      orderDiscountValue: input.value,
      orderDiscountReason: input.reason,
    });
  }

  public async clearSaleDiscount(saleId: string, expectedVersion: number) {
    const sale = this.openSale(saleId, expectedVersion);
    return this.save(sale, {
      orderDiscountType: null,
      orderDiscountValue: null,
      orderDiscountReason: null,
    });
  }

  public async setSaleLineAssignments(saleId: string, saleLineId: string, input: AssignmentInput) {
    const sale = this.openSale(saleId, input.expectedVersion);
    input.employeeIds.forEach((employeeId) => this.employee(employeeId));
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        participations: input.employeeIds.map((employeeId) => ({
          saleId,
          saleLineId,
          employeeId,
          assigned: true,
          shareRate:
            line.participations.find((item) => item.employeeId === employeeId)?.shareRate ?? null,
        })),
      })),
    });
  }

  public async setSaleLineContributions(
    saleId: string,
    saleLineId: string,
    input: ContributionInput,
  ) {
    const sale = this.openSale(saleId, input.expectedVersion);
    const rates = this.contributionRates(input);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => ({
        ...line,
        participations: [
          ...new Set([...line.participations.map((item) => item.employeeId), ...rates.keys()]),
        ].map((employeeId) => {
          const current = line.participations.find((item) => item.employeeId === employeeId);
          return {
            saleId,
            saleLineId,
            employeeId,
            assigned: current?.assigned ?? false,
            shareRate: rates.get(employeeId) ?? null,
          };
        }),
      })),
    });
  }

  public async getSaleLineContributionPreview(
    saleId: string,
    saleLineId: string,
  ): Promise<ContributionPreview> {
    const sale = this.sale(saleId);
    const line = this.line(sale, saleLineId);
    const rates = line.participations.filter((item) => item.shareRate !== null);
    const base = decimal(line.discountedCustomerBaseAmount);
    return clone({
      saleId,
      saleLineId,
      version: sale.version,
      contributionBaseAmount: fixed(base),
      preview: rates.map((participation) => ({
        employeeId: participation.employeeId,
        contributionAmount: fixed(base.times(decimal(participation.shareRate!))),
      })),
      facts: line.contributions,
    });
  }

  public async transitionSaleLineFulfillment(
    saleId: string,
    saleLineId: string,
    input: FulfillmentInput,
  ) {
    const sale = this.openSale(saleId, input.expectedVersion);
    return this.save(sale, {
      lines: this.replaceLine(sale, saleLineId, (line) => {
        if (!line.fulfillment) throw new Error('This line has instant fulfillment.');
        const time = timestamp();
        return {
          ...line,
          fulfillment: {
            ...line.fulfillment,
            status: input.status,
            startedAt: input.status === 'IN_PROGRESS' ? time : line.fulfillment.startedAt,
            completedAt: input.status === 'COMPLETED' ? time : null,
            canceledAt: input.status === 'CANCELED' ? time : null,
          },
        };
      }),
    });
  }

  public async createSalePayment(
    saleId: string,
    input: CreatePaymentInput,
    idempotencyKey: string,
  ) {
    void idempotencyKey;
    const sale = this.openSale(saleId, input.expectedVersion);
    const appliedAmount = this.validPositive(input.appliedAmount, 'Payment amount');
    const paid = sale.payments
      .filter((payment) => payment.status === 'SUCCEEDED' || payment.status === 'PENDING')
      .reduce((sum, payment) => sum.plus(decimal(payment.appliedAmount)), decimal('0'));
    if (paid.plus(decimal(appliedAmount)).greaterThan(decimal(sale.totalAmount)))
      throw new Error('Payment exceeds the available amount.');
    const tenderedAmount = input.tenderedAmount
      ? this.validPositive(input.tenderedAmount, 'Tendered amount')
      : null;
    if (
      input.method === 'CASH' &&
      (!tenderedAmount || decimal(tenderedAmount).lessThan(decimal(appliedAmount)))
    )
      throw new Error('Tendered cash cannot be below the applied amount.');
    const time = timestamp();
    const succeeded = input.method === 'CASH';
    const payment: Payment = {
      id: `demo-payment-${sale.id}-${sale.payments.length + 1}`,
      saleId,
      method: input.method,
      status: succeeded ? 'SUCCEEDED' : 'PENDING',
      currency: sale.currency,
      appliedAmount,
      tenderedAmount,
      changeAmount: tenderedAmount
        ? fixed(decimal(tenderedAmount).minus(decimal(appliedAmount)))
        : null,
      providerReference: input.providerReference ?? null,
      idempotencyKey: `demo-payment-${sale.payments.length + 1}`,
      createdByActorId: 'demo-cashier',
      createdByActorKind: 'USER',
      settledByActorId: succeeded ? 'demo-cashier' : null,
      settledByActorKind: succeeded ? 'USER' : null,
      terminalAt: succeeded ? time : null,
      createdAt: time,
      updatedAt: time,
    };
    return this.save(sale, { payments: [...sale.payments, payment] });
  }

  public async transitionSalePayment(
    saleId: string,
    paymentId: string,
    input: PaymentTransitionInput,
  ) {
    const sale = this.openSale(saleId, input.expectedVersion);
    return this.save(sale, {
      payments: sale.payments.map((payment) =>
        payment.id !== paymentId
          ? payment
          : {
              ...payment,
              status: input.status,
              terminalAt: timestamp(),
              settledByActorId: input.status === 'SUCCEEDED' ? 'demo-cashier' : null,
              settledByActorKind: input.status === 'SUCCEEDED' ? 'USER' : null,
              updatedAt: timestamp(),
            },
      ),
    });
  }

  public async finalizeSale(saleId: string, expectedVersion: number, idempotencyKey: string) {
    void idempotencyKey;
    const sale = this.openSale(saleId, expectedVersion);
    this.ensureReadyToFinalize(sale);
    const finalized = this.save(sale, { status: 'FINALIZED', finalizedAt: timestamp() });
    const lines = finalized.lines.map((line) => ({
      ...line,
      contributions: line.participations
        .filter((item) => item.shareRate !== null)
        .map((participation) => {
          const employee = this.employee(participation.employeeId);
          const base = decimal(line.discountedCustomerBaseAmount);
          return {
            saleId,
            saleLineId: line.id,
            employeeId: employee.id,
            employeeCodeSnapshot: employee.code,
            employeeDisplayNameSnapshot: employee.displayName,
            shareRate: participation.shareRate!,
            contributionBaseAmount: fixed(base),
            contributionAmount: fixed(base.times(decimal(participation.shareRate!))),
            finalizedAt: finalized.finalizedAt!,
          };
        }),
    }));
    return this.save(finalized, { lines });
  }

  public async voidSale(saleId: string, expectedVersion: number, idempotencyKey: string) {
    void idempotencyKey;
    const sale = this.openSale(saleId, expectedVersion);
    if (
      sale.payments.some(
        (payment) => payment.status === 'PENDING' || payment.status === 'SUCCEEDED',
      )
    )
      throw new Error('A paid or pending Sale cannot be voided.');
    return this.save(sale, { status: 'VOIDED', voidedAt: timestamp() });
  }

  private createItems(): DemoItem[] {
    const make = (
      index: number,
      name: string,
      type: CatalogItem['type'],
      prices: Record<string, string>,
      tracked = false,
    ): DemoItem => {
      const time = timestamp();
      return {
        id: `demo-item-00${index}`,
        code: `DEMO-${String(index).padStart(2, '0')}`,
        name,
        type,
        prices,
        categoryId: type === 'SERVICE' ? 'demo-services' : 'demo-products',
        taxCategoryId: null,
        description: null,
        lifecycle: 'ACTIVE',
        fulfillmentBehavior: tracked ? 'TRACKED' : 'INSTANT',
        version: 1,
        createdAt: time,
        updatedAt: time,
        serviceDefinition:
          type === 'SERVICE'
            ? {
                defaultDurationMinutes: 45,
                employeeAssignmentMode: tracked ? 'REQUIRED' : 'OPTIONAL',
                allowEmployeeContribution: tracked,
              }
            : null,
      };
    };
    return [
      make(
        1,
        'Hair Styling',
        'SERVICE',
        {
          base: '125000.0000',
          'demo-variant-short': '125000.0000',
          'demo-variant-long': '165000.0000',
        },
        true,
      ),
      make(2, 'Nail Care', 'SERVICE', { base: '95000.0000' }),
      make(3, 'Facial Care', 'SERVICE', { base: '175000.0000' }),
      make(4, 'Hair Serum', 'PRODUCT', { base: '85000.0000' }),
      make(5, 'Care Shampoo', 'PRODUCT', { base: '65000.0000' }),
      make(6, 'Treatment Mask', 'PRODUCT', { base: '110000.0000' }),
    ];
  }

  private item(id: string) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw new Error('Demo catalog item was not found.');
    return item;
  }
  private employee(id: string) {
    const employee = this.employees.find((candidate) => candidate.id === id);
    if (!employee) throw new Error('Demo employee was not found.');
    return employee;
  }
  private sale(id: string) {
    const sale = this.sales.get(id);
    if (!sale) throw new Error('Demo Sale was not found.');
    return sale;
  }
  private line(sale: Sale, id: string) {
    const line = sale.lines.find(
      (candidate) => candidate.id === id && candidate.removedAt === null,
    );
    if (!line) throw new Error('Demo Sale line was not found.');
    return line;
  }
  private openSale(id: string, expectedVersion: number) {
    const sale = this.sale(id);
    if (sale.status !== 'OPEN') throw new Error('This Sale is already terminal.');
    if (sale.version !== expectedVersion)
      throw new Error('The Sale changed. Reload the latest state.');
    return sale;
  }
  private replaceLine(sale: Sale, id: string, change: (line: SaleLine) => SaleLine) {
    this.line(sale, id);
    return sale.lines.map((line) =>
      line.id === id ? { ...change(line), updatedAt: timestamp() } : line,
    );
  }
  private validQuantity(value: string) {
    return this.validPositive(value, 'Quantity');
  }
  private validPositive(value: string, label: string) {
    if (!/^\d+(?:\.\d{1,4})?$/.test(value) || decimal(value).lessThanOrEqualTo(0))
      throw new Error(`${label} must be greater than zero with at most four decimals.`);
    return fixed(decimal(value));
  }
  private validDiscount(input: DiscountInput) {
    if (!input.reason.trim()) throw new Error('Discount reason is required.');
    const value = this.validPositive(input.value, 'Discount');
    if (input.type === 'PERCENTAGE' && decimal(value).greaterThan(1))
      throw new Error('Percentage discount must not exceed 100%.');
  }
  private contributionRates(input: ContributionInput) {
    if (!input.contributors.length) throw new Error('At least one contributor is required.');
    input.contributors.forEach((contributor) => this.employee(contributor.employeeId));
    const explicit = input.contributors.filter(
      (contributor) => contributor.shareRate !== undefined,
    );
    explicit.forEach((contributor) =>
      this.validPositive(contributor.shareRate!, 'Contribution share'),
    );
    const explicitTotal = explicit.reduce(
      (sum, contributor) => sum.plus(decimal(contributor.shareRate!)),
      decimal('0'),
    );
    if (explicitTotal.greaterThan(1)) throw new Error('Contribution shares cannot exceed 100%.');
    const missing = input.contributors.filter((contributor) => contributor.shareRate === undefined);
    if (!missing.length && !explicitTotal.equals(1))
      throw new Error('Contribution shares must total 100%.');
    const result = new Map<string, string>();
    let placed = decimal('0');
    missing.forEach((contributor, index) => {
      const remainder = decimal('1').minus(explicitTotal);
      const rate =
        index === missing.length - 1
          ? remainder.minus(placed)
          : remainder.dividedBy(missing.length).toDecimalPlaces(18);
      placed = placed.plus(rate);
      result.set(contributor.employeeId, rate.toFixed(18));
    });
    explicit.forEach((contributor) =>
      result.set(contributor.employeeId, decimal(contributor.shareRate!).toFixed(18)),
    );
    return result;
  }
  private save(sale: Sale, changes: Partial<Sale>) {
    const recalculated = this.recalculate({
      ...sale,
      ...changes,
      version: sale.version + 1,
      updatedAt: timestamp(),
    });
    this.sales.set(recalculated.id, recalculated);
    return clone(recalculated);
  }
  private recalculate(sale: Sale): Sale {
    const active = sale.lines.filter((line) => line.removedAt === null);
    const withLineAmounts = active.map((line) => {
      const gross = decimal(line.quantity).times(decimal(line.effectiveUnitPrice));
      const discount =
        line.discountType === 'PERCENTAGE'
          ? gross.times(decimal(line.discountValue!))
          : line.discountType === 'FIXED_AMOUNT'
            ? decimal(line.discountValue!)
            : decimal('0');
      const lineDiscount = discount.greaterThan(gross) ? gross : discount;
      return { line, gross, base: gross.minus(lineDiscount), lineDiscount };
    });
    const base = withLineAmounts.reduce((sum, entry) => sum.plus(entry.base), decimal('0'));
    const requestedOrderDiscount =
      sale.orderDiscountType === 'PERCENTAGE'
        ? base.times(decimal(sale.orderDiscountValue!))
        : sale.orderDiscountType === 'FIXED_AMOUNT'
          ? decimal(sale.orderDiscountValue!)
          : decimal('0');
    const orderDiscount = requestedOrderDiscount.greaterThan(base) ? base : requestedOrderDiscount;
    let allocated = decimal('0');
    const lines = sale.lines.map((line) => {
      const entry = withLineAmounts.find((candidate) => candidate.line.id === line.id);
      if (!entry) return line;
      const allocation =
        entry === withLineAmounts[withLineAmounts.length - 1]
          ? orderDiscount.minus(allocated)
          : base.equals(0)
            ? decimal('0')
            : orderDiscount.times(entry.base).dividedBy(base).toDecimalPlaces(4);
      allocated = allocated.plus(allocation);
      const total = entry.base.minus(allocation);
      return {
        ...line,
        grossAmount: fixed(entry.gross),
        lineDiscountAmount: fixed(entry.lineDiscount),
        orderDiscountAllocationAmount: fixed(allocation),
        discountedCustomerBaseAmount: fixed(total),
        includedTaxAmount: '0.0000',
        excludedTaxAmount: '0.0000',
        netPreTaxAmount: fixed(total),
        taxAmount: '0.0000',
        totalAmount: fixed(total),
      };
    });
    return {
      ...sale,
      lines,
      grossAmount: fixed(
        withLineAmounts.reduce((sum, entry) => sum.plus(entry.gross), decimal('0')),
      ),
      discountAmount: fixed(
        withLineAmounts
          .reduce((sum, entry) => sum.plus(entry.lineDiscount), decimal('0'))
          .plus(orderDiscount),
      ),
      netPreTaxAmount: fixed(base.minus(orderDiscount)),
      taxAmount: '0.0000',
      totalAmount: fixed(base.minus(orderDiscount)),
      orderDiscountAmount: fixed(orderDiscount),
    };
  }
  private ensureReadyToFinalize(sale: Sale) {
    const active = sale.lines.filter((line) => line.removedAt === null);
    if (!active.length) throw new Error('Add at least one active line.');
    if (sale.payments.some((payment) => payment.status === 'PENDING'))
      throw new Error('Resolve pending payments before finalizing.');
    const paid = sale.payments
      .filter((payment) => payment.status === 'SUCCEEDED')
      .reduce((sum, payment) => sum.plus(decimal(payment.appliedAmount)), decimal('0'));
    if (!paid.equals(decimal(sale.totalAmount)))
      throw new Error('Successful payments must exactly match the Sale total.');
    active.forEach((line) => {
      if (
        line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
        line.fulfillment?.status !== 'COMPLETED'
      )
        throw new Error(`${line.itemNameSnapshot} fulfillment is incomplete.`);
      if (
        line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
        !line.participations.some((participation) => participation.assigned)
      )
        throw new Error(`${line.itemNameSnapshot} requires employee assignment.`);
      if (line.allowEmployeeContributionSnapshot) {
        const total = line.participations.reduce(
          (sum, participation) => sum.plus(decimal(participation.shareRate ?? '0')),
          decimal('0'),
        );
        if (!total.equals(1))
          throw new Error(`${line.itemNameSnapshot} contribution must total 100%.`);
      }
    });
  }
}
