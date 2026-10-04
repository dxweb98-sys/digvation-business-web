import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dataset, fakeGet, LOADED, renderReports } from './reporting-test-harness';

const entry = {
  entryType: 'EARN',
  commissionType: 'FIXED_PER_UNIT',
  saleNumber: 'TRX-20260929-000001',
  occurredAt: '2026-09-29T03:00:00.000Z',
  sellingLocation: 'Cabang utama',
  employeeCode: 'EMP-001',
  employeeName: 'Andi',
  productCode: 'SHP',
  productName: 'Shampoo Premium',
  variantName: null,
  quantity: '2.0000',
  commissionPerUnit: '5000.0000',
  commissionAmount: '10000.0000',
  currency: 'IDR',
  reversesEntryId: null,
};
const commission = dataset('product-commission', {
  summary: {
    entryCount: 2,
    earnedAmount: '10000.0000',
    reversedAmount: '-10000.0000',
    netCommission: '0.0000',
    earnedQuantity: '2.0000',
  },
  analytics: {
    trend: [],
    breakdown: [],
    breakdowns: {},
    ranking: [{ label: 'Andi', value: '0.0000' }],
  },
  items: [
    { ...entry, id: 'earn-1' },
    {
      ...entry,
      id: 'reversal-1',
      entryType: 'REVERSAL',
      quantity: '-2.0000',
      commissionAmount: '-10000.0000',
      reversesEntryId: 'earn-1',
    },
  ],
  total: 2,
});

const api = vi.hoisted(() => ({
  client: null as null | { get: (url: string) => Promise<unknown> },
}));
vi.mock('@digvation/business-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof BusinessRuntime>()),
  useRuntime: () => ({ apiBaseUrl: '' }),
}));
vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({
    createApiClient: () => api.client,
    getAccessToken: async () => 'token',
    session: {
      access: {
        permissions: ['commission:read'],
        products: ['POS'],
        capabilities: [],
        foundations: [],
      },
    },
  }),
  isSessionExpiredError: () => false,
}));

const rowsOf = (text: string) =>
  screen
    .getAllByText(text)
    .map((node) => node.closest('tr'))
    .filter((row): row is HTMLTableRowElement => Boolean(row));

afterEach(cleanup);

describe('Product commission report', () => {
  const open = () => {
    const fake = fakeGet({ 'product-commission': commission });
    api.client = { get: fake.get };
    renderReports('/?type=product-commission&dateFrom=2026-09-29&dateTo=2026-09-29');
    return fake;
  };

  it('shows earned, reversal, and net separately with a bounded server page', async () => {
    const fake = open();
    await screen.findAllByText('TRX-20260929-000001', undefined, LOADED);
    const [earned, reversal] = rowsOf('TRX-20260929-000001');
    expect(earned!.textContent).toMatch(/Rp\s?10\.000/);
    expect(within(earned!).getByText('Komisi diperoleh')).toBeTruthy();
    expect(reversal!.textContent).toMatch(/−\s?Rp\s?10\.000/);
    expect(within(reversal!).getByText('Pembatalan komisi')).toBeTruthy();
    expect(fake.requests.find((url) => url.includes('/reports/product-commission'))).toMatch(
      /dateFrom=2026-09-29.*page=1&pageSize=25/,
    );
  });

  it('offers the entry type filter and the transaction, employee, or product search', async () => {
    open();
    await screen.findAllByText('TRX-20260929-000001', undefined, LOADED);
    expect(screen.getAllByText('Jenis catatan').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Cari transaksi, karyawan, atau produk')).toBeTruthy();
  });

  it('opens the commission detail and identifies a reversal', async () => {
    open();
    await screen.findAllByText('TRX-20260929-000001', undefined, LOADED);
    const reversal = rowsOf('TRX-20260929-000001')[1]!;
    fireEvent.click(reversal.querySelector('[data-ds-component="dropdown-trigger"] > *')!);
    fireEvent.click((await screen.findAllByText('Lihat detail')).at(-1)!);
    const dialog = within(await screen.findByRole('dialog', { name: 'Detail komisi' }));
    expect(dialog.getByText(/membatalkan komisi yang diperoleh sebelumnya/)).toBeTruthy();
    expect(dialog.getAllByText('Andi').length).toBeGreaterThan(0);
    expect(dialog.getAllByText('Shampoo Premium').length).toBeGreaterThan(0);
    expect(dialog.getByText('Tetap per unit')).toBeTruthy();
    expect(dialog.queryByText('earn-1')).toBeNull();
  });
});
