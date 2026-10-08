import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@digvation/pos-api';
import type { CustomerMemberApi } from '../api/customer-member-api';
import { CustomerMemberDialog } from './customer-member-dialog';

vi.mock('../../../../app/localization/operational-localization', () => ({
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
    enrollExisting: vi.fn().mockResolvedValue(enrolled),
    searchCustomers: vi.fn().mockResolvedValue({ items: [] }),
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
        canReadCustomers
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
const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });
const enrollButton = () =>
  screen.getByRole('button', { name: /Daftar & Pilih Member/ }) as HTMLButtonElement;
const openEnroll = () => fireEvent.click(screen.getByRole('tab', { name: /Daftar Member Baru/ }));

describe('Customer picker phone', () => {
  it('searches after a pause and captures only the explicitly selected canonical customer', async () => {
    const { api, onChoose } = renderDialog({
      canReadMembers: false,
      canEnrollMember: false,
      canReadLoyalty: false,
    });
    api.searchCustomers.mockResolvedValue({
      items: [
        { id: 'c-a', name: 'Dicky', phoneE164: '+628123456789', status: 'ACTIVE' },
        { id: 'c-b', name: 'Dicky Darmawan', phoneE164: '+628123456789', status: 'ACTIVE' },
        { id: 'c-c', name: 'Dicky', phoneE164: '+628999999999', status: 'ACTIVE' },
      ],
    });
    type(name(), 'Dic');
    type(name(), 'Dicky');
    expect(api.searchCustomers).not.toHaveBeenCalled();
    const choice = await screen.findByRole('option', { name: 'Dicky Darmawan +628123456789' });
    expect(api.searchCustomers).toHaveBeenCalledTimes(1);
    expect(api.searchCustomers).toHaveBeenCalledWith('Dicky', expect.any(AbortSignal));
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(choice);
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan Pelanggan' }));
    expect(onChoose).toHaveBeenCalledWith({
      type: 'NON_MEMBER',
      referenceId: 'c-b',
      name: 'Dicky Darmawan',
      phone: '+628123456789',
    });
    expect(screen.queryByRole('tab', { name: /Member Terdaftar/ })).toBeNull();
    expect(screen.queryByText('Saldo Poin')).toBeNull();
  });

  it('creates a separate customer when explicitly requested despite matching name and phone', async () => {
    const { api, onChoose } = renderDialog();
    api.searchCustomers.mockResolvedValue({
      items: [{ id: 'old', name: 'Dicky', phoneE164: '+628123456789', status: 'ACTIVE' }],
    });
    type(name(), 'Dicky');
    type(phone(), '+628123456789');
    await screen.findByRole('option', { name: 'Dicky +628123456789' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Gunakan sebagai pelanggan baru' })[0]!);
    expect(onChoose).toHaveBeenCalledWith({
      type: 'NON_MEMBER',
      name: 'Dicky',
      phone: '+628123456789',
      createNew: true,
    });
    expect(api.enrollNew).not.toHaveBeenCalled();
  });

  it('uses the existing Member selection path for an authorized Member suggestion', async () => {
    const { api, onChoose } = renderDialog();
    api.searchCustomers.mockResolvedValue({
      items: [
        {
          ...enrolled.customer,
          membership: {
            id: enrolled.id,
            memberNumber: enrolled.memberNumber,
            status: 'ACTIVE',
            joinedAt: '2026-01-01',
          },
        },
      ],
    });
    type(name(), 'Andir');
    fireEvent.click(await screen.findByRole('option', { name: /Andir.*Member/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan Pelanggan' }));
    expect(onChoose).toHaveBeenCalledWith(
      { type: 'MEMBER', referenceId: enrolled.customerId },
      expect.objectContaining({ id: enrolled.id, customerId: enrolled.customerId }),
    );
  });

  it('does not request the directory without customers:read', async () => {
    const { api } = renderDialog({
      canReadCustomers: false,
      canReadMembers: false,
      canEnrollMember: false,
    });
    type(name(), 'Dicky');
    type(phone(), '+628123456789');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(api.searchCustomers).not.toHaveBeenCalled();
  });

  it('keeps the local number visible and submits canonical E.164 for a regular customer', () => {
    const { onChoose } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08192381923');
    expect(phone().value).toBe('08192381923');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Gunakan sebagai pelanggan baru' }).at(-1)!,
    );
    expect(onChoose).toHaveBeenCalledWith({
      type: 'NON_MEMBER',
      name: 'Andir',
      phone: '+628192381923',
      createNew: true,
    });
  });

  it.each([
    ['0812 3456 7890', '081234567890'],
    ['+6281234567890', '081234567890'],
    ['6281234567890', '081234567890'],
  ])('normalizes POS regular Customer input %s to %s', (entered, expected) => {
    renderDialog();
    type(phone(), entered);
    expect(phone().value).toBe(expected);
  });

  it('does not submit a partial or empty phone', () => {
    const { onChoose } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08');
    const button = screen
      .getAllByRole('button', { name: 'Gunakan sebagai pelanggan baru' })
      .at(-1)! as HTMLButtonElement;
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
    fireEvent.click(enrollButton());
    await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());
    expect(api.enrollNew).toHaveBeenCalledWith({
      name: 'Andir',
      phone: '+628192381923',
    });
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
  });

  it('asks only for name and phone: there is no NIK field, hint or request property', async () => {
    const { api } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    expect(screen.queryByLabelText(/NIK/)).toBeNull();
    expect(screen.queryByText(/NIK/)).toBeNull();
    expect(enrollButton().disabled).toBe(false);
    fireEvent.click(enrollButton());
    await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());
    expect(Object.keys(api.enrollNew.mock.calls[0]![0]).sort()).toEqual(['name', 'phone']);
  });

  it.each(['08192381923', '628192381923', '+628192381923', '0819 2381 923', '+62 819-2381-923'])(
    'submits the same canonical phone for %s',
    async (typed) => {
      const { api } = renderDialog();
      type(name(), 'Andir');
      type(phone(), typed);
      openEnroll();
      fireEvent.click(enrollButton());
      await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());
      expect(api.enrollNew).toHaveBeenCalledWith({ name: 'Andir', phone: '+628192381923' });
    },
  );

  it('never blocks a name on the client: the same name is submitted and Runtime decides by phone', async () => {
    const { api } = renderDialog();
    type(name(), enrolled.customer.name);
    type(phone(), '08111222333');
    openEnroll();
    fireEvent.click(enrollButton());
    await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());
    expect(api.enrollNew).toHaveBeenCalledWith({
      name: enrolled.customer.name,
      phone: '+628111222333',
    });
  });

  it('does not enroll with an invalid phone', () => {
    const { api } = renderDialog();
    type(name(), 'Andir');
    type(phone(), '08');
    openEnroll();
    expect(enrollButton().disabled).toBe(true);
    fireEvent.click(enrollButton());
    expect(api.enrollNew).not.toHaveBeenCalled();
  });
});

describe('Placeholder hierarchy', () => {
  it('keeps the labels and adds localized example placeholders for a regular customer', () => {
    renderDialog();
    expect(name().placeholder).toBe('Contoh: Andir Saputra');
    expect(phone().placeholder).toBe('Contoh: 081234567890');
  });

  it('adds name and phone guidance to enrollment without any NIK guidance', () => {
    renderDialog();
    openEnroll();
    expect(name().placeholder).toBe('Contoh: Andir Saputra');
    expect(phone().placeholder).toBe('Contoh: 081234567890');
    expect(screen.queryByText(/NIK/)).toBeNull();
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

  it('explains a phone already registered as a member without naming that member', async () => {
    const { api } = renderDialog({ resetKey: 3 });
    api.enrollNew.mockRejectedValueOnce(
      new ApiError(409, 'MEMBERSHIP_PHONE_ALREADY_IN_USE', 'in use'),
    );
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    fireEvent.click(enrollButton());
    expect(
      await screen.findByText('Nomor telepon ini sudah terdaftar sebagai member.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Pendaftaran member tidak dapat diselesaikan/)).toBeNull();
    expect(phone().value).toBe('08192381923');
  });

  it('explains a phone already registered as a customer and points to enrolling that customer', async () => {
    const { api } = renderDialog({ resetKey: 3 });
    api.enrollNew.mockRejectedValueOnce(
      new ApiError(409, 'CUSTOMER_PHONE_ALREADY_EXISTS', 'exists'),
    );
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
    fireEvent.click(enrollButton());
    expect(
      await screen.findByText(
        'Nomor telepon ini sudah terdaftar sebagai pelanggan. Tambahkan sebagai member dari pelanggan tersebut.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Pendaftaran member tidak dapat diselesaikan/)).toBeNull();
    expect(phone().value).toBe('08192381923');
  });

  it('keeps the draft after a failed save so it can be retried', async () => {
    const { api, update } = renderDialog({ resetKey: 3 });
    api.enrollNew.mockRejectedValueOnce(new Error('offline'));
    type(name(), 'Andir');
    type(phone(), '08192381923');
    openEnroll();
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
    update({ open: false, resetKey: 0 });
    update({ open: true, resetKey: 1 });

    // Back on the default Customer tab with nothing carried over.
    expect(name().value).toBe('');
    expect(phone().value).toBe('');
    openEnroll();
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
    fireEvent.click(enrollButton());
    await waitFor(() => expect(api.enrollNew).toHaveBeenCalled());

    update({ resetKey: 1 });
    expect(name().value).toBe('Andir');

    finish(enrolled);
    await waitFor(() => expect(name().value).toBe(''));
  });
});

describe('Existing Customer continuation', () => {
  const PHONE = '+628192381923';
  const lama = {
    id: 'c-lama',
    name: 'Pelanggan Lama',
    phoneE164: PHONE,
    status: 'ACTIVE' as const,
  };
  const kembar = {
    id: 'c-kembar',
    name: 'Pelanggan Kembar',
    phoneE164: PHONE,
    status: 'ACTIVE' as const,
  };
  const exists = () => new ApiError(409, 'CUSTOMER_PHONE_ALREADY_EXISTS', 'exists');
  const CONFLICT_COPY =
    'Nomor telepon ini sudah terdaftar sebagai pelanggan. Tambahkan sebagai member dari pelanggan tersebut.';
  const makeMember = () =>
    screen.getByRole('button', { name: /Jadikan Member/ }) as HTMLButtonElement;

  function startConflict(
    customers: unknown[],
    typed = { name: 'Nama Baru', phone: '08192381923' },
    props: DialogProps = {},
  ) {
    const view = renderDialog(props);
    view.api.enrollNew.mockRejectedValueOnce(exists());
    view.api.searchCustomers.mockResolvedValue({ items: customers });
    type(name(), typed.name);
    type(phone(), typed.phone);
    openEnroll();
    fireEvent.click(enrollButton());
    return view;
  }

  it('resolves the conflict into a continuation for the one existing Customer and enrolls that Customer', async () => {
    const { api, onChoose } = startConflict([lama]);
    expect(await screen.findByText('Pelanggan sudah terdaftar')).toBeTruthy();
    expect(screen.getByText('Pelanggan Lama')).toBeTruthy();
    expect(screen.getByText(PHONE)).toBeTruthy();
    expect(screen.queryByText(CONFLICT_COPY)).toBeNull();
    // A single unambiguous match is preselected.
    expect(makeMember().disabled).toBe(false);
    fireEvent.click(makeMember());
    await waitFor(() => expect(api.enrollExisting).toHaveBeenCalled());
    expect(api.enrollExisting).toHaveBeenCalledWith({ customerId: 'c-lama' });
    expect(api.enrollNew).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onChoose).toHaveBeenCalled());
  });

  it('never overwrites the existing Customer name with the typed one', async () => {
    const { api } = startConflict([lama], { name: 'Nama Yang Diketik', phone: '08192381923' });
    await screen.findByText('Pelanggan sudah terdaftar');
    expect(screen.queryByText('Nama Yang Diketik')).toBeNull();
    fireEvent.click(makeMember());
    await waitFor(() => expect(api.enrollExisting).toHaveBeenCalled());
    expect(JSON.stringify(api.enrollExisting.mock.calls[0])).not.toContain('Nama Yang Diketik');
    expect(Object.keys(api.enrollExisting.mock.calls[0]![0])).toEqual(['customerId']);
  });

  it('requires an explicit choice when several Customers match and sends the chosen id', async () => {
    const { api } = startConflict([
      lama,
      kembar,
      { ...lama, id: 'c-longer', name: 'Nomor Lebih Panjang', phoneE164: `${PHONE}0` },
      { ...lama, id: 'c-inactive', name: 'Tidak Aktif', status: 'INACTIVE' as const },
    ]);
    await screen.findByText('Pelanggan sudah terdaftar');
    // Only the two exact ACTIVE matches are offered, and none is preselected.
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByText('Nomor Lebih Panjang')).toBeNull();
    expect(screen.queryByText('Tidak Aktif')).toBeNull();
    expect(screen.getByText('Pilih pelanggan yang akan dijadikan member.')).toBeTruthy();
    expect(makeMember().disabled).toBe(true);
    fireEvent.click(makeMember());
    expect(api.enrollExisting).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(makeMember().disabled).toBe(false);
    fireEvent.click(makeMember());
    await waitFor(() => expect(api.enrollExisting).toHaveBeenCalled());
    expect(api.enrollExisting).toHaveBeenCalledWith({ customerId: 'c-kembar' });
  });

  it.each(['08192381923', '628192381923', '+628192381923'])(
    'looks the Customer up by the same canonical phone when %s is typed',
    async (typed) => {
      const { api } = startConflict([lama], { name: 'Nama Baru', phone: typed });
      await screen.findByText('Pelanggan sudah terdaftar');
      expect(api.enrollNew).toHaveBeenCalledWith({ name: 'Nama Baru', phone: PHONE });
      expect(api.searchCustomers).toHaveBeenCalledWith(PHONE);
    },
  );

  it('leaves everything unchanged on Cancel and returns to the simple form', async () => {
    const { api, onChoose } = startConflict([lama]);
    await screen.findByText('Pelanggan sudah terdaftar');
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByText('Pelanggan sudah terdaftar')).toBeNull();
    expect(name().value).toBe('Nama Baru');
    expect(phone().value).toBe('08192381923');
    expect(api.enrollExisting).not.toHaveBeenCalled();
    expect(api.enrollNew).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('shows the specific message when no Customer matches the phone exactly', async () => {
    startConflict([{ ...lama, phoneE164: `${PHONE}0` }]);
    expect(await screen.findByText(CONFLICT_COPY)).toBeTruthy();
    expect(screen.queryByText('Pelanggan sudah terdaftar')).toBeNull();
  });

  it('shows the specific message without any lookup when customers:read is missing', async () => {
    const { api } = startConflict([lama], undefined, { canReadCustomers: false });
    expect(await screen.findByText(CONFLICT_COPY)).toBeTruthy();
    expect(api.searchCustomers).not.toHaveBeenCalled();
  });

  it('shows the specific message when the Customer lookup fails', async () => {
    const view = renderDialog();
    view.api.enrollNew.mockRejectedValueOnce(exists());
    view.api.searchCustomers.mockRejectedValue(new Error('offline'));
    type(name(), 'Nama Baru');
    type(phone(), '08192381923');
    openEnroll();
    fireEvent.click(enrollButton());
    expect(await screen.findByText(CONFLICT_COPY)).toBeTruthy();
  });

  it('does not continue for an existing Member: nothing is created and nothing is looked up', async () => {
    const view = renderDialog();
    view.api.enrollNew.mockRejectedValueOnce(
      new ApiError(409, 'MEMBERSHIP_PHONE_ALREADY_IN_USE', 'in use'),
    );
    type(name(), 'Nama Baru');
    type(phone(), '08192381923');
    openEnroll();
    fireEvent.click(enrollButton());
    expect(
      await screen.findByText('Nomor telepon ini sudah terdaftar sebagai member.'),
    ).toBeTruthy();
    expect(view.api.searchCustomers).not.toHaveBeenCalled();
    expect(view.api.enrollExisting).not.toHaveBeenCalled();
    expect(view.onChoose).not.toHaveBeenCalled();
  });

  it('reports a Member conflict raised while enrolling the chosen Customer', async () => {
    const { api } = startConflict([lama]);
    await screen.findByText('Pelanggan sudah terdaftar');
    api.enrollExisting.mockRejectedValueOnce(
      new ApiError(409, 'MEMBERSHIP_PHONE_ALREADY_IN_USE', 'in use'),
    );
    fireEvent.click(makeMember());
    expect(
      await screen.findByText('Nomor telepon ini sudah terdaftar sebagai member.'),
    ).toBeTruthy();
  });
});
