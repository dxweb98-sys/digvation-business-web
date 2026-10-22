import { createDecimal } from '@digvation/pos-money';

import type {
  Employee,
  SaleComponentPerformerAssignment,
  SaleLine,
} from './cashier-transaction.types';

export interface SaleLineAddition {
  id: string;
  name: string;
  /** Quantity used for the whole line: per-unit composition quantity x line quantity. */
  quantity: string;
  /** Product/Variant selling price snapshotted when it was chosen. */
  unitPrice: string;
  /** Billed amount for the whole line; a breakdown of the line amount, never extra revenue. */
  amount: string;
  /** Its own performers ("Dikerjakan oleh") when it has any; empty otherwise. */
  performerIds: string[];
  /** Its own performers with their persisted shares, as the editor reopens them. */
  performerRates: Array<{ employeeId: string; shareRate: string }>;
  /** The operator's decision: null until made, SERVICE for the main Service performers, OWN. */
  performerAssignment: SaleComponentPerformerAssignment | null;
  /** Finalized performer names, by employee, as recorded with its work facts. */
  performerSnapshots: Readonly<Record<string, string>>;
  /**
   * Historical only: a Product salesperson recorded on the addition before additions stopped
   * earning Product sales commission. New additions never have one.
   */
  soldByName: string | null;
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
      performerRates: (component.performers ?? []).map((performer) => ({
        employeeId: performer.employeeId,
        shareRate: performer.shareRate,
      })),
      performerAssignment: component.performerAssignment ?? null,
      performerSnapshots: Object.fromEntries(
        (component.contributions ?? []).map((fact) => [
          fact.employeeId,
          fact.employeeDisplayNameSnapshot,
        ]),
      ),
      soldByName: component.soldByEmployeeId
        ? component.soldByEmployeeNameSnapshot?.trim() || null
        : null,
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
        // A decision already made in the transaction detail survives reconfiguring the line.
        ...(component.performers?.length
          ? {
              performers: component.performers.map((performer) => ({
                employeeId: performer.employeeId,
                name: performerName(performer.employeeId),
                shareRate: performer.shareRate,
              })),
            }
          : {}),
        ...(component.performerAssignment
          ? { performerAssignment: component.performerAssignment }
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

/** Who does an addition's work, as the transaction detail shows it. */
export interface AdditionWork {
  /**
   * UNDECIDED: nobody has said who does it yet. SERVICE: follows the main Service performers, whose
   * work it is part of. OWN: the employees chosen for it, kept as chosen whatever the Service does.
   */
  state: 'UNDECIDED' | SaleComponentPerformerAssignment;
  /** Effective performer names; empty when undecided or the main Service has nobody yet. */
  names: string[];
  /**
   * OWN only, against the main Service's current performers. SAME: the same employees with the same
   * shares. SAME_EMPLOYEES: the same employees, shared differently. NONE: different employees, or
   * either side has nobody. Display only: it never changes the persisted decision.
   */
  match: 'SAME' | 'SAME_EMPLOYEES' | 'NONE';
  /** Each performer's share of the addition's work, in the order of `names`. */
  shares: Array<{ name: string; shareRate: string }>;
}

/** Shares as exact decimals keyed by employee; a missing rate means an equal split, as in Runtime. */
function shareMap(
  ids: readonly string[],
  rateOf: (id: string) => string | null | undefined,
): Map<string, string> {
  const rates = ids.map((id) => rateOf(id) ?? null);
  const equal = ids.length ? createDecimal('1').dividedBy(ids.length).toFixed() : '0';
  return new Map(
    ids.map((id, index) => [id, rates.some((rate) => rate === null) ? equal : rates[index]!]),
  );
}

/**
 * The effective performers of a Service's addition, from the operator's explicit decision: its own
 * employees, or the main Service's (whose work it is then part of). An addition without performers
 * is never taken to follow the main Service unless that was chosen, except in finalized history,
 * where it was recorded as the Service's work. Own employees that happen to be exactly the main
 * Service's are recognised as such, by employee set and exact shares, without becoming SERVICE.
 * Never a salesperson. Null for a Product line.
 */
export function additionWork(
  addition: Pick<
    SaleLineAddition,
    'performerIds' | 'performerSnapshots' | 'performerAssignment' | 'performerRates'
  >,
  line: Pick<SaleLine, 'itemTypeSnapshot' | 'participations' | 'workUnits' | 'contributions'>,
  employees: readonly Pick<Employee, 'id' | 'displayName'>[],
  unavailable: string,
): AdditionWork | null {
  if (line.itemTypeSnapshot !== 'SERVICE') return null;
  const current = (id: string) =>
    employees.find((employee) => employee.id === id)?.displayName?.trim() || unavailable;
  // The main Service's performers: finalized work facts are the authority; before that, the
  // current assignment and its contribution shares.
  const finalized = line.contributions.length > 0;
  const serviceIds = finalized
    ? [...new Set(line.contributions.map((fact) => fact.employeeId))]
    : [
        ...new Set([
          ...line.participations.filter((p) => p.assigned).map((p) => p.employeeId),
          ...(line.workUnits ?? []).flatMap((unit) => unit.employeeIds),
        ]),
      ];
  const serviceShares = shareMap(serviceIds, (id) =>
    finalized
      ? line.contributions.find((fact) => fact.employeeId === id)?.shareRate
      : line.participations.find((p) => p.employeeId === id)?.shareRate,
  );
  const serviceName = (id: string) =>
    line.contributions
      .find((fact) => fact.employeeId === id)
      ?.employeeDisplayNameSnapshot?.trim() || current(id);

  if (addition.performerIds.length) {
    const ownShares = shareMap(
      addition.performerIds,
      (id) => addition.performerRates.find((rate) => rate.employeeId === id)?.shareRate,
    );
    const name = (id: string) => addition.performerSnapshots[id] || current(id);
    const sameEmployees =
      serviceIds.length > 0 &&
      serviceIds.length === addition.performerIds.length &&
      addition.performerIds.every((id) => serviceShares.has(id));
    const sameShares =
      sameEmployees &&
      addition.performerIds.every((id) =>
        createDecimal(ownShares.get(id)!).equals(createDecimal(serviceShares.get(id)!)),
      );
    return {
      state: 'OWN',
      names: addition.performerIds.map(name),
      match: sameShares ? 'SAME' : sameEmployees ? 'SAME_EMPLOYEES' : 'NONE',
      shares: addition.performerIds.map((id) => ({
        name: name(id),
        shareRate: ownShares.get(id)!,
      })),
    };
  }
  if (addition.performerAssignment !== 'SERVICE' && !finalized)
    return { state: 'UNDECIDED', names: [], match: 'NONE', shares: [] };
  return {
    state: 'SERVICE',
    names: serviceIds.map(serviceName),
    match: 'NONE',
    shares: serviceIds.map((id) => ({ name: serviceName(id), shareRate: serviceShares.get(id)! })),
  };
}
