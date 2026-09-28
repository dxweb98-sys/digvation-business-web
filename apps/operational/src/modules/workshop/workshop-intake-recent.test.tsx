import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const LOCATION = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  locationId: '' as string | null,
}));

vi.mock('@digvation/business-api', () => ({ ApiClient: class {} }));
vi.mock('@digvation/business-auth', () => ({
  useAuth: () => ({ authPort: {} }),
}));
vi.mock('@digvation/business-runtime', () => ({
  useDeploymentBootstrap: () => ({ apiBaseUrl: 'http://runtime.test' }),
}));
vi.mock('../operational/operational-session-provider', () => ({
  useOperationalSession: () => ({ selectedLocationId: mocks.locationId }),
}));
vi.mock('../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({
    copy: (value: string) => value,
    label: (status: string) => `label:${status}`,
    formatDate: () => '21:45',
  }),
}));
vi.mock('./workshop-queue-api', () => ({
  WorkshopQueueApi: class {
    list = mocks.list;
  },
}));

import { RECENT_WORK_ORDER_LIMIT, WorkshopRecentWorkOrders } from './workshop-intake-recent';

function workOrder(index: number, status: string) {
  return {
    id: `wo-${index}`,
    workOrderNumber: `WO-20260928-00000${index}`,
    workStatus: status,
    sellingLocationId: LOCATION,
    customerNameSnapshot: `Pelanggan ${index}`,
    vehiclePlateSnapshot: `B ${index}234 XYZ`,
    createdAt: new Date().toISOString(),
  };
}

function renderRecent() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkshopRecentWorkOrders onOpenQueue={() => undefined} />
    </QueryClientProvider>,
  );
}

describe('WorkshopRecentWorkOrders', () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.locationId = LOCATION;
  });

  it('reuses the queue list contract: newest page of the active location, small limit', async () => {
    mocks.list.mockResolvedValue({ items: [workOrder(1, 'WAITING')], total: 1 });

    renderRecent();

    await screen.findByText('WO-20260928-000001');
    expect(mocks.list).toHaveBeenCalledWith({
      limit: RECENT_WORK_ORDER_LIMIT,
      offset: 0,
      sellingLocationId: LOCATION,
    });
    expect(RECENT_WORK_ORDER_LIMIT).toBe(5);
  });

  it('shows the presented status label, never the raw enum value', async () => {
    mocks.list.mockResolvedValue({
      items: [workOrder(1, 'IN_PROGRESS'), workOrder(2, 'PAUSED')],
      total: 2,
    });

    renderRecent();

    expect(await screen.findByText('label:IN_PROGRESS')).toBeTruthy();
    expect(screen.getByText('label:PAUSED')).toBeTruthy();
    expect(screen.queryByText('IN_PROGRESS')).toBeNull();
  });

  it('does not read the queue until an active location exists', () => {
    mocks.locationId = null;

    renderRecent();

    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('shows a purposeful empty state for a branch with no Work Orders', async () => {
    mocks.list.mockResolvedValue({ items: [], total: 0 });

    renderRecent();

    expect(await screen.findByText('No Work Orders at this branch yet.')).toBeTruthy();
  });

  it('keeps a failure inside the section, with a retry', async () => {
    mocks.list.mockRejectedValue(new Error('down'));

    renderRecent();

    await waitFor(() =>
      expect(screen.getByText('Could not load recent Work Orders.')).toBeTruthy(),
    );
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
