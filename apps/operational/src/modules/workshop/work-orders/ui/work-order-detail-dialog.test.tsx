import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  mechanic: {
    employeeId: 'emp-1',
    displayName: 'Andi Mekanik',
    assignedAt: '2026-09-28T20:00:00.000Z',
  },
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
    onOpenMechanicPicker: vi.fn(),
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

  it('keeps Work Order context on one side and the items with the billing derived from them on the other', () => {
    render(
      <WorkOrderDetailDialog
        {...props({
          itemsSection: <p>items-section</p>,
          billingSection: <p>billing-section</p>,
        })}
      />,
    );
    const context = document.querySelector('[data-region="context"]') as HTMLElement;
    const work = document.querySelector('[data-region="work"]') as HTMLElement;
    for (const text of ['Budi Santoso', 'B 1234 CDV', 'Andi Mekanik', 'Rem berbunyi'])
      expect(context.textContent).toContain(text);
    expect(context.textContent).not.toContain('billing-section');
    expect(context.textContent).not.toContain('items-section');
    // Items first, the billing they produce directly after them.
    expect(work.textContent).toContain('items-section');
    expect(work.textContent).toContain('billing-section');
    expect(work.textContent?.indexOf('items-section')).toBeLessThan(
      work.textContent?.indexOf('billing-section') ?? 0,
    );
  });

  it('keeps the last Work Order rendered after a close is requested', () => {
    const { rerender } = render(<WorkOrderDetailDialog {...props()} />);
    rerender(<WorkOrderDetailDialog {...props({ workOrder: null })} />);

    expect(screen.getByText('WO-20260928-000001')).toBeTruthy();
    expect(screen.getByText('B 1234 CDV')).toBeTruthy();
    expect(screen.getByText('Rem berbunyi')).toBeTruthy();
  });

  it('shows the items section supplied by the workspace and keeps it through the close transition', () => {
    const section = <p>items-section</p>;
    const { rerender } = render(<WorkOrderDetailDialog {...props({ itemsSection: section })} />);
    expect(screen.getByText('items-section')).toBeTruthy();

    rerender(<WorkOrderDetailDialog {...props({ workOrder: null, itemsSection: null })} />);
    expect(screen.getByText('items-section')).toBeTruthy();
  });

  it('puts the destructive cancel action in the footer and runs lifecycle actions', () => {
    const onAction = vi.fn();
    render(<WorkOrderDetailDialog {...props({ onAction })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onAction).toHaveBeenCalledWith(workOrder, 'pause');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel work order' }));
    expect(onAction).toHaveBeenCalledWith(workOrder, 'cancel');
  });

  describe('cancellation', () => {
    it('opens a dedicated dialog and leaves the Work Order detail unchanged behind it', () => {
      const onAction = vi.fn();
      const { rerender } = render(<WorkOrderDetailDialog {...props({ onAction })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel work order' }));
      expect(onAction).toHaveBeenCalledWith(workOrder, 'cancel');

      rerender(<WorkOrderDetailDialog {...props({ isCancelling: true })} />);
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(2);
      const cancellation = dialogs[dialogs.length - 1] as HTMLElement;
      expect(within(cancellation).getByText('WO-20260928-000001')).toBeTruthy();
      expect(within(cancellation).getByLabelText('Cancellation reason')).toBeTruthy();
      // The Work Order detail is still fully there and did not swap in a form.
      const detail = dialogs[0] as HTMLElement;
      expect(within(detail).getByText('Budi Santoso')).toBeTruthy();
      expect(within(detail).queryByLabelText('Cancellation reason')).toBeNull();
      expect(within(detail).queryByRole('button', { name: 'Yes, cancel' })).toBeNull();
      // Lifecycle actions did not turn into Back / Yes, cancel.
      expect(within(detail).getByRole('button', { name: 'Pause' })).toBeTruthy();
    });

    it('renders no cancellation dialog or field until cancellation starts', () => {
      render(<WorkOrderDetailDialog {...props()} />);
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.queryByLabelText('Cancellation reason')).toBeNull();
    });

    it.each(['', '   '])(
      'keeps the destructive confirmation disabled for a blank reason (%j)',
      (blank) => {
        render(<WorkOrderDetailDialog {...props({ isCancelling: true, cancelReason: blank })} />);
        expect(
          (screen.getByRole('button', { name: 'Yes, cancel' }) as HTMLButtonElement).disabled,
        ).toBe(true);
      },
    );

    it('sends the entered reason through the existing handlers', () => {
      const onCancelReasonChange = vi.fn();
      const onCancelConfirm = vi.fn();
      render(
        <WorkOrderDetailDialog
          {...props({
            isCancelling: true,
            cancelReason: 'Berubah pikiran',
            onCancelReasonChange,
            onCancelConfirm,
          })}
        />,
      );
      fireEvent.change(screen.getByLabelText('Cancellation reason'), {
        target: { value: 'Pelanggan batal' },
      });
      // DTextarea reports (value, event); the workspace handler takes the value.
      expect(onCancelReasonChange.mock.calls[0]?.[0]).toBe('Pelanggan batal');
      const confirm = screen.getByRole('button', { name: 'Yes, cancel' }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
      fireEvent.click(confirm);
      expect(onCancelConfirm).toHaveBeenCalledTimes(1);
    });

    it('keeps the confirmation busy while the cancellation is pending', () => {
      render(
        <WorkOrderDetailDialog
          {...props({ isCancelling: true, cancelReason: 'x', cancelPending: true })}
        />,
      );
      expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    it('backing out cancels nothing and never closes the Work Order detail', () => {
      const onCancelBack = vi.fn();
      const onCancelConfirm = vi.fn();
      const onClose = vi.fn();
      render(
        <WorkOrderDetailDialog
          {...props({
            isCancelling: true,
            cancelReason: 'x',
            onCancelBack,
            onCancelConfirm,
            onClose,
          })}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(onCancelBack).toHaveBeenCalledTimes(1);
      expect(onCancelConfirm).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Budi Santoso')).toBeTruthy();
    });

    it('keeps the cancellation dialog through the close transition', () => {
      const { rerender } = render(
        <WorkOrderDetailDialog
          {...props({ isCancelling: true, cancelReason: 'Berubah pikiran' })}
        />,
      );
      rerender(
        <WorkOrderDetailDialog
          {...props({ workOrder: null, isCancelling: false, cancelReason: '' })}
        />,
      );
      expect(screen.getAllByText('WO-20260928-000001').length).toBeGreaterThan(0);
    });
  });

  describe('mechanic assignment', () => {
    const waiting = { ...workOrder, workStatus: 'WAITING' as const, mechanic: null };
    const assign = ['workshop-assignments:update'];

    it('shows the canonical mechanic name for an assigned Work Order', () => {
      render(<WorkOrderDetailDialog {...props()} />);
      expect(screen.getByText('Mechanic')).toBeTruthy();
      expect(screen.getByText('Andi Mekanik')).toBeTruthy();
    });

    it('shows a clear unassigned state with an assign action when permitted', () => {
      const onOpenMechanicPicker = vi.fn();
      render(
        <WorkOrderDetailDialog
          {...props({ workOrder: waiting, permissions: assign, onOpenMechanicPicker })}
        />,
      );
      expect(screen.getByText('Not assigned yet')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Assign mechanic' }));
      expect(onOpenMechanicPicker).toHaveBeenCalledTimes(1);
    });

    it('hides the assign action without workshop-assignments:update but still shows the state', () => {
      render(
        <WorkOrderDetailDialog
          {...props({ workOrder: waiting, permissions: ['work-orders:cancel'] })}
        />,
      );
      expect(screen.getByText('Not assigned yet')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Assign mechanic' })).toBeNull();
    });

    it('offers an icon-only replace action while ASSIGNED and PAUSED', () => {
      const onOpenMechanicPicker = vi.fn();
      for (const workStatus of ['ASSIGNED', 'PAUSED'] as const) {
        cleanup();
        render(
          <WorkOrderDetailDialog
            {...props({
              workOrder: { ...workOrder, workStatus },
              permissions: assign,
              onOpenMechanicPicker,
            })}
          />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Replace mechanic' }));
      }
      expect(onOpenMechanicPicker).toHaveBeenCalledTimes(2);
    });

    it('offers no replace action while IN_PROGRESS or without the permission', () => {
      render(<WorkOrderDetailDialog {...props({ permissions: assign })} />);
      expect(screen.queryByRole('button', { name: 'Replace mechanic' })).toBeNull();
      cleanup();
      render(
        <WorkOrderDetailDialog
          {...props({
            workOrder: { ...workOrder, workStatus: 'ASSIGNED' },
            permissions: ['workshop-execution:update'],
          })}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Replace mechanic' })).toBeNull();
    });

    it('starts an ASSIGNED Work Order from the footer', () => {
      const onAction = vi.fn();
      const assigned = { ...workOrder, workStatus: 'ASSIGNED' as const };
      render(
        <WorkOrderDetailDialog
          {...props({ workOrder: assigned, permissions: ['workshop-execution:update'], onAction })}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      expect(onAction).toHaveBeenCalledWith(assigned, 'start');
    });
  });

  it('offers no actions for a finished Work Order', () => {
    render(
      <WorkOrderDetailDialog {...props({ workOrder: { ...workOrder, workStatus: 'DONE' } })} />,
    );
    expect(screen.getByText('No more actions for this Work Order.')).toBeTruthy();
  });
});
