import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDetail: vi.fn(),
  getCatalog: vi.fn(),
  getAdditionalItemCandidates: vi.fn(),
  acceptInitialLines: vi.fn(),
}));

vi.mock('@digvation/business-api', () => ({ ApiClient: class {} }));
vi.mock('@digvation/business-auth', () => ({
  useAuth: () => ({ authPort: {}, session: { business: { currency: 'IDR' } } }),
}));
vi.mock('@digvation/business-runtime', () => ({
  useDeploymentBootstrap: () => ({ apiBaseUrl: 'http://runtime.test' }),
}));
vi.mock('../../../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({
    locale: 'id-ID',
    copy: (value: string) => value,
    label: (value: string) => value,
  }),
}));
vi.mock('../api/workshop-lines-api', () => ({
  WorkshopLinesApi: class {
    getDetail = mocks.getDetail;
    getCatalog = mocks.getCatalog;
    getAdditionalItemCandidates = mocks.getAdditionalItemCandidates;
    acceptInitialLines = mocks.acceptInitialLines;
  },
}));

import type { WorkshopWorkOrderDetail } from '../api/workshop-lines-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { WorkOrderItemsSection } from './work-order-items-section';

const UPDATE = ['work-order-items:update'];

const queueOrder = (overrides: Partial<WorkshopQueueWorkOrder> = {}): WorkshopQueueWorkOrder => ({
  id: 'wo-1',
  workOrderNumber: 'WO-1',
  workStatus: 'WAITING',
  sellingLocationId: 'loc-1',
  customerNameSnapshot: 'Budi',
  customerPhoneSnapshot: '+6281234567890',
  vehiclePlateSnapshot: 'B 1',
  vehicleChassisNumberSnapshot: 'CH',
  customerRequest: 'servis',
  cancellationReason: null,
  mechanic: null,
  version: 4,
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z',
  ...overrides,
});

const detail = (lines: WorkshopWorkOrderDetail['lines'], version = 4): WorkshopWorkOrderDetail => ({
  ...queueOrder({ version }),
  lines,
});

const ACCEPTED: WorkshopWorkOrderDetail['lines'] = [
  {
    id: 'l1',
    position: 0,
    catalogItemId: 'svc',
    catalogVariantId: null,
    itemCode: 'SB',
    itemName: 'Servis Besar (nama lama)',
    itemType: 'SERVICE',
    variantCode: null,
    variantName: null,
    quantity: '1.0000',
    currency: 'IDR',
    unitPrice: '120000.0000',
    lineAmount: '120000.0000',
    components: [
      {
        source: 'FIXED_BOM',
        componentItemId: 'c1',
        itemCode: 'F',
        itemName: 'Filter',
        componentVariantId: null,
        variantCode: null,
        variantName: null,
        quantity: '2.0000',
      },
    ],
  },
  {
    id: 'l2',
    position: 1,
    catalogItemId: 'ban',
    catalogVariantId: 'v90',
    itemCode: 'BAN',
    itemName: 'Ban Luar',
    itemType: 'PRODUCT',
    variantCode: 'B90',
    variantName: 'Ukuran 90',
    quantity: '2.0000',
    currency: 'IDR',
    unitPrice: '250000.0000',
    lineAmount: '500000.0000',
    components: [],
  },
];

function renderSection(
  props: {
    workOrder?: WorkshopQueueWorkOrder;
    permissions?: string[];
    onAccepted?: (order: WorkshopWorkOrderDetail) => void;
    onStale?: () => void;
  } = {},
) {
  const onAccepted = props.onAccepted ?? vi.fn();
  const onStale = props.onStale ?? vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <DToastProvider>
      <QueryClientProvider client={client}>
        <WorkOrderItemsSection
          workOrder={props.workOrder ?? queueOrder()}
          permissions={props.permissions ?? UPDATE}
          onAccepted={onAccepted}
          onStale={onStale}
        />
      </QueryClientProvider>
    </DToastProvider>,
  );
  return { onAccepted, onStale };
}

const CATALOG = {
  items: [
    {
      id: 'prt-oil',
      code: 'OLI',
      name: 'Oli Mesin 1L',
      type: 'PRODUCT',
      lifecycle: 'ACTIVE',
      resolvedPrice: { amount: '75000', currency: 'IDR' },
      variants: [],
    },
  ],
};

describe('WorkOrderItemsSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getCatalog.mockResolvedValue(CATALOG);
    mocks.getAdditionalItemCandidates.mockResolvedValue({ items: [] });
  });

  it('offers the initial selection when there are no items and the user may update them', async () => {
    mocks.getDetail.mockResolvedValue(detail([]));
    renderSection();
    expect(await screen.findByText('No items selected yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Select items/ })).toBeTruthy();
    // The catalog is not read until the picker is opened.
    expect(mocks.getCatalog).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'without work-order-items:update', props: { permissions: ['work-orders:read'] } },
    {
      name: 'once work has started',
      props: { workOrder: queueOrder({ workStatus: 'IN_PROGRESS' }) },
    },
  ])('does not offer a selection action $name', async ({ props }) => {
    mocks.getDetail.mockResolvedValue(detail([]));
    renderSection(props);
    await screen.findByText('No items selected yet.');
    expect(screen.queryByRole('button', { name: /Select items/ })).toBeNull();
  });

  it('renders accepted items strictly from the Runtime snapshot and offers no edit or remove control', async () => {
    mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
    renderSection();

    expect(await screen.findByText(/Servis Besar \(nama lama\)/)).toBeTruthy();
    expect(screen.getByText('Ban Luar')).toBeTruthy();
    expect(screen.getByText(/Ukuran 90/)).toBeTruthy();
    expect(screen.getByText(/2 x/)).toBeTruthy();
    expect(screen.getByText(/500\.000/)).toBeTruthy();
    expect(screen.getByText('Includes: Filter')).toBeTruthy();
    expect(screen.getByText('Service')).toBeTruthy();
    expect(screen.getByText('Spare part')).toBeTruthy();

    expect(screen.queryByRole('button', { name: /Select items|Remove|Edit|Replace|Ubah|Hapus/ })).toBeNull();
    // Snapshot rendering never asks Catalog for current names or prices.
    expect(mocks.getCatalog).not.toHaveBeenCalled();
  });

  it('selects, reviews and accepts the set, then shows what Runtime returned', async () => {
    mocks.getDetail.mockResolvedValue(detail([]));
    mocks.acceptInitialLines.mockResolvedValue(detail(ACCEPTED, 5));
    const { onAccepted } = renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Select items/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Oli Mesin 1L' }));
    fireEvent.change(screen.getByLabelText('Quantity Oli Mesin 1L'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));

    await waitFor(() =>
      expect(mocks.acceptInitialLines).toHaveBeenCalledWith('wo-1', 4, [
        { catalogItemId: 'prt-oil', quantity: '2' },
      ]),
    );
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(expect.objectContaining({ version: 5 })));
    expect(await screen.findByText('Ban Luar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Select items/ })).toBeNull();
  });

  it('reloads the Work Order when the open version is stale', async () => {
    mocks.getDetail.mockResolvedValue(detail([]));
    mocks.acceptInitialLines.mockRejectedValue({ status: 409, code: 'VERSION_CONFLICT' });
    const { onStale, onAccepted } = renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Select items/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Oli Mesin 1L' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));

    await waitFor(() => expect(onStale).toHaveBeenCalled());
    expect(onAccepted).not.toHaveBeenCalled();
    expect(await screen.findByText('This Work Order was just changed. Open it again.')).toBeTruthy();
  });

  it('keeps the picker open and explains a rejected item without exposing the raw code', async () => {
    mocks.getDetail.mockResolvedValue(detail([]));
    mocks.acceptInitialLines.mockRejectedValue({ status: 409, code: 'PRICE_NOT_FOUND' });
    const { onStale } = renderSection();

    fireEvent.click(await screen.findByRole('button', { name: /Select items/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Oli Mesin 1L' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));

    expect(
      await screen.findByText('One of the items has no price right now. Choose another item.'),
    ).toBeTruthy();
    expect(screen.queryByText('PRICE_NOT_FOUND')).toBeNull();
    expect(onStale).not.toHaveBeenCalled();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save items' })).toBeTruthy();
  });

  it('offers a retry when the accepted items cannot be loaded', async () => {
    mocks.getDetail.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(detail(ACCEPTED));
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Ban Luar')).toBeTruthy();
  });
});
