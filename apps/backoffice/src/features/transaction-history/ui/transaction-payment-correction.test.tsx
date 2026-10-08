import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PaymentComposition, Sale } from '../api/transaction-history-api';
import { transactionActions } from '../model/transaction-actions';
import { paymentKind } from '../model/payment-kind';
import { transactionPaymentComposition } from '../model/transaction-payment-composition';
import { testPayment, testSale } from '../model/transaction-test-fixtures';
import { renderDetail } from './transaction-history-test-harness';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
const client = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@digvation/business-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof BusinessRuntime>()),
  useRuntime: () => ({ apiBaseUrl: 'http://runtime.test', currency: 'IDR' }),
}));

vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({
    session: { access: { permissions: auth.permissions } },
    createApiClient: () => client,
  }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

const entry = (
  method: 'CASH' | 'BANK_TRANSFER',
  paymentRouteId: string,
  name: string,
  amount: string,
) => ({
  method,
  paymentRouteId,
  financialAccountId: `account-${paymentRouteId}`,
  financialAccountCode: null,
  financialAccountName: name,
  receivedAmount: amount,
  refundedAmount: '0.0000',
  effectiveAmount: amount,
});

const composition = (cash: string, bca: string): PaymentComposition => ({
  entries: [
    entry('BANK_TRANSFER', 'route-bca', 'BCA', bca),
    entry('CASH', 'route-cash', 'Tunai', cash),
  ],
  totalReceived: '110000.0000',
  totalRefunded: '0.0000',
  totalPaid: '110000.0000',
});

/** Total 110.000: Tunai 5.000 + BCA 105.000 as recorded. */
const recorded = (change: Partial<Sale> = {}) =>
  testSale({
    id: 'sale-c',
    saleNumber: 'TRX-20261008-000010',
    status: 'FINALIZED',
    finalizedAt: '2026-10-08T06:00:00.000Z',
    version: 7,
    grossAmount: '110000.0000',
    totalAmount: '110000.0000',
    payments: [
      testPayment('p-cash', 'SUCCEEDED', '5000.0000', {
        kind: 'PAYMENT',
        financeFinancialAccountNameSnapshot: 'Tunai',
        tenderedAmount: '5000.0000',
        changeAmount: '0.0000',
        createdAt: '2026-10-08T05:00:00.000Z',
      }),
      testPayment('p-bca', 'SUCCEEDED', '105000.0000', {
        kind: 'PAYMENT',
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA',
        createdAt: '2026-10-08T05:01:00.000Z',
      }),
    ],
    paymentComposition: composition('5000.0000', '105000.0000'),
    ...change,
  });

const corrected = (afterSettlement = false) =>
  recorded({
    version: 8,
    payments: [
      ...recorded().payments,
      testPayment('c-out', 'SUCCEEDED', '-5000.0000', {
        kind: 'CORRECTION_OUT',
        correction: { id: 'correction-1', leg: 'OUT' },
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA',
        createdAt: '2026-10-08T07:00:00.000Z',
      }),
      testPayment('c-in', 'SUCCEEDED', '5000.0000', {
        kind: 'CORRECTION_IN',
        correction: { id: 'correction-1', leg: 'IN' },
        financeFinancialAccountNameSnapshot: 'Tunai',
        createdAt: '2026-10-08T07:00:00.000Z',
      }),
    ],
    paymentCorrections: [
      {
        id: 'correction-1',
        reason: 'Salah memasukkan nominal pembayaran',
        correctsCorrectionId: null,
        afterSettlement,
        createdBy: 'Andini',
        createdByPresence: 'USER',
        createdAt: '2026-10-08T07:00:00.000Z',
        movements: [
          {
            paymentId: 'c-out',
            leg: 'OUT',
            method: 'BANK_TRANSFER',
            paymentRouteId: 'route-bca',
            financialAccountId: 'account-route-bca',
            financialAccountCode: null,
            financialAccountName: 'BCA',
            amount: '-5000.0000',
          },
          {
            paymentId: 'c-in',
            leg: 'IN',
            method: 'CASH',
            paymentRouteId: 'route-cash',
            financialAccountId: 'account-route-cash',
            financialAccountCode: null,
            financialAccountName: 'Tunai',
            amount: '5000.0000',
          },
        ],
        allocations: [{ outPaymentId: 'c-out', sourcePaymentId: 'p-bca', amount: '5000.0000' }],
      },
    ],
    paymentComposition: composition('10000.0000', '100000.0000'),
  });

const permitted = { refund: true, reverse: true, correct: true };
const paymentsPanel = async () => {
  const dialog = within(await screen.findByRole('dialog'));
  return within(await dialog.findByRole('region', { name: 'Pembayaran' }));
};

describe('payment kinds in the Backoffice payment model', () => {
  it('uses Runtime’s explicit kind, so a correction leg is never read as a payment or a refund', () => {
    const sale = corrected();
    const split = transactionPaymentComposition(sale);
    expect(split.applied.map((payment) => payment.id)).toEqual(['p-cash', 'p-bca']);
    expect(split.refunds).toEqual([]);
    expect(split.corrections.map((payment) => payment.id).sort()).toEqual(['c-in', 'c-out']);
    // The sign alone decides nothing when Runtime states the kind.
    expect(paymentKind({ appliedAmount: '5000.0000', kind: 'CORRECTION_IN' })).toBe(
      'CORRECTION_IN',
    );
    expect(paymentKind({ appliedAmount: '-5000.0000', kind: 'CORRECTION_OUT' })).toBe(
      'CORRECTION_OUT',
    );
    expect(split.totalPaid).toBe('110000.0000');
    expect(split.totalRefunded).toBe('0.0000');
  });

  it('keeps a refund a refund (PR #136 manual refund) apart from corrections', () => {
    const sale = corrected();
    sale.payments.push(
      testPayment('r-1', 'SUCCEEDED', '-1000.0000', {
        kind: 'REFUND',
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA Operasional',
        refund: {
          id: 'refund-1',
          kind: 'MANUAL',
          reason: 'ORDER_ADJUSTMENT',
          externalReference: 'TRF-1',
          note: null,
          adjustmentId: null,
          allocations: [{ sourcePaymentId: 'p-bca', amount: '1000.0000' }],
        },
      }),
    );
    const split = transactionPaymentComposition(sale);
    expect(split.refunds.map((payment) => payment.id)).toEqual(['r-1']);
    expect(split.totalRefunded).toBe('1000.0000');
    expect(split.corrections).toHaveLength(2);
  });
});

describe('payment correction entry point', () => {
  it('is offered only with payments:correct and an eligible Sale', () => {
    expect(transactionActions(recorded(), permitted).canCorrect).toBe(true);
    expect(transactionActions(recorded(), { ...permitted, correct: false }).canCorrect).toBe(false);
    expect(transactionActions(recorded(), { refund: true, reverse: true }).canCorrect).toBe(false);
    expect(transactionActions(recorded({ status: 'VOIDED' }), permitted).canCorrect).toBe(false);
    expect(
      transactionActions(
        recorded({ reversal: { reason: 'x', reversedAt: '2026-10-08T00:00:00.000Z' } }),
        permitted,
      ).canCorrect,
    ).toBe(false);
  });

  it('shows the button only to a permitted session', async () => {
    const correctPayments = vi.fn(async () => corrected());
    renderDetail(recorded(), permitted, { correctPayments, paymentRoutes: vi.fn(async () => []) });
    expect(await screen.findByRole('button', { name: 'Koreksi pembayaran' })).toBeTruthy();
    cleanup();
    renderDetail(recorded(), { refund: true, reverse: true }, { correctPayments });
    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Koreksi pembayaran' })).toBeNull();
  });
});

describe('payment correction audit context', () => {
  it('keeps the original payments, then the correction history, then the effective composition', async () => {
    renderDetail(corrected(), permitted);
    const panel = await paymentsPanel();
    // Original facts, exactly as recorded.
    expect(panel.getByText(/^Rp\s105\.000$/)).toBeTruthy();
    expect(panel.getAllByText(/^Rp\s5\.000$/).length).toBeGreaterThan(0);

    const history = within(panel.getByText('Koreksi pembayaran').parentElement as HTMLElement);
    const correction = history.getByTestId('payment-correction');
    expect(correction.textContent).toMatch(/−\s?Rp\s?5\.000/);
    expect(correction.textContent).toMatch(/\+\s?Rp\s?5\.000/);
    expect(correction.textContent).toContain('Transfer bank · Dikurangi');
    expect(correction.textContent).toContain('Alasan:Salah memasukkan nominal pembayaran');
    expect(correction.textContent).toContain('Dikoreksi oleh:Andini');
    expect(correction.textContent).toContain('Waktu koreksi:');

    const effective = within(panel.getByText('Pembayaran efektif').parentElement as HTMLElement);
    expect(effective.getByText(/^Rp\s100\.000$/)).toBeTruthy();
    expect(effective.getByText(/^Rp\s10\.000$/)).toBeTruthy();
    // No refund and no payment attempt was invented.
    expect(panel.queryByText('Pengembalian dana')).toBeNull();
    expect(panel.queryByText('Percobaan pembayaran lain')).toBeNull();
  });

  it('says when the correction came after a closed reconciliation', async () => {
    renderDetail(corrected(true), permitted);
    const panel = await paymentsPanel();
    expect(panel.getByText(/Koreksi setelah rekonsiliasi/)).toBeTruthy();
    cleanup();
    renderDetail(corrected(false), permitted);
    const plain = await paymentsPanel();
    expect(plain.queryByText(/Koreksi setelah rekonsiliasi/)).toBeNull();
  });

  it('shows a manual refund by where the money left, never as a correction', async () => {
    const sale = corrected();
    sale.payments.push(
      testPayment('r-1', 'SUCCEEDED', '-1000.0000', {
        kind: 'REFUND',
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA Operasional',
        refund: {
          id: 'refund-1',
          kind: 'MANUAL',
          reason: 'ORDER_ADJUSTMENT',
          externalReference: 'TRF-1',
          note: null,
          adjustmentId: null,
          allocations: [],
        },
      }),
    );
    renderDetail(sale, permitted);
    const panel = await paymentsPanel();
    const refunds = within(panel.getByText('Pengembalian dana').parentElement as HTMLElement);
    expect(refunds.getByText('BCA Operasional')).toBeTruthy();
    expect(refunds.getByText(/Pengembalian manual · TRF-1/)).toBeTruthy();
    expect(refunds.queryByText('Koreksi')).toBeNull();
  });
});

describe('payment correction command', () => {
  const open = async (correctPayments = vi.fn(async () => corrected())) => {
    const paymentRoutes = vi.fn(async () => [
      {
        id: 'route-mandiri',
        paymentMethod: 'BANK_TRANSFER' as const,
        currency: 'IDR',
        financialAccountName: 'Mandiri',
      },
    ]);
    renderDetail(recorded(), permitted, { correctPayments, paymentRoutes });
    fireEvent.click(await screen.findByRole('button', { name: 'Koreksi pembayaran' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Koreksi pembayaran' }));
    return { dialog, correctPayments, paymentRoutes };
  };

  it('sends the same one Runtime command with the two sides of a net-zero move', async () => {
    const { dialog, correctPayments, paymentRoutes } = await open();
    await waitFor(() => expect(paymentRoutes).toHaveBeenCalledWith('location-1', 'IDR'));
    expect(
      (dialog.getByRole('button', { name: 'Simpan koreksi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(dialog.getByLabelText('Pindahkan dari'));
    fireEvent.click(await screen.findByRole('option', { name: /BCA · Rp\s?105\.000/ }));
    fireEvent.click(dialog.getByLabelText('Ke'));
    fireEvent.click(await screen.findByRole('option', { name: 'Tunai' }));
    fireEvent.change(dialog.getByRole('textbox', { name: /Nominal yang dipindahkan/ }), {
      target: { value: '5000' },
    });
    fireEvent.change(dialog.getByRole('textbox', { name: 'Alasan' }), {
      target: { value: 'Salah memasukkan nominal pembayaran' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan koreksi' }));
    await waitFor(() => expect(correctPayments).toHaveBeenCalledOnce());
    const [saleId, request, key] = correctPayments.mock.calls[0]! as unknown as [
      string,
      unknown,
      string,
    ];
    expect(saleId).toBe('sale-c');
    expect(request).toEqual({
      expectedVersion: 7,
      reason: 'Salah memasukkan nominal pembayaran',
      moves: [
        { paymentRouteId: 'route-bca', delta: '-5000' },
        { paymentRouteId: 'route-cash', delta: '5000' },
      ],
    });
    expect(key).toMatch(/^backoffice-payment-correction-/);
  });
});
