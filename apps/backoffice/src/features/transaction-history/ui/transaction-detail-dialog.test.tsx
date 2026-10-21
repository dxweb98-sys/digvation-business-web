import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Sale } from '../api/transaction-history-api';
import {
  SCENARIOS,
  testComponent,
  testLine,
  testPayment,
  testSale,
} from '../model/transaction-test-fixtures';
import { TransactionHistoryPage } from './transaction-history-page';
import { renderDetail, renderWithProviders, tableRow } from './transaction-history-test-harness';

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Transaction detail cards', () => {
  it('explains item and transaction discounts without double counting', async () => {
    renderDetail(SCENARIOS.promotion);
    const dialog = within(await screen.findByRole('dialog'));
    const billing = within(await dialog.findByRole('region', { name: 'Rincian tagihan' }));
    const breakdown = within(billing.getByRole('group', { name: 'Diskon yang diterapkan' }));
    expect(breakdown.getByText(/Promo Member Oktober/)).toBeTruthy();
    expect(breakdown.getByText('Promo · Hair Coloring')).toBeTruthy();
    expect(breakdown.getByText('Seluruh transaksi · 10%')).toBeTruthy();
    expect(breakdown.getByText('Alasan: Pelanggan lama')).toBeTruthy();
    expect(breakdown.getByText('OKTOBER25')).toBeTruthy();
    // The aggregate Discount row stays the single figure that reaches the total.
    expect(billing.getAllByText(/^−Rp\s74\.000$/)).toHaveLength(1);

    const items = within(dialog.getByRole('region', { name: 'Item transaksi' }));
    expect(items.getByText(/Promo Member Oktober/)).toBeTruthy();
    expect(items.queryByText(/Pelanggan lama/)).toBeNull();
    expect(items.getByText(/^Rp\s210\.000$/)).toBeTruthy();
    for (const raw of ['PROMOTION', 'MANUAL_DISCOUNT', 'TRANSACTION', 'adjustment-1'])
      expect(dialog.queryByText(new RegExp(raw))).toBeNull();
  });

  it('shows member points with exact formatting, and no card for non-members', async () => {
    renderDetail(SCENARIOS.memberRedeeming);
    let card = within(
      await within(await screen.findByRole('dialog')).findByRole('region', {
        name: 'Member & poin',
      }),
    );
    expect(card.getByText('500 poin')).toBeTruthy();
    expect(card.getByText(/^−Rp\s50\.000$/)).toBeTruthy();
    expect(card.getByText('20 poin')).toBeTruthy();
    expect(card.getByText('760 poin')).toBeTruthy();
    expect(card.queryByText(/\.0000/)).toBeNull();
    cleanup();

    renderDetail(SCENARIOS.memberEarning);
    card = within(
      await within(await screen.findByRole('dialog')).findByRole('region', {
        name: 'Member & poin',
      }),
    );
    expect(card.getByText('Tidak digunakan')).toBeTruthy();
    expect(card.getByText('1.240 poin')).toBeTruthy();
    cleanup();

    renderDetail(SCENARIOS.split);
    const plain = within(await screen.findByRole('dialog'));
    await plain.findByText('Creambath Ginseng');
    expect(plain.queryByRole('region', { name: 'Member & poin' })).toBeNull();
  });

  it('labels OPEN points as an estimate and marks reversed point history', async () => {
    renderDetail({
      ...SCENARIOS.draft,
      customer: { type: 'MEMBER', name: 'Andini' },
      lines: [testLine({ loyaltyEarning: { state: 'PREVIEW', pointsEarned: '1.5000' } })],
    });
    const open = within(await screen.findByRole('dialog'));
    expect(await open.findByText('Estimasi poin')).toBeTruthy();
    expect(open.getByText('1,5 poin')).toBeTruthy();
    expect(open.queryByText('Poin diperoleh')).toBeNull();
    cleanup();

    renderDetail({
      ...SCENARIOS.reversed,
      customer: { type: 'MEMBER', name: 'Andini' },
      loyaltyEarning: { state: 'FINALIZED', pointsEarned: '71.0000' },
    });
    const reversed = within(await screen.findByRole('dialog'));
    expect(
      await reversed.findByText(/poin yang diperoleh dan digunakan sudah dikompensasi/),
    ).toBeTruthy();
    expect(reversed.getByText('71 poin')).toBeTruthy();
  });

  it('uses English point copy in the English locale', async () => {
    window.localStorage.setItem('digvation.pos.backoffice.locale.v1', 'en');
    renderDetail(SCENARIOS.memberRedeeming);
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Membership & points')).toBeTruthy();
    expect(dialog.getByText('500 points')).toBeTruthy();
    expect(dialog.getByText('Balance after transaction')).toBeTruthy();
    expect(dialog.queryByText(/\bpoin\b/)).toBeNull();
  });
});

describe('Transaction detail actions', () => {
  it('disables Reverse with an explanation while money is held and the user may not return it', async () => {
    renderDetail(SCENARIOS.paid, { refund: false, reverse: true });
    const dialog = within(await screen.findByRole('dialog'));
    const reverse = await dialog.findByRole('button', { name: 'Batalkan transaksi' });
    expect((reverse as HTMLButtonElement).disabled).toBe(true);
    const hint = dialog.getByText(
      'Uang yang benar-benar diterima harus dikembalikan sebelum transaksi ini dapat dibatalkan. Pembayaran yang salah input belum dapat dihapus di sini.',
    );
    expect(reverse.getAttribute('aria-describedby')).toBe(hint.closest('p')!.id);
  });

  it('offers the refund of a remaining bank part and the one-step reversal of what is left', async () => {
    renderDetail(SCENARIOS.partiallyRefunded);
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByRole('button', { name: 'Pengembalian dana' })).toBeTruthy();
    expect(dialog.queryByText(/penyedia/i)).toBeNull();
    expect(dialog.queryByText(/Uang yang benar-benar diterima harus dikembalikan/)).toBeNull();
    expect(
      (dialog.getByRole('button', { name: 'Batalkan transaksi' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('reverses a paid sale in one confirmed step: payout route, confirmation and reason', async () => {
    const reverse = vi.fn(async () => SCENARIOS.paid);
    const paymentRoutes = vi.fn(async () => [
      {
        id: 'route-cash',
        paymentMethod: 'CASH' as const,
        currency: 'IDR',
        financialAccountName: 'Kas Laci',
      },
      {
        id: 'route-qris',
        paymentMethod: 'QRIS' as const,
        currency: 'IDR',
        financialAccountName: 'Akun QRIS',
      },
    ]);
    renderDetail(SCENARIOS.paid, undefined, { reverse, paymentRoutes });
    const parent = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    fireEvent.click(await within(parent).findByRole('button', { name: 'Batalkan transaksi' }));
    const child = within(await screen.findByRole('dialog', { name: 'Batalkan transaksi' }));
    expect(child.getByText('Uang diterima yang dikembalikan', { exact: false })).toBeTruthy();
    const submit = child.getByRole('button', {
      name: 'Kembalikan dana & batalkan',
    }) as HTMLButtonElement;
    fireEvent.change(child.getByLabelText('Alasan'), { target: { value: 'Transaksi salah' } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(child.getByLabelText('Dana dikembalikan melalui'));
    expect(screen.queryByRole('option', { name: /QRIS/ })).toBeNull();
    fireEvent.click(await screen.findByRole('option', { name: /Kas Laci/ }));
    // The money must really have been returned: no confirmation, no reversal.
    expect(submit.disabled).toBe(true);
    fireEvent.click(child.getByRole('checkbox', { name: /Uang sudah benar-benar dikembalikan/ }));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(reverse).toHaveBeenCalledTimes(1));
    expect(reverse).toHaveBeenCalledWith(
      SCENARIOS.paid.id,
      SCENARIOS.paid.version,
      'Transaksi salah',
      {
        method: 'CASH',
        paymentRouteId: 'route-cash',
      },
    );
  });

  it('reverses once fully refunded; nested dialogs keep the parent and Escape closes only the top', async () => {
    const reverse = vi.fn(async () => SCENARIOS.readyToReverse);
    renderDetail(SCENARIOS.readyToReverse, undefined, { reverse });
    const parent = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    const button = await within(parent).findByRole('button', { name: 'Batalkan transaksi' });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);
    await screen.findByRole('dialog', { name: 'Batalkan transaksi' });
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Batalkan transaksi' }).className).toMatch(
        /opacity-0/,
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Detail transaksi' }).className).toMatch(
      /opacity-100/,
    );

    fireEvent.click(within(parent).getByRole('button', { name: 'Batalkan transaksi' }));
    const child = within(await screen.findByRole('dialog', { name: 'Batalkan transaksi' }));
    fireEvent.change(child.getByRole('textbox'), { target: { value: 'Komplain pelanggan' } });
    const submit = child.getByRole('button', { name: 'Batalkan transaksi' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(reverse).toHaveBeenCalledTimes(1));
    expect(reverse).toHaveBeenCalledWith('sale-m', 3, 'Komplain pelanggan', undefined);
    // Nothing was held, so nothing is returned and no confirmation was asked.
    expect(child.queryByRole('checkbox')).toBeNull();
  });

  it('closing the refund dialog returns to the transaction detail', async () => {
    renderDetail(SCENARIOS.paid);
    const parent = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    fireEvent.click(await within(parent).findByRole('button', { name: 'Pengembalian dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    fireEvent.click(refund.getByRole('button', { name: 'Batal' }));
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Kembalikan pembayaran' }).className).toMatch(
        /opacity-0/,
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Detail transaksi' }).className).toMatch(
      /opacity-100/,
    );
  });

  it('sends the chosen payout route for a QRIS payment refunded by bank transfer', async () => {
    const refundPayment = vi.fn(async () => SCENARIOS.paid);
    const sale: Sale = {
      ...SCENARIOS.paid,
      totalAmount: '150000.0000',
      payments: [testPayment('qris-x', 'SUCCEEDED', '150000.0000', { method: 'QRIS' })],
    };
    const paymentRoutes = vi.fn(async () => [
      {
        id: 'route-bank-b',
        paymentMethod: 'BANK_TRANSFER' as const,
        currency: 'IDR',
        financialAccountName: 'Rekening B',
      },
      {
        id: 'route-qris-a',
        paymentMethod: 'QRIS' as const,
        currency: 'IDR',
        financialAccountName: 'Akun QRIS A',
      },
    ]);
    renderDetail(sale, undefined, { refundPayment, paymentRoutes });
    fireEvent.click(await screen.findByRole('button', { name: 'Pengembalian dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    const submit = refund.getByRole('button', { name: 'Pengembalian dana' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(refund.getByRole('textbox', { name: /Jumlah pengembalian/ }), {
      target: { value: '50.000' },
    });
    fireEvent.click(refund.getByLabelText('Dana dikembalikan melalui'));
    // A QRIS route can receive money but never pays it out, so it is not offered.
    expect(screen.queryByRole('option', { name: /QRIS/ })).toBeNull();
    fireEvent.click(await screen.findByRole('option', { name: /Rekening B/ }));
    expect(submit.disabled).toBe(true);
    fireEvent.change(refund.getByLabelText('Alasan pengembalian'), {
      target: { value: 'Pelanggan batal' },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(refundPayment).toHaveBeenCalledWith(
        'sale-d',
        'qris-x',
        3,
        '50000',
        'Pelanggan batal',
        {
          method: 'BANK_TRANSFER',
          paymentRouteId: 'route-bank-b',
        },
      ),
    );
  });

  it('shows why money was returned and the Sale reversed, by whom and when', async () => {
    const sale: Sale = {
      ...SCENARIOS.reversed,
      reversal: {
        reason: 'Transaksi salah input',
        reversedAt: '2026-10-01T08:00:00.000Z',
        reversedBy: 'Dewi Pemilik',
      },
      payments: [
        testPayment('cash-f', 'SUCCEEDED', '250000.0000', {
          financeFinancialAccountNameSnapshot: 'Kas Utama',
        }),
        testPayment('refund-f', 'SUCCEEDED', '-200000.0000', {
          kind: 'REFUND',
          financeFinancialAccountNameSnapshot: 'Rekening B',
          createdBy: 'Dewi Pemilik',
          terminalAt: '2026-10-01T07:00:00.000Z',
          refund: {
            id: 'refund-record',
            kind: 'MANUAL',
            reason: 'PAYMENT_REFUND',
            externalReference: null,
            note: 'Pelanggan komplain rasa',
            adjustmentId: null,
            allocations: [{ sourcePaymentId: 'cash-f', amount: '200000.0000' }],
          },
        }),
        // Recorded before explanations were required: still listed, without a reason.
        testPayment('refund-legacy', 'SUCCEEDED', '-50000.0000', {
          kind: 'REFUND',
          providerReference: 'REFUND:cash-f',
          refundOfPaymentId: 'cash-f',
          financeFinancialAccountNameSnapshot: 'Kas Utama',
        }),
      ],
    };
    renderDetail(sale);
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Pelanggan komplain rasa')).toBeTruthy();
    expect(dialog.getAllByText('Alasan pengembalian:')).toHaveLength(1);
    expect(dialog.getAllByText('Dikembalikan oleh:')).toHaveLength(2);
    expect(dialog.getAllByText('Dewi Pemilik').length).toBeGreaterThanOrEqual(2);
    expect(dialog.getByText('Transaksi salah input')).toBeTruthy();
    expect(dialog.getByText('Pembatalan transaksi')).toBeTruthy();
    expect(dialog.getByText('Dibatalkan oleh')).toBeTruthy();
    // Cancellation and returned money are separate facts: the panel states the refund outcome.
    expect(dialog.getByText('Dana ke pelanggan')).toBeTruthy();
    expect(dialog.getAllByText('Dana dikembalikan penuh').length).toBeGreaterThan(0);
    expect(dialog.queryByText(/direversal/i)).toBeNull();
  });

  it('sends the canonical refund amount, never the displayed grouping', async () => {
    const refundPayment = vi.fn(async () => SCENARIOS.paid);
    const sale: Sale = {
      ...SCENARIOS.paid,
      totalAmount: '535464.0000',
      payments: [testPayment('cash-x', 'SUCCEEDED', '535464.0000')],
    };
    renderDetail(sale, undefined, { refundPayment });
    fireEvent.click(await screen.findByRole('button', { name: 'Pengembalian dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    const amount = refund.getByRole('textbox', { name: /Jumlah pengembalian/ }) as HTMLInputElement;
    expect(amount.value).toBe('535.464');
    fireEvent.change(amount, { target: { value: '535.464' } });
    fireEvent.click(refund.getByLabelText('Dana dikembalikan melalui'));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Jalur tunai yang sama dengan pembayaran' }),
    );
    fireEvent.change(refund.getByLabelText('Alasan pengembalian'), {
      target: { value: 'Pelanggan batal' },
    });
    fireEvent.click(refund.getByRole('button', { name: 'Pengembalian dana' }));
    await waitFor(() =>
      expect(refundPayment).toHaveBeenCalledWith(
        'sale-d',
        'cash-x',
        3,
        '535464',
        'Pelanggan batal',
        undefined,
      ),
    );
  });

  it('shows a localized message for a known Runtime refusal instead of its raw text', async () => {
    const refundPayment = vi.fn(async () => {
      throw Object.assign(new Error('Refund exceeds the uncompensated source Payment amount'), {
        status: 400,
        code: 'PAYMENT_REFUND_EXCEEDS_SOURCE',
      });
    });
    renderDetail(SCENARIOS.paid, undefined, { refundPayment });
    fireEvent.click(await screen.findByRole('button', { name: 'Pengembalian dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    fireEvent.click(refund.getByLabelText('Dana dikembalikan melalui'));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Jalur tunai yang sama dengan pembayaran' }),
    );
    fireEvent.change(refund.getByLabelText('Alasan pengembalian'), {
      target: { value: 'Pelanggan batal' },
    });
    fireEvent.click(refund.getByRole('button', { name: 'Pengembalian dana' }));
    expect(
      await refund.findByText('Jumlah melebihi sisa yang dapat dikembalikan dari pembayaran ini.'),
    ).toBeTruthy();
    expect(refund.queryByText(/uncompensated/)).toBeNull();
  });
});

describe('Transaction detail stability', () => {
  it('opens each transaction with its own content and keeps it while closing', async () => {
    auth.permissions = ['backoffice:access', 'sales:read', 'sales:read-completed'];
    const sales = [SCENARIOS.paid, SCENARIOS.split];
    client.get.mockImplementation(async (path: string) => {
      const id = /\/api\/v1\/sales\/([^/?]+)$/.exec(path)?.[1];
      if (id) return sales.find((sale) => sale.id === id);
      return { items: sales, limit: 20, offset: 0, total: sales.length };
    });
    renderWithProviders(<TransactionHistoryPage />);
    const view = async (saleNumber: string) => {
      const trigger = tableRow(saleNumber).querySelector(
        '[data-ds-component="dropdown-trigger"] > *',
      )!;
      fireEvent.click(trigger);
      fireEvent.click((await screen.findAllByText('Lihat transaksi')).at(-1)!);
    };

    await screen.findAllByText('TRX-20261001-000004');
    await view('TRX-20261001-000004');
    const first = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    // The list row renders at once: no loading placeholder before the detail arrives.
    expect(within(first).getAllByText('TRX-20261001-000004').length).toBeGreaterThan(0);
    expect(within(first).queryByRole('status')).toBeNull();

    fireEvent.click(within(first).getByRole('button', { name: 'Tutup' }));
    // During the exit transition the same transaction stays rendered.
    expect(first.className).toMatch(/opacity-0/);
    expect(within(first).getAllByText('TRX-20261001-000004').length).toBeGreaterThan(0);
    expect(within(first).queryByRole('status')).toBeNull();

    await view('TRX-20261001-000005');
    const second = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    expect(within(second).getAllByText('TRX-20261001-000005').length).toBeGreaterThan(0);
    expect(within(second).queryByText('TRX-20261001-000004')).toBeNull();
  });
});

describe('Composed Service price presentation', () => {
  const composedSale = (line: Parameters<typeof testLine>[0] = {}) =>
    testSale({
      lines: [
        testLine({
          itemNameSnapshot: 'Hair Color',
          variantNameSnapshot: 'Red',
          quantity: '1.0000',
          resolvedUnitPrice: '210000.0000',
          overrideAmount: null,
          effectiveUnitPrice: '210000.0000',
          grossAmount: '210000.0000',
          totalAmount: '210000.0000',
          compositionComponents: [
            testComponent({
              itemNameSnapshot: 'Red Coloring BRAND',
              extendedContribution: '10000.0000',
            }),
          ],
          ...line,
        }),
      ],
    });
  const itemsOf = async (sale: Sale) => {
    renderDetail(sale);
    const dialog = within(await screen.findByRole('dialog'));
    return within(await dialog.findByRole('region', { name: 'Item transaksi' }));
  };

  it('reconciles the composed amount instead of adding the addition on top of it', async () => {
    const items = await itemsOf(composedSale());
    expect(items.getByText('Rincian harga')).toBeTruthy();
    expect(items.getByText('Harga layanan')).toBeTruthy();
    expect(items.getByText(/^Rp\s200\.000$/)).toBeTruthy();
    expect(items.getByText(/^\+Rp\s10\.000$/)).toBeTruthy();
    expect(items.getByText('Total item')).toBeTruthy();
    // The authoritative line amount and the breakdown total are the same Rp 210.000.
    expect(items.getAllByText(/^Rp\s210\.000$/)).toHaveLength(2);
    // The composed price is never presented as a per-item base price.
    expect(items.getByText(/^Jml 1$/)).toBeTruthy();
    expect(items.queryByText(/per item/)).toBeNull();
    expect(items.queryByText('Item tambahan')).toBeNull();
    // Addition performer attribution is unchanged.
    expect(items.getByText('Citra Ayu')).toBeTruthy();
  });

  it('shows an included addition as included, never as Rp 0', async () => {
    const items = await itemsOf(
      composedSale({
        compositionComponents: [
          testComponent({
            itemNameSnapshot: 'Red Coloring BRAND',
            extendedContribution: '10000.0000',
          }),
          testComponent({
            id: 'included',
            position: 1,
            itemNameSnapshot: 'Hair Mask',
            pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
            extendedContribution: '0.0000',
          }),
        ],
      }),
    );
    expect(items.getByText('Hair Mask')).toBeTruthy();
    expect(items.getByText('Termasuk')).toBeTruthy();
    expect(items.queryByText(/Rp\s0$/)).toBeNull();
  });

  it('keeps the existing presentation for a manual price override', async () => {
    const items = await itemsOf(
      composedSale({
        overrideAmount: '180000.0000',
        effectiveUnitPrice: '180000.0000',
        grossAmount: '180000.0000',
        totalAmount: '180000.0000',
      }),
    );
    expect(items.queryByText('Rincian harga')).toBeNull();
    expect(items.getByText(/Jml 1 × Rp\s180\.000 per item/)).toBeTruthy();
    expect(items.getByText('Item tambahan')).toBeTruthy();
  });
});
