import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FinancialAccount } from '../api/financial-accounts-api';
import { FinancialAccountDetailDialog } from './financial-account-detail-dialog';
import { FinancialAccountDialog } from './financial-account-dialog';
import {
  fakeFinancialAccountsApi,
  renderWithProviders,
  testAccount,
} from './financial-accounts-test-harness';

vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
  isSessionExpiredError: () => false,
}));

afterEach(cleanup);

function renderEditor(account: FinancialAccount | null, api = fakeFinancialAccountsApi()) {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn() };
  renderWithProviders(<FinancialAccountDialog account={account} api={api} {...handlers} />);
  return { api, ...handlers, dialog: within(screen.getByRole('dialog')) };
}

const saveButton = () => screen.getByRole('button', { name: 'Simpan' });

async function chooseType(dialog: ReturnType<typeof within>, label: string) {
  fireEvent.click(dialog.getByRole('button', { name: /Jenis akun/ }));
  fireEvent.click(await screen.findByRole('option', { name: label }));
}

describe('FinancialAccountDialog', () => {
  it('uses the Backoffice dialog hierarchy with an optional code and Batal / Simpan footer', () => {
    const { dialog } = renderEditor(null);

    expect(dialog.getByText('Tambah akun')).toBeTruthy();
    expect(dialog.getByText('Identitas akun')).toBeTruthy();
    expect(dialog.getByText('Detail tujuan')).toBeTruthy();
    expect(dialog.getByText('Kosongkan untuk membuat kode otomatis.')).toBeTruthy();
    const buttons = dialog.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Batal')).toBeLessThan(buttons.indexOf('Simpan'));
  });

  it('saves with a blank code so Runtime generates it', async () => {
    const { api, onSaved, dialog } = renderEditor(null);

    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(dialog.getByLabelText('Nama akun'), { target: { value: ' Kas Utama ' } });
    expect(saveButton().hasAttribute('disabled')).toBe(false);
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.createAccount).toHaveBeenCalledTimes(1));
    expect(api.createAccount).toHaveBeenCalledWith({
      name: 'Kas Utama',
      type: 'CASH',
      currency: 'IDR',
      institutionName: null,
      accountReference: null,
      accountHolderName: null,
    });
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACC-000001' })),
    );
  });

  it('sends a normalized custom code', async () => {
    const { api, dialog } = renderEditor(null);

    fireEvent.change(dialog.getByLabelText('Kode akun'), {
      target: { value: 'smoke_bank_custom' },
    });
    fireEvent.change(dialog.getByLabelText('Nama akun'), { target: { value: 'Kas Smoke' } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SMOKE_BANK_CUSTOM' }),
      ),
    );
  });

  it('shows the Runtime reservation of generated codes on the code field', async () => {
    const api = fakeFinancialAccountsApi();
    api.createAccount.mockRejectedValueOnce({ status: 400, code: 'DOMAIN_VALIDATION_ERROR' });
    const { dialog, onClose } = renderEditor(null, api);

    fireEvent.change(dialog.getByLabelText('Kode akun'), { target: { value: 'ACC-000123' } });
    fireEvent.change(dialog.getByLabelText('Nama akun'), { target: { value: 'Kas' } });
    fireEvent.click(saveButton());

    expect(
      await screen.findByText('Format kode ini khusus untuk kode otomatis. Gunakan kode lain.'),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(saveButton().hasAttribute('disabled')).toBe(true);
  });

  it('collects QRIS provider and merchant reference before saving a QRIS account', async () => {
    const { api, dialog } = renderEditor(null);

    await chooseType(dialog, 'Akun QRIS');
    expect(dialog.getByLabelText('Penyedia / institusi QRIS')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText('Nama akun'), { target: { value: 'QRIS Toko' } });
    expect(saveButton().hasAttribute('disabled')).toBe(true);
    fireEvent.change(dialog.getByLabelText('Penyedia / institusi QRIS'), {
      target: { value: 'BCA' },
    });
    fireEvent.change(dialog.getByLabelText('Merchant ID / referensi QRIS'), {
      target: { value: 'ID1023456789' },
    });
    fireEvent.change(dialog.getByLabelText('Nama merchant (opsional)'), {
      target: { value: 'Toko Maju' },
    });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(api.createAccount).toHaveBeenCalledWith({
        name: 'QRIS Toko',
        type: 'QRIS',
        currency: 'IDR',
        institutionName: 'BCA',
        accountReference: 'ID1023456789',
        accountHolderName: 'Toko Maju',
      }),
    );
  });

  it('locks code, type, and currency when editing and sends only mutable fields', async () => {
    const account = testAccount('BANK', { code: 'MAIN_BANK', version: 5 });
    const { api, dialog } = renderEditor(account);

    expect(dialog.getByText('Ubah akun')).toBeTruthy();
    expect(dialog.getByText('MAIN_BANK')).toBeTruthy();
    expect(dialog.getByLabelText('Kode akun').hasAttribute('disabled')).toBe(true);
    expect(dialog.getByLabelText('Mata uang').hasAttribute('disabled')).toBe(true);
    fireEvent.change(dialog.getByLabelText('Nama akun'), { target: { value: 'Bank Utama' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.updateAccount).toHaveBeenCalledTimes(1));
    expect(api.updateAccount).toHaveBeenCalledWith(account, {
      name: 'Bank Utama',
      institutionName: 'BCA',
      accountReference: 'ID1023456789',
      accountHolderName: 'Toko Maju',
    });
  });

  it('shows a legacy account without a code quietly in the title', () => {
    const { dialog } = renderEditor(testAccount('CASH', { code: null }));

    expect(dialog.getByText('—')).toBeTruthy();
    expect(dialog.queryByText('null')).toBeNull();
  });
});

describe('FinancialAccountDetailDialog', () => {
  function renderDetail(account: FinancialAccount, canUpdate = true) {
    const handlers = { onClose: vi.fn(), onEdit: vi.fn() };
    renderWithProviders(
      <FinancialAccountDetailDialog account={account} canUpdate={canUpdate} {...handlers} />,
    );
    return { ...handlers, dialog: within(screen.getByRole('dialog')) };
  }

  it('shows QRIS identity, destination, and merchant labels in information tiles', () => {
    const account = testAccount('QRIS', { code: 'ACC-000007' });
    const { dialog, onEdit } = renderDetail(account);

    expect(dialog.getByText('Detail akun keuangan')).toBeTruthy();
    expect(dialog.getByRole('heading', { name: 'Akun QRIS' })).toBeTruthy();
    expect(dialog.getAllByText('ACC-000007').length).toBeGreaterThan(0);
    expect(dialog.getByText('Aktif')).toBeTruthy();
    expect(dialog.getByText('Detail QRIS')).toBeTruthy();
    expect(dialog.getByText('Penyedia / institusi QRIS')).toBeTruthy();
    expect(dialog.getByText('Merchant ID / referensi QRIS')).toBeTruthy();
    expect(dialog.getByText('Nama merchant')).toBeTruthy();
    expect(dialog.getByText('Toko Maju')).toBeTruthy();
    expect(dialog.getAllByText('IDR').length).toBeGreaterThan(0);

    fireEvent.click(dialog.getByRole('button', { name: 'Ubah akun' }));
    expect(onEdit).toHaveBeenCalledWith(account);
  });

  it('renders a legacy null code and absent holder as a quiet dash', () => {
    const { dialog } = renderDetail(
      testAccount('BANK', { code: null, accountHolderName: null }),
      false,
    );

    expect(dialog.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(dialog.queryByText('null')).toBeNull();
    expect(dialog.queryByRole('button', { name: 'Ubah akun' })).toBeNull();
  });
});
