import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBilling: vi.fn(),
  validateBilling: vi.fn(),
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
vi.mock('../api/workshop-billing-api', () => ({
  WorkshopBillingApi: class {
    getBilling = mocks.getBilling;
    validateBilling = mocks.validateBilling;
  },
}));

import type { WorkshopBilling } from '../api/workshop-billing-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { WorkOrderBillingSection } from './work-order-billing-section';

const BOTH = ['workshop-billing:read-sensitive', 'workshop-billing:validate'];
const READ_ONLY = ['workshop-billing:read-sensitive'];

const queueOrder = (overrides: Partial<WorkshopQueueWorkOrder> = {}): WorkshopQueueWorkOrder => ({
  id: 'wo-1',
  workOrderNumber: 'WO-1',
  workStatus: 'IN_PROGRESS',
  sellingLocationId: 'loc-1',
  customerNameSnapshot: 'Budi',
  customerPhoneSnapshot: '+6281234567890',
  vehiclePlateSnapshot: 'B 1',
  vehicleChassisNumberSnapshot: 'CH',
  customerRequest: 'servis',
  cancellationReason: null,
  mechanic: null,
  version: 4,
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
  ...overrides,
});

const billing = (overrides: Partial<WorkshopBilling> = {}): WorkshopBilling => ({
  workOrderId: 'wo-1',
  currency: 'IDR',
  subtotalAmount: '500000.0000',
  tax: { enabled: true, rate: '0.11', treatment: 'EXCLUDED', amount: '55000.0000' },
  totalAmount: '555000.0000',
  validationState: 'DRAFT',
  sourceWorkOrderVersion: 4,
  version: 2,
  lastValidatedAt: null,
  ...overrides,
});

function renderSection(
  props: { workOrder?: WorkshopQueueWorkOrder; permissions?: string[] } = {},
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const ui = (workOrder: WorkshopQueueWorkOrder) => (
    <DToastProvider>
      <QueryClientProvider client={client}>
        <WorkOrderBillingSection workOrder={workOrder} permissions={props.permissions ?? BOTH} />
      </QueryClientProvider>
    </DToastProvider>
  );
  const view = render(ui(props.workOrder ?? queueOrder()));
  return { rerenderWith: (workOrder: WorkshopQueueWorkOrder) => view.rerender(ui(workOrder)) };
}

describe('WorkOrderBillingSection', () => {
  afterEach(cleanup);
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('shows a loading state, then the Runtime-calculated draft summary with tax', async () => {
    mocks.getBilling.mockResolvedValue(billing());
    renderSection();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    expect(await screen.findByText('Subtotal')).toBeTruthy();
    expect(screen.getByText(/500\.000/)).toBeTruthy();
    expect(screen.getByText('Tax 11%')).toBeTruthy();
    expect(screen.getByText(/^Rp\s55\.000$/)).toBeTruthy();
    expect(screen.getByText(/555\.000/)).toBeTruthy();
    expect(screen.getByText('Not validated')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Validate billing' })).toBeTruthy();
  });

  it('does not invent a 0% rule when tax is disabled', async () => {
    mocks.getBilling.mockResolvedValue(
      billing({
        tax: { enabled: false, rate: '0.11', treatment: 'EXCLUDED', amount: '0.0000' },
        totalAmount: '500000.0000',
      }),
    );
    renderSection();
    expect(await screen.findByText('Not charged')).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByText('Tax')).toBeTruthy();
  });

  it('shows a validated billing without a validation action', async () => {
    mocks.getBilling.mockResolvedValue(billing({ validationState: 'VALIDATED', version: 3 }));
    renderSection();
    expect(await screen.findByText('Validated')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Validate billing|Revalidate billing/ }),
    ).toBeNull();
  });

  it('makes revalidation noticeable with a helper and the revalidate action', async () => {
    mocks.getBilling.mockResolvedValue(billing({ validationState: 'REVALIDATION_REQUIRED' }));
    renderSection();
    expect(await screen.findByText('Needs revalidation')).toBeTruthy();
    expect(
      screen.getByText('Items or tax settings changed after the billing was last validated.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revalidate billing' })).toBeTruthy();
    expect(screen.queryByText('REVALIDATION_REQUIRED')).toBeNull();
  });

  describe('permission and state gates', () => {
    it('renders nothing and never asks Runtime without the sensitive billing permission', async () => {
      renderSection({ permissions: ['work-orders:read', 'workshop-billing:validate'] });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByText('Billing summary')).toBeNull();
      expect(screen.queryByText(/555\.000/)).toBeNull();
      expect(mocks.getBilling).not.toHaveBeenCalled();
    });

    it('shows amounts but no validation action without workshop-billing:validate', async () => {
      mocks.getBilling.mockResolvedValue(billing());
      renderSection({ permissions: READ_ONLY });
      expect(await screen.findByText(/555\.000/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Validate billing/ })).toBeNull();
    });

    it.each(['WAITING', 'ASSIGNED'] as const)(
      'shows the draft while %s but offers no validation',
      async (workStatus) => {
        mocks.getBilling.mockResolvedValue(billing());
        renderSection({ workOrder: queueOrder({ workStatus }) });
        expect(await screen.findByText(/555\.000/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Validate billing/ })).toBeNull();
      },
    );

    it('offers validation for a DONE Work Order', async () => {
      mocks.getBilling.mockResolvedValue(billing());
      renderSection({ workOrder: queueOrder({ workStatus: 'DONE' }) });
      expect(await screen.findByRole('button', { name: 'Validate billing' })).toBeTruthy();
    });

    it('is hidden for a cancelled Work Order and never asks Runtime', async () => {
      renderSection({ workOrder: queueOrder({ workStatus: 'CANCELLED' }) });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByText('Billing summary')).toBeNull();
      expect(mocks.getBilling).not.toHaveBeenCalled();
    });

    it('is hidden while the Work Order has no items yet', async () => {
      mocks.getBilling.mockRejectedValue({ status: 409, code: 'WORKSHOP_BILLING_LINES_REQUIRED' });
      renderSection();
      await waitFor(() => expect(mocks.getBilling).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText('Billing summary')).toBeNull());
    });
  });

  describe('explicit validation', () => {
    it('does not validate just because the section is open', async () => {
      mocks.getBilling.mockResolvedValue(billing());
      renderSection();
      await screen.findByText('Not validated');
      expect(mocks.validateBilling).not.toHaveBeenCalled();
    });

    it('confirms first, sends only the reviewed billing version, and renders what Runtime returns', async () => {
      mocks.getBilling.mockResolvedValue(billing());
      mocks.validateBilling.mockResolvedValue(
        billing({ validationState: 'VALIDATED', version: 3 }),
      );
      renderSection();

      fireEvent.click(await screen.findByRole('button', { name: 'Validate billing' }));
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText('Make sure the Work Order items and billing amounts are correct.'),
      ).toBeTruthy();
      expect(within(dialog).getByText(/555\.000/)).toBeTruthy();
      expect(mocks.validateBilling).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Validate billing' }));
      await waitFor(() => expect(mocks.validateBilling).toHaveBeenCalledWith('wo-1', 2));
      expect(mocks.validateBilling.mock.calls[0]).toHaveLength(2);
      expect(await screen.findByText('Validated')).toBeTruthy();
      expect(await screen.findByText('Billing validated.')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('cancelling the confirmation sends nothing', async () => {
      mocks.getBilling.mockResolvedValue(billing());
      renderSection();
      fireEvent.click(await screen.findByRole('button', { name: 'Validate billing' }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
      expect(mocks.validateBilling).not.toHaveBeenCalled();
    });

    it('closes the confirmation and shows the recalculated billing after a version conflict', async () => {
      mocks.getBilling
        .mockResolvedValueOnce(billing())
        .mockResolvedValue(
          billing({ subtotalAmount: '600000.0000', totalAmount: '666000.0000', version: 3 }),
        );
      mocks.validateBilling.mockRejectedValue({ status: 409, code: 'VERSION_CONFLICT' });
      renderSection();

      fireEvent.click(await screen.findByRole('button', { name: 'Validate billing' }));
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Validate billing' }),
      );

      expect(
        await screen.findByText('The billing changed. Review the new amounts and try again.'),
      ).toBeTruthy();
      expect(await screen.findByText(/666\.000/)).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByText('VERSION_CONFLICT')).toBeNull();
    });

    it('explains a rejected state without exposing the raw code', async () => {
      mocks.getBilling.mockResolvedValue(billing());
      mocks.validateBilling.mockRejectedValue({
        status: 409,
        code: 'WORKSHOP_BILLING_STATE_INVALID',
      });
      renderSection();
      fireEvent.click(await screen.findByRole('button', { name: 'Validate billing' }));
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Validate billing' }),
      );
      expect(
        await screen.findByText(
          'Billing cannot be validated while the Work Order is in this status.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('WORKSHOP_BILLING_STATE_INVALID')).toBeNull();
    });
  });

  it('refreshes from Runtime when the Work Order version changes, for example after an item adjustment', async () => {
    mocks.getBilling
      .mockResolvedValueOnce(billing({ validationState: 'VALIDATED', version: 3 }))
      .mockResolvedValue(
        billing({
          validationState: 'REVALIDATION_REQUIRED',
          subtotalAmount: '700000.0000',
          totalAmount: '777000.0000',
          sourceWorkOrderVersion: 5,
          version: 4,
        }),
      );
    const { rerenderWith } = renderSection();
    expect(await screen.findByText('Validated')).toBeTruthy();

    rerenderWith(queueOrder({ version: 5 }));
    expect(await screen.findByText('Needs revalidation')).toBeTruthy();
    expect(screen.getByText(/777\.000/)).toBeTruthy();
    expect(mocks.getBilling).toHaveBeenCalledTimes(2);
  });

  it('offers a retry when the billing cannot be loaded', async () => {
    mocks.getBilling.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(billing());
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/555\.000/)).toBeTruthy();
  });

  it('carries no payment, invoice, discount or outstanding controls', async () => {
    mocks.getBilling.mockResolvedValue(billing());
    renderSection();
    await screen.findByText(/555\.000/);
    expect(screen.queryByText(/Pay|Payment|Invoice|Discount|Outstanding|Paid/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Pay|Invoice|Discount/i })).toBeNull();
  });
});
