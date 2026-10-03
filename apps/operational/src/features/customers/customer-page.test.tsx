import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OperationalMembersApi } from '../../modules/membership/operational-members-api';
import { canReadCustomerMembership, canReadOperationalCustomers } from './customer-access';
import { CustomerDetailDialog, OperationalCustomersView } from './customer-page';
import type { Customer, OperationalCustomersApi } from './customer-api';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;
const customer: Customer = {
  id: 'c1',
  name: 'Dicky',
  phoneE164: '+628123456789',
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};
afterEach(cleanup);
function setup(membership = false, edit = false) {
  const api = {
    list: vi.fn().mockResolvedValue({ items: [customer], total: 1 }),
    detail: vi.fn().mockResolvedValue({
      customer,
      recentTransactions: [
        {
          saleId: 's1',
          saleNumber: 'SALE-001',
          currency: 'IDR',
          totalAmount: '10000',
          finalizedAt: '2026-10-01T00:00:00Z',
          pointsEarned: null,
          pointsRedeemed: null,
        },
      ],
      transactionTotal: 12,
    }),
    update: vi.fn().mockResolvedValue(customer),
  };
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DToastProvider>
          <OperationalCustomersView
            api={api as unknown as OperationalCustomersApi}
            memberApi={{} as OperationalMembersApi}
            canEdit={edit}
            canReadMembership={membership}
          />
        </DToastProvider>
      </QueryClientProvider>
    </DeploymentBootstrapProvider>,
  );
  return api;
}
describe('Operational canonical Customers', () => {
  it('does not reuse another authenticated context Customer detail cache', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['operational-customers', 'previous-context', 'detail', customer.id], {
      customer: { ...customer, name: 'Previous actor customer' },
      recentTransactions: [],
      transactionTotal: 0,
    });
    const api = {
      detail: vi.fn().mockResolvedValue({ customer, recentTransactions: [], transactionTotal: 0 }),
    };
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <QueryClientProvider client={client}>
          <DToastProvider>
            <CustomerDetailDialog
              api={api as unknown as OperationalCustomersApi}
              cacheScope="current-context"
              customerId={customer.id}
              canEdit={false}
              onClose={() => undefined}
            />
          </DToastProvider>
        </QueryClientProvider>
      </DeploymentBootstrapProvider>,
    );
    expect(screen.queryByText('Previous actor customer')).toBeNull();
    expect(await screen.findByText('Dicky')).toBeTruthy();
    expect(api.detail).toHaveBeenCalledWith(customer.id, expect.anything());
  });
  it('requires Customer foundation/read independently of Membership', () => {
    expect(canReadOperationalCustomers(['customers:read'], ['CUSTOMER_IDENTITY'])).toBe(true);
    expect(canReadOperationalCustomers(['membership:read'], ['CUSTOMER_IDENTITY'])).toBe(false);
    expect(canReadOperationalCustomers(['customers:read'], [])).toBe(false);
    expect(canReadCustomerMembership(['customers:read'], ['MEMBERSHIP'])).toBe(false);
    expect(canReadCustomerMembership(['membership:read'], [])).toBe(false);
    expect(canReadCustomerMembership(['membership:read'], ['MEMBERSHIP'])).toBe(true);
  });
  it('renders Customer-only identity and bounded transactions without Membership or Loyalty facts', async () => {
    const api = setup();
    fireEvent.click((await screen.findAllByText('Dicky'))[0]!);
    await screen.findByRole('dialog', { name: 'Detail pelanggan' });
    expect(await screen.findByText('SALE-001')).toBeTruthy();
    expect(screen.getByText('Menampilkan 1 / 12 transaksi terakhir')).toBeTruthy();
    expect(screen.queryByLabelText('Jenis pelanggan')).toBeNull();
    expect(screen.queryByText('Saldo poin')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ubah data' })).toBeNull();
    expect(api.detail).toHaveBeenCalledWith('c1', expect.anything());
  });
  it('debounces canonical search and exposes type filters only when authorized', async () => {
    const api = setup(true);
    await screen.findAllByText('Dicky');
    fireEvent.change(screen.getAllByPlaceholderText('Cari nama atau telepon')[0]!, {
      target: { value: '0812' },
    });
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith({ q: '0812', offset: 0 }, expect.anything()),
    );
    fireEvent.click(screen.getByLabelText('Jenis pelanggan'));
    fireEvent.click(await screen.findByRole('option', { name: 'Pelanggan Umum' }));
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(
        { q: '0812', type: 'REGULAR', offset: 0 },
        expect.anything(),
      ),
    );
  });
  it('edits the canonical profile with its current version through Customer API', async () => {
    const api = setup(false, true);
    fireEvent.click((await screen.findAllByText('Dicky'))[0]!);
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah data' }));
    expect((screen.getByLabelText('Nomor telepon') as HTMLInputElement).value).toBe('08123456789');
    fireEvent.change(screen.getByLabelText('Nomor telepon'), {
      target: { value: '+6281234567890' },
    });
    expect((screen.getByLabelText('Nomor telepon') as HTMLInputElement).value).toBe('081234567890');
    fireEvent.change(screen.getByLabelText('Nama'), { target: { value: 'Dicky Darmawan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(customer, {
        name: 'Dicky Darmawan',
        phone: '+6281234567890',
      }),
    );
  });
});
