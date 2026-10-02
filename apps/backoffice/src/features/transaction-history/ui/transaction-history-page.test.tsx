import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Sale } from '../api/transaction-history-api';
import { EMPLOYEE, SCENARIOS, testComponent, testLine } from '../model/transaction-test-fixtures';
import { TransactionHistoryPage } from './transaction-history-page';
import { renderDetail, renderWithProviders, tableRow } from './transaction-history-test-harness';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
const rows = vi.hoisted(() => ({ items: [] as unknown[] }));
const client = vi.hoisted(() => ({
  get: vi.fn(async () => ({ items: rows.items, limit: 20, offset: 0, total: rows.items.length })),
}));

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

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('TransactionHistoryPage list', () => {
  it('shows one transaction, payment, and work state per row', async () => {
    auth.permissions = ['backoffice:access', 'sales:read', 'sales:read-completed'];
    rows.items = [SCENARIOS.split, SCENARIOS.inProgress, SCENARIOS.productOnly];
    renderWithProviders(<TransactionHistoryPage />);

    expect((await screen.findAllByText('TRX-20261001-000005')).length).toBeGreaterThan(0);
    const row = tableRow('TRX-20261001-000005');
    // Two settling payments and two completed lines collapse to one badge each.
    expect(within(row).getAllByText('Lunas (pembayaran terpisah)')).toHaveLength(1);
    expect(within(row).getAllByText('Selesai')).toHaveLength(2); // transaction + work
    expect(within(row).queryByText('Berhasil')).toBeNull();

    const partial = tableRow('TRX-20261001-000003');
    expect(within(partial).getByText('Dibayar sebagian')).toBeTruthy();
    expect(within(partial).queryByText('Gagal')).toBeNull();
    expect(within(partial).getAllByText('Dikerjakan')).toHaveLength(1);

    const product = tableRow('TRX-20261001-000007');
    expect(within(product).getByText('Tanpa pengerjaan')).toBeTruthy();
  });
});

describe('TransactionDetailDialog', () => {
  it('presents billed items, quantities, performers, components, and the salesperson', async () => {
    const sale: Sale = {
      ...SCENARIOS.split,
      lines: [
        ...SCENARIOS.split.lines,
        testLine({
          id: 'line-color',
          quantity: '1.5000',
          compositionComponents: [testComponent()],
          fulfillment: null,
        }),
        {
          ...SCENARIOS.productOnly.lines[0]!,
          removedAt: null,
        },
        testLine({
          id: 'retired',
          itemNameSnapshot: 'Old Item',
          removedAt: '2026-10-01T04:00:00Z',
        }),
      ],
    };
    renderDetail(sale);
    const dialog = within(await screen.findByRole('dialog'));

    expect(await dialog.findByText('Creambath Ginseng')).toBeTruthy();
    expect(dialog.getAllByText('Long Hair').length).toBeGreaterThan(0);
    expect(dialog.getByText(/Jml 1,5/)).toBeTruthy();
    expect(dialog.queryByText(/1\.0000|1,5000|2\.0000/)).toBeNull();
    expect(dialog.getByText('Budi Santoso')).toBeTruthy();
    expect(dialog.getByText('Hair Color Red')).toBeTruthy();
    expect(dialog.getByText('Citra Ayu')).toBeTruthy();
    expect(dialog.getByText('Dewi Lestari')).toBeTruthy();
    expect(dialog.getByText(/Old Item/)).toBeTruthy();
    expect(dialog.getByText('Item yang dihapus atau dikoreksi')).toBeTruthy();
    expect(dialog.queryByText(UUID)).toBeNull();
    expect(dialog.queryByText(EMPLOYEE.citra)).toBeNull();
  });

  it('places refund and reversal in the footer, never in the body', async () => {
    renderDetail(SCENARIOS.paid);
    const dialog = await screen.findByRole('dialog');
    const refund = await within(dialog).findByRole('button', { name: 'Kembalikan dana' });
    const reverse = within(dialog).getByRole('button', { name: 'Reversal transaksi' });
    expect(within(dialog).getAllByRole('button', { name: 'Kembalikan dana' })).toHaveLength(1);
    const footer = refund.closest('div.flex')!.parentElement!;
    expect(footer.contains(reverse)).toBe(true);
    expect(within(footer).getByRole('button', { name: 'Tutup' })).toBeTruthy();
    expect(screen.queryByText('Transaction actions')).toBeNull();
  });

  it('hides actions without permission or on a reversed sale', async () => {
    renderDetail(SCENARIOS.paid, { refund: false, reverse: false });
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('Hair Coloring');
    expect(dialog.queryByRole('button', { name: 'Kembalikan dana' })).toBeNull();
    expect(dialog.queryByRole('button', { name: 'Reversal transaksi' })).toBeNull();
    cleanup();

    renderDetail(SCENARIOS.reversed);
    const reversed = within(await screen.findByRole('dialog'));
    await reversed.findByText('Customer complaint');
    expect(reversed.queryByRole('button', { name: 'Kembalikan dana' })).toBeNull();
    expect(reversed.queryByRole('button', { name: 'Reversal transaksi' })).toBeNull();
    expect(reversed.getByText('Pengembalian untuk CASH')).toBeTruthy();
  });

  it('refunds the single cash payment with its exact remaining amount', async () => {
    const refundPayment = vi.fn(async () => SCENARIOS.paid);
    renderDetail(SCENARIOS.paid, undefined, { refundPayment });
    fireEvent.click(await screen.findByRole('button', { name: 'Kembalikan dana' }));
    const refund = within(await screen.findByRole('dialog', { name: 'Kembalikan pembayaran' }));
    fireEvent.click(refund.getByRole('button', { name: 'Kembalikan dana' }));
    await waitFor(() =>
      expect(refundPayment).toHaveBeenCalledWith('sale-d', 'cash-d', 3, '250000'),
    );
  });

  it('uses intentional English copy in the English locale', async () => {
    window.localStorage.setItem('digvation.pos.backoffice.locale.v1', 'en');
    renderDetail(SCENARIOS.split);
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText('Transaction items')).toBeTruthy();
    expect(dialog.getAllByText('Paid (split)').length).toBeGreaterThan(0);
    expect(dialog.getAllByText(/Worked by/).length).toBeGreaterThan(0);
    expect(dialog.queryByText('Lunas (pembayaran terpisah)')).toBeNull();
  });

  it('shows no English feature copy in the Indonesian locale', async () => {
    renderDetail(SCENARIOS.split);
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('Item transaksi');
    for (const english of [
      'Split Payment',
      'Paid (split)',
      'Transaction items',
      'Worked by',
      'Payments',
      'Charges',
      'Total paid',
      'Succeeded',
      'FINALIZED',
      'COMPLETED',
    ])
      expect(
        dialog.queryByText(new RegExp(`\\b${english.replace(/[()]/g, '\\$&')}\\b`)),
      ).toBeNull();
  });
});
