import type * as BusinessRuntime from '@digvation/business-runtime';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FinancialAccountsPage } from './financial-accounts-page';
import { renderWithProviders } from './financial-accounts-test-harness';

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
const client = vi.hoisted(() => ({
  get: vi.fn(async (path: string) => ({
    items: path.startsWith('/api/v1/financial-accounts') ? [testAccountRow] : [],
    limit: 20,
    offset: 0,
    total: path.startsWith('/api/v1/financial-accounts') ? 1 : 0,
  })),
}));
const testAccountRow = vi.hoisted(() => ({
  id: 'qris-account',
  code: 'ACC-000003',
  name: 'QRIS Toko',
  type: 'QRIS',
  currency: 'IDR',
  institutionName: 'BCA',
  accountReference: 'ID1023456789',
  accountHolderName: null,
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
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

afterEach(cleanup);

describe('FinancialAccountsPage', () => {
  it('shows both tabs with every action for a finance manager', async () => {
    auth.permissions = [
      'backoffice:access',
      'financial-accounts:read',
      'financial-accounts:create',
      'financial-accounts:update',
      'payment-routing:read',
      'payment-routing:update',
    ];
    renderWithProviders(<FinancialAccountsPage />);

    expect(screen.getByRole('heading', { name: 'Akun Keuangan' })).toBeTruthy();
    expect((await screen.findAllByText('QRIS Toko')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Tambah akun' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Perutean pembayaran' }));
    expect(await screen.findByRole('button', { name: 'Tambah rute' })).toBeTruthy();
    await waitFor(() =>
      expect(client.get).toHaveBeenCalledWith('/api/v1/payment-routing?limit=20&offset=0'),
    );
  });

  it('keeps create and route actions hidden for a read-only user', async () => {
    auth.permissions = ['backoffice:access', 'financial-accounts:read', 'payment-routing:read'];
    renderWithProviders(<FinancialAccountsPage />);

    expect((await screen.findAllByText('QRIS Toko')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Tambah akun' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Perutean pembayaran' }));
    await waitFor(() =>
      expect(client.get).toHaveBeenCalledWith('/api/v1/payment-routing?limit=20&offset=0'),
    );
    expect(screen.queryByRole('button', { name: 'Tambah rute' })).toBeNull();
  });
});
