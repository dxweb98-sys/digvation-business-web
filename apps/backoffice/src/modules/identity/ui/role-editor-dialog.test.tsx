import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { AccessPermission, AccessRole } from '../access-control-api';
import { RoleEditorDialog } from './role-editor-dialog';

vi.mock('../../../auth/backoffice-auth-context', () => ({
  isSessionExpiredError: () => false,
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const permission = (
  key: string,
  area: string,
  surface: AccessPermission['surface'],
  label: string,
): AccessPermission => ({
  key,
  label: { id: label, en: label },
  product: 'POS',
  capability: null,
  foundation: null,
  section: { key: 'POS', label: { id: 'POS', en: 'POS' }, order: 10 },
  businessArea: { key: area, label: { id: area, en: area }, order: area === 'USERS' ? 10 : 20 },
  surface,
  configurable: true,
  order: 10,
});

const permissions = [
  permission('users:read', 'USERS', 'BACKOFFICE', 'Lihat pengguna'),
  permission('users:update', 'USERS', 'BACKOFFICE', 'Ubah pengguna'),
  permission('sales:read', 'SALES', 'BOTH', 'Lihat penjualan'),
  permission('sales:create', 'SALES', 'OPERATIONAL', 'Buat penjualan'),
];

const role = (overrides: Partial<AccessRole> = {}): AccessRole => ({
  id: 'r-1',
  code: 'MANAGER',
  name: 'Manager',
  status: 'ACTIVE',
  systemKey: null,
  version: 3,
  permissions: ['users:read'],
  ...overrides,
});

function renderEditor(target: AccessRole | null, api: Record<string, unknown> = {}) {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <BackofficeLocalizationProvider>
          <RoleEditorDialog
            role={target}
            permissions={permissions}
            api={api as never}
            canUpdate
            canManagePermissions
            onClose={onClose}
            onChanged={onChanged}
          />
        </BackofficeLocalizationProvider>
      </DToastProvider>
    </DeploymentBootstrapProvider>,
  );
  return { onClose, onChanged };
}

const text = () => document.body.textContent ?? '';
const button = (name: string | RegExp) =>
  [...document.body.querySelectorAll('button')].find((node) =>
    typeof name === 'string' ? node.textContent === name : name.test(node.textContent ?? ''),
  ) as HTMLButtonElement;
const checkbox = (label: string) =>
  [...document.body.querySelectorAll('label')]
    .find((node) => node.textContent?.includes(label))
    ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
const tab = (name: string) =>
  [...document.body.querySelectorAll('[role="tab"]')].find((node) =>
    node.textContent?.startsWith(name),
  ) as HTMLElement;
const press = async (node: HTMLElement) => {
  await act(async () => {
    fireEvent.click(node);
  });
};

afterEach(cleanup);

describe('RoleEditorDialog', () => {
  it('shows one category at a time with selected/total counts and switches category', async () => {
    renderEditor(role());
    expect(text()).toContain('1/4 izin berbeda dipilih');
    // The first category is open; the other category is one click away.
    expect(checkbox('Lihat pengguna').checked).toBe(true);
    expect(checkbox('Lihat penjualan')).toBeFalsy();
    await press(button(/^SALES/));
    expect(checkbox('Lihat penjualan')).toBeTruthy();
    expect(checkbox('Lihat pengguna')).toBeFalsy();
  });

  it('finds permissions across categories and keeps the original permission keys on save', async () => {
    const updateRole = vi.fn();
    const replacePermissions = vi.fn().mockResolvedValue({});
    const { onChanged } = renderEditor(role(), { updateRole, replacePermissions });
    const search = document.body.querySelector('input[type="search"]')!;
    fireEvent.change(search, { target: { value: 'sales:' } });
    await waitFor(() => expect(text()).toContain('Lihat penjualan'));
    // Result context: matches are counted per area; the other area is one tab away.
    expect(text()).toContain('Backoffice: 1');
    expect(text()).toContain('Operational: 2');
    expect(text()).not.toContain('Ubah pengguna');
    await press(tab('Operational'));
    expect(text()).toContain('Buat penjualan');
    fireEvent.click(checkbox('Buat penjualan'));
    await press(button('Simpan peran'));
    await waitFor(() => expect(replacePermissions).toHaveBeenCalledTimes(1));
    const [, keys] = replacePermissions.mock.calls[0] as [AccessRole, string[]];
    expect([...keys].sort()).toEqual(['sales:create', 'users:read']);
    expect(updateRole).not.toHaveBeenCalled();
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('selects and clears every permission of a category', async () => {
    renderEditor(role({ permissions: [] }));
    await press(button(/^Pilih kategori ini/));
    expect(checkbox('Lihat pengguna').checked).toBe(true);
    expect(checkbox('Ubah pengguna').checked).toBe(true);
    expect(text()).toContain('2/4 izin berbeda dipilih');
    await press(button(/^Kosongkan kategori ini/));
    expect(text()).toContain('0/4 izin berbeda dipilih');
  });

  it('keeps the selection when switching area and counts a shared permission once', async () => {
    renderEditor(role({ permissions: [] }));
    // sales:read applies to both areas: ticking it in Backoffice keeps it ticked in Operational.
    await press(tab('Operational'));
    expect(checkbox('Lihat penjualan')).toBeTruthy();
    fireEvent.click(checkbox('Lihat penjualan'));
    expect(text()).toContain('1/4 izin berbeda dipilih');
    await press(tab('Backoffice'));
    await press(button(/^SALES/));
    expect(checkbox('Lihat penjualan').checked).toBe(true);
    expect(text()).toContain('1/4 izin berbeda dipilih');
    // Per-area counts: 1 distinct key selected in each of the two areas.
    expect(tab('Backoffice').textContent).toContain('1/3');
    expect(tab('Operational').textContent).toContain('1/2');
  });

  it('limits bulk selection to the open category or the filtered results, and says which', async () => {
    renderEditor(role({ permissions: [] }));
    const search = document.body.querySelector('input[type="search"]')!;
    fireEvent.change(search, { target: { value: 'pengguna' } });
    await waitFor(() => expect(button(/^Pilih semua hasil/)).toBeTruthy());
    expect(button(/^Pilih semua hasil/).getAttribute('aria-label')).toContain('Hasil');
    await press(button(/^Pilih semua hasil/));
    expect(text()).toContain('2/4 izin berbeda dipilih');
    // Nothing outside the filtered results was touched.
    fireEvent.change(search, { target: { value: '' } });
    await press(tab('Operational'));
    expect(checkbox('Buat penjualan').checked).toBe(false);
  });

  it('previews the generated role code and keeps manual editing separate', async () => {
    renderEditor(null);
    const name = document.body.querySelector('input') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Kasir Senior' } });
    await waitFor(() => expect(text()).toContain('Pratinjau kode peran'));
    expect(text()).toContain('KASIR_SENIOR');
    expect(text()).not.toContain('Kosongkan untuk memakai');
    await press(button('Ubah kode'));
    expect(text()).toContain('Kode peran kustom');
    expect(text()).toContain('Gunakan kode otomatis');
  });

  it('asks before discarding unsaved changes and keeps editing on request', async () => {
    const { onClose } = renderEditor(role());
    await press(button('Batal'));
    expect(onClose).toHaveBeenCalledTimes(1);

    cleanup();
    const second = renderEditor(role());
    fireEvent.click(checkbox('Ubah pengguna'));
    await press(button('Batal'));
    expect(second.onClose).not.toHaveBeenCalled();
    expect(text()).toContain('Buang perubahan?');
    await press(button('Lanjutkan mengedit'));
    expect(second.onClose).not.toHaveBeenCalled();
    await press(button('Batal'));
    await press(button('Buang'));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a system role immutable: summary first, details read only, no save', async () => {
    const replacePermissions = vi.fn();
    renderEditor(
      role({ code: 'OWNER', name: 'Owner', systemKey: 'OWNER', permissions: ['users:read'] }),
      { replacePermissions },
    );
    expect(text()).toContain('1/3 izin');
    expect(button('Simpan peran')).toBeUndefined();
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull();
    await press(button('Lihat detail izin'));
    const box = checkbox('Lihat pengguna');
    expect(box.checked).toBe(true);
    expect(box.disabled).toBe(true);
    expect(button('Pilih semua')).toBeUndefined();
    expect(replacePermissions).not.toHaveBeenCalled();
  });
});

describe('RoleEditorDialog new role code', () => {
  const fillName = (value: string) => {
    const input = [...document.body.querySelectorAll('input')].find(
      (node) => node.getAttribute('type') !== 'search' && node.type === 'text',
    )!;
    fireEvent.change(input, { target: { value } });
  };

  it('generates the role code from the name and sends it without asking for one', async () => {
    const createRole = vi.fn().mockResolvedValue({});
    renderEditor(null, { createRole });
    fillName('Kasir Senior');
    expect(text()).toContain('KASIR_SENIOR');
    fireEvent.click(checkbox('Lihat pengguna'));
    await press(button('Simpan peran'));
    await waitFor(() => expect(createRole).toHaveBeenCalledTimes(1));
    expect(createRole).toHaveBeenCalledWith({
      code: 'KASIR_SENIOR',
      name: 'Kasir Senior',
      permissions: ['users:read'],
    });
  });

  it('shows a collision under the advanced code field and keeps the dialog open', async () => {
    const createRole = vi.fn().mockRejectedValue({ status: 409, code: 'DUPLICATE_RESOURCE' });
    const { onClose } = renderEditor(null, { createRole });
    fillName('Manager');
    await press(button('Simpan peran'));
    await waitFor(() => expect(text()).toContain('sudah ada'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not accept the reserved OWNER code', async () => {
    const createRole = vi.fn();
    renderEditor(null, { createRole });
    fillName('Owner');
    await press(button('Simpan peran'));
    expect(createRole).not.toHaveBeenCalled();
    expect(text()).toContain('dicadangkan');
  });
});
