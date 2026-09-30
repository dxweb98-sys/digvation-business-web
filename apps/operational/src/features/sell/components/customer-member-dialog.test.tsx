import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@digvation/pos-api';
import type { CustomerMemberApi } from '../customer-member-api';
import { CustomerMemberDialog } from './customer-member-dialog';

vi.mock('../../../app/localization/operational-localization', () => ({
  useOperationalLocalization: () => ({ locale: 'id-ID' }),
}));

afterEach(cleanup);

const enrolled = {
  id: 'm1',
  customerId: 'c1',
  memberNumber: 'MBR-1',
  status: 'ACTIVE' as const,
  customer: { id: 'c1', name: 'Andir', phoneE164: '+628192381923', status: 'ACTIVE' as const },
};

type DialogProps = Partial<React.ComponentProps<typeof CustomerMemberDialog>>;

function renderDialog(initial: DialogProps = {}) {
  const api = {
    enrollNew: vi.fn().mockResolvedValue(enrolled),
    searchMembers: vi.fn().mockResolvedValue({ items: [enrolled] }),
    getPointBalance: vi.fn().mockResolvedValue({ membershipId: 'm1', pointsBalance: '120' }),
  };
  const onChoose = vi.fn();
  const client = new QueryClient();
  const element = (overrides: DialogProps) => (
    <QueryClientProvider client={client}>
      <CustomerMemberDialog
        open
        customer={null}
        isSaving={false}
        api={api as unknown as CustomerMemberApi}
        canReadMembers
        canEnrollMember
        canReadLoyalty
        onClose={vi.fn()}
        onChoose={onChoose}
        {...initial}
        {...overrides}
      />
    </QueryClientProvider>
  );
  const view = render(element({}));
  return {
    api,
    onChoose,
    client,
    update: (overrides: DialogProps) => view.rerender(element(overrides)),
  };
}

const name = () => screen.getByLabelText(/Nama/) as HTMLInputElement;
const phone = () => screen.getByLabelText(/Nomor WhatsApp/) as HTMLInputElement;
const nik = () => screen.getByLabelText(/NIK/) as HTMLInputElement;
const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });
const enrollButton = () =>
  screen.getByRole('button', { name: /Daftar & Pilih Member/ }) as HTMLButtonElement;
const openEnroll = () => fireEvent.click(screen.getByRole('tab', { name: /Daftar Member Baru/ }));

describe('Customer picker phone', () => {
  it('keeps the local number visible and submits canonical E.164 for a regular customer', () => {
    const { onChoose } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08192381923');
    expect(phone().value).toBe('08192381923');

    fireEvent.click(screen.getByRole('button', { name: 'Gunakan Pelanggan' }));
    expect(onChoose).toHaveBeenCalledWith({
      type: 'NON_MEMBER',
      name: 'Andir',
      phone: '+628192381923',
    });
  });

  it('does not submit a partial or empty phone', () => {
    const { onChoose } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08');
    const button = screen.getByRole('button', { name: 'Gunakan Pelanggan' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe('Member enrollment', () => {
  it('carries name and the local phone over from the regular customer form', () => {
    renderDialog();
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    expect(name().value).toBe('Andir');
    // Still the friendly local value, not silently rewritten to +62.
    expect(phone().value).toBe('08192381923');
  });

  it('submits the same canonical phone as a regular customer', async () => {
    const { api, onChoose } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    type(nik(), '1234567890123456');
    fireEvent.click(enrollButton());
    await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());
    expect(api.enrollNew).toHaveBeenCalledWith({
      name: 'Andir',
      phone: '+628192381923',
      nik: '1234567890123456',
    });
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
  });

  it('keeps only digits in the NIK and never exceeds 16', () => {
    renderDialog();
    openEnroll();
    type(nik(), '12ab34-56');
    expect(nik().value).toBe('123456');
    type(nik(), '12345678901234567');
    expect(nik().value).toBe('1234567890123456');
    expect(nik().getAttribute('maxlength')).toBe('16');
    expect(nik().getAttribute('inputmode')).toBe('numeric');
  });

  it('enables enrollment only with exactly 16 NIK digits', () => {
    renderDialog();
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    type(nik(), '123456789012345');
    expect(enrollButton().disabled).toBe(true);
    type(nik(), '1234567890123456');
    expect(enrollButton().disabled).toBe(false);
  });

  it('does not enroll with an invalid phone even when the NIK is complete', () => {
    const { api } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08');
    openEnroll();
    type(nik(), '1234567890123456');
    expect(enrollButton().disabled).toBe(true);
    fireEvent.click(enrollButton());
    expect(api.enrollNew).not.toHaveBeenCalled();
  });
});

describe('Placeholder hierarchy', () => {
  it('keeps the labels and adds localized example placeholders for a regular customer', () => {
    renderDialog();
    expect(name().placeholder).toBe('Contoh: Andir Saputra');
    expect(phone().placeholder).toBe('Contoh: 0812 3456 7890');
  });

  it('adds name, phone and NIK guidance to enrollment and keeps the NIK hint', () => {
    renderDialog();
    openEnroll();
    expect(name().placeholder).toBe('Contoh: Andir Saputra');
    expect(phone().placeholder).toBe('Contoh: 0812 3456 7890');
    expect(nik().placeholder).toBe('16 digit NIK');
    expect(screen.getByText(/16 digit NIK digunakan hanya untuk verifikasi/)).toBeTruthy();
  });
});

describe('Same-transaction continuity', () => {
  it('keeps an unfinished draft when the picker is closed and reopened', () => {
    const { update } = renderDialog({ resetKey: 3 });
    type(name(), 'Andir');
    type(phone(), '08192381923');
    update({ open: false, resetKey: 3 });
    update({ open: true, resetKey: 3 });
    expect(name().value).toBe('Andir');
    expect(phone().value).toBe('08192381923');
  });

  it('keeps a selected Member when closed and reopened', async () => {
    const { update } = renderDialog({ resetKey: 3 });
    fireEvent.click(screen.getByRole('tab', { name: /Member Terdaftar/ }));
    type(screen.getByLabelText(/Cari Member Terdaftar/), 'And');
    fireEvent.click(await screen.findByText('Andir'));
    expect(await screen.findByText('Saldo Poin')).toBeTruthy();
    update({ open: false, resetKey: 3 });
    update({ open: true, resetKey: 3 });
    expect(screen.getByText('Saldo Poin')).toBeTruthy();
  });

  it('explains a phone already used by another active member without naming that member', async () => {
    const { api } = renderDialog({ resetKey: 3 });
    api.enrollNew.mockRejectedValueOnce(
      new ApiError(409, 'MEMBERSHIP_PHONE_ALREADY_IN_USE', 'in use'),
    );
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    type(nik(), '1234567890123456');
    fireEvent.click(enrollButton());
    expect(
      await screen.findByText('Nomor telepon ini sudah digunakan oleh member aktif lain.'),
    ).toBeTruthy();
    expect(phone().value).toBe('08192381923');
  });

  it('keeps the draft after a failed save so it can be retried', async () => {
    const { api, update } = renderDialog({ resetKey: 3 });
    api.enrollNew.mockRejectedValueOnce(new Error('offline'));
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    type(nik(), '1234567890123456');
    fireEvent.click(enrollButton());
    await screen.findByText(/Pendaftaran member tidak dapat diselesaikan/);
    // No reset boundary fired: the same revision is passed on rerender.
    update({ resetKey: 3 });
    expect(name().value).toBe('Andir');
    expect(phone().value).toBe('08192381923');
  });
});

describe('New transaction reset boundary', () => {
  it('starts a clean picker for the next transaction', () => {
    const { update } = renderDialog({ resetKey: 0 });
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    type(nik(), '1234567890123456');
    update({ open: false, resetKey: 0 });
    update({ open: true, resetKey: 1 });

    // Back on the default Customer tab with nothing carried over.
    expect(name().value).toBe('');
    expect(phone().value).toBe('');
    openEnroll();
    expect(nik().value).toBe('');
    expect(screen.queryByText(/Pendaftaran member tidak dapat diselesaikan/)).toBeNull();
  });

  it('forgets the selected Member and the member search for the next transaction', async () => {
    const { update } = renderDialog({ resetKey: 0 });
    fireEvent.click(screen.getByRole('tab', { name: /Member Terdaftar/ }));
    const search = () => screen.getByLabelText(/Cari Member Terdaftar/) as HTMLInputElement;
    type(search(), 'And');
    fireEvent.click(await screen.findByText('Andir'));
    await screen.findByText('Saldo Poin');
    update({ open: false, resetKey: 0 });
    update({ open: true, resetKey: 1 });

    expect(screen.queryByText('Saldo Poin')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Member Terdaftar/ }));
    expect(search().value).toBe('');
    expect(screen.queryByText('Saldo Poin')).toBeNull();
    expect(screen.queryByText('Saldo Poin')).toBeNull();
  });

  it('does not wipe the query cache; only the dialog draft is discarded', () => {
    const { update, client } = renderDialog({ resetKey: 0 });
    client.setQueryData(['operational-member-search', 'And'], { items: [enrolled] });
    update({ resetKey: 1 });
    expect(client.getQueryData(['operational-member-search', 'And'])).toBeTruthy();
  });

  it('never interrupts an enrollment in flight and resets once it settles', async () => {
    let finish: (value: typeof enrolled) => void = () => undefined;
    const { api, update } = renderDialog({ resetKey: 0 });
    api.enrollNew.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve as typeof finish)),
    );
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    type(nik(), '1234567890123456');
    fireEvent.click(enrollButton());
    await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());

    update({ resetKey: 1 });
    expect(name().value).toBe('Andir');

    finish(enrolled);
    await waitFor(() => expect(name().value).toBe(''));
  });
});
