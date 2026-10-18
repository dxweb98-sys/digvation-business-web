import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../../app/localization/backoffice-localization-base';
import type { Category } from '../../api/catalog-api';
import { CatalogCategoryDialog } from './catalog-category-dialog';

vi.mock('../../../../auth/backoffice-auth-context', () => ({
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

const existing: Category = {
  id: 'cat-1',
  code: 'CAT-000001',
  name: 'Minuman',
  status: 'ACTIVE',
  version: 4,
};

function fakeApi() {
  return {
    createCategory: vi.fn(async () => existing),
    updateCategory: vi.fn(async () => existing),
  };
}

function renderDialog(
  category: Category | null,
  api = fakeApi(),
  handlers = { onClose: vi.fn(), onSaved: vi.fn() },
) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <DToastProvider>
          <CatalogCategoryDialog category={category} api={api} {...handlers} />
        </DToastProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
  return { api, ...handlers };
}

const nameInput = () => screen.getByLabelText('Nama kategori');
const codeInput = () => screen.getByLabelText('Kode kategori');
const saveButton = () => screen.getByRole('button', { name: 'Simpan' });

afterEach(cleanup);

describe('CatalogCategoryDialog', () => {
  it('keeps save disabled until a name is entered', () => {
    renderDialog(null);

    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(nameInput(), { target: { value: '   ' } });
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(nameInput(), { target: { value: 'Makanan' } });
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('creates a category without a code so Runtime generates one', async () => {
    const { api, onSaved, onClose } = renderDialog(null);

    expect(codeInput().hasAttribute('disabled')).toBe(false);
    fireEvent.change(nameInput(), { target: { value: ' Makanan ' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.createCategory).toHaveBeenCalledTimes(1));
    expect(api.createCategory).toHaveBeenCalledWith({ name: 'Makanan', status: 'ACTIVE' });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('creates a category with a normalized manual code', async () => {
    const { api } = renderDialog(null);

    fireEvent.change(codeInput(), { target: { value: ' mkn-01 ' } });
    fireEvent.change(nameInput(), { target: { value: 'Makanan' } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith({
        code: 'MKN-01',
        name: 'Makanan',
        status: 'ACTIVE',
      }),
    );
  });

  it('blocks an invalid manual code', () => {
    const { api } = renderDialog(null);

    fireEvent.change(codeInput(), { target: { value: 'kode salah' } });
    fireEvent.change(nameInput(), { target: { value: 'Makanan' } });

    expect(
      screen.getByText(
        'Gunakan huruf, angka, titik, garis bawah, atau tanda hubung, diawali huruf atau angka.',
      ),
    ).toBeTruthy();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.click(saveButton());
    expect(api.createCategory).not.toHaveBeenCalled();
  });

  it('edits the code with name and status against the loaded version', async () => {
    const { api, onSaved } = renderDialog(existing);

    expect(codeInput().hasAttribute('disabled')).toBe(false);
    expect((codeInput() as HTMLInputElement).value).toBe('CAT-000001');
    expect(screen.queryByText('Kode tidak dapat diubah setelah dibuat.')).toBeNull();
    fireEvent.change(codeInput(), { target: { value: ' mnm-01 ' } });
    fireEvent.change(nameInput(), { target: { value: 'Minuman Dingin' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledTimes(1));
    // `existing` carries version 4, which CatalogApi sends as expectedVersion.
    expect(api.updateCategory).toHaveBeenCalledWith(existing, {
      code: 'MNM-01',
      name: 'Minuman Dingin',
      status: 'ACTIVE',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('blocks clearing the code on edit', () => {
    const { api } = renderDialog(existing);

    fireEvent.change(codeInput(), { target: { value: '' } });

    expect(screen.getByText('Masukkan kode kategori.')).toBeTruthy();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    expect(api.updateCategory).not.toHaveBeenCalled();
  });

  it('shows a duplicate code from Runtime on the code field', async () => {
    const api = fakeApi();
    api.updateCategory.mockRejectedValueOnce({ status: 409, code: 'DUPLICATE_RESOURCE' });
    const { onClose } = renderDialog(existing, api);

    fireEvent.change(codeInput(), { target: { value: 'TAKEN-01' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText('Kode ini sudah digunakan kategori lain.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(codeInput(), { target: { value: 'FREE-01' } });
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('keeps the dialog open and reports a version conflict', async () => {
    const api = fakeApi();
    api.updateCategory.mockRejectedValueOnce({ status: 409, code: 'VERSION_CONFLICT' });
    const { onSaved, onClose } = renderDialog(existing, api);

    fireEvent.click(saveButton());

    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(saveButton().hasAttribute('disabled')).toBe(false);
  });

  it('cancels without saving', () => {
    const { api, onClose } = renderDialog(existing);

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.updateCategory).not.toHaveBeenCalled();
  });
});
