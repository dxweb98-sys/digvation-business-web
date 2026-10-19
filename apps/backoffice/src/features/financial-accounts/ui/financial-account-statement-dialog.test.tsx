import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FinancialAccountStatement } from '../api/financial-accounts-api';
import { FinancialAccountStatementDialog } from './financial-account-statement-dialog';
import {
  fakeFinancialAccountsApi,
  renderWithProviders,
  testAccount,
  testMovement,
} from './financial-accounts-test-harness';

vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

const account = testAccount('CASH');

function statement(change: Partial<FinancialAccountStatement> = {}): FinancialAccountStatement {
  return {
    account,
    openingBalanceAvailable: false,
    openingRecordedNetMovement: '0.0000',
    totalIncoming: '205350.0000',
    totalOutgoing: '25000.0000',
    closingRecordedNetMovement: '180350.0000',
    items: [testMovement()],
    total: 1,
    limit: 25,
    offset: 0,
    ...change,
  };
}

function renderStatement(api = fakeFinancialAccountsApi({ accounts: [account] })) {
  const onClose = vi.fn();
  renderWithProviders(
    <FinancialAccountStatementDialog account={account} api={api} onClose={onClose} />,
  );
  return { api, onClose, dialog: within(screen.getByRole('dialog')) };
}

/** Matches an Indonesian Rupiah amount regardless of the non-breaking space after "Rp". */
const rupiah = (digits: string) => new RegExp(`^Rp\\s?${digits.replace(/\./g, '\\.')}$`);

describe('FinancialAccountStatementDialog', () => {
  it('shows account identity and a selected-period difference that is not a balance', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    // Cumulative closing movement includes earlier periods and must not be shown as the period net.
    api.getStatement.mockResolvedValue(
      statement({
        openingRecordedNetMovement: '819649.0000',
        closingRecordedNetMovement: '999999.0000',
      }),
    );
    const { dialog, onClose } = renderStatement(api);

    expect(dialog.getByRole('status', { name: 'Memuat ringkasan...' })).toBeTruthy();
    expect(dialog.queryByText('Selisih mutasi')).toBeNull();
    expect(dialog.getByText('Mutasi akun')).toBeTruthy();
    expect(dialog.getByText('Kas di lokasi')).toBeTruthy();
    expect(dialog.getByRole('heading', { name: 'Akun CASH' })).toBeTruthy();
    expect(dialog.getAllByText('CASH_MAIN').length).toBeGreaterThan(0);
    expect(dialog.getByText('IDR')).toBeTruthy();
    expect(dialog.getByText('Aktif')).toBeTruthy();
    expect(await dialog.findByText(rupiah('180.350'))).toBeTruthy();
    expect(dialog.queryByText(rupiah('999.999'))).toBeNull();
    expect(dialog.getAllByText(rupiah('205.350')).length).toBeGreaterThanOrEqual(2);
    expect(dialog.getByText(rupiah('25.000'))).toBeTruthy();
    expect(dialog.getByText('Selisih mutasi')).toBeTruthy();
    expect(
      dialog.getByText(
        'Dana masuk dikurangi dana keluar yang tercatat di sistem. Ini bukan saldo rekening saat ini.',
      ),
    ).toBeTruthy();
    expect(dialog.queryByText(/Pergerakan bersih tercatat|saldo awal|Saldo rekening/)).toBeNull();
    // Dedicated and white-label clients must not see a hardcoded product name.
    expect(screen.getByRole('dialog').textContent).not.toMatch(/Digvation/);

    fireEvent.click(dialog.getByRole('button', { name: 'Tutup' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('labels payment, refund, expense, and payment-correction reattribution movements', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    api.getStatement.mockResolvedValue(
      statement({
        total: 4,
        items: [
          testMovement({ id: 'm-1', source: 'PAYMENT', sourceId: 'payment-1' }),
          testMovement({ id: 'm-2', source: 'REFUND', direction: 'OUT', sourceId: 'refund-1' }),
          testMovement({ id: 'm-3', source: 'EXPENSE', direction: 'OUT', sourceId: 'expense-1' }),
          testMovement({
            id: 'm-4',
            source: 'PAYMENT_CORRECTION',
            nature: 'REATTRIBUTION',
            sourceId: 'correction-1',
          }),
        ],
      }),
    );
    const { dialog } = renderStatement(api);

    expect((await dialog.findAllByText('Pembayaran diterima')).length).toBeGreaterThan(0);
    expect(dialog.getAllByText('Pengembalian dana').length).toBeGreaterThan(0);
    expect(dialog.getAllByText('Pengeluaran').length).toBeGreaterThan(0);
    expect(dialog.getAllByText('Koreksi pembayaran').length).toBeGreaterThan(0);
    expect(
      dialog.getAllByText('Penyesuaian pencatatan akun pembayaran sebelumnya.').length,
    ).toBeGreaterThan(0);
    expect(dialog.queryByText(/Atribusi ulang|antarakun|pendapatan baru|REATTRIBUTION/)).toBeNull();
    expect(dialog.getAllByText('correction-1').length).toBeGreaterThan(0);
    expect(dialog.getAllByRole('table').length).toBeGreaterThan(0);
  });

  it('shows the empty state when the account has no recorded movements', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    api.getStatement.mockResolvedValue(
      statement({
        items: [],
        total: 0,
        totalIncoming: '0.0000',
        totalOutgoing: '0.0000',
        closingRecordedNetMovement: '0.0000',
      }),
    );
    const { dialog } = renderStatement(api);

    expect(
      (await dialog.findAllByText('Belum ada mutasi tercatat untuk akun ini.')).length,
    ).toBeGreaterThan(0);
  });

  it('shows a retryable error when movements cannot be loaded', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    api.getStatement.mockRejectedValueOnce(new Error('offline'));
    const { dialog } = renderStatement(api);

    expect(await dialog.findByText('Mutasi akun tidak dapat dimuat.')).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Coba Lagi' }));
    await waitFor(() => expect(api.getStatement).toHaveBeenCalledTimes(2));
  });

  it('pages movements through limit/offset and resets to page 1 on page-size change', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    api.getStatement.mockImplementation(async (_id, { limit, offset }) =>
      statement({ total: 45, limit, offset }),
    );
    const { dialog } = renderStatement(api);
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', { limit: 25, offset: 0 }),
    );

    fireEvent.click(await dialog.findByRole('button', { name: 'Halaman berikutnya' }));
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', { limit: 25, offset: 25 }),
    );

    fireEvent.click(dialog.getByRole('button', { name: '25' }));
    fireEvent.click((await screen.findAllByRole('button', { name: '50' })).at(-1)!);
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', { limit: 50, offset: 0 }),
    );
  });

  it('filters by activity and direction on the server, from page 1, with matching summary', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    api.getStatement.mockImplementation(async (_id, query) =>
      query.source === 'PAYMENT_CORRECTION'
        ? statement({
            ...query,
            total: 1,
            totalIncoming: '50000.0000',
            totalOutgoing: '20000.0000',
            items: [testMovement({ source: 'PAYMENT_CORRECTION', nature: 'REATTRIBUTION' })],
          })
        : statement({ ...query, total: 45 }),
    );
    const { dialog } = renderStatement(api);
    await dialog.findAllByText('payment-1');
    fireEvent.click(dialog.getByRole('button', { name: 'Halaman berikutnya' }));
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', { limit: 25, offset: 25 }),
    );

    await chooseFilter('Aktivitas', 'Koreksi pembayaran');
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', {
        source: 'PAYMENT_CORRECTION',
        limit: 25,
        offset: 0,
      }),
    );
    expect(await dialog.findByText(rupiah('30.000'))).toBeTruthy();

    await chooseFilter('Arah', 'Dana keluar');
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', {
        source: 'PAYMENT_CORRECTION',
        direction: 'OUT',
        limit: 25,
        offset: 0,
      }),
    );

    fireEvent.click(dialog.getByRole('button', { name: 'Atur ulang filter' }));
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', { limit: 25, offset: 0 }),
    );
    expect(dialog.queryByRole('button', { name: 'Atur ulang filter' })).toBeNull();
  });

  it('filters the period by whole business days and clears it', async () => {
    const api = fakeFinancialAccountsApi({ accounts: [account] });
    api.getStatement.mockImplementation(async (_id, query) => statement({ ...query }));
    const { dialog } = renderStatement(api);
    await waitFor(() => expect(api.getStatement).toHaveBeenCalled());

    fireEvent.click(dialog.getByText('Periode'));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Hari ini' })).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));
    // Without a session the business time zone falls back to UTC: today is one whole UTC day.
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', {
        from: new Date(today).toISOString(),
        to: new Date(today + 24 * 60 * 60 * 1000 - 1).toISOString(),
        limit: 25,
        offset: 0,
      }),
    );

    fireEvent.click(dialog.getByRole('button', { name: 'Atur ulang filter' }));
    await waitFor(() =>
      expect(api.getStatement).toHaveBeenLastCalledWith('cash-account', { limit: 25, offset: 0 }),
    );
  });
});

/** Opens the filter labelled `label` (not the same-named column header) and picks `option`. */
async function chooseFilter(label: string, option: string) {
  const trigger = screen
    .getAllByRole('button', { name: new RegExp(`^${label}`) })
    .find((button) => !button.closest('thead'));
  fireEvent.click(trigger!);
  fireEvent.click((await screen.findAllByRole('option', { name: option })).at(-1)!);
}
