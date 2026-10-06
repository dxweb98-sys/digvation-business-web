import { createDecimal } from '@digvation/pos-money';
import type { CartDisplayLine } from '../cart/cart-draft';
import type { Sale, SaleLine } from '../transaction/model/cashier-transaction.types';
import { serviceWorkUnitCount } from '../performer/service-performers-dialog';
import { copyFor, isPositiveDecimal } from '../transaction/model/sale-display';

export function employeeAssignmentIssues(
  line: SaleLine,
  locale: string,
  // A corrected replacement is staffed on its retired historical source line.
  workLine: SaleLine = line,
): string[] {
  const issues: string[] = [];
  if (
    line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
    !workLine.participations.some((participation) => participation.assigned)
  ) {
    issues.push(`${line.itemNameSnapshot}: ${copyFor('Select an employee.', locale)}`);
  }
  if (line.allowEmployeeContributionSnapshot) {
    const shares = workLine.participations.filter(
      (participation) => participation.assigned && participation.shareRate !== null,
    );
    const total = shares.reduce(
      (sum, participation) => sum.plus(createDecimal(participation.shareRate ?? '0')),
      createDecimal('0'),
    );
    if (!shares.length || !total.equals(createDecimal('1'))) {
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Employee contribution must total 100%.', locale)}`,
      );
    }
  }
  return issues;
}

export function workflowIssues(sale: Sale, locale: string) {
  const issues: string[] = [];
  const active = sale.lines.filter((line) => line.removedAt === null);
  if (!active.length) issues.push(copyFor('Add at least one item.', locale));

  const succeeded = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  if (!succeeded.equals(createDecimal(sale.totalAmount))) {
    issues.push(copyFor('Payments must match the transaction total.', locale));
  }
  if (sale.payments.some((payment) => payment.status === 'PENDING')) {
    issues.push(copyFor('Resolve pending payments.', locale));
  }

  for (const line of active) {
    if (!isPositiveDecimal(line.quantity))
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Quantity must be greater than zero.', locale)}`,
      );
    if (!isPositiveDecimal(line.effectiveUnitPrice))
      issues.push(`${line.itemNameSnapshot}: ${copyFor('Price is not available.', locale)}`);
    const requiresTrackedServiceAssignment =
      line.itemTypeSnapshot === 'SERVICE' && line.fulfillmentBehaviorSnapshot === 'TRACKED';
    if (!requiresTrackedServiceAssignment) continue;

    const workLine =
      (line.workLineage
        ? sale.lines.find((candidate) => candidate.id === line.workLineage!.sourceLineId)
        : null) ?? line;
    const plannedUnits = workLine.workUnits?.length ?? 0;
    if (plannedUnits > 0 && plannedUnits !== serviceWorkUnitCount(workLine)) {
      issues.push(
        `${line.itemNameSnapshot}: ${copyFor('Every work unit needs at least one employee.', locale)}`,
      );
      continue;
    }

    issues.push(...employeeAssignmentIssues(line, locale, workLine));
  }
  return issues;
}

interface WorkflowIssueGroup {
  id: string;
  label: string;
  issues: string[];
}

export function groupWorkflowIssues(
  sale: Sale,
  issues: readonly string[],
  locale: string,
): WorkflowIssueGroup[] {
  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const groups = new Map<string, WorkflowIssueGroup>();

  for (const issue of issues) {
    const line = activeLines.find((candidate) =>
      issue.startsWith(`${candidate.itemNameSnapshot}:`),
    );
    const id = line?.id ?? 'transaction';
    const label = line?.itemNameSnapshot ?? copyFor('Transaction', locale);
    const detail = line ? issue.slice(`${line.itemNameSnapshot}:`.length).trim() : issue;
    const group = groups.get(id) ?? { id, label, issues: [] };
    group.issues.push(detail);
    groups.set(id, group);
  }

  return [...groups.values()];
}

export function processIssues(
  sale: Sale | null,
  lines: readonly CartDisplayLine[],
  locale: string,
): string[] {
  if (!lines.length) return [copyFor('Add at least one item.', locale)];
  if (sale && sale.status !== 'OPEN')
    return [copyFor('Only active transactions can be processed.', locale)];

  return lines.flatMap((line) => {
    if (!isPositiveDecimal(line.quantity))
      return [
        `${line.itemNameSnapshot}: ${copyFor('Quantity must be greater than zero.', locale)}`,
      ];
    if (!isPositiveDecimal(line.effectiveUnitPrice))
      return [`${line.itemNameSnapshot}: ${copyFor('Price is not available.', locale)}`];
    return [];
  });
}
