import { DToastProvider } from '@digvation/ui';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    openingPoints: '0.0000',
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

function renderDialog(
  result: MemberImportPreview,
  {
    openingPointsAvailable = true,
    openingBalanceMemberCount = 0,
    openingBalancePointsTotal = '0.0000',
  } = {},
) {
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
        openingBalanceMemberCount,
        openingBalancePointsTotal,
      },
    }),
  };
  const onImported = vi.fn();
  const onClose = vi.fn();
  render(
    <DToastProvider>
      <MemberImportDialog
        api={api}
        openingPointsAvailable={openingPointsAvailable}
        onImported={onImported}
        onClose={onClose}
      />
    </DToastProvider>,
  );
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
    // No opening balance imported: the point tiles stay out of the way.
    expect(screen.queryByText('Member dengan saldo awal')).toBeNull();
    expect(screen.queryByText('Total poin awal')).toBeNull();
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

  describe('Poin Awal', () => {
    it('shows a Poin Awal column: quiet for blank/zero, visible for a positive balance', async () => {
      renderDialog(
        preview([
          previewRow({ rowNumber: 2, openingPoints: '0.0000' }),
          previewRow({ rowNumber: 3, name: 'Budi', openingPoints: '1250.5000' }),
        ]),
      );
      chooseFile(workbook());
      fireEvent.click(button('Validasi'));

      expect(await screen.findByRole('columnheader', { name: 'Poin Awal' })).toBeTruthy();
      const positive = screen.getByText('1.250,5');
      expect(positive.className).toContain('font-semibold');
      const zeroRow = screen.getAllByRole('row')[1]!;
      expect(zeroRow.textContent).toContain('Ayu');
      expect(within(zeroRow).getByText('0').className).toContain('italic');
      expect(button('Import').disabled).toBe(false);
    });

    it('shows a Poin Awal error and keeps Import disabled', async () => {
      renderDialog(
        preview([
          previewRow({
            openingPoints: '-10',
            action: null,
            errors: [
              {
                field: 'openingPoints',
                code: 'OPENING_POINTS_NEGATIVE',
                message: 'Opening points cannot be negative',
              },
            ],
          }),
        ]),
      );
      chooseFile(workbook());
      fireEvent.click(button('Validasi'));

      expect(await screen.findByText('Poin Awal tidak boleh negatif.')).toBeTruthy();
      expect(screen.getByText('-10')).toBeTruthy();
      expect(button('Import').disabled).toBe(true);
    });

    it('explains a Runtime authority rejection of opening points', async () => {
      renderDialog(
        preview([
          previewRow({
            openingPoints: '500.0000',
            action: null,
            errors: [
              {
                field: 'openingPoints',
                code: 'LOYALTY_OPENING_BALANCE_NOT_PERMITTED',
                message: 'Importing opening points requires permission to manage Loyalty',
              },
            ],
          }),
        ]),
        { openingPointsAvailable: false },
      );
      chooseFile(workbook());
      fireEvent.click(button('Validasi'));

      expect(
        await screen.findByText('Import Poin Awal memerlukan izin mengelola Loyalty.'),
      ).toBeTruthy();
      expect(button('Import').disabled).toBe(true);
    });

    it('hints, without hiding import, when opening points are unavailable', () => {
      renderDialog(preview([previewRow()]), { openingPointsAvailable: false });
      expect(
        screen.getByText(
          'Poin Awal memerlukan fitur Poin Loyalty dan izin mengelola Loyalty. Kosongkan kolom tersebut atau isi 0.',
        ),
      ).toBeTruthy();
      expect(button('Unduh template').disabled).toBe(false);
    });

    it('does not show the hint when opening points are available', () => {
      renderDialog(preview([previewRow()]));
      expect(screen.queryByText(/Poin Awal memerlukan fitur Poin Loyalty/)).toBeNull();
    });

    it('summarizes imported opening balances', async () => {
      renderDialog(preview([previewRow({ openingPoints: '18750.0000' })]), {
        openingBalanceMemberCount: 23,
        openingBalancePointsTotal: '18750.0000',
      });
      chooseFile(workbook());
      fireEvent.click(button('Validasi'));
      await screen.findByText('Semua baris valid. Import akan menyimpan semua baris sekaligus.');
      fireEvent.click(button('Import'));

      expect(await screen.findByText('Import berhasil')).toBeTruthy();
      expect(screen.getByText('Member dengan saldo awal').nextSibling?.textContent).toBe('23');
      expect(screen.getByText('Total poin awal').nextSibling?.textContent).toBe('18.750');
    });
  });
});

describe('MemberImportDialog existing Members', () => {
  const existingRow = previewRow({
    name: 'Ani',
    phone: '+6281234567890',
    openingPoints: '150.0000',
    action: 'ADD_POINTS_TO_EXISTING_MEMBER',
    existingMember: {
      membershipId: 'm-1',
      memberNumber: 'MBR-000007',
      name: 'Ani Wijaya',
      phone: '+6281234567890',
      status: 'ACTIVE',
      currentPoints: '300.0000',
      resultingPoints: '450.0000',
    },
    warnings: [
      {
        field: 'row',
        code: 'EXISTING_MEMBER_DATA_DIFFERS',
        message: 'The file data differs from the current member.',
      },
    ],
  });

  beforeEach(() => localStorage.clear());

  it('shows an existing Member as importable with current, imported and resulting points', async () => {
    const { api } = renderDialog(preview([existingRow, previewRow({ rowNumber: 3 })]));
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));

    expect(await screen.findByText('Member sudah ada')).toBeTruthy();
    // Canonical profile is shown, not the file's name.
    expect(screen.getByText('Ani Wijaya')).toBeTruthy();
    expect(screen.queryByText('Ani')).toBeNull();
    const row = screen.getByText('Ani Wijaya').closest('tr') as HTMLElement;
    expect(within(row).getByText('Saat ini').nextSibling?.textContent).toBe('300');
    expect(within(row).getByText('Dari import').nextSibling?.textContent).toBe('+150');
    expect(within(row).getByText('Hasil').nextSibling?.textContent).toBe('450');
    // Informational, not a failure.
    expect(
      within(row).getByText(
        'Data pada file berbeda dengan data member saat ini. Data member yang sudah ada akan dipertahankan.',
      ),
    ).toBeTruthy();
    expect(button('Import').disabled).toBe(false);
    expect(api.importMembers).not.toHaveBeenCalled();
  });

  it('does not count an existing Member under errors', async () => {
    renderDialog(preview([existingRow]));
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    await screen.findByText('Member sudah ada');
    expect(
      screen.queryByText('Semua baris valid. Import akan menyimpan semua baris sekaligus.'),
    ).not.toBeNull();
  });

  it('shows an already-imported member as skipped with previous and file points, not as an error', async () => {
    const skipped = previewRow({
      name: 'Ani',
      openingPoints: '150.0000',
      action: 'SKIP_ALREADY_IMPORTED',
      existingMember: {
        membershipId: 'm-1',
        memberNumber: 'MBR-000007',
        name: 'Ani Wijaya',
        phone: '+6281234567890',
        status: 'ACTIVE',
        currentPoints: '450.0000',
        resultingPoints: '450.0000',
        previousImportPoints: '150.0000',
      },
      warnings: [
        {
          field: 'openingPoints',
          code: 'IMPORT_POINTS_ALREADY_APPLIED',
          message: 'already',
        },
      ],
    });
    renderDialog(preview([skipped]));
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));

    expect(await screen.findByText('Sudah pernah diimport')).toBeTruthy();
    const row = screen.getByText('Ani Wijaya').closest('tr') as HTMLElement;
    expect(within(row).getByText('Poin import sebelumnya').nextSibling?.textContent).toBe('150');
    expect(within(row).getByText('Poin pada file ini').nextSibling?.textContent).toBe('150');
    expect(within(row).getByText('Poin tidak akan ditambahkan kembali.')).toBeTruthy();
    expect(within(row).queryByText('Dari import')).toBeNull();
    expect(button('Import').disabled).toBe(false);
  });
});

describe('MemberImportDialog operation feedback', () => {
  const READY = 'Validasi selesai. Data siap diimpor.';
  const NEEDS_FIX = 'Validasi selesai. Ada data yang perlu diperbaiki sebelum impor.';

  it('confirms a successful validation with a success toast', async () => {
    renderDialog(preview([previewRow()]));
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    expect(await screen.findByText(READY)).toBeTruthy();
    expect(screen.queryByText(NEEDS_FIX)).toBeNull();
  });

  it('warns, keeping the row errors visible, when validation finds problems', async () => {
    renderDialog(
      preview([
        previewRow({
          action: null,
          errors: [{ field: 'phone', code: 'PHONE_INVALID', message: 'bad' }],
        }),
      ]),
    );
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    expect(await screen.findByText(NEEDS_FIX)).toBeTruthy();
    expect(screen.queryByText(READY)).toBeNull();
    expect(screen.getByText('No. HP tidak valid, contoh 081234567890.')).toBeTruthy();
    expect(button('Import').disabled).toBe(true);
  });

  it('shows the API failure as an error and no validation success or warning', async () => {
    const { api } = renderDialog(preview([previewRow()]));
    api.previewImport.mockRejectedValueOnce(
      Object.assign(new Error('x'), { status: 503, code: 'SERVICE_UNAVAILABLE' }),
    );
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    expect(
      await screen.findByText('Layanan sedang tidak tersedia. Coba beberapa saat lagi.'),
    ).toBeTruthy();
    expect(screen.queryByText(READY)).toBeNull();
    expect(screen.queryByText(NEEDS_FIX)).toBeNull();
  });

  it('confirms a completed import with the processed row count', async () => {
    renderDialog(preview([previewRow(), previewRow({ rowNumber: 3, name: 'Budi' })]));
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    await screen.findByText(READY);
    fireEvent.click(button('Import'));
    expect(await screen.findByText('Import member berhasil. 2 data diproses.')).toBeTruthy();
  });

  it('never reports success when Runtime rejects the import', async () => {
    const { api } = renderDialog(preview([previewRow()]));
    api.importMembers.mockResolvedValueOnce({
      outcome: 'REJECTED',
      preview: preview([
        previewRow({
          action: null,
          errors: [{ field: 'phone', code: 'CUSTOMER_AMBIGUOUS', message: 'x' }],
        }),
      ]),
      summary: null,
    });
    chooseFile(workbook());
    fireEvent.click(button('Validasi'));
    await screen.findByText(READY);
    fireEvent.click(button('Import'));
    expect(
      await screen.findByText(
        'Import tidak dilakukan. Data berubah atau tidak lagi valid; tidak ada data yang disimpan.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Import member berhasil/)).toBeNull();
    expect(screen.queryByText('Import berhasil')).toBeNull();
  });

  it('ignores repeated clicks while validation and import are in flight', async () => {
    const { api } = renderDialog(preview([previewRow()]));
    let finishPreview: (value: MemberImportPreview) => void = () => undefined;
    api.previewImport.mockReturnValueOnce(
      new Promise<MemberImportPreview>((resolve) => (finishPreview = resolve)),
    );
    chooseFile(workbook());
    const validate = button('Validasi');
    fireEvent.click(validate);
    fireEvent.click(validate);
    fireEvent.click(validate);
    expect(button('Memvalidasi…').disabled).toBe(true);
    expect(api.previewImport).toHaveBeenCalledTimes(1);
    finishPreview(preview([previewRow()]));
    await screen.findByText(READY);

    let finishImport: (value: unknown) => void = () => undefined;
    api.importMembers.mockReturnValueOnce(new Promise((resolve) => (finishImport = resolve)));
    const run = button('Import');
    fireEvent.click(run);
    fireEvent.click(run);
    expect(button('Mengimpor…').disabled).toBe(true);
    expect(api.importMembers).toHaveBeenCalledTimes(1);
    finishImport({
      outcome: 'IMPORTED',
      preview: preview([previewRow()]),
      summary: {
        importedCount: 1,
        createdCustomerCount: 1,
        enrolledExistingCustomerCount: 0,
        generatedMemberNumberCount: 1,
        preservedMemberNumberCount: 0,
        openingBalanceMemberCount: 0,
        openingBalancePointsTotal: '0.0000',
      },
    });
    expect(await screen.findByText('Import member berhasil. 1 data diproses.')).toBeTruthy();
  });
});
