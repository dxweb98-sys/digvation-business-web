import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({
    copy: (value: string) => value,
    label: (status: string) => `label:${status}`,
    formatDate: () => '29 Sep 2026 02.23',
  }),
}));

import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { WorkOrderDetailDialog } from './work-order-detail-dialog';

const workOrder: WorkshopQueueWorkOrder = {
  id: 'wo-1',
  workOrderNumber: 'WO-20260928-000001',
  workStatus: 'IN_PROGRESS',
  sellingLocationId: 'loc',
  customerNameSnapshot: 'Budi Santoso',
  customerPhoneSnapshot: '+6281234567890',
  vehiclePlateSnapshot: 'B 1234 CDV',
  vehicleChassisNumberSnapshot: 'MH1JFZ1',
  customerRequest: 'Rem berbunyi',
  cancellationReason: null,
  version: 3,
  createdAt: '2026-09-28T19:23:00.000Z',
  updatedAt: '2026-09-28T19:23:00.000Z',
};

function props(overrides: Partial<Parameters<typeof WorkOrderDetailDialog>[0]> = {}) {
  return {
    workOrder,
    permissions: ['workshop-execution:update', 'work-orders:complete', 'work-orders:cancel'],
    isCancelling: false,
    cancelReason: '',
    cancelPending: false,
    commandPending: false,
    onClose: vi.fn(),
    onAction: vi.fn(),
    onCancelReasonChange: vi.fn(),
    onCancelBack: vi.fn(),
    onCancelConfirm: vi.fn(),
    ...overrides,
  };
}

describe('WorkOrderDetailDialog', () => {
  afterEach(cleanup);

  it('shows the Work Order and status, then Customer, Vehicle, complaint and created time', () => {
    render(<WorkOrderDetailDialog {...props()} />);

    expect(screen.getByText('WO-20260928-000001')).toBeTruthy();
    expect(screen.getByText('label:IN_PROGRESS')).toBeTruthy();
    expect(screen.getByText('Budi Santoso')).toBeTruthy();
    expect(screen.getByText('0812 3456 7890')).toBeTruthy();
    expect(screen.getByText('B 1234 CDV')).toBeTruthy();
    expect(screen.getByText('Chassis number')).toBeTruthy();
    expect(screen.getByText('Rem berbunyi')).toBeTruthy();
    expect(screen.getByText('29 Sep 2026 02.23')).toBeTruthy();
    // The Queue contract has no engine number, so none is shown.
    expect(screen.queryByText('Engine number')).toBeNull();
  });

  it('keeps the last Work Order rendered after a close is requested', () => {
    const { rerender } = render(<WorkOrderDetailDialog {...props()} />);
    rerender(<WorkOrderDetailDialog {...props({ workOrder: null })} />);

    expect(screen.getByText('WO-20260928-000001')).toBeTruthy();
    expect(screen.getByText('B 1234 CDV')).toBeTruthy();
    expect(screen.getByText('Rem berbunyi')).toBeTruthy();
  });

  it('keeps the cancellation form while closing instead of collapsing it', () => {
    const { rerender } = render(
      <WorkOrderDetailDialog {...props({ isCancelling: true, cancelReason: 'Berubah pikiran' })} />,
    );
    rerender(
      <WorkOrderDetailDialog
        {...props({ workOrder: null, isCancelling: true, cancelReason: 'Berubah pikiran' })}
      />,
    );
    expect(screen.getByDisplayValue('Berubah pikiran')).toBeTruthy();
  });

  it('puts the destructive cancel action in the footer and runs lifecycle actions', () => {
    const onAction = vi.fn();
    render(<WorkOrderDetailDialog {...props({ onAction })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onAction).toHaveBeenCalledWith(workOrder, 'pause');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel work order' }));
    expect(onAction).toHaveBeenCalledWith(workOrder, 'cancel');
  });

  it('requires a reason before confirming the cancellation', () => {
    render(<WorkOrderDetailDialog {...props({ isCancelling: true })} />);
    expect((screen.getByRole('button', { name: 'Yes, cancel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers no actions for a finished Work Order', () => {
    render(
      <WorkOrderDetailDialog
        {...props({ workOrder: { ...workOrder, workStatus: 'DONE' } })}
      />,
    );
    expect(screen.getByText('No more actions for this Work Order.')).toBeTruthy();
  });
});
