import { createDecimal } from '@digvation/pos-money';
import type { ConnectivityState } from '@digvation/pos-runtime';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../app/localization/operational-localization';
import type { Sale, SaleLine } from './cashier-transaction.types';

export type SaleWorkspacePrimaryMode =
  | 'EMPTY'
  | 'OPEN_ACTIVE'
  | 'PAYMENT_PENDING_ATTENTION'
  | 'PAID_WORK_REMAINING'
  | 'READY_TO_FINALIZE'
  | 'CONFLICT_REVIEW'
  | 'FINALIZED'
  | 'VOIDED';

export type SynchronizationState = 'CLEAN' | 'MUTATING' | 'CONFLICT_REVIEW' | 'UNCERTAIN_COMMAND';

export type ActionBlockReason =
  | 'SALE_TERMINAL'
  | 'PAYMENT_PENDING'
  | 'OFFLINE'
  | 'CONFLICT_REVIEW'
  | 'MUTATION_IN_PROGRESS'
  | 'DOMAIN_NOT_READY'
  | 'NOTHING_TO_PAY'
  | 'NOT_VOIDABLE';

export type ActionAvailability =
  { state: 'AVAILABLE' } | { state: 'HIDDEN' } | { state: 'DISABLED'; reason: ActionBlockReason };

export type DomainReadinessBlockerCode =
  | 'NO_LINES'
  | 'PAYMENT_PENDING'
  | 'NOT_SETTLED'
  | 'FULFILLMENT_INCOMPLETE'
  | 'ASSIGNMENT_REQUIRED'
  | 'CONTRIBUTION_REQUIRED';

export interface DomainReadinessBlocker {
  code: DomainReadinessBlockerCode;
  message: string;
  saleLineId?: string;
}

export interface SaleWorkspaceViewModel {
  primaryMode: SaleWorkspacePrimaryMode;
  sale: Sale | null;
  activeLines: SaleLine[];
  hasPendingPayment: boolean;
  paidAmount: string;
  pendingAmount: string;
  availableToPay: string;
  connectivity: ConnectivityState;
  synchronization: SynchronizationState;
  domainReadiness: {
    ready: boolean;
    blockers: DomainReadinessBlocker[];
  };
  monetaryMutation: ActionAvailability;
  operationalMutation: ActionAvailability;
  paymentMutation: ActionAvailability;
  finalizeMutation: ActionAvailability;
  voidMutation: ActionAvailability;
}

function copyForLocale(value: string, locale?: string): string {
  return operationalCopy(value, resolveOperationalLocale(locale));
}

function executionBlock(
  connectivity: ConnectivityState,
  synchronization: SynchronizationState,
): ActionAvailability | null {
  if (connectivity === 'OFFLINE') return { state: 'DISABLED', reason: 'OFFLINE' };
  if (synchronization === 'CONFLICT_REVIEW' || synchronization === 'UNCERTAIN_COMMAND') {
    return { state: 'DISABLED', reason: 'CONFLICT_REVIEW' };
  }
  if (synchronization === 'MUTATING') {
    return { state: 'DISABLED', reason: 'MUTATION_IN_PROGRESS' };
  }
  return null;
}

function sumPayments(sale: Sale | null, status: 'SUCCEEDED' | 'PENDING'): string {
  const total = sale?.payments
    .filter((payment) => payment.status === status)
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  return (total ?? createDecimal('0')).toFixed(4);
}

function hasValidContribution(line: SaleLine): boolean {
  if (!line.allowEmployeeContributionSnapshot) return true;
  const rates = line.participations.flatMap((participation) =>
    participation.shareRate === null ? [] : [createDecimal(participation.shareRate)],
  );
  if (rates.length === 0) return false;
  const total = rates.reduce((sum, rate) => sum.plus(rate), createDecimal('0'));
  return total.equals(1);
}

function domainReadiness(sale: Sale | null, activeLines: SaleLine[], locale?: string) {
  const blockers: DomainReadinessBlocker[] = [];
  if (!sale) return { ready: false, blockers };

  if (activeLines.length === 0) {
    blockers.push({ code: 'NO_LINES', message: copyForLocale('Add at least one item.', locale) });
  }

  if (sale.payments.some((payment) => payment.status === 'PENDING')) {
    blockers.push({
      code: 'PAYMENT_PENDING',
      message: copyForLocale('Resolve pending payments.', locale),
    });
  }

  const succeeded = createDecimal(sumPayments(sale, 'SUCCEEDED'));
  if (!succeeded.equals(createDecimal(sale.totalAmount))) {
    blockers.push({
      code: 'NOT_SETTLED',
      message: copyForLocale('Payments must match the transaction total.', locale),
    });
  }

  for (const line of activeLines) {
    if (
      line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
      line.fulfillment?.status !== 'COMPLETED'
    ) {
      blockers.push({
        code: 'FULFILLMENT_INCOMPLETE',
        saleLineId: line.id,
        message: `${line.itemNameSnapshot}: ${copyForLocale('Complete all work before finishing the transaction.', locale)}`,
      });
    }

    if (
      line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
      !line.participations.some((participation) => participation.assigned)
    ) {
      blockers.push({
        code: 'ASSIGNMENT_REQUIRED',
        saleLineId: line.id,
        message: `${line.itemNameSnapshot}: ${copyForLocale('Select an employee.', locale)}`,
      });
    }

    if (!hasValidContribution(line)) {
      blockers.push({
        code: 'CONTRIBUTION_REQUIRED',
        saleLineId: line.id,
        message: `${line.itemNameSnapshot}: ${copyForLocale('Employee contribution must total 100%.', locale)}`,
      });
    }
  }

  return { ready: blockers.length === 0, blockers };
}

export function createSaleWorkspaceViewModel(
  sale: Sale | null,
  connectivity: ConnectivityState,
  synchronization: SynchronizationState,
  locale?: string,
): SaleWorkspaceViewModel {
  const activeLines = sale?.lines.filter((line) => line.removedAt === null) ?? [];
  const paidAmount = sumPayments(sale, 'SUCCEEDED');
  const pendingAmount = sumPayments(sale, 'PENDING');
  const availableToPay = sale
    ? createDecimal(sale.totalAmount)
        .minus(createDecimal(paidAmount))
        .minus(createDecimal(pendingAmount))
        .toFixed(4)
    : '0.0000';
  const hasPendingPayment = createDecimal(pendingAmount).greaterThan(0);
  const readiness = domainReadiness(sale, activeLines, locale);
  const execution = executionBlock(connectivity, synchronization);

  const terminalBlock: ActionAvailability | null =
    sale && sale.status !== 'OPEN' ? { state: 'DISABLED', reason: 'SALE_TERMINAL' } : null;

  const operationalMutation = execution ?? terminalBlock ?? { state: 'AVAILABLE' as const };
  const monetaryMutation = execution ??
    terminalBlock ??
    (hasPendingPayment
      ? { state: 'DISABLED' as const, reason: 'PAYMENT_PENDING' as const }
      : null) ?? { state: 'AVAILABLE' as const };
  const paymentMutation = execution ??
    terminalBlock ??
    (createDecimal(availableToPay).lessThanOrEqualTo(0)
      ? { state: 'DISABLED' as const, reason: 'NOTHING_TO_PAY' as const }
      : null) ?? { state: 'AVAILABLE' as const };
  const finalizeMutation = execution ??
    terminalBlock ??
    (!readiness.ready
      ? { state: 'DISABLED' as const, reason: 'DOMAIN_NOT_READY' as const }
      : null) ?? { state: 'AVAILABLE' as const };
  const hasBlockingPayment =
    sale?.payments.some(
      (payment) => payment.status === 'PENDING' || payment.status === 'SUCCEEDED',
    ) ?? false;
  const voidMutation = execution ??
    terminalBlock ??
    (hasBlockingPayment
      ? { state: 'DISABLED' as const, reason: 'NOT_VOIDABLE' as const }
      : null) ?? { state: 'AVAILABLE' as const };

  let primaryMode: SaleWorkspacePrimaryMode = 'EMPTY';
  if (sale?.status === 'FINALIZED') primaryMode = 'FINALIZED';
  else if (sale?.status === 'VOIDED') primaryMode = 'VOIDED';
  else if (synchronization === 'CONFLICT_REVIEW' || synchronization === 'UNCERTAIN_COMMAND') {
    primaryMode = 'CONFLICT_REVIEW';
  } else if (hasPendingPayment) primaryMode = 'PAYMENT_PENDING_ATTENTION';
  else if (sale && readiness.ready) primaryMode = 'READY_TO_FINALIZE';
  else if (
    sale &&
    createDecimal(paidAmount).equals(createDecimal(sale.totalAmount)) &&
    readiness.blockers.some((blocker) =>
      ['FULFILLMENT_INCOMPLETE', 'ASSIGNMENT_REQUIRED', 'CONTRIBUTION_REQUIRED'].includes(
        blocker.code,
      ),
    )
  ) {
    primaryMode = 'PAID_WORK_REMAINING';
  } else if (sale) primaryMode = 'OPEN_ACTIVE';

  return {
    primaryMode,
    sale,
    activeLines,
    hasPendingPayment,
    paidAmount,
    pendingAmount,
    availableToPay,
    connectivity,
    synchronization,
    domainReadiness: readiness,
    monetaryMutation,
    operationalMutation,
    paymentMutation,
    finalizeMutation,
    voidMutation,
  };
}

export function actionBlockMessage(reason: ActionBlockReason, locale?: string): string {
  switch (reason) {
    case 'SALE_TERMINAL':
      return copyForLocale('This transaction is already closed.', locale);
    case 'PAYMENT_PENDING':
      return copyForLocale('Resolve pending payments.', locale);
    case 'OFFLINE':
      return copyForLocale('Reconnect before changing this transaction.', locale);
    case 'CONFLICT_REVIEW':
      return copyForLocale('Review the latest changes before continuing.', locale);
    case 'MUTATION_IN_PROGRESS':
      return copyForLocale('Wait for the current change to finish.', locale);
    case 'DOMAIN_NOT_READY':
      return copyForLocale('Complete the transaction before continuing.', locale);
    case 'NOTHING_TO_PAY':
      return copyForLocale('There is no remaining amount to pay.', locale);
    case 'NOT_VOIDABLE':
      return copyForLocale('Transactions with payments cannot be canceled.', locale);
  }
}
