import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import type * as BusinessRuntime from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import { testExpense } from '../model/expense-test-fixtures';
import { ExpenseDetailDialog } from './expense-detail-dialog';
import { ExpenseDialog } from './expense-dialog';
import { ExpensesPage } from './expenses-page';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
const rows = vi.hoisted(() => ({ items: [] as unknown[], total: undefined as number | undefined }));
const references = vi.hoisted(() => ({
  locations: [
    { id: 'location-1', code: 'PUSAT', name: 'Toko Pusat', status: 'ACTIVE', version: 1 },
    { id: 'location-2', code: 'LAMA', name: 'Toko Lama', status: 'INACTIVE', version: 1 },
  ],
  accounts: [
    { id: 'bca-account', code: 'BCA_MAIN', name: 'BCA', type: 'BANK', status: 'ACTIVE' },
    { id: 'cash-account', code: 'CASH_MAIN', name: 'CASH', type: 'CASH', status: 'ACTIVE' },
  ],
}));
const client = vi.hoisted(() => ({
  get: vi.fn(async (path: string) => {
    const page = (items: unknown[], total = items.length) => ({
      items,
      limit: 20,
      offset: 0,
      total,
    });
    if (path.startsWith('/api/v1/locations')) return page(references.locations);
    if (path.startsWith('/api/v1/financial-accounts')) return page(references.accounts);
    return page(rows.items, rows.total ?? rows.items.length);
  }),
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

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={queryClient}>
          <DToastProvider>{ui}</DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

const textMatch = (expected: string) => (content: string, node: Element | null) =>
  node?.textContent === expected;

afterEach(() => {
  cleanup();
  client.get.mockClear();
  rows.total = undefined;
});

describe('ExpensesPage', () => {
  it('presents category codes and source accounts as business-readable values', async () => {
    auth.permissions = ['backoffice:access', 'expenses:read'];
    rows.items = [
      testExpense({ id: 'e1', categoryCode: 'OPERATIONS' }),
      testExpense({ id: 'e2', categoryCode: 'TRANSPORT' }),
      testExpense({
        id: 'e3',
        categoryCode: 'SUPPLIES',
        financialAccountName: 'CASH',
        financialAccountType: 'CASH',
      }),
      testExpense({ id: 'e4', categoryCode: 'OTHER', note: null }),
    ];
    renderWithProviders(<ExpensesPage />);

    expect((await screen.findAllByText('Transportasi')).length).toBeGreaterThan(0);
    for (const label of ['Operasional', 'Perlengkapan', 'Lainnya'])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    for (const code of ['OPERATIONS', 'TRANSPORT', 'SUPPLIES', 'OTHER'])
      expect(screen.queryAllByText(code)).toHaveLength(0);

    // Account names stay as configured; the type is the quiet secondary line.
    expect(screen.getAllByText('BCA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rekening bank').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CASH').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Akun kas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(client.get).toHaveBeenCalledWith('/api/v1/expenses?limit=20&offset=0');
  });

  it('shows Record expense only with the create permission', async () => {
    rows.items = [testExpense()];
    auth.permissions = ['backoffice:access', 'expenses:read'];
    renderWithProviders(<ExpensesPage />);
    expect((await screen.findAllByText('BCA')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Catat pengeluaran' })).toBeNull();
    cleanup();

    auth.permissions = ['backoffice:access', 'expenses:read', 'expenses:create'];
    renderWithProviders(<ExpensesPage />);
    expect(await screen.findByRole('button', { name: 'Catat pengeluaran' })).toBeTruthy();
  });

  it('resets to the first page when the search changes', async () => {
    auth.permissions = ['backoffice:access', 'expenses:read'];
    rows.items = [testExpense()];
    renderWithProviders(<ExpensesPage />);
    fireEvent.change(
      (await screen.findAllByPlaceholderText('Cari deskripsi, akun, atau lokasi...'))[0]!,
      {
        target: { value: ' bensin ' },
      },
    );
    await waitFor(() =>
      expect(client.get).toHaveBeenCalledWith('/api/v1/expenses?q=bensin&limit=20&offset=0'),
    );
  });
});

describe('ExpensesPage filters', () => {
  const expenseRequests = () =>
    client.get.mock.calls
      .map(([path]) => path)
      .filter((path) => path.startsWith('/api/v1/expenses'));
  const lastExpenseRequest = () => expenseRequests().at(-1);
  const choose = async (filter: string, option: string) => {
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(filter) })[0]!);
    fireEvent.click(await screen.findByRole('option', { name: option }));
  };
  const renderPage = async (loadedText = 'BCA') => {
    auth.permissions = ['backoffice:access', 'expenses:read'];
    renderWithProviders(<ExpensesPage />);
    expect((await screen.findAllByText(loadedText)).length).toBeGreaterThan(0);
  };

  it('offers exactly one search field and the four list filters', async () => {
    rows.items = [testExpense()];
    await renderPage();
    // The table may render its search per layout; every text input is that one search field.
    const search = screen.getAllByPlaceholderText('Cari deskripsi, akun, atau lokasi...');
    expect(screen.getAllByRole('textbox')).toEqual(search);
    for (const filter of ['Status', 'Lokasi penjualan', 'Kategori', 'Sumber dana'])
      expect(screen.getAllByRole('button', { name: new RegExp(filter) }).length).toBeGreaterThan(0);
    for (const deferred of ['Asal', 'Diajukan oleh'])
      expect(screen.queryByRole('button', { name: new RegExp(deferred) })).toBeNull();
  });

  it('sends canonical ids and code while showing localized labels, resetting to page 1', async () => {
    rows.items = [testExpense()];
    rows.total = 45;
    await renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Halaman 2' })[0]!);
    await waitFor(() => expect(lastExpenseRequest()).toBe('/api/v1/expenses?limit=20&offset=20'));

    await choose('Kategori', 'Transportasi');
    await waitFor(() =>
      expect(lastExpenseRequest()).toBe(
        '/api/v1/expenses?categoryCode=TRANSPORT&limit=20&offset=0',
      ),
    );
    await choose('Lokasi penjualan', 'Toko Pusat');
    await choose('Sumber dana', 'BCA');
    await choose('Status', 'Menunggu');
    await waitFor(() =>
      expect(lastExpenseRequest()).toBe(
        '/api/v1/expenses?status=PENDING&sellingLocationId=location-1&categoryCode=TRANSPORT&financialAccountId=bca-account&limit=20&offset=0',
      ),
    );
  });

  it('clears one filter while keeping the others', async () => {
    rows.items = [testExpense()];
    await renderPage();
    await choose('Lokasi penjualan', 'Toko Pusat');
    await choose('Kategori', 'Transportasi');
    await waitFor(() => expect(lastExpenseRequest()).toContain('categoryCode=TRANSPORT'));

    const categoryFilter = screen
      .getAllByRole('button', { name: /Kategori/ })[0]!
      .closest('[data-ds-component]') as HTMLElement | null;
    const clear = within(categoryFilter ?? document.body).getAllByRole('button', {
      name: 'Hapus filter',
    });
    fireEvent.click(clear.at(-1)!);
    await waitFor(() =>
      expect(lastExpenseRequest()).toBe(
        '/api/v1/expenses?sellingLocationId=location-1&limit=20&offset=0',
      ),
    );
  });

  it('keeps inactive and historical references readable', async () => {
    rows.items = [
      testExpense({ financialAccountId: 'old-account', financialAccountName: 'BNI Lama' }),
    ];
    await renderPage('BNI Lama');
    fireEvent.click(screen.getAllByRole('button', { name: /Lokasi penjualan/ })[0]!);
    expect(await screen.findByRole('option', { name: 'Toko Lama (Nonaktif)' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Sumber dana/ })[0]!);
    expect(await screen.findByRole('option', { name: 'BNI Lama' })).toBeTruthy();
  });

  it('renders rows exactly as Runtime returns them, without client-side filtering', async () => {
    rows.items = [testExpense({ id: 'e1', categoryCode: 'OTHER' }), testExpense({ id: 'e2' })];
    await renderPage();
    await choose('Kategori', 'Transportasi');
    await waitFor(() => expect(lastExpenseRequest()).toContain('categoryCode=TRANSPORT'));
    expect(screen.getAllByText('Lainnya').length).toBeGreaterThan(0);
  });
});

describe('ExpenseDetailDialog', () => {
  it('keeps readable actor names and the decision audit', () => {
    renderWithProviders(
      <ExpenseDetailDialog
        expense={testExpense({
          status: 'REJECTED',
          origin: 'OPERATIONAL',
          rejectedAt: '2026-10-01T05:00:00.000Z',
          rejectedByActorId: 'user-2',
          rejectedBy: { id: 'user-2', kind: 'user', displayName: 'Budi' },
          rejectionNote: 'Bukti belum lengkap',
        })}
        onClose={() => undefined}
      />,
    );
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getAllByText('Transportasi').length).toBeGreaterThan(0);
    expect(dialog.getByText('Rina')).toBeTruthy();
    expect(dialog.getByText('Budi')).toBeTruthy();
    expect(dialog.getByText('Bukti belum lengkap')).toBeTruthy();
    expect(dialog.getAllByText('Operasional').length).toBeGreaterThan(0);
    expect(dialog.queryByText('user-1')).toBeNull();
    expect(dialog.queryByText('OPERATIONAL')).toBeNull();
  });
});

describe('ExpenseDialog', () => {
  function fakeApi() {
    return {
      create: vi.fn(async () => testExpense()),
      update: vi.fn(async () => testExpense()),
      listLocations: vi.fn(async () => ({
        items: [
          {
            id: 'location-1',
            code: 'PUSAT',
            name: 'Toko Pusat',
            status: 'ACTIVE' as const,
            version: 1,
          },
        ],
        limit: 100,
        offset: 0,
      })),
      listSourceAccounts: vi.fn(async () => ({ items: [], limit: 100, offset: 0 })),
    };
  }

  it('groups the editor into expense sections and saves the unchanged codes', async () => {
    const api = fakeApi();
    const expense = testExpense();
    renderWithProviders(
      <ExpenseDialog
        expense={expense}
        api={api}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('region', { name: 'Konteks pengeluaran' })).toBeTruthy();
    expect(dialog.getByRole('region', { name: 'Sumber pembayaran' })).toBeTruthy();
    expect(dialog.getAllByText(textMatch('Ubah pengeluaran')).length).toBeGreaterThan(0);

    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(expense, {
        sellingLocationId: 'location-1',
        financialAccountId: 'bca-account',
        categoryCode: 'TRANSPORT',
        amount: '150000',
        note: 'Bensin pengiriman',
        occurredAt: '2026-10-01T02:00:00.000Z',
      }),
    );
  });

  it('keeps Save disabled until the required fields are chosen', () => {
    renderWithProviders(
      <ExpenseDialog
        expense={null}
        api={fakeApi()}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    const save = within(screen.getByRole('dialog')).getByRole('button', { name: 'Simpan' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });
});
