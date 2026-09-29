import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const showToast = vi.fn();

vi.mock('@digvation/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@digvation/ui')>()),
  useToast: () => ({ showToast }),
}));
vi.mock('./workforce-localization', () => ({
  useWorkforceLocalization: () => ({
    copy: (value: string) => value,
    formatDate: () => '29 Sep 2026',
    locale: 'en',
  }),
}));

import { EmployeeDetailDialog } from './employee-detail-dialog';
import type { EmployeeDetail, EmployeesApi } from './employees-api';

const employee: EmployeeDetail = {
  id: 'emp-1',
  code: 'EMP-001',
  displayName: 'Andi Mekanik',
  positionId: null,
  position: null,
  joinedOn: null,
  status: 'ACTIVE',
  version: 4,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  statusHistory: [],
};

function renderDialog(options: {
  profiles: { employeeId: string; eligible: boolean; version: number }[];
  canUpdate?: boolean;
  workshopMechanic?: boolean;
  set?: ReturnType<typeof vi.fn>;
  detail?: EmployeeDetail;
}) {
  const api = {
    listWorkshopMechanicProfiles: vi.fn().mockResolvedValue({ items: options.profiles }),
    setWorkshopMechanicProfile: options.set ?? vi.fn().mockResolvedValue({}),
  } as unknown as EmployeesApi;
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EmployeeDetailDialog
        open
        employee={options.detail ?? employee}
        isLoading={false}
        isError={false}
        api={api}
        attendanceEnabled={false}
        {...(options.workshopMechanic === false
          ? {}
          : { workshopMechanic: { canUpdate: options.canUpdate ?? true } })}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return api;
}

describe('Employee Workshop mechanic setting', () => {
  afterEach(() => {
    cleanup();
    showToast.mockClear();
  });

  it('is absent when the Workshop product is not entitled', () => {
    renderDialog({ profiles: [], workshopMechanic: false });
    expect(screen.queryByText('Workshop mechanic')).toBeNull();
  });

  it('keeps the canonical Employee identity and shows the current eligibility', async () => {
    renderDialog({ profiles: [{ employeeId: 'emp-1', eligible: true, version: 2 }] });

    expect(screen.getAllByText('Andi Mekanik').length).toBeGreaterThan(0);
    const toggle = await screen.findByRole('switch', { name: 'Active as a mechanic' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('creates the profile without a version when the Employee has none', async () => {
    const set = vi.fn().mockResolvedValue({});
    renderDialog({ profiles: [], set });

    fireEvent.click(await screen.findByRole('switch', { name: 'Active as a mechanic' }));

    await waitFor(() => expect(set).toHaveBeenCalledWith('emp-1', true, undefined));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success', title: 'Mechanic setting saved.' }),
      ),
    );
  });

  it('updates an existing profile with its current version', async () => {
    const set = vi.fn().mockResolvedValue({});
    renderDialog({ profiles: [{ employeeId: 'emp-1', eligible: true, version: 3 }], set });

    fireEvent.click(await screen.findByRole('switch', { name: 'Active as a mechanic' }));

    await waitFor(() => expect(set).toHaveBeenCalledWith('emp-1', false, 3));
  });

  it('shows status and helper, with no misleading switch, without employees:update', async () => {
    renderDialog({
      profiles: [{ employeeId: 'emp-1', eligible: true, version: 1 }],
      canUpdate: false,
    });

    expect(await screen.findByText('Active mechanic')).toBeTruthy();
    expect(
      screen.getByText('This employee can be selected and assigned to workshop Work Orders.'),
    ).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows a not-a-mechanic status with guidance when the profile is not eligible', async () => {
    renderDialog({
      profiles: [{ employeeId: 'emp-1', eligible: false, version: 1 }],
      canUpdate: false,
    });

    expect(await screen.findByText('Not a mechanic')).toBeTruthy();
    expect(
      screen.getByText('Turn this on if this employee works as a workshop mechanic.'),
    ).toBeTruthy();
  });

  it('never presents an inactive Employee as an available mechanic, even with an eligible profile', async () => {
    renderDialog({
      profiles: [{ employeeId: 'emp-1', eligible: true, version: 1 }],
      detail: { ...employee, status: 'INACTIVE' },
    });

    expect(await screen.findByText('Employee is inactive')).toBeTruthy();
    expect(
      screen.getByText('The employee must be active before they can be assigned as a mechanic.'),
    ).toBeTruthy();
    expect(screen.queryByText('Active mechanic')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('never uses the rejected wording', async () => {
    renderDialog({ profiles: [{ employeeId: 'emp-1', eligible: true, version: 1 }] });
    await screen.findByRole('switch', { name: 'Active as a mechanic' });
    expect(screen.queryByText('Available as a mechanic')).toBeNull();
    expect(screen.queryByText('Bisa menjadi mekanik')).toBeNull();
  });

  it('explains a stale version in plain language instead of a raw code', async () => {
    const set = vi.fn().mockRejectedValue({ status: 409, code: 'VERSION_CONFLICT' });
    renderDialog({ profiles: [{ employeeId: 'emp-1', eligible: true, version: 1 }], set });

    fireEvent.click(await screen.findByRole('switch', { name: 'Active as a mechanic' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'danger',
          title: 'This setting was just changed. Reopen the employee and try again.',
        }),
      ),
    );
  });
});
