import { describe, expect, it } from 'vitest';

import type { PaymentRoute, Sale } from '../transaction/model/cashier-transaction.types';
import {
  canCorrectPayments,
  correctionMoves,
  correctionRows,
  correctionState,
  paymentCompositionOf,
  paymentCorrectionInput,
} from './payment-correction-draft';

const payment = (id: string, route: string, amount: string, extra: object = {}) => ({
  id,
  status: 'SUCCEEDED',
  method: route === 'cash' ? 'CASH' : 'BANK_TRANSFER',
  appliedAmount: amount,
  financePaymentRouteId: route,
  financeFinancialAccountId: `account-${route}`,
  financeFinancialAccountNameSnapshot: route === 'cash' ? 'Tunai' : 'BCA',
  ...extra,
});

const composition = (cash: string, bca: string) => ({
  entries: [
    {
      method: 'CASH',
      paymentRouteId: 'cash',
      financialAccountId: 'account-cash',
      financialAccountCode: null,
      financialAccountName: 'Tunai',
      receivedAmount: cash,
      refundedAmount: '0.0000',
      effectiveAmount: cash,
    },
    {
      method: 'BANK_TRANSFER',
      paymentRouteId: 'bca',
      financialAccountId: 'account-bca',
      financialAccountCode: null,
      financialAccountName: 'BCA',
      receivedAmount: bca,
      refundedAmount: '0.0000',
      effectiveAmount: bca,
    },
  ],
  totalReceived: '110000.0000',
  totalRefunded: '0.0000',
  totalPaid: '110000.0000',
});

const sale = (overrides: object = {}) =>
  ({
    id: 'sale-1',
    version: 4,
    status: 'FINALIZED',
    sellingLocationId: 'location-1',
    currency: 'IDR',
    totalAmount: '110000.0000',
    payments: [payment('p1', 'cash', '5000.0000'), payment('p2', 'bca', '105000.0000')],
    paymentComposition: composition('5000.0000', '105000.0000'),
    ...overrides,
  }) as unknown as Sale;

const route = (id: string, name: string, overrides: object = {}) =>
  ({
    id,
    sellingLocationId: 'location-1',
    paymentMethod: 'BANK_TRANSFER',
    currency: 'IDR',
    financialAccountId: `account-${id}`,
    financialAccountCode: null,
    financialAccountName: name,
    status: 'ACTIVE',
    version: 1,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }) as PaymentRoute;

describe('payment correction draft', () => {
  it('uses Runtime’s effective composition as the one authority', () => {
    const corrected = sale({ paymentComposition: composition('10000.0000', '100000.0000') });
    expect(paymentCompositionOf(corrected).entries.map((e) => e.effectiveAmount)).toEqual([
      '10000.0000',
      '100000.0000',
    ]);
  });

  it('groups received payments by route only when Runtime sent no composition (local demo)', () => {
    const local = sale({ paymentComposition: undefined });
    expect(paymentCompositionOf(local)).toMatchObject({
      totalPaid: '110000.0000',
      totalRefunded: '0.0000',
    });
    expect(paymentCompositionOf(local).entries).toHaveLength(2);
  });

  it('offers the entry point only with payments:correct on a correctable Sale', () => {
    expect(canCorrectPayments(sale(), ['payments:refund'])).toBe(false);
    expect(canCorrectPayments(sale(), ['payments:correct'])).toBe(true);
    expect(canCorrectPayments(sale({ status: 'VOIDED' }), ['payments:correct'])).toBe(false);
    expect(
      canCorrectPayments(sale({ reversal: { reason: 'x', reversedAt: 'y' } }), [
        'payments:correct',
      ]),
    ).toBe(false);
    expect(
      canCorrectPayments(
        sale({
          payments: [],
          paymentComposition: { ...composition('0.0000', '0.0000'), entries: [] },
        }),
        ['payments:correct'],
      ),
    ).toBe(false);
  });

  it('lists the effective routes first and every other active route of the location', () => {
    const rows = correctionRows(sale(), [
      route('mandiri', 'Mandiri'),
      route('other-place', 'Elsewhere', { sellingLocationId: 'location-2' }),
      route('usd', 'USD', { currency: 'USD' }),
      route('closed', 'Closed', { status: 'INACTIVE' }),
    ]);
    expect(rows.map((row) => row.name)).toEqual(['BCA', 'Tunai', 'Mandiri']);
  });

  it('derives the signed deltas from the correct composition the operator typed', () => {
    const rows = correctionRows(sale(), []);
    const state = correctionState(rows, { cash: '10000', bca: '100000' });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.moves.map((move) => [move.row.name, move.delta])).toEqual([
      ['BCA', '-5000.0000'],
      ['Tunai', '5000.0000'],
    ]);
    expect(paymentCorrectionInput(sale(), '  Salah nominal  ', state.moves)).toEqual({
      expectedVersion: 4,
      reason: 'Salah nominal',
      moves: [
        { paymentRouteId: 'bca', delta: '-5000.0000' },
        { paymentRouteId: 'cash', delta: '5000.0000' },
      ],
    });
  });

  it('is not valid while the total paid would change', () => {
    const rows = correctionRows(sale(), []);
    expect(correctionState(rows, { cash: '11000', bca: '100000' })).toMatchObject({
      ok: false,
      reason: 'NOT_NET_ZERO',
      net: '1000.0000',
    });
  });

  it('is not valid without a change or with an unreadable amount', () => {
    const rows = correctionRows(sale(), []);
    expect(correctionState(rows, {})).toMatchObject({ ok: false, reason: 'NO_CHANGE' });
    expect(correctionState(rows, { cash: 'abc' })).toMatchObject({
      ok: false,
      reason: 'INVALID_AMOUNT',
    });
  });

  it('moves money to a route that held none yet', () => {
    const rows = correctionRows(sale(), [route('mandiri', 'Mandiri')]);
    const moves = correctionMoves(rows, { bca: '100000', mandiri: '5000' });
    expect(moves.map((move) => [move.row.name, move.delta])).toEqual([
      ['BCA', '-5000.0000'],
      ['Mandiri', '5000.0000'],
    ]);
  });
});
