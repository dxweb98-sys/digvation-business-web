import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LOCATION = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  permissions: [] as string[],
}));

vi.mock('@digvation/business-api', () => ({ ApiClient: class {} }));
vi.mock('@digvation/business-auth', () => ({
  useAuth: () => ({ authPort: {}, session: { access: { permissions: mocks.permissions } } }),
}));
vi.mock('@digvation/business-runtime', () => ({
  useDeploymentBootstrap: () => ({ apiBaseUrl: 'http://runtime.test' }),
}));
vi.mock('../../../operational/operational-session-provider', () => ({
  useOperationalSession: () => ({ selectedLocationId: LOCATION }),
}));
vi.mock('../../../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({
    copy: (value: string) => value,
    label: (status: string) => `label:${status}`,
    formatDate: () => '29 Sep 2026 02.23',
  }),
}));
vi.mock('../api/workshop-queue-api', () => ({
  WorkshopQueueApi: class {
    list = mocks.list;
  },
}));
vi.mock('./create/create-work-order-dialog', () => ({
  CreateWorkOrderDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="create-dialog" /> : null,
}));

import { WorkOrdersPage } from './work-orders-page';

const READ = ['workshop-queue:read'];
const CREATE = ['work-orders:create', 'customers:read'];

function workOrder(index: number) {
  return {
    id: `wo-${index}`,
    workOrderNumber: `WO-${index}`,
    workStatus: 'WAITING',
    sellingLocationId: LOCATION,
    customerNameSnapshot: `Pelanggan ${index}`,
    customerPhoneSnapshot: '+6281234567890',
    vehiclePlateSnapshot: 'B 1234 ABC',
    vehicleChassisNumberSnapshot: 'CH',
    customerRequest: `rem bunyi ${index}`,
    cancellationReason: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <DToastProvider>
      <QueryClientProvider client={client}>
        <WorkOrdersPage />
      </QueryClientProvider>
    </DToastProvider>,
  );
}

describe('WorkOrdersPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.list.mockReset();
    mocks.permissions = [...READ, ...CREATE];
    mocks.list.mockResolvedValue({ items: [workOrder(1)], total: 1 });
  });

  it('is one Work Order workspace with a single primary create action', async () => {
    renderPage();
    await screen.findAllByText('WO-1');

    expect(screen.getByRole('heading', { name: 'Work Order' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Create Work Order/ })).toHaveLength(1);
    expect(screen.queryByText(/Open queue/)).toBeNull();
    expect(screen.queryByText(/Intake|Penerimaan|Antrean/)).toBeNull();
  });

  it('lists the active location, first page, no status filter', async () => {
    renderPage();
    await screen.findAllByText('WO-1');
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0, sellingLocationId: LOCATION }),
    );
  });

  it('offers exactly the DIG-26 lifecycle statuses as one tab group', async () => {
    renderPage();
    await screen.findAllByText('WO-1');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'label:WAITING',
      'label:ASSIGNED',
      'label:IN_PROGRESS',
      'label:PAUSED',
      'label:DONE',
      'label:CANCELLED',
    ]);
  });

  it('uses the status filter as the queue view and returns to the first page', async () => {
    renderPage();
    await screen.findAllByText('WO-1');

    fireEvent.click(screen.getByRole('tab', { name: 'label:IN_PROGRESS' }));

    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'IN_PROGRESS', offset: 0 }),
      ),
    );
  });

  it('opens the Work Order detail from a row', async () => {
    renderPage();
    const [cell] = await screen.findAllByText('WO-1');
    fireEvent.click(cell!);

    const dialog = await screen.findByRole('dialog', { name: 'WO-1' });
    expect(within(dialog).getByText('rem bunyi 1')).toBeTruthy();
  });

  it('opens the create flow from the page action', async () => {
    renderPage();
    await screen.findAllByText('WO-1');
    fireEvent.click(screen.getByRole('button', { name: /Create Work Order/ }));
    expect(await screen.findByRole('dialog', { name: 'create-dialog' })).toBeTruthy();
  });

  it('lets a read-only user browse without a create action', async () => {
    mocks.permissions = READ;
    renderPage();
    await screen.findAllByText('WO-1');
    expect(screen.queryByRole('button', { name: /Create Work Order/ })).toBeNull();
  });

  it('lets a create-only user start a Work Order without the list', () => {
    mocks.permissions = CREATE;
    renderPage();
    expect(screen.getByRole('button', { name: /Create Work Order/ })).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
