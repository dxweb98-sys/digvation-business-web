import { describe, expect, it } from 'vitest';

import type { PaymentRoute, Sale } from '../transaction/model/cashier-transaction.types';
import {
  canCorrectPayments,
  correctionEffectiveEntries,
  correctionRouteInfos,
  paymentCompositionOf,
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

  it('starts the shared editor from the route-bound effective composition only', () => {
    const legacy = sale({
      paymentComposition: {
        ...composition('5000.0000', '105000.0000'),
        entries: [
          ...composition('5000.0000', '105000.0000').entries,
          {
            method: 'CASH',
            paymentRouteId: null,
            financialAccountId: null,
            financialAccountCode: null,
            financialAccountName: null,
            receivedAmount: '1.0000',
            refundedAmount: '0.0000',
            effectiveAmount: '1.0000',
          },
        ],
      },
    });
    expect(correctionEffectiveEntries(legacy)).toEqual([
      { routeId: 'cash', amount: '5000.0000' },
      { routeId: 'bca', amount: '105000.0000' },
    ]);
  });

  it('knows the effective routes first and every other active route of the location', () => {
    const infos = correctionRouteInfos(sale(), [
      route('mandiri', 'Mandiri'),
      route('bni', 'Bank BNI'),
      route('other-place', 'Elsewhere', { sellingLocationId: 'location-2' }),
      route('usd', 'USD', { currency: 'USD' }),
      route('closed', 'Closed', { status: 'INACTIVE' }),
    ]);
    expect(infos.map((info) => info.name)).toEqual(['Tunai', 'BCA', 'Mandiri', 'Bank BNI']);
    // Two bank-transfer routes stay distinct correction targets.
    expect(infos.filter((info) => info.method === 'BANK_TRANSFER')).toHaveLength(3);
  });
});
