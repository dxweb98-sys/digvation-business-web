import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LOCATION = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  searchCustomers: vi.fn(),
  listVehicles: vi.fn(),
  createCustomer: vi.fn(),
  createWorkOrder: vi.fn(),
  permissions: ['customers:manage'] as string[],
}));

vi.mock('@digvation/business-api', () => ({ ApiClient: class {} }));
vi.mock('@digvation/business-auth', () => ({
  useAuth: () => ({
    authPort: {},
    session: { access: { permissions: mocks.permissions } },
  }),
}));
vi.mock('@digvation/business-runtime', () => ({
  useDeploymentBootstrap: () => ({ apiBaseUrl: 'http://runtime.test' }),
}));
vi.mock('../operational/operational-session-provider', () => ({
  useOperationalSession: () => ({ selectedLocationId: LOCATION }),
}));
vi.mock('../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({ copy: (value: string) => value }),
}));
vi.mock('./workshop-intake-api', () => ({
  WorkshopIntakeApi: class {
    searchCustomers = mocks.searchCustomers;
    listVehicles = mocks.listVehicles;
    createCustomer = mocks.createCustomer;
    createWorkOrder = mocks.createWorkOrder;
  },
}));

import { WorkshopIntakeDialog } from './workshop-intake-form';

const budi = { id: 'c-1', name: 'Budi Santoso', phoneE164: '+6281234567890' };
const sari = { id: 'c-2', name: 'Sari Dewi', phoneE164: '+6281298765432' };
const vehicle = {
  id: 'v-1',
  customerId: 'c-1',
  plateNumber: 'B 1234 ABC',
  chassisNumber: 'CH-1',
  engineNumber: 'EN-1',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <DToastProvider>
      <QueryClientProvider client={client}>
        <WorkshopIntakeDialog open onClose={() => undefined} />
      </QueryClientProvider>
    </DToastProvider>,
  );
}

describe('WorkshopIntakeDialog', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.searchCustomers.mockReset();
    mocks.listVehicles.mockReset();
    mocks.createCustomer.mockReset();
    mocks.createWorkOrder.mockReset();
    mocks.permissions = ['customers:manage'];
  });

  it('shows no rows while the first search is pending, then the customers', async () => {
    const first = deferred<{ items: unknown[]; total: number }>();
    mocks.searchCustomers.mockReturnValue(first.promise);

    renderDialog();

    expect(screen.queryByText('Budi Santoso')).toBeNull();
    expect(screen.queryByText('No customers found. Try another search.')).toBeNull();

    first.resolve({ items: [budi, sari], total: 2 });
    expect(await screen.findByText('Budi Santoso')).toBeTruthy();
    expect(screen.getByText('0812 3456 7890')).toBeTruthy();
  });

  it('keeps the previous customers visible until the new search resolves', async () => {
    mocks.searchCustomers.mockResolvedValueOnce({ items: [budi, sari], total: 2 });
    renderDialog();
    await screen.findByText('Budi Santoso');

    const next = deferred<{ items: unknown[]; total: number }>();
    mocks.searchCustomers.mockReturnValueOnce(next.promise);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find customer' }), {
      target: { value: 'sari' },
    });

    await waitFor(() => expect(mocks.searchCustomers).toHaveBeenCalledWith('sari'));
    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    expect(screen.getByText('Sari Dewi')).toBeTruthy();

    next.resolve({ items: [sari], total: 1 });
    await waitFor(() => expect(screen.queryByText('Budi Santoso')).toBeNull());
    expect(screen.getByText('Sari Dewi')).toBeTruthy();
  });

  it('shows the empty state when nothing matches', async () => {
    mocks.searchCustomers.mockResolvedValue({ items: [], total: 0 });
    renderDialog();
    expect(await screen.findByText('No customers found. Try another search.')).toBeTruthy();
  });

  it('hides the New customer tab without customers:manage', async () => {
    mocks.permissions = [];
    mocks.searchCustomers.mockResolvedValue({ items: [budi], total: 1 });
    renderDialog();
    await screen.findByText('Budi Santoso');
    expect(screen.queryByRole('tab', { name: 'New customer' })).toBeNull();
    expect(screen.queryByText(/Customer not found/)).toBeNull();
  });

  it('accepts a local phone number and sends the normalized value', async () => {
    mocks.searchCustomers.mockResolvedValue({ items: [], total: 0 });
    mocks.createCustomer.mockResolvedValue(budi);
    mocks.listVehicles.mockResolvedValue({ items: [vehicle], total: 1 });
    renderDialog();
    await screen.findByText('No customers found. Try another search.');

    fireEvent.click(screen.getByRole('tab', { name: 'New customer' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Budi Santoso' } });
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '0812 3456 7890' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));

    await waitFor(() =>
      expect(mocks.createCustomer).toHaveBeenCalledWith({
        name: 'Budi Santoso',
        phone: '+6281234567890',
      }),
    );
    expect(await screen.findByText('Choose vehicle')).toBeTruthy();
  });

  it('keeps Save customer disabled for an invalid phone number', async () => {
    mocks.searchCustomers.mockResolvedValue({ items: [], total: 0 });
    renderDialog();
    await screen.findByText('No customers found. Try another search.');

    fireEvent.click(screen.getByRole('tab', { name: 'New customer' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Budi' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0812' } });

    expect((screen.getByRole('button', { name: 'Save customer' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('walks customer -> vehicle -> complaint and keeps selections when going back', async () => {
    mocks.searchCustomers.mockResolvedValue({ items: [budi, sari], total: 2 });
    mocks.listVehicles.mockResolvedValue({ items: [vehicle], total: 1 });
    renderDialog();

    fireEvent.click(await screen.findByRole('radio', { name: /Budi Santoso/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Vehicle/ }));

    await waitFor(() => expect(mocks.listVehicles).toHaveBeenCalledWith('c-1', ''));
    fireEvent.click(await screen.findByRole('radio', { name: /B 1234 ABC/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Complaint/ }));

    const complaint = await screen.findByLabelText('Keluhan');
    fireEvent.change(complaint, { target: { value: 'rem bunyi' } });
    expect(
      (screen.getByRole('button', { name: 'Create Work Order' }) as HTMLButtonElement).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const selected = await screen.findByRole('radio', { name: /B 1234 ABC/ });
    expect((selected as HTMLInputElement).checked).toBe(true);
  });
});
