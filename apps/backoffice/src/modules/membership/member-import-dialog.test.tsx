import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemberImportDialog } from './member-import-dialog';
import type { MemberImportPreview, MemberImportRow } from './members-api';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function previewRow(overrides: Partial<MemberImportRow> = {}): MemberImportRow {
  return {
    rowNumber: 2,
    name: 'Ayu',
    phone: '+6281234567890',
    memberNumber: null,
    status: 'ACTIVE',
    joinedDate: null,
    action: 'CREATE_CUSTOMER_AND_MEMBERSHIP',
    errors: [],
    warnings: [],
    ...overrides,
  };
}

function preview(rows: MemberImportRow[]): MemberImportPreview {
  const errorRows = rows.filter((row) => row.errors.length).length;
  return {
    totalRows: rows.length,
    validRows: rows.length - errorRows,
    errorRows,
    warningRows: rows.filter((row) => row.warnings.length).length,
    canImport: errorRows === 0,
    rows,
  };
}

const workbook = (name = 'members.xlsx') =>
  new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], name, { type: XLSX });

function renderDialog(result: MemberImportPreview) {
  const api = {
    importTemplate: vi.fn().mockResolvedValue(new Blob(['x'])),
    previewImport: vi.fn().mockResolvedValue(result),
    importMembers: vi.fn().mockResolvedValue({
      outcome: 'IMPORTED',
      preview: result,
      summary: {
        importedCount: 3,
        createdCustomerCount: 2,
        enrolledExistingCustomerCount: 1,
        generatedMemberNumberCount: 2,
        preservedMemberNumberCount: 1,
      },
    }),
  };
  const onImported = vi.fn();
  const onClose = vi.fn();
  render(<MemberImportDialog api={api} onImported={onImported} onClose={onClose} />);
  return { api, onImported, onClose };
}

const chooseFile = (file: File) =>
  fireEvent.change(screen.getByLabelText('Pilih file .xlsx'), { target: { files: [file] } });
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:template');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe('MemberImportDialog', () => {
  it('downloads the blank template through the authenticated API client', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { api } = renderDialog(preview([previewRow()]));
    fireEvent.click(button('Unduh template'));
    await waitFor(() => expect(api.importTemplate).toHaveBeenCalledOnce());
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    click.mockRestore();
  });

  it('accepts an .xlsx file and shows its name and size', () => {
    renderDialog(preview([previewRow()]));
    expect(button('Validasi').disabled).toBe(true);
    chooseFile(workbook());
    expect(screen.getByText('members.xlsx')).toBeTruthy();
    expect(button('Validasi').disabled).toBe(false);
  });

  it.each(['members.xls', 'members.csv'])('rejects %s before any upload', (name) => {
    const { api } = renderDialog(preview([previewRow()]));
    chooseFile(workbook(name));
    expect(screen.getByRole('alert').textContent).toBe('Pilih file Excel dengan format .xlsx.');
    expect(button('Validasi').disabled).toBe(true);
    expect(api.previewImport).not.toHaveBeenCalled();
  });

  it('renders the Runtime preview summary, row errors, and keeps Import disabled', async () => {
    const { api } = renderDialog(
      preview([
        previewRow({
          rowNumber: 2,
          action: null,
          errors: [
            {
              field: 'phone',
              code: 'PHONE_DUPLICATE_IN_FILE',
              message: 'The same phone number is also in row 3',
              relatedRows: [3],
            },
          ],
        }),
        previewRow({ rowNumber: 3, name: 'Budi', memberNumber: 'MBR-000500' }),
      ]),
    );
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));

    expect(await screen.findByText('No. HP yang sama juga ada di baris 3.')).toBeTruthy();
    expect(api.previewImport).toHaveBeenCalledWith(expect.any(File));
    expect(screen.getByText('Total baris').nextSibling?.textContent).toBe('2');
    expect(
      screen.getByText('Perbaiki baris bertanda error di file, lalu validasi ulang.'),
    ).toBeTruthy();
    // Canonical phones are presented nationally and blank numbers as automatic.
    expect(screen.getAllByText('081234567890').length).toBe(2);
    expect(screen.getByText('MBR-000500')).toBeTruthy();
    expect(button('Import').disabled).toBe(true);
    fireEvent.click(button('Import'));
    expect(api.importMembers).not.toHaveBeenCalled();
  });

  it('keeps warnings distinct from errors and allows import', async () => {
    renderDialog(
      preview([
        previewRow({
          action: 'ENROLL_EXISTING_CUSTOMER',
          warnings: [
            {
              field: 'phone',
              code: 'EXISTING_CUSTOMER_ENROLLED',
              message: 'An existing customer with this phone number will be enrolled as a Member',
            },
          ],
        }),
      ]),
    );
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));

    expect(
      await screen.findByText('Pelanggan yang sudah ada dengan No. HP ini akan dijadikan member.'),
    ).toBeTruthy();
    expect(screen.getByText('Pelanggan lama jadi member')).toBeTruthy();
    expect(screen.getByText('Error').nextSibling?.textContent).toBe('0');
    expect(button('Import').disabled).toBe(false);
  });

  it('imports, refreshes the Member list and shows the summary', async () => {
    const { api, onImported } = renderDialog(preview([previewRow()]));
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    await screen.findByText('Semua baris valid. Import akan menyimpan semua baris sekaligus.');
    fireEvent.click(button('Import'));

    expect(await screen.findByText('Import berhasil')).toBeTruthy();
    expect(api.importMembers).toHaveBeenCalledWith(expect.any(File));
    expect(onImported).toHaveBeenCalledOnce();
    expect(screen.getByText('Nomor member lama dipertahankan').nextSibling?.textContent).toBe('1');
  });

  it('shows the re-validated rows and does not refresh when Runtime rejects at import', async () => {
    const valid = preview([previewRow()]);
    const { api, onImported } = renderDialog(valid);
    api.importMembers.mockResolvedValueOnce({
      outcome: 'REJECTED',
      preview: preview([
        previewRow({
          action: null,
          errors: [
            {
              field: 'phone',
              code: 'PHONE_MEMBER_EXISTS',
              message: 'A Member already uses this phone number',
            },
          ],
        }),
      ]),
      summary: null,
    });
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    await screen.findByText('Semua baris valid. Import akan menyimpan semua baris sekaligus.');
    fireEvent.click(button('Import'));

    expect(
      await screen.findByText(
        'Data berubah sejak validasi. Tidak ada data yang disimpan; periksa baris berikut.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('No. HP ini sudah dipakai member lain.')).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
    expect(button('Import').disabled).toBe(true);
  });
});
