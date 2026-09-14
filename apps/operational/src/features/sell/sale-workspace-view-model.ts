import { createDecimal } from '@digvation/pos-money';
import type { ConnectivityState } from '@digvation/pos-runtime';

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

function domainReadiness(sale: Sale | null, activeLines: SaleLine[]) {
  const blockers: DomainReadinessBlocker[] = [];
  if (!sale) return { ready: false, blockers };

  if (activeLines.length === 0) {
    blockers.push({ code: 'NO_LINES', message: 'Tambahkan setidaknya satu item.' });
  }

  if (sale.payments.some((payment) => payment.status === 'PENDING')) {
    blockers.push({ code: 'PAYMENT_PENDING', message: 'Selesaikan pembayaran yang masih menunggu.' });
  }

  const succeeded = createDecimal(sumPayments(sale, 'SUCCEEDED'));
  if (!succeeded.equals(createDecimal(sale.totalAmount))) {
    blockers.push({
      code: 'NOT_SETTLED',
      message: 'Jumlah pembayaran harus sama dengan total transaksi.',
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
        message: `${line.itemNameSnapshot}: pengerjaan belum selesai.`,
      });
    }

    if (
      line.employeeAssignmentModeSnapshot === 'REQUIRED' &&
      !line.participations.some((participation) => participation.assigned)
    ) {
      blockers.push({
        code: 'ASSIGNMENT_REQUIRED',
        saleLineId: line.id,
        message: `${line.itemNameSnapshot}: pilih karyawan.`,
      });
    }

    if (!hasValidContribution(line)) {
      blockers.push({
        code: 'CONTRIBUTION_REQUIRED',
        saleLineId: line.id,
        message: `${line.itemNameSnapshot}: total kontribusi karyawan harus 100%.`,
      });
    }
  }

  return { ready: blockers.length === 0, blockers };
}

export function createSaleWorkspaceViewModel(
  sale: Sale | null,
  connectivity: ConnectivityState,
  synchronization: SynchronizationState,
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
  const readiness = domainReadiness(sale, activeLines);
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

export function actionBlockMessage(reason: ActionBlockReason): string {
  switch (reason) {
    case 'SALE_TERMINAL':
      return 'Transaksi ini sudah ditutup.';
    case 'PAYMENT_PENDING':
      return 'Selesaikan pembayaran yang masih menunggu.';
    case 'OFFLINE':
      return 'Sambungkan kembali perangkat sebelum mengubah transaksi.';
    case 'CONFLICT_REVIEW':
      return 'Periksa perubahan terbaru sebelum melanjutkan.';
    case 'MUTATION_IN_PROGRESS':
      return 'Tunggu perubahan saat ini selesai.';
    case 'DOMAIN_NOT_READY':
      return 'Lengkapi transaksi sebelum melanjutkan.';
    case 'NOTHING_TO_PAY':
      return 'Tidak ada sisa pembayaran.';
    case 'NOT_VOIDABLE':
      return 'Transaksi dengan pembayaran tidak dapat dibatalkan.';
  }
}
