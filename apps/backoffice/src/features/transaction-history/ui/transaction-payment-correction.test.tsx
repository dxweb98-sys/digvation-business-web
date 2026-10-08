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

describe('payment correction composition editor', () => {
  /** Tunai 5.000 + QRIS BRI 200.350 recorded; every other eligible route holds nothing. */
  const twoRoutes = () =>
    recorded({
      grossAmount: '205350.0000',
      totalAmount: '205350.0000',
      paymentComposition: {
        entries: [
          entry('CASH', 'route-cash', 'Tunai', '5000.0000'),
          { ...entry('CASH', 'route-qris', 'QRIS BRI', '200350.0000'), method: 'QRIS' },
        ],
        totalReceived: '205350.0000',
        totalRefunded: '0.0000',
        totalPaid: '205350.0000',
      },
    });
  const eligible = [
    {
      id: 'route-cash',
      paymentMethod: 'CASH' as const,
      currency: 'IDR',
      financialAccountName: 'Tunai',
    },
    {
      id: 'route-qris',
      paymentMethod: 'QRIS' as const,
      currency: 'IDR',
      financialAccountName: 'QRIS BRI',
    },
    {
      id: 'route-bca',
      paymentMethod: 'BANK_TRANSFER' as const,
      currency: 'IDR',
      financialAccountName: 'BCA',
    },
    {
      id: 'route-bni',
      paymentMethod: 'BANK_TRANSFER' as const,
      currency: 'IDR',
      financialAccountName: 'Bank BNI',
    },
    {
      id: 'route-akun1',
      paymentMethod: 'BANK_TRANSFER' as const,
      currency: 'IDR',
      financialAccountName: 'AKUN1',
    },
  ];

  const open = async (
    sale: Sale = twoRoutes(),
    correctPayments = vi.fn(async () => corrected()),
  ) => {
    const paymentRoutes = vi.fn(async () => eligible);
    renderDetail(sale, permitted, { correctPayments, paymentRoutes });
    fireEvent.click(await screen.findByRole('button', { name: 'Koreksi pembayaran' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Koreksi pembayaran' }));
    await waitFor(() => expect(paymentRoutes).toHaveBeenCalledWith('location-1', 'IDR'));
    return { dialog, correctPayments };
  };
  const amount = (dialog: ReturnType<typeof within>, name: string) =>
    dialog.getByLabelText(name) as HTMLInputElement;
  const type = (dialog: ReturnType<typeof within>, name: string, value: string) =>
    fireEvent.change(amount(dialog, name), { target: { value } });
  const reasonOk = (dialog: ReturnType<typeof within>) =>
    fireEvent.change(dialog.getByRole('textbox', { name: 'Alasan' }), {
      target: { value: 'Salah memasukkan nominal pembayaran' },
    });
  const save = (dialog: ReturnType<typeof within>) =>
    dialog.getByRole('button', { name: 'Simpan koreksi' }) as HTMLButtonElement;

  it('uses the composition editor, not a transfer between accounts', async () => {
    const { dialog } = await open();
    for (const heading of ['Pencatatan saat ini', 'Pencatatan yang benar', 'Perubahan'])
      expect(dialog.getByRole('region', { name: heading })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Pindahkan dari|Nominal yang dipindahkan/);
    expect(dialog.queryByLabelText('Ke')).toBeNull();
  });

  it('shows only routes that hold money now; zero-value eligible routes stay hidden', async () => {
    const { dialog } = await open();
    const current = dialog.getByRole('region', { name: 'Pencatatan saat ini' });
    expect(current.textContent).toMatch(/Tunai.*5\.000/);
    expect(current.textContent).toMatch(/QRIS BRI.*200\.350/);
    expect(current.textContent).not.toMatch(/BCA|BNI|AKUN1/);
    expect(dialog.queryByLabelText('BCA')).toBeNull();
    expect(amount(dialog, 'Tunai').value).toBe('5.000');
    expect(amount(dialog, 'QRIS BRI').value).toBe('200.350');
    expect(save(dialog).disabled).toBe(true);
  });

  it('balances the other of two routes automatically and derives the changes', async () => {
    const { dialog } = await open();
    type(dialog, 'Tunai', '10000');
    expect(amount(dialog, 'QRIS BRI').value).toBe('195.350');
    const changes = dialog.getByRole('region', { name: 'Perubahan' });
    expect(changes.textContent).toMatch(/Tunai.*\+\s?Rp\s?5\.000/);
    expect(changes.textContent).toMatch(/QRIS BRI.*−\s?Rp\s?5\.000/);
    expect(within(changes).getAllByRole('listitem')).toHaveLength(2);
    type(dialog, 'QRIS BRI', '200350');
    expect(amount(dialog, 'Tunai').value).toBe('5.000');
  });

  it('adds only a route not yet selected, and a three-route mismatch blocks Save', async () => {
    const { dialog } = await open();
    fireEvent.click(dialog.getByLabelText('Tambah metode pembayaran'));
    expect(screen.queryByRole('option', { name: /Tunai/ })).toBeNull();
    expect(screen.queryByRole('option', { name: /QRIS BRI/ })).toBeNull();
    expect(await screen.findByRole('option', { name: /AKUN1/ })).toBeTruthy();
    fireEvent.click(await screen.findByRole('option', { name: /BCA/ }));
    type(dialog, 'BCA', '1000');
    // Three routes: nothing is redistributed, the excess is reported.
    expect(amount(dialog, 'Tunai').value).toBe('5.000');
    expect(amount(dialog, 'QRIS BRI').value).toBe('200.350');
    expect(dialog.getByText(/Alokasi melebihi total dibayar.*1\.000/)).toBeTruthy();
    reasonOk(dialog);
    expect(save(dialog).disabled).toBe(true);
    type(dialog, 'QRIS BRI', '199350');
    expect(save(dialog).disabled).toBe(false);
  });

  it('removes a route: the survivor receives the balancing amount', async () => {
    const { dialog } = await open();
    fireEvent.click(dialog.getByRole('button', { name: 'Hapus metode pembayaran Tunai' }));
    expect(dialog.queryByLabelText('Tunai')).toBeNull();
    expect(amount(dialog, 'QRIS BRI').value).toBe('205.350');
    expect(dialog.getByRole('region', { name: 'Perubahan' }).textContent).toMatch(
      /Tunai.*−\s?Rp\s?5\.000/,
    );
  });

  it('sends the same Runtime command Operational sends for the same current and target', async () => {
    const { dialog, correctPayments } = await open();
    type(dialog, 'Tunai', '10000');
    reasonOk(dialog);
    fireEvent.click(save(dialog));
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
        { paymentRouteId: 'route-cash', delta: '5000' },
        { paymentRouteId: 'route-qris', delta: '-5000' },
      ],
    });
    expect(key).toMatch(/^backoffice-payment-correction-/);
  });
});
