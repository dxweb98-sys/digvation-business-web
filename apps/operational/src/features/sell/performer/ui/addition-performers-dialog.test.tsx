import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Employee } from '../../transaction/model/cashier-transaction.types';
import { AdditionPerformersDialog } from './addition-performers-dialog';

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
  { id: 'emp-rindu', code: 'RIN', displayName: 'Rindu Putri', status: 'ACTIVE' },
] as unknown as Employee[];

function renderDialog(props: Partial<Parameters<typeof AdditionPerformersDialog>[0]> = {}) {
  const onSave = vi.fn();
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <AdditionPerformersDialog
        additionName="Hair Serum · Creambath"
        assignment={null}
        performers={[]}
        serviceNames={['Andini']}
        employees={employees}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
        {...props}
      />
    </DeploymentBootstrapProvider>,
  );
  return onSave;
}

const radio = (name: 'Sama dengan layanan utama' | 'Pilih karyawan lain') =>
  screen.getByRole('radio', { name }) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole('button', { name: /^Simpan$/ }));
const tick = (name: RegExp) => fireEvent.click(screen.getByRole('checkbox', { name }));

afterEach(cleanup);

describe('AdditionPerformersDialog', () => {
  it('starts undecided and asks for a choice instead of assuming one', () => {
    const onSave = renderDialog();
    expect(radio('Sama dengan layanan utama').checked).toBe(false);
    expect(radio('Pilih karyawan lain').checked).toBe(false);
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Pilih siapa yang mengerjakannya.');
  });

  it('saves "same as the main service" with no performers of its own, naming who that is now', () => {
    const onSave = renderDialog();
    fireEvent.click(radio('Sama dengan layanan utama'));
    expect(document.body.textContent).toContain('Andini');
    save();
    expect(onSave).toHaveBeenCalledWith({ assignment: 'SERVICE' });
  });

  it('never saves "other employees" with nobody named', () => {
    const onSave = renderDialog();
    fireEvent.click(radio('Pilih karyawan lain'));
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Pilih minimal satu karyawan/);
  });

  it('may name the main service performer too, and splits shared work exactly', () => {
    const onSave = renderDialog();
    fireEvent.click(radio('Pilih karyawan lain'));
    tick(/Andini/);
    tick(/Rindu/);
    expect(screen.getByRole('region', { name: 'Pembagian pengerjaan' }).textContent).toContain(
      'Total 100%',
    );
    save();
    expect(onSave).toHaveBeenCalledWith({
      assignment: 'OWN',
      performers: [
        { employeeId: 'emp-andini', shareRate: '0.5' },
        { employeeId: 'emp-rindu', shareRate: '0.5' },
      ],
    });
  });

  it('reopens with the persisted decision and shares', () => {
    renderDialog({
      assignment: 'OWN',
      performers: [{ employeeId: 'emp-rindu', shareRate: '1' }],
    });
    expect(radio('Pilih karyawan lain').checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Rindu/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('warns when following a main service that nobody performs yet', () => {
    renderDialog({ assignment: 'SERVICE', serviceNames: [] });
    expect(document.body.textContent).toContain('Pelaksana layanan utama belum dipilih');
  });
});
