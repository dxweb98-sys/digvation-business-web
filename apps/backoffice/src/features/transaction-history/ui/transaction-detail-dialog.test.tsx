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
  it('disables Reverse with an explanation while money is uncompensated', async () => {
    renderDetail(SCENARIOS.paid);
    const dialog = within(await screen.findByRole('dialog'));
    const reverse = await dialog.findByRole('button', { name: 'Reversal transaksi' });
    expect((reverse as HTMLButtonElement).disabled).toBe(true);
    const hint = dialog.getByText(
      'Kembalikan semua pembayaran yang berhasil sebelum mereversal transaksi ini.',
    );
    expect(reverse.getAttribute('aria-describedby')).toBe(hint.closest('p')!.id);
  });

  it('explains the provider limitation of a split payment with a bank part', async () => {
    renderDetail(SCENARIOS.partiallyRefunded);
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      await dialog.findByText(/Pembayaran non-tunai harus dikembalikan melalui penyedianya/),
    ).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Kembalikan dana' })).toBeNull();
    expect(
      (dialog.getByRole('button', { name: 'Reversal transaksi' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('reverses once fully refunded; nested dialogs keep the parent and Escape closes only the top', async () => {
    const reverse = vi.fn(async () => SCENARIOS.readyToReverse);
    renderDetail(SCENARIOS.readyToReverse, undefined, { reverse });
    const parent = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    const button = await within(parent).findByRole('button', { name: 'Reversal transaksi' });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);
    await screen.findByRole('dialog', { name: 'Reversal transaksi' });
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Reversal transaksi' }).className).toMatch(
        /opacity-0/,
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Detail transaksi' }).className).toMatch(
      /opacity-100/,
    );

    fireEvent.click(within(parent).getByRole('button', { name: 'Reversal transaksi' }));
    const child = within(await screen.findByRole('dialog', { name: 'Reversal transaksi' }));
    fireEvent.change(child.getByRole('textbox'), { target: { value: 'Komplain pelanggan' } });
    const submit = child.getByRole('button', { name: 'Reversal transaksi' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(reverse).toHaveBeenCalledTimes(1));
    expect(reverse).toHaveBeenCalledWith('sale-m', 3, 'Komplain pelanggan');
  });

  it('closing the refund dialog returns to the transaction detail', async () => {
    renderDetail(SCENARIOS.paid);
    const parent = await screen.findByRole('dialog', { name: 'Detail transaksi' });
    fireEvent.click(await within(parent).findByRole('button', { name: 'Kembalikan dana' }));
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

  it('sends the canonical refund amount, never the displayed grouping', async () => {
    const refundPayment = vi.fn(async () => SCENARIOS.paid);
    const sale: Sale = {
      ...SCENARIOS.paid,
      totalAmount: '535464.0000',
      payments: [testPayment('cash-x', 'SUCCEEDED', '535464.0000')],
    };
    renderDetail(sale, undefined, { refundPayment });
    fireEvent.click(await screen.findByRole('button', { name: 'Kembalikan dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    const amount = refund.getByRole('textbox') as HTMLInputElement;
    expect(amount.value).toBe('535.464');
    fireEvent.change(amount, { target: { value: '535.464' } });
    fireEvent.click(refund.getByRole('button', { name: 'Kembalikan dana' }));
    await waitFor(() =>
      expect(refundPayment).toHaveBeenCalledWith('sale-d', 'cash-x', 3, '535464'),
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
    fireEvent.click(await screen.findByRole('button', { name: 'Kembalikan dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    fireEvent.click(refund.getByRole('button', { name: 'Kembalikan dana' }));
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
