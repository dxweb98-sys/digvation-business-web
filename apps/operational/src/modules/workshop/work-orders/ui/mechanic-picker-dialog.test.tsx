import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({
    copy: (value: string) => value,
    label: (value: string) => `label:${value}`,
  }),
}));

import type { WorkshopMechanicCandidate } from '../api/workshop-queue-api';
import { MechanicPickerDialog } from './mechanic-picker-dialog';

const available: WorkshopMechanicCandidate = {
  employeeId: 'a',
  displayName: 'Andi',
  availability: 'AVAILABLE',
  activeWorkOrder: null,
  openWorkOrderCount: 2,
};
const busy: WorkshopMechanicCandidate = {
  employeeId: 'b',
  displayName: 'Budi',
  availability: 'BUSY',
  activeWorkOrder: { id: 'wo-9', workOrderNumber: 'WO-20260929-000009' },
  openWorkOrderCount: 1,
};
const ineligible: WorkshopMechanicCandidate = {
  employeeId: 'c',
  displayName: 'Cici',
  availability: 'INELIGIBLE',
  activeWorkOrder: null,
  openWorkOrderCount: 0,
};

function props(overrides: Partial<Parameters<typeof MechanicPickerDialog>[0]> = {}) {
  return {
    open: true,
    mode: 'assign' as const,
    currentEmployeeId: null,
    mechanics: [available, busy, ineligible],
    loading: false,
    failed: false,
    pending: false,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

describe('MechanicPickerDialog', () => {
  afterEach(cleanup);

  it('shows name, availability and workload context, never raw ids', () => {
    render(<MechanicPickerDialog {...props()} />);

    expect(screen.getByText('Andi')).toBeTruthy();
    expect(screen.getByText('label:AVAILABLE')).toBeTruthy();
    expect(screen.getByText('2 open Work Orders')).toBeTruthy();
    expect(screen.getByText('label:BUSY')).toBeTruthy();
    expect(screen.getByText('Working on WO-20260929-000009')).toBeTruthy();
    expect(screen.getByText('label:INELIGIBLE')).toBeTruthy();
    expect(screen.getByText('Not enabled as a workshop mechanic.')).toBeTruthy();
    expect(screen.queryByText('wo-9')).toBeNull();
  });

  it('only lets an available mechanic be chosen and confirms that mechanic', () => {
    const onConfirm = vi.fn();
    render(<MechanicPickerDialog {...props({ onConfirm })} />);

    const confirm = screen.getByRole('button', { name: 'Assign' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect((screen.getByRole('radio', { name: /Budi/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: /Cici/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: /Andi/ }));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('a');
  });

  it('uses the replace wording and leaves the current mechanic out of the choices', () => {
    render(<MechanicPickerDialog {...props({ mode: 'replace', currentEmployeeId: 'a' })} />);

    expect(screen.getAllByText('Replace mechanic').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Andi/ })).toBeNull();
  });

  it('explains an empty roster instead of showing an empty list', () => {
    render(<MechanicPickerDialog {...props({ mechanics: [] })} />);
    expect(
      screen.getByText('No mechanics yet. Enable mechanics from the Employee page in Backoffice.'),
    ).toBeTruthy();
  });

  it('offers a retry when the roster fails to load', () => {
    const onRetry = vi.fn();
    render(<MechanicPickerDialog {...props({ failed: true, mechanics: undefined, onRetry })} />);
    expect(screen.getByText('Could not load mechanics.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
