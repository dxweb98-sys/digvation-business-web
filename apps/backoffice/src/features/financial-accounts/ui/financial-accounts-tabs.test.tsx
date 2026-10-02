import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FinancialAccountsApi } from '../api/financial-accounts-api';
import { FinancialAccountsTab } from './financial-accounts-tab';
import { PaymentRouteDialog } from './payment-route-dialog';
import { PaymentRoutingTab } from './payment-routing-tab';
import {
  fakeFinancialAccountsApi,
  renderWithProviders,
  testAccount,
  testRoute,
} from './financial-accounts-test-harness';

vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

const lastQuery = (mock: { mock: { calls: unknown[][] } }) => mock.mock.calls.at(-1)?.[0];

describe('FinancialAccountsTab', () => {
  function renderTab(
    api = fakeFinancialAccountsApi(),
    permissions = { canCreate: true, canUpdate: true },
  ) {
    renderWithProviders(
      <FinancialAccountsTab
        api={api as unknown as FinancialAccountsApi}
        {...permissions}
        onAccountsChanged={vi.fn()}
      />,
    );
    return api;
  }

  it('lists accounts by name with a quiet code, including QRIS and legacy null codes', async () => {
    renderTab(
      fakeFinancialAccountsApi({
        accounts: [
          testAccount('QRIS', { name: 'QRIS Toko', code: 'ACC-000002' }),
          testAccount('CASH', { name: 'Kas Lama', code: null }),
        ],
      }),
    );

    expect((await screen.findAllByText('QRIS Toko')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('ACC-000002').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Akun QRIS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BCA · ID1023456789').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kas Lama').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kas di lokasi').length).toBeGreaterThan(0);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('filters by QRIS account type and resets to the first page', async () => {
    const api = renderTab();
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalled());
    expect(lastQuery(api.listAccounts)).toEqual({ limit: 20, offset: 0 });

    fireEvent.click(screen.getByRole('button', { name: /Jenis akun/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Akun QRIS' }));

    await waitFor(() =>
      expect(lastQuery(api.listAccounts)).toEqual({ type: 'QRIS', limit: 20, offset: 0 }),
    );
  });

  it('searches by code or name', async () => {
    const api = renderTab();
    fireEvent.change((await screen.findAllByPlaceholderText('Cari kode atau nama akun...'))[0]!, {
      target: { value: ' ACC-0000 ' },
    });
    await waitFor(() =>
      expect(lastQuery(api.listAccounts)).toEqual({ q: 'ACC-0000', limit: 20, offset: 0 }),
    );
  });

  it('hides create when the user cannot create financial accounts', async () => {
    const api = renderTab(fakeFinancialAccountsApi(), { canCreate: false, canUpdate: false });
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Tambah akun' })).toBeNull();
  });

  it('opens the account editor from Tambah akun', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Tambah akun' }));
    expect(within(screen.getByRole('dialog')).getByText('Identitas akun')).toBeTruthy();
  });
});

describe('PaymentRoutingTab', () => {
  function renderTab(api = fakeFinancialAccountsApi(), canUpdate = true) {
    renderWithProviders(
      <PaymentRoutingTab
        api={api as unknown as FinancialAccountsApi}
        canUpdate={canUpdate}
        onRoutesChanged={vi.fn()}
      />,
    );
    return api;
  }

  it('lists routes with QRIS method and destination identity', async () => {
    renderTab(fakeFinancialAccountsApi({ routes: [testRoute()] }));

    expect((await screen.findAllByText('Toko Pusat')).length).toBeGreaterThan(0);
    for (const text of ['PUSAT', 'QRIS', 'QRIS_MAIN'])
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    // Code and destination type share one quiet secondary line, like Catalog's identity rows.
    expect(
      screen.getAllByText((content, node) => node?.textContent === 'QRIS_MAIN · Akun QRIS').length,
    ).toBeGreaterThan(0);
  });

  it('shows only the destination type when a legacy destination has no code', async () => {
    renderTab(
      fakeFinancialAccountsApi({
        routes: [
          testRoute({
            financialAccountName: 'Bank Lama',
            financialAccountCode: null,
            financialAccountType: 'BANK',
          }),
        ],
      }),
    );

    expect((await screen.findAllByText('Bank Lama')).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((content, node) => node?.textContent === 'Rekening bank').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/— · Rekening bank/)).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('filters routes by QRIS payment method on the first page', async () => {
    const api = renderTab();
    await waitFor(() => expect(api.listRoutes).toHaveBeenCalled());

    // The sortable column header is also named "Metode pembayaran"; the filter is the enabled one.
    const filter = screen
      .getAllByRole('button', { name: /Metode pembayaran/ })
      .find((button) => !button.hasAttribute('disabled'));
    fireEvent.click(filter!);
    fireEvent.click(await screen.findByRole('option', { name: 'QRIS' }));

    await waitFor(() =>
      expect(lastQuery(api.listRoutes)).toEqual({ paymentMethod: 'QRIS', limit: 20, offset: 0 }),
    );
  });

  it('hides add route without payment routing update permission', async () => {
    const api = renderTab(fakeFinancialAccountsApi(), false);
    await waitFor(() => expect(api.listRoutes).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Tambah rute' })).toBeNull();
  });
});

describe('PaymentRouteDialog', () => {
  const accounts = [
    testAccount('CASH', { name: 'Kas' }),
    testAccount('BANK', { name: 'Bank' }),
    testAccount('E_WALLET', { name: 'Dompet' }),
    testAccount('QRIS', { name: 'QRIS' }),
  ];

  function renderDialog(route = null as ReturnType<typeof testRoute> | null) {
    const api = fakeFinancialAccountsApi({ accounts });
    const handlers = { onClose: vi.fn(), onSaved: vi.fn() };
    renderWithProviders(<PaymentRouteDialog route={route} api={api} {...handlers} />);
    return { api, ...handlers, dialog: within(screen.getByRole('dialog')) };
  }

  async function chooseMethod(dialog: ReturnType<typeof within>, label: string) {
    fireEvent.click(dialog.getByRole('button', { name: /Metode pembayaran/ }));
    fireEvent.click(await screen.findByRole('option', { name: label }));
  }

  async function destinationStates(dialog: ReturnType<typeof within>) {
    fireEvent.click(dialog.getByRole('button', { name: /Akun keuangan/ }));
    const options = await screen.findAllByRole('option');
    const states = Object.fromEntries(
      options.map((option) => [
        option.textContent?.split(' · ')[0],
        option.getAttribute('aria-disabled') === 'true' || option.hasAttribute('disabled'),
      ]),
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    return states;
  }

  it('offers QRIS, bank, and e-wallet destinations for QRIS only', async () => {
    const { api, dialog } = renderDialog();
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalled());
    expect(dialog.getByText('Tambah rute')).toBeTruthy();

    await chooseMethod(dialog, 'QRIS');
    expect(await destinationStates(dialog)).toEqual({
      Kas: true,
      Bank: false,
      Dompet: false,
      QRIS: false,
    });
  });

  it.each([
    ['Transfer bank', { Kas: true, Bank: false, Dompet: true, QRIS: true }],
    ['Dompet digital', { Kas: true, Bank: true, Dompet: false, QRIS: true }],
    ['Tunai', { Kas: false, Bank: true, Dompet: true, QRIS: true }],
  ])('keeps QRIS accounts ineligible for %s', async (method, expected) => {
    const { api, dialog } = renderDialog();
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalled());
    if (method !== 'Tunai') await chooseMethod(dialog, method);
    expect(await destinationStates(dialog)).toEqual(expected);
  });

  it('creates a QRIS route to a QRIS account', async () => {
    const { api, dialog, onSaved } = renderDialog();
    await waitFor(() => expect(api.listLocations).toHaveBeenCalled());

    fireEvent.click(dialog.getByRole('button', { name: /Lokasi penjualan/ }));
    fireEvent.click(await screen.findByRole('option', { name: /Toko Pusat/ }));
    await chooseMethod(dialog, 'QRIS');
    fireEvent.click(dialog.getByRole('button', { name: /Akun keuangan/ }));
    fireEvent.click(await screen.findByRole('option', { name: /^QRIS ·/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.createRoute).toHaveBeenCalledWith({
        sellingLocationId: 'location-1',
        paymentMethod: 'QRIS',
        financialAccountId: 'qris-account',
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('edits destination and status of an existing route with location and method locked', async () => {
    const route = testRoute({ financialAccountId: 'bank-account', financialAccountType: 'BANK' });
    const { api, dialog } = renderDialog(route);
    await waitFor(() => expect(api.listAccounts).toHaveBeenCalled());

    expect(dialog.getByText('Ubah rute')).toBeTruthy();
    expect(dialog.getByLabelText('Lokasi penjualan').hasAttribute('disabled')).toBe(true);
    expect(dialog.getByRole('button', { name: /Metode pembayaran/ }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(dialog.getByRole('button', { name: /^Status/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Nonaktif' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(api.updateRoute).toHaveBeenCalledWith(route, {
        financialAccountId: 'bank-account',
        status: 'INACTIVE',
      }),
    );
  });
});
