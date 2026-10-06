import type {
  ComponentPricingMode,
  Sale,
  SaleLine,
  SaleLineCompositionComponent,
} from '../api/transaction-history-api';
import { fromMoneyUnits, toMoneyUnits } from './transaction-payment-composition';
import { activeSaleLines } from './transaction-summary';

/** A readable employee, or `null` when no readable identity exists (never a raw id). */
export type EmployeeName = string | null;

export interface WorkUnitPresentation {
  unitNumber: number;
  performers: EmployeeName[];
}

export interface AdditionalComponentPresentation {
  id: string;
  name: string;
  variant: string | null;
  /** Captured composition quantity per Service unit. */
  quantity: string;
  pricingMode: ComponentPricingMode;
  /** Billed contribution; `null` when the component is included in the Service price. */
  chargedAmount: string | null;
  performers: EmployeeName[];
}

export interface ServicePriceAdditionPresentation extends AdditionalComponentPresentation {
  /** What this addition contributes to the whole line; `null` when included in the Service price. */
  lineAmount: string | null;
}

/**
 * How a composed Service line's billed amount is built: the Service before its sale-selected
 * additions plus each priced addition. It only explains the captured gross amount; it never adds.
 */
export interface ServicePriceBreakdown {
  /** Service price per unit before sale-selected additions (fixed composition stays bundled). */
  serviceUnitPrice: string;
  /** `serviceUnitPrice` for the whole line quantity. */
  serviceAmount: string;
  additions: ServicePriceAdditionPresentation[];
  /** Equals the line's captured gross amount. */
  totalAmount: string;
}

export interface TransactionItemPresentation {
  line: SaleLine;
  isService: boolean;
  /** Who performed the Service; for finalized work, the immutable contribution snapshots. */
  performers: EmployeeName[];
  /** Per-unit attribution, only when different units name different employees. */
  workUnits: WorkUnitPresentation[];
  /** Product salesperson; never a Service performer. */
  soldBy: EmployeeName;
  additionalComponents: AdditionalComponentPresentation[];
  /** Present only when the captured snapshot reconciles exactly; otherwise `null`. */
  priceBreakdown: ServicePriceBreakdown | null;
}

/**
 * Employee identity for a Sale: finalized contribution snapshots first (historical authority),
 * then the readable planned-work identity projected by the Sale read.
 */
export function saleEmployeeNames(sale: Pick<Sale, 'lines' | 'workEmployees'>) {
  const snapshots = new Map<string, string>();
  for (const line of sale.lines) {
    for (const fact of line.contributions ?? [])
      snapshots.set(fact.employeeId, fact.employeeDisplayNameSnapshot);
    for (const component of line.compositionComponents ?? [])
      for (const fact of component.contributions ?? [])
        snapshots.set(fact.employeeId, fact.employeeDisplayNameSnapshot);
  }
  const current = new Map((sale.workEmployees ?? []).map((employee) => [employee.id, employee]));
  return (employeeId: string): EmployeeName =>
    snapshots.get(employeeId) ?? current.get(employeeId)?.displayName ?? null;
}

const unique = <T>(values: readonly T[]) => [...new Set(values)];

function servicePerformers(line: SaleLine, nameOf: (id: string) => EmployeeName) {
  if (line.contributions?.length)
    return unique(line.contributions.map((fact) => fact.employeeDisplayNameSnapshot));
  return unique(
    (line.participations ?? [])
      .filter((participation) => participation.assigned)
      .map((participation) => nameOf(participation.employeeId)),
  );
}

function distinctWorkUnits(line: SaleLine, nameOf: (id: string) => EmployeeName) {
  const units = line.workUnits ?? [];
  const signature = (employeeIds: readonly string[]) => [...employeeIds].sort().join('|');
  if (units.length < 2 || new Set(units.map((unit) => signature(unit.employeeIds))).size < 2)
    return [];
  return units.map((unit) => ({
    unitNumber: unit.unitNumber,
    performers: unit.employeeIds.map(nameOf),
  }));
}

function componentPerformers(
  component: SaleLineCompositionComponent,
  nameOf: (id: string) => EmployeeName,
) {
  if (component.contributions.length)
    return unique(component.contributions.map((fact) => fact.employeeDisplayNameSnapshot));
  return unique(component.performers.map((performer) => nameOf(performer.employeeId)));
}

/** Customer-chosen additional items of a Service; fixed bill-of-material consumables are not. */
function additionalComponents(line: SaleLine, nameOf: (id: string) => EmployeeName) {
  return (line.compositionComponents ?? [])
    .filter((component) => component.componentSource === 'SALE_SELECTED')
    .sort((left, right) => left.position - right.position)
    .map((component) => ({
      id: component.id,
      name: component.itemNameSnapshot,
      variant: component.variantNameSnapshot,
      quantity: component.quantity,
      pricingMode: component.pricingMode,
      chargedAmount:
        component.pricingMode === 'INCLUDED_IN_SERVICE_PRICE'
          ? null
          : component.extendedContribution,
      performers: componentPerformers(component, nameOf),
    }));
}

const UNIT_SCALE = 10_000n;

/** `amount × quantity` at four decimals, or `null` when the product needs more precision. */
function timesQuantity(amount: string, quantity: string): string | null {
  const product = toMoneyUnits(amount) * toMoneyUnits(quantity);
  return product % UNIT_SCALE === 0n ? fromMoneyUnits(product / UNIT_SCALE) : null;
}

/**
 * Runtime captures a composed Service as resolvedUnitPrice = base + Σ extendedContribution, so the
 * Service before its sale-selected additions is resolvedUnitPrice minus those priced additions.
 * Only the immutable Sale snapshot is used, never current Catalog prices. A manual override replaced
 * the composed price, so no base is derived for it; any snapshot that does not reconcile exactly
 * to the captured gross amount keeps the plain presentation.
 */
function servicePriceBreakdown(
  line: SaleLine,
  additional: AdditionalComponentPresentation[],
): ServicePriceBreakdown | null {
  const priced = additional.filter(
    (component) => component.chargedAmount !== null && toMoneyUnits(component.chargedAmount) !== 0n,
  );
  if (!priced.length || line.overrideAmount != null) return null;
  const { resolvedUnitPrice, effectiveUnitPrice, grossAmount, quantity } = line;
  if (!resolvedUnitPrice || !effectiveUnitPrice || !grossAmount) return null;
  if (toMoneyUnits(resolvedUnitPrice) !== toMoneyUnits(effectiveUnitPrice)) return null;

  const serviceUnits =
    toMoneyUnits(resolvedUnitPrice) -
    priced.reduce((sum, component) => sum + toMoneyUnits(component.chargedAmount ?? '0'), 0n);
  if (serviceUnits < 0n) return null;
  const serviceUnitPrice = fromMoneyUnits(serviceUnits);
  const serviceAmount = timesQuantity(serviceUnitPrice, quantity);
  const additions = additional.map((component) => ({
    ...component,
    lineAmount:
      component.chargedAmount === null ? null : timesQuantity(component.chargedAmount, quantity),
  }));
  if (
    serviceAmount === null ||
    additions.some((addition) => addition.chargedAmount !== null && addition.lineAmount === null)
  )
    return null;

  const reconciled = additions.reduce(
    (sum, addition) => sum + (addition.lineAmount ? toMoneyUnits(addition.lineAmount) : 0n),
    toMoneyUnits(serviceAmount),
  );
  if (reconciled !== toMoneyUnits(grossAmount)) return null;
  return { serviceUnitPrice, serviceAmount, additions, totalAmount: grossAmount };
}

/** The billed items of a transaction, each with who sold or performed it. */
export function transactionItems(
  sale: Pick<Sale, 'lines' | 'workEmployees'>,
): TransactionItemPresentation[] {
  const nameOf = saleEmployeeNames(sale);
  return activeSaleLines(sale.lines).map((line) => {
    const isService =
      line.itemTypeSnapshot === 'SERVICE' ||
      (line.itemTypeSnapshot === undefined && line.fulfillmentBehaviorSnapshot === 'TRACKED');
    const additional = isService ? additionalComponents(line, nameOf) : [];
    return {
      line,
      isService,
      performers: isService ? servicePerformers(line, nameOf) : [],
      workUnits: isService ? distinctWorkUnits(line, nameOf) : [],
      soldBy: isService ? null : (line.soldByEmployeeNameSnapshot?.trim() ?? null) || null,
      additionalComponents: additional,
      priceBreakdown: isService ? servicePriceBreakdown(line, additional) : null,
    };
  });
}

/** Lines retired by removal or correction, kept apart from the billed items. */
export function retiredSaleLines(sale: Pick<Sale, 'lines'>): SaleLine[] {
  return sale.lines.filter((line) => Boolean(line.removedAt));
}
