import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../app/localization/backoffice-localization-base';
import { EmployeeEditorDialog } from './employee-editor-dialog';
import type { EmployeeDetail, EmployeePosition, EmployeesApi } from './employees-api';

vi.mock('../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
  isSessionExpiredError: () => false,
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const position = (
  id: string,
  name: string,
  serviceAssignmentEnabled: boolean,
): EmployeePosition => ({
  id,
  code: id.toUpperCase(),
  name,
  serviceAssignmentEnabled,
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});
const stylist = position('pos-stylist', 'Stylist', true);
const cashier = position('pos-cashier', 'Kasir', false);

const existing: EmployeeDetail = {
  id: 'emp-1',
  code: 'EMP-000001',
  displayName: 'Andini',
  positionId: cashier.id,
  position: cashier,
  servicePerformerEligible: true,
  canPerformServices: false,
  productSalesEligible: false,
  canSellProducts: false,
  joinedOn: null,
  status: 'ACTIVE',
  version: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  statusHistory: [],
};

function renderEditor(employee: EmployeeDetail | null) {
  const api = {
    listPositions: vi.fn(async () => ({
      items: [stylist, cashier],
      total: 2,
      limit: 100,
      offset: 0,
    })),
    create: vi.fn(async () => existing),
    update: vi.fn(async () => existing),
  };
  const onClose = vi.fn();
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <QueryClientProvider client={new QueryClient()}>
          <DToastProvider>
            <EmployeeEditorDialog
              employee={employee}
              isLoading={false}
              isError={false}
              api={api as unknown as EmployeesApi}
              onClose={onClose}
              onSaved={vi.fn()}
            />
          </DToastProvider>
        </QueryClientProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
  return { api, onClose, dialog: within(screen.getByRole('dialog')) };
}

afterEach(cleanup);

describe('Employee editor', () => {
  it('creates an Active Service performer by default and says a position is still needed', async () => {
    const { api, dialog } = renderEditor(null);

    expect(dialog.getByText('Tambah karyawan')).toBeTruthy();
    expect(
      dialog.getByText(
        'Tidak muncul di pilihan pelaksana layanan Operational. Jabatan belum diatur.',
      ),
    ).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Nama tampilan'), { target: { value: ' Sari ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith({
      displayName: 'Sari',
      positionId: null,
      servicePerformerEligible: true,
      productSalesEligible: false,
    });
  });

  it('edits without touching eligibility and explains a blocking position', async () => {
    const { api, dialog } = renderEditor(existing);

    expect(dialog.getByText('EMP-000001')).toBeTruthy();
    expect((dialog.getByLabelText('Kode karyawan') as HTMLInputElement).disabled).toBe(true);
    await waitFor(() =>
      expect(
        dialog.getByText(
          'Tidak muncul di pilihan pelaksana layanan Operational. Jabatan tidak mengizinkan penugasan layanan.',
        ),
      ).toBeTruthy(),
    );
    fireEvent.change(dialog.getByLabelText('Nama tampilan'), { target: { value: 'Andini P' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const [, payload] = api.update.mock.calls[0] as unknown as [EmployeeDetail, object];
    expect(payload).toEqual({ displayName: 'Andini P', joinedOn: null });
  });

  it('turning Service work off sends only that eligibility', async () => {
    const { api, dialog } = renderEditor({
      ...existing,
      positionId: stylist.id,
      position: stylist,
      canPerformServices: true,
    });

    expect(dialog.getByText('Muncul di pilihan pelaksana layanan Operational.')).toBeTruthy();
    fireEvent.click(dialog.getByRole('checkbox', { name: /pelaksana layanan/i }));
    expect(
      dialog.getByText(
        'Tidak muncul di pilihan pelaksana layanan Operational. Belum diaktifkan sebagai pelaksana layanan.',
      ),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    const [, payload] = api.update.mock.calls[0] as unknown as [EmployeeDetail, object];
    expect(payload).toMatchObject({ servicePerformerEligible: false });
    expect(payload).not.toHaveProperty('productSalesEligible');
  });
});
