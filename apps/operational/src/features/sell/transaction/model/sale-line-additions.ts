import { createDecimal } from '@digvation/pos-money';

import type { Employee, SaleLine } from './cashier-transaction.types';

export interface SaleLineAddition {
  id: string;
  name: string;
  /** Quantity used for the whole line: per-unit composition quantity x line quantity. */
  quantity: string;
  /** Product/Variant selling price snapshotted when it was chosen. */
  unitPrice: string;
  /** Billed amount for the whole line; a breakdown of the line amount, never extra revenue. */
  amount: string;
  /** Who performs it ("Dikerjakan oleh"); empty when nobody is assigned. */
  performerIds: string[];
}

/**
 * Transaction-selected additions of a line. Fixed BOM components are internal recipe detail: they
 * carry no customer price and are never shown in the Transaction Detail or on the receipt.
 */
export function saleLineAdditions(
  line: Pick<SaleLine, 'compositionComponents' | 'quantity'>,
): SaleLineAddition[] {
  return (line.compositionComponents ?? [])
    .filter((component) => component.componentSource === 'SALE_SELECTED')
    .map((component) => ({
      id: component.id,
      name: [component.itemNameSnapshot, component.variantNameSnapshot].filter(Boolean).join(' / '),
      quantity: createDecimal(component.quantity).times(line.quantity).toFixed(4),
      unitPrice: component.transactionUnitPrice ?? '0.0000',
      // Contributions are stored per line unit; the line quantity is applied exactly once.
      amount: createDecimal(component.extendedContribution).times(line.quantity).toFixed(4),
      performerIds: (component.performers ?? []).map((performer) => performer.employeeId),
    }));
}

/**
 * The item configuration a persisted line already has, in the shape the shared configurator
 * takes as its starting point: base variant, quantity and the additions chosen at sale time.
 * Per-unit prices and contributions stay Runtime facts; only what the operator chose is read.
 */
export function saleLineConfiguration(
  line: Pick<
    SaleLine,
    | 'catalogVariantId'
    | 'quantity'
    | 'compositionComponents'
    | 'soldByEmployeeId'
    | 'soldByEmployeeNameSnapshot'
  >,
  /** Names for an addition's performers; Runtime returns only their ids. */
  employees: readonly Pick<Employee, 'id' | 'displayName'>[] = [],
) {
  const performerName = (employeeId: string) =>
    employees.find((employee) => employee.id === employeeId)?.displayName ?? '';
  return {
    catalogVariantId: line.catalogVariantId,
    quantity: line.quantity,
    soldBy: line.soldByEmployeeId
      ? {
          employeeId: line.soldByEmployeeId,
          name: line.soldByEmployeeNameSnapshot ?? '',
        }
      : null,
    additionalComponents: (line.compositionComponents ?? [])
      .filter((component) => component.componentSource === 'SALE_SELECTED')
      .map((component) => ({
        componentItemId: component.componentItemId,
        ...(component.componentVariantId
          ? { componentVariantId: component.componentVariantId }
          : {}),
        quantity: component.quantity,
        label: [component.itemNameSnapshot, component.variantNameSnapshot]
          .filter(Boolean)
          .join(' / '),
        unitPrice: component.transactionUnitPrice ?? '0.0000',
        ...(component.performers?.length
          ? {
              performers: component.performers.map((performer) => ({
                employeeId: performer.employeeId,
                name: performerName(performer.employeeId),
              })),
            }
          : {}),
      })),
  };
}

/**
 * A persisted line of an OPEN Sale can be edited in place while nothing else owns it: its work has
 * not progressed, no performer is assigned, and it carries no manual price or discount. Runtime
 * enforces the same rule; this only decides whether to offer the action.
 */
export function isSaleLineReplaceable(
  line: Pick<
    SaleLine,
    | 'removedAt'
    | 'fulfillment'
    | 'participations'
    | 'contributions'
    | 'overrideAmount'
    | 'discountType'
  >,
): boolean {
  return (
    line.removedAt === null &&
    !(line.fulfillment && ['IN_PROGRESS', 'COMPLETED'].includes(line.fulfillment.status)) &&
    !line.participations.some((participation) => participation.assigned) &&
    line.contributions.length === 0 &&
    line.overrideAmount === null &&
    line.discountType === null
  );
}

/** What remains of the line once the additions are taken out, so base + additions = line amount. */
export function saleLineBase(
  line: Pick<SaleLine, 'grossAmount' | 'quantity'>,
  additions: readonly SaleLineAddition[],
): { unitPrice: string; amount: string } {
  const amount = additions.reduce(
    (rest, addition) => rest.minus(addition.amount),
    createDecimal(line.grossAmount),
  );
  return {
    amount: amount.toFixed(4),
    unitPrice: amount.dividedBy(line.quantity).toFixed(4),
  };
}

/**
 * "Dikerjakan oleh …" for an addition someone performs; null when nobody is assigned. Names come
 * from the Service performer list, as for any work unit; an unknown employee keeps a neutral label.
 */
export function additionPerformedBy(
  addition: Pick<SaleLineAddition, 'performerIds'>,
  employees: readonly Pick<Employee, 'id' | 'displayName'>[],
  copy: (value: string) => string,
): string | null {
  if (!addition.performerIds.length) return null;
  const names = addition.performerIds.map(
    (id) => employees.find((employee) => employee.id === id)?.displayName ?? copy('Employee'),
  );
  return `${copy('Performed by')} ${names.join(', ')}`;
}
