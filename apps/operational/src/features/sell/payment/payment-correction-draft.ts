import { createDecimal } from '@digvation/pos-money';

import type {
  PaymentComposition,
  PaymentCompositionEntry,
  PaymentMethod,
  PaymentRoute,
  Sale,
} from '../transaction/model/cashier-transaction.types';
import { paymentKind } from '../transaction/model/payment-kind';

export const PAYMENT_CORRECT_PERMISSION = 'payments:correct';

const ZERO = '0.0000';

/**
 * Runtime's effective payment composition. Only the local demo adapters, which have no Runtime,
 * lack it; then the successful payments received are grouped by route, exactly once, here.
 */
export function paymentCompositionOf(sale: Sale): PaymentComposition {
  if (sale.paymentComposition) return sale.paymentComposition;
  const entries = new Map<string, PaymentCompositionEntry>();
  let received = createDecimal('0');
  for (const payment of sale.payments) {
    if (payment.status !== 'SUCCEEDED') continue;
    const kind = paymentKind(payment);
    if (kind === 'REFUND') continue;
    const key = `${payment.method}|${payment.financePaymentRouteId ?? ''}`;
    const amount = createDecimal(payment.appliedAmount);
    received = received.plus(amount);
    const previous = entries.get(key);
    const total = createDecimal(previous?.receivedAmount ?? '0')
      .plus(amount)
      .toFixed(4);
    entries.set(key, {
      method: payment.method,
      paymentRouteId: payment.financePaymentRouteId ?? null,
      financialAccountId: payment.financeFinancialAccountId ?? null,
      financialAccountCode: payment.financeFinancialAccountCodeSnapshot ?? null,
      financialAccountName: payment.financeFinancialAccountNameSnapshot ?? null,
      receivedAmount: total,
      refundedAmount: ZERO,
      effectiveAmount: total,
    });
  }
  const refunded = sale.payments
    .filter((payment) => payment.status === 'SUCCEEDED' && paymentKind(payment) === 'REFUND')
    .reduce((sum, payment) => sum.minus(createDecimal(payment.appliedAmount)), createDecimal('0'));
  return {
    entries: [...entries.values()],
    totalReceived: received.toFixed(4),
    totalRefunded: refunded.toFixed(4),
    totalPaid: received.minus(refunded).toFixed(4),
  };
}

/**
 * Whether the correction entry point is offered: the session holds the permission and the Sale has
 * money recorded on a route that could be re-attributed. Runtime stays the authority and refuses a
 * voided or reversed Sale, so a stale screen can never write one.
 */
export function canCorrectPayments(sale: Sale, permissions: readonly string[]): boolean {
  if (!permissions.includes(PAYMENT_CORRECT_PERMISSION)) return false;
  if (sale.status === 'VOIDED' || sale.reversal) return false;
  return paymentCompositionOf(sale).entries.some(
    (entry) => entry.paymentRouteId !== null && createDecimal(entry.effectiveAmount).greaterThan(0),
  );
}

export interface CorrectionRow {
  routeId: string;
  method: PaymentMethod;
  name: string;
  /** What Runtime effectively holds on this route now. */
  current: string;
}

/**
 * The routes the operator can attribute money to: every effective route of the Sale and every
 * active payment route of its location and currency. Legacy payments without a route are fixed
 * and never offered.
 */
export function correctionRows(sale: Sale, routes: readonly PaymentRoute[]): CorrectionRow[] {
  const rows = new Map<string, CorrectionRow>();
  for (const entry of paymentCompositionOf(sale).entries)
    if (entry.paymentRouteId)
      rows.set(entry.paymentRouteId, {
        routeId: entry.paymentRouteId,
        method: entry.method,
        name: entry.financialAccountName ?? entry.method,
        current: entry.effectiveAmount,
      });
  for (const route of routes)
    if (
      route.status === 'ACTIVE' &&
      route.sellingLocationId === sale.sellingLocationId &&
      route.currency === sale.currency &&
      !rows.has(route.id)
    )
      rows.set(route.id, {
        routeId: route.id,
        method: route.paymentMethod,
        name: route.financialAccountName,
        current: ZERO,
      });
  return [...rows.values()].sort(
    (left, right) =>
      Number(createDecimal(right.current).greaterThan(createDecimal(left.current))) -
        Number(createDecimal(left.current).greaterThan(createDecimal(right.current))) ||
      left.name.localeCompare(right.name),
  );
}

/** The target the operator types, as a decimal; empty means zero and anything else is invalid. */
export function targetOf(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return ZERO;
  return /^\d+(\.\d{1,4})?$/.test(trimmed) ? createDecimal(trimmed).toFixed(4) : null;
}

export interface CorrectionMove {
  row: CorrectionRow;
  /** Signed delta from the current effective amount to the typed target. */
  delta: string;
}

/** The derived moves: only the routes whose typed target differs from what they hold now. */
export function correctionMoves(
  rows: readonly CorrectionRow[],
  targets: Readonly<Record<string, string>>,
): CorrectionMove[] {
  const moves: CorrectionMove[] = [];
  for (const row of rows) {
    const target = targetOf(targets[row.routeId] ?? row.current);
    if (target === null) continue;
    const delta = createDecimal(target).minus(createDecimal(row.current));
    if (!delta.isZero()) moves.push({ row, delta: delta.toFixed(4) });
  }
  return moves;
}

export type CorrectionState =
  | { ok: true; moves: CorrectionMove[] }
  | {
      ok: false;
      reason: 'INVALID_AMOUNT' | 'NO_CHANGE' | 'NOT_NET_ZERO' | 'NEGATIVE';
      net: string;
    };

/** The correction is valid only when it changes something and keeps the total paid unchanged. */
export function correctionState(
  rows: readonly CorrectionRow[],
  targets: Readonly<Record<string, string>>,
): CorrectionState {
  for (const row of rows)
    if (targetOf(targets[row.routeId] ?? row.current) === null)
      return { ok: false, reason: 'INVALID_AMOUNT', net: ZERO };
  const moves = correctionMoves(rows, targets);
  const net = moves.reduce((sum, move) => sum.plus(createDecimal(move.delta)), createDecimal('0'));
  if (moves.length === 0) return { ok: false, reason: 'NO_CHANGE', net: ZERO };
  if (!net.isZero()) return { ok: false, reason: 'NOT_NET_ZERO', net: net.toFixed(4) };
  if (
    !moves.some((move) => createDecimal(move.delta).isNegative()) ||
    !moves.some((move) => createDecimal(move.delta).greaterThan(0))
  )
    return { ok: false, reason: 'NEGATIVE', net: ZERO };
  return { ok: true, moves };
}

/** The request Runtime validates again; the typed targets never leave the screen. */
export function paymentCorrectionInput(
  sale: Sale,
  reason: string,
  moves: readonly CorrectionMove[],
) {
  return {
    expectedVersion: sale.version,
    reason: reason.trim(),
    moves: moves.map((move) => ({ paymentRouteId: move.row.routeId, delta: move.delta })),
  };
}
