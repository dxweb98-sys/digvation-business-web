import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Employee, Sale } from '../cashier-transaction.types';
import { ServicePerformersDialog } from './service-performers-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const employees = [
  { id: 'emp-andini', code: 'AND', displayName: 'Andini', status: 'ACTIVE' },
  { id: 'emp-rindu', code: 'RIN', displayName: 'Rindu', status: 'ACTIVE' },
  { id: 'emp-sari', code: 'SAR', displayName: 'Sari', status: 'ACTIVE' },
] as unknown as Employee[];

type Unit = {
  unitNumber: number;
  employeeIds: string[];
  performers: Array<{ employeeId: string; shareRate: string | null }>;
};

function unit(unitNumber: number, employeeId: string): Unit {
  return {
    unitNumber,
    employeeIds: [employeeId],
    performers: [{ employeeId, shareRate: '1.000000000000000000' }],
  };
}

function line(
  id: string,
  name: string,
  options: { quantity?: string; workUnits?: Unit[]; assigned?: string[] } = {},
) {
  return {
    id,
    saleId: 'sale-1',
    catalogItemId: `item-${id}`,
    itemNameSnapshot: name,
    variantNameSnapshot: null,
    itemTypeSnapshot: 'SERVICE',
    fulfillmentBehaviorSnapshot: 'TRACKED',
    employeeAssignmentModeSnapshot: 'REQUIRED',
    allowEmployeeContributionSnapshot: true,
    quantity: options.quantity ?? '1.0000',
    removedAt: null,
    fulfillment: { status: 'WAITING' },
    participations: (options.assigned ?? []).map((employeeId) => ({
      employeeId,
      assigned: true,
      shareRate: '1.0000',
    })),
    workUnits: options.workUnits ?? [],
    contributions: [],
  };
}

const saleOf = (...lines: ReturnType<typeof line>[]) =>
  ({ id: 'sale-1', saleNumber: 'TRX-1', status: 'OPEN', lines }) as unknown as Sale;

function renderDialog(sale: Sale, lineId: string) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <ServicePerformersDialog
          sale={sale}
          lineId={lineId}
          employees={employees}
          isSaving={false}
          onClose={onClose}
          onSave={onSave}
        />
      </DToastProvider>
    </DeploymentBootstrapProvider>,
  );
  return { onSave, onClose };
}

// The dialog is scoped to the ONE line the user clicked. Its work units live inside it when
// quantity is above one, each as a row of its own.
const row = (name: RegExp) => screen.getByRole('button', { name });
const rowText = (name: RegExp) => row(name).textContent ?? '';
const tick = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }));
const isTicked = (name: RegExp) =>
  (screen.getByRole('checkbox', { name }) as HTMLInputElement).checked;
const save = () => fireEvent.click(screen.getByRole('button', { name: /^Simpan$/ }));
const useForAllWork = () =>
  fireEvent.click(screen.getByRole('button', { name: /Pakai untuk semua pengerjaan/ }));
const payload = (onSave: ReturnType<typeof vi.fn>) =>
  onSave.mock.calls[0]![0] as Array<{
    lineId: string;
    units: Array<Array<{ employeeId: string; shareRate: string }>>;
  }>;
const ids = (units: Array<Array<{ employeeId: string }>>) =>
  units.map((performers) => performers.map((performer) => performer.employeeId));

afterEach(cleanup);

describe('ServicePerformersDialog: edit is scoped to the clicked service line', () => {
  const threeServices = () =>
    saleOf(
      line('l-color', 'Hair Color'),
      line('l-curly', 'Smoothing Curly'),
      line('l-bleach', 'Body Bleaching'),
    );

  it('opens only the clicked line: the other service lines are absent', () => {
    renderDialog(threeServices(), 'l-color');
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Hair Color');
    expect(dialog.textContent).not.toContain('Smoothing Curly');
    expect(dialog.textContent).not.toContain('Body Bleaching');
    // The editor is shown directly: employees only, no other service to expand.
    expect(screen.queryByRole('button', { name: /Smoothing Curly|Body Bleaching/ })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(employees.length);
    cleanup();

    renderDialog(threeServices(), 'l-curly');
    expect(screen.getByRole('dialog').textContent).toContain('Smoothing Curly');
    expect(screen.getByRole('dialog').textContent).not.toContain('Hair Color');
  });

  it('offers no sale-wide "apply to all services" action from an item-level edit', () => {
    renderDialog(threeServices(), 'l-color');
    tick(/Andini/);
    expect(screen.queryByRole('button', { name: /semua layanan/i })).toBeNull();
    // A quantity-1 line has no other work unit to copy to either.
    expect(screen.queryByRole('button', { name: /Pakai untuk semua/ })).toBeNull();
  });

  it('saves only the clicked line and never touches the other lines', () => {
    const { onSave } = renderDialog(
      saleOf(
        line('l-color', 'Hair Color'),
        line('l-curly', 'Smoothing Curly', { assigned: ['emp-sari'] }),
        line('l-bleach', 'Body Bleaching'),
      ),
      'l-color',
    );
    tick(/Andini/);
    save();
    const plans = payload(onSave);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.lineId).toBe('l-color');
    expect(ids(plans[0]!.units)).toEqual([['emp-andini']]);
  });

  it('does not number a quantity-1 service: no "Pengerjaan 1", "1/1" or ×N noise', () => {
    renderDialog(threeServices(), 'l-color');
    expect(screen.queryByText(/Pengerjaan \d/)).toBeNull();
    expect(screen.queryByText(/\d\/\d(?!\d)\s*$/)).toBeNull();
    expect(screen.queryByText(/×\d/)).toBeNull();
  });

  it('still exposes BOTH work units of a quantity-2 line, inside that one line only', () => {
    renderDialog(
      saleOf(
        line('l-color', 'Hair Color', { quantity: '2.0000' }),
        line('l-curly', 'Smoothing Curly'),
      ),
      'l-color',
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Hair Color ×2');
    expect(dialog.textContent).not.toContain('Smoothing Curly');
    expect(row(/Pengerjaan 1/)).toBeTruthy();
    expect(row(/Pengerjaan 2/)).toBeTruthy();
    // Never two sibling "Hair Color" services.
    expect(screen.queryByRole('button', { name: /Hair Color/ })).toBeNull();
  });

  it('lets the two units of a quantity-2 line have different performers', () => {
    const { onSave } = renderDialog(
      saleOf(
        line('l-color', 'Hair Color', { quantity: '2.0000' }),
        line('l-curly', 'Smoothing Curly', { assigned: ['emp-sari'] }),
      ),
      'l-color',
    );
    tick(/Andini/); // Pengerjaan 1
    fireEvent.click(row(/Pengerjaan 2/));
    tick(/Rindu/); // Pengerjaan 2
    expect(rowText(/Pengerjaan 1/)).toContain('Andini');
    expect(rowText(/Pengerjaan 1/)).not.toContain('Rindu');
    expect(rowText(/Pengerjaan 2/)).toContain('Rindu');

    save();
    const plans = payload(onSave);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.lineId).toBe('l-color');
    // Unit order and independence are preserved, never collapsed to one performer.
    expect(ids(plans[0]!.units)).toEqual([['emp-andini'], ['emp-rindu']]);
  });

  it('copies one unit to the other units of THIS line only, through an explicit action', () => {
    const { onSave } = renderDialog(
      saleOf(
        line('l-color', 'Hair Color', { quantity: '2.0000' }),
        line('l-curly', 'Smoothing Curly'),
      ),
      'l-color',
    );
    tick(/Andini/);
    // Choosing an employee alone never reaches the other unit.
    expect(rowText(/Pengerjaan 2/)).toContain('Belum ada karyawan');
    useForAllWork();
    expect(rowText(/Pengerjaan 1/)).toContain('Andini');
    expect(rowText(/Pengerjaan 2/)).toContain('Andini');

    // One unit can then differ again without touching its sibling.
    fireEvent.click(row(/Pengerjaan 2/));
    tick(/Andini/);
    tick(/Rindu/);
    expect(rowText(/Pengerjaan 1/)).toContain('Andini');
    expect(rowText(/Pengerjaan 2/)).toContain('Rindu');

    save();
    const plans = payload(onSave);
    expect(plans.map((plan) => plan.lineId)).toEqual(['l-color']);
    expect(ids(plans[0]!.units)).toEqual([['emp-andini'], ['emp-rindu']]);
  });

  it('keeps the choice when a work unit is collapsed and opened again', () => {
    renderDialog(saleOf(line('l-color', 'Hair Color', { quantity: '2.0000' })), 'l-color');
    tick(/Andini/);
    fireEvent.click(row(/Pengerjaan 1/)); // collapse
    expect(screen.queryByRole('checkbox', { name: /Andini/ })).toBeNull();
    fireEvent.click(row(/Pengerjaan 1/)); // expand again
    expect(isTicked(/Andini/)).toBe(true);
    expect(rowText(/Pengerjaan 1/)).toContain('Andini');
  });

  it('reopens with only its own persisted assignment, per unit, and saves only what changed', () => {
    const sale = saleOf(
      line('l-color', 'Hair Color', {
        quantity: '2.0000',
        workUnits: [unit(1, 'emp-andini'), unit(2, 'emp-rindu')],
        assigned: ['emp-andini', 'emp-rindu'],
      }),
      line('l-curly', 'Smoothing Curly', {
        workUnits: [unit(1, 'emp-sari')],
        assigned: ['emp-sari'],
      }),
    );
    const { onSave } = renderDialog(sale, 'l-color');
    expect(rowText(/Pengerjaan 1/)).toContain('Andini');
    expect(rowText(/Pengerjaan 2/)).toContain('Rindu');
    // The other line's persisted performer is not part of this dialog at all.
    expect(screen.queryByText(/Smoothing Curly/)).toBeNull();

    // Change only unit 2; unit 1 keeps its performer.
    fireEvent.click(row(/Pengerjaan 2/));
    tick(/Rindu/);
    tick(/Sari/);
    save();
    const plans = payload(onSave);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.lineId).toBe('l-color');
    expect(ids(plans[0]!.units)).toEqual([['emp-andini'], ['emp-sari']]);
    cleanup();

    // Opening the other line shows its own assignment, untouched.
    renderDialog(sale, 'l-curly');
    expect(isTicked(/Sari/)).toBe(true);
    expect(isTicked(/Andini/)).toBe(false);
    expect(screen.queryByText(/Pengerjaan \d/)).toBeNull();
  });

  it('shows the work split only when one unit has several employees, never for quantity or one employee', () => {
    renderDialog(saleOf(line('l-color', 'Hair Color')), 'l-color');
    tick(/Andini/);
    // One employee: no percentage field and no total.
    expect(screen.queryByRole('region', { name: 'Pembagian pengerjaan' })).toBeNull();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    tick(/Rindu/);
    // Two employees on ONE unit: each ticked row gains its own share, with a total.
    const split = screen.getByRole('region', { name: 'Pembagian pengerjaan' });
    expect(split.textContent).toContain('Total 100%');
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    cleanup();

    // Quantity 2 with one employee per unit never shows a split.
    renderDialog(saleOf(line('l-color', 'Hair Color', { quantity: '2.0000' })), 'l-color');
    tick(/Andini/);
    fireEvent.click(row(/Pengerjaan 2/));
    tick(/Rindu/);
    expect(screen.queryByRole('region', { name: 'Pembagian pengerjaan' })).toBeNull();
  });

  it('blocks a half-assigned quantity and names the unit that is missing', () => {
    const { onSave } = renderDialog(
      saleOf(line('l-color', 'Hair Color', { quantity: '2.0000' })),
      'l-color',
    );
    tick(/Andini/); // only Pengerjaan 1
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Hair Color · Pengerjaan 2/);
  });
});
