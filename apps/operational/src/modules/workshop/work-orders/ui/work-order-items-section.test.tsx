import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDetail: vi.fn(),
  getCatalog: vi.fn(),
  getAdditionalItemCandidates: vi.fn(),
  acceptInitialLines: vi.fn(),
  adjustLines: vi.fn(),
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
    formatDate: (value: Date) => value.toISOString(),
  }),
}));
vi.mock('../api/workshop-lines-api', () => ({
  WorkshopLinesApi: class {
    getDetail = mocks.getDetail;
    getCatalog = mocks.getCatalog;
    getAdditionalItemCandidates = mocks.getAdditionalItemCandidates;
    acceptInitialLines = mocks.acceptInitialLines;
    adjustLines = mocks.adjustLines;
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

const detail = (
  lines: WorkshopWorkOrderDetail['lines'],
  version = 4,
  adjustments: WorkshopWorkOrderDetail['adjustments'] = [],
): WorkshopWorkOrderDetail => ({
  ...queueOrder({ version }),
  lines,
  adjustments,
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
    expect(await screen.findByText('No work items yet')).toBeTruthy();
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
    await screen.findByText('No work items yet');
    expect(screen.queryByRole('button', { name: /Select items/ })).toBeNull();
  });

  it('renders accepted items strictly from the Runtime snapshot', async () => {
    mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
    renderSection();

    expect(await screen.findByText(/Servis Besar \(nama lama\)/)).toBeTruthy();
    expect(screen.getByText('Ban Luar')).toBeTruthy();
    expect(screen.getByText(/Ukuran 90/)).toBeTruthy();
    expect(screen.getByText(/2 ×/)).toBeTruthy();
    expect(screen.getByText(/500\.000/)).toBeTruthy();
    expect(screen.getByText('Includes: Filter')).toBeTruthy();
    expect(screen.getByText('Service')).toBeTruthy();
    expect(screen.getByText('Spare part')).toBeTruthy();
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
    await waitFor(() =>
      expect(onAccepted).toHaveBeenCalledWith(expect.objectContaining({ version: 5 })),
    );
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
    expect(
      await screen.findByText('This Work Order was just changed. Open it again.'),
    ).toBeTruthy();
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
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save items' }),
    ).toBeTruthy();
  });

  it('offers a retry when the accepted items cannot be loaded', async () => {
    mocks.getDetail.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(detail(ACCEPTED));
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Ban Luar')).toBeTruthy();
  });

  describe('adjusting accepted items', () => {
    const openOrder = (workStatus: WorkshopQueueWorkOrder['workStatus'] = 'IN_PROGRESS') =>
      queueOrder({ workStatus });

    it.each(['WAITING', 'ASSIGNED', 'IN_PROGRESS', 'PAUSED'] as const)(
      'offers add and change while %s for someone who may update items',
      async (workStatus) => {
        mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
        renderSection({ workOrder: openOrder(workStatus) });
        await screen.findByText('Ban Luar');
        expect(screen.getByRole('button', { name: 'Add item' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Change items' })).toBeTruthy();
      },
    );

    it.each([
      { name: 'DONE', props: { workOrder: queueOrder({ workStatus: 'DONE' }) } },
      { name: 'CANCELLED', props: { workOrder: queueOrder({ workStatus: 'CANCELLED' }) } },
      {
        name: 'a user without work-order-items:update',
        props: { permissions: ['work-orders:read'] },
      },
    ])('offers no item action for $name', async ({ props }) => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      renderSection(props);
      await screen.findByText('Ban Luar');
      expect(
        screen.queryByRole('button', { name: /Add item|Change items|Select items|Remove item/ }),
      ).toBeNull();
    });

    it('changes a quantity and sends one semantic adjustment with the open version', async () => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      mocks.adjustLines.mockResolvedValue(detail(ACCEPTED, 5));
      const { onAccepted } = renderSection({ workOrder: openOrder() });

      fireEvent.click(await screen.findByRole('button', { name: 'Change items' }));
      expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
        true,
      );
      fireEvent.change(screen.getByLabelText('Quantity Ban Luar - Ukuran 90'), {
        target: { value: '3' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(mocks.adjustLines).toHaveBeenCalledWith('wo-1', 4, [
          { type: 'QUANTITY_CHANGE', lineId: 'l2', quantity: '3' },
        ]),
      );
      await waitFor(() =>
        expect(onAccepted).toHaveBeenCalledWith(expect.objectContaining({ version: 5 })),
      );
      expect(await screen.findByText('Items updated.')).toBeTruthy();
    });

    it('stages a removal that can be restored, and saves it as REMOVE', async () => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      mocks.adjustLines.mockResolvedValue(detail([ACCEPTED[0]!], 5));
      renderSection({ workOrder: openOrder() });

      fireEvent.click(await screen.findByRole('button', { name: 'Change items' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove item Ban Luar - Ukuran 90' }));
      expect(screen.getByText('Will be removed')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Restore item Ban Luar - Ukuran 90' }));
      expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
        true,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Remove item Ban Luar - Ukuran 90' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(mocks.adjustLines).toHaveBeenCalledWith('wo-1', 4, [
          { type: 'REMOVE', lineId: 'l2' },
        ]),
      );
    });

    it('adds an item through the shared picker and saves it together with other changes', async () => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      mocks.adjustLines.mockResolvedValue(detail(ACCEPTED, 5));
      renderSection({ workOrder: openOrder() });

      fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Add Oli Mesin 1L' }));
      fireEvent.change(screen.getByLabelText('Quantity Oli Mesin 1L'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add to list' }));

      // Back in the adjustment dialog with the item staged, not yet saved.
      expect(await screen.findByText('New')).toBeTruthy();
      expect(mocks.adjustLines).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Remove item Ban Luar - Ukuran 90' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(mocks.adjustLines).toHaveBeenCalledWith('wo-1', 4, [
          { type: 'REMOVE', lineId: 'l2' },
          { type: 'ADD', catalogItemId: 'prt-oil', quantity: '2' },
        ]),
      );
    });

    it('sends nothing when the adjustment is cancelled', async () => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      renderSection({ workOrder: openOrder() });
      fireEvent.click(await screen.findByRole('button', { name: 'Change items' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove item Ban Luar - Ukuran 90' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mocks.adjustLines).not.toHaveBeenCalled();
      // Reopening starts from a clean draft.
      fireEvent.click(await screen.findByRole('button', { name: 'Change items' }));
      expect(screen.queryByText('Will be removed')).toBeNull();
    });

    it('blocks saving an invalid quantity', async () => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      renderSection({ workOrder: openOrder() });
      fireEvent.click(await screen.findByRole('button', { name: 'Change items' }));
      fireEvent.change(screen.getByLabelText('Quantity Ban Luar - Ukuran 90'), {
        target: { value: '0' },
      });
      expect(screen.getByRole('alert').textContent).toContain('Enter a quantity above zero.');
      expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
        true,
      );
    });

    it('reloads the Work Order when the adjustment hits a version conflict', async () => {
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED));
      mocks.adjustLines.mockRejectedValue({ status: 409, code: 'VERSION_CONFLICT' });
      const { onStale, onAccepted } = renderSection({ workOrder: openOrder() });
      fireEvent.click(await screen.findByRole('button', { name: 'Change items' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove item Ban Luar - Ukuran 90' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() => expect(onStale).toHaveBeenCalled());
      expect(onAccepted).not.toHaveBeenCalled();
      expect(
        await screen.findByText('This Work Order was just changed. Open it again.'),
      ).toBeTruthy();
    });

    it('lets an open Work Order without items receive its first item', async () => {
      mocks.getDetail.mockResolvedValue(detail([]));
      renderSection({ workOrder: openOrder('IN_PROGRESS') });
      await screen.findByText('No work items yet');
      expect(screen.queryByRole('button', { name: /Select items/ })).toBeNull();
      expect(screen.getByRole('button', { name: /Add item/ })).toBeTruthy();
    });

    it('does not offer the one-time initial selection again after every item was removed', async () => {
      const history: WorkshopWorkOrderDetail['adjustments'] = [
        {
          id: 'a1',
          sequence: 1,
          type: 'REMOVE',
          lineId: 'l1',
          itemCode: 'X',
          itemName: 'Filter Oli',
          itemType: 'PRODUCT',
          variantName: null,
          previousQuantity: '1.0000',
          quantity: '0.0000',
          workOrderVersion: 5,
          adjustedAt: '2026-09-30T02:00:00.000Z',
        },
      ];
      mocks.getDetail.mockResolvedValue(detail([], 5, history));
      renderSection({ workOrder: queueOrder({ workStatus: 'WAITING', version: 5 }) });
      await screen.findByText('No work items yet');
      expect(screen.queryByRole('button', { name: /Select items/ })).toBeNull();
      expect(screen.getByRole('button', { name: /Add item/ })).toBeTruthy();
    });

    it('opens the change history in a focused popup, newest first, with no inline accordion', async () => {
      const history: WorkshopWorkOrderDetail['adjustments'] = [
        {
          id: 'a1',
          sequence: 1,
          type: 'ADD',
          lineId: 'l3',
          itemCode: 'F',
          itemName: 'Filter Oli',
          itemType: 'PRODUCT',
          variantName: null,
          previousQuantity: null,
          quantity: '1.0000',
          workOrderVersion: 5,
          adjustedAt: '2026-09-30T02:00:00.000Z',
        },
        {
          id: 'a2',
          sequence: 2,
          type: 'QUANTITY_CHANGE',
          lineId: 'l2',
          itemCode: 'BAN',
          itemName: 'Ban Luar',
          itemType: 'PRODUCT',
          variantName: null,
          previousQuantity: '1.0000',
          quantity: '2.0000',
          workOrderVersion: 5,
          adjustedAt: '2026-09-30T02:00:00.000Z',
        },
        {
          id: 'a3',
          sequence: 3,
          type: 'REMOVE',
          lineId: 'l4',
          itemCode: 'B',
          itemName: 'Baut Kuras',
          itemType: 'PRODUCT',
          variantName: null,
          previousQuantity: '1.0000',
          quantity: '0.0000',
          workOrderVersion: 6,
          adjustedAt: '2026-09-30T03:00:00.000Z',
        },
      ];
      mocks.getDetail.mockResolvedValue(detail(ACCEPTED, 6, history));
      renderSection({ workOrder: queueOrder({ workStatus: 'DONE', version: 6 }) });

      const action = await screen.findByRole('button', { name: /View change history \(3\)/ });
      // No inline accordion: nothing of the history is on the page until it is opened.
      expect(screen.queryByText(/Baut Kuras/)).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(action);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Item change history')).toBeTruthy();
      const entries = within(dialog)
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '');
      // Newest first, with the change type and the quantity meaning.
      expect(entries[0]).toContain('Removed');
      expect(entries[0]).toContain('Baut Kuras');
      expect(entries[0]).toContain('− 1');
      expect(entries[1]).toContain('Quantity changed');
      expect(entries[1]).toContain('Ban Luar');
      expect(entries[1]).toContain('1 → 2');
      expect(entries[2]).toContain('Added');
      expect(entries[2]).toContain('Filter Oli');
      expect(entries[2]).toContain('+ 1');

      fireEvent.click(within(dialog).getByRole('button', { name: /close|tutup/i }));
      await waitFor(() => expect(screen.queryByText(/Baut Kuras/)).toBeNull());
      // A terminal Work Order keeps its history but offers no edit action.
      expect(screen.queryByRole('button', { name: /Add item|Change items/ })).toBeNull();
    });
  });
});
