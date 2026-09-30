import { DToastProvider } from '@digvation/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberEditor } from './member-editor';
import type { Member } from './members-api';

const existing: Member = {
  id: 'm1',
  customerId: 'c1',
  memberNumber: 'MBR-1',
  status: 'ACTIVE',
  joinedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  customer: { id: 'c1', name: 'Budi', phoneE164: '+628111111111', version: 1, status: 'ACTIVE' },
};

function renderEditor(member: Member | null = null) {
  const api = {
    enroll: vi.fn().mockResolvedValue(existing),
    updateCustomer: vi.fn().mockResolvedValue(existing.customer),
    enrollExisting: vi.fn().mockResolvedValue(existing),
    searchCustomers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const done = vi.fn();
  const close = vi.fn();
  render(
    <DToastProvider>
      <MemberEditor member={member} api={api} canLookupCustomers done={done} close={close} />
    </DToastProvider>,
  );
  return { api, done, close };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

afterEach(cleanup);

describe('MemberEditor enrollment', () => {
  it('asks only for name and phone: no NIK field or hint', () => {
    renderEditor();
    expect(field('Name')).toBeTruthy();
    expect(field('Phone')).toBeTruthy();
    expect(screen.queryByLabelText(/NIK/i)).toBeNull();
    expect(screen.queryByText(/NIK/i)).toBeNull();
  });

  it('stays disabled until both name and a valid phone are present', () => {
    renderEditor();
    expect(save().disabled).toBe(true);
    type('Name', 'Budi');
    expect(save().disabled).toBe(true);
    type('Phone', '08');
    expect(save().disabled).toBe(true);
    type('Phone', '0811 1111 111');
    expect(save().disabled).toBe(false);
  });

  it.each(['081111111111', '6281111111111', '+6281111111111', '0811 1111 1111'])(
    'submits only name and the canonical phone for %s',
    async (typed) => {
      const { api, done, close } = renderEditor();
      type('Name', 'Budi');
      type('Phone', typed);
      fireEvent.click(save());
      await waitFor(() => expect(api.enroll).toHaveBeenCalled());
      expect(api.enroll).toHaveBeenCalledWith({ name: 'Budi', phone: '+6281111111111' });
      expect(Object.keys(api.enroll.mock.calls[0]![0]).sort()).toEqual(['name', 'phone']);
      await waitFor(() => expect(done).toHaveBeenCalled());
      expect(close).toHaveBeenCalled();
    },
  );

  it('never blocks a name that already exists: only the phone decides', async () => {
    const { api } = renderEditor();
    type('Name', existing.customer.name);
    type('Phone', '0822 2222 222');
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(api.enroll).toHaveBeenCalled());
  });

  it.each([
    ['MEMBERSHIP_PHONE_ALREADY_IN_USE', 'Nomor telepon ini sudah terdaftar sebagai member.'],
    [
      'CUSTOMER_PHONE_ALREADY_EXISTS',
      'Nomor telepon ini sudah terdaftar sebagai pelanggan. Tambahkan sebagai member dari pelanggan tersebut.',
    ],
  ])('shows the specific %s message and keeps the dialog open', async (code, message) => {
    const { api, done, close } = renderEditor();
    api.enroll.mockRejectedValueOnce({ status: 409, code });
    type('Name', 'Budi');
    type('Phone', '081111111111');
    fireEvent.click(save());
    expect(await screen.findByText(message)).toBeTruthy();
    expect(done).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('MemberEditor editing an existing Member', () => {
  it('re-saves the same canonical phone and never sends a NIK', async () => {
    const { api } = renderEditor(existing);
    expect(field('Phone').value).toBe('+628111111111');
    type('Name', 'Budi Santoso');
    fireEvent.click(save());
    await waitFor(() => expect(api.updateCustomer).toHaveBeenCalled());
    expect(api.updateCustomer).toHaveBeenCalledWith(existing, {
      name: 'Budi Santoso',
      phone: '+628111111111',
    });
  });
});

describe('MemberEditor existing Customer continuation', () => {
  const PHONE = '+628111111111';
  const lama = {
    id: 'c-lama',
    name: 'Pelanggan Lama',
    phoneE164: PHONE,
    version: 3,
    status: 'ACTIVE' as const,
  };
  const kembar = { ...lama, id: 'c-kembar', name: 'Pelanggan Kembar' };
  const conflict = (code: string) => ({ status: 409, code });
  const CONFLICT_COPY =
    'Nomor telepon ini sudah terdaftar sebagai pelanggan. Tambahkan sebagai member dari pelanggan tersebut.';
  const makeMember = () =>
    screen.getByRole('button', { name: 'Jadikan Member' }) as HTMLButtonElement;

  function startConflict(customers: unknown[], typed = '0811 1111 111', canLookupCustomers = true) {
    const api = {
      enroll: vi.fn().mockRejectedValueOnce(conflict('CUSTOMER_PHONE_ALREADY_EXISTS')),
      enrollExisting: vi.fn().mockResolvedValue(existing),
      searchCustomers: vi.fn().mockResolvedValue({ items: customers, total: customers.length }),
      updateCustomer: vi.fn(),
    };
    const done = vi.fn();
    const close = vi.fn();
    render(
      <DToastProvider>
        <MemberEditor
          member={null}
          api={api}
          canLookupCustomers={canLookupCustomers}
          done={done}
          close={close}
        />
      </DToastProvider>,
    );
    type('Name', 'Nama Yang Diketik');
    type('Phone', typed);
    fireEvent.click(save());
    return { api, done, close };
  }

  it('resolves the conflict into a continuation for the one existing Customer and enrolls that Customer', async () => {
    const { api, done, close } = startConflict([lama]);
    expect(await screen.findByText('Pelanggan sudah terdaftar')).toBeTruthy();
    expect(screen.getByText('Pelanggan Lama')).toBeTruthy();
    expect(screen.getByText(PHONE)).toBeTruthy();
    expect(screen.queryByText(CONFLICT_COPY)).toBeNull();
    // A single unambiguous match is preselected; the typed name is neither shown nor sent.
    expect(screen.queryByText('Nama Yang Diketik')).toBeNull();
    expect(makeMember().disabled).toBe(false);
    fireEvent.click(makeMember());
    await waitFor(() => expect(api.enrollExisting).toHaveBeenCalled());
    expect(api.enrollExisting).toHaveBeenCalledWith({ customerId: 'c-lama' });
    expect(Object.keys(api.enrollExisting.mock.calls[0]![0])).toEqual(['customerId']);
    expect(api.enroll).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(close).toHaveBeenCalled();
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
    expect(makeMember().disabled).toBe(true);
    fireEvent.click(makeMember());
    expect(api.enrollExisting).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.click(makeMember());
    await waitFor(() => expect(api.enrollExisting).toHaveBeenCalled());
    expect(api.enrollExisting).toHaveBeenCalledWith({ customerId: 'c-kembar' });
  });

  it.each(['0811 1111 111', '62811 1111 111', '+62 811 1111 111'])(
    'looks the Customer up by the same canonical phone when %s is typed',
    async (typed) => {
      const { api } = startConflict([lama], typed);
      await screen.findByText('Pelanggan sudah terdaftar');
      expect(api.enroll).toHaveBeenCalledWith({ name: 'Nama Yang Diketik', phone: PHONE });
      expect(api.searchCustomers).toHaveBeenCalledWith(PHONE);
    },
  );

  it('leaves everything unchanged on Cancel and returns to the simple form', async () => {
    const { api, done, close } = startConflict([lama]);
    await screen.findByText('Pelanggan sudah terdaftar');
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByText('Pelanggan sudah terdaftar')).toBeNull();
    expect(field('Name').value).toBe('Nama Yang Diketik');
    expect(api.enrollExisting).not.toHaveBeenCalled();
    expect(api.enroll).toHaveBeenCalledTimes(1);
    expect(done).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the specific message when no Customer matches the phone exactly', async () => {
    startConflict([{ ...lama, phoneE164: `${PHONE}0` }]);
    expect(await screen.findByText(CONFLICT_COPY)).toBeTruthy();
    expect(screen.queryByText('Pelanggan sudah terdaftar')).toBeNull();
  });

  it('shows the specific message without any lookup when customers:read is missing', async () => {
    const { api } = startConflict([lama], '0811 1111 111', false);
    expect(await screen.findByText(CONFLICT_COPY)).toBeTruthy();
    expect(api.searchCustomers).not.toHaveBeenCalled();
  });

  it('does not continue for an existing Member: nothing is created and nothing is looked up', async () => {
    const api = {
      enroll: vi.fn().mockRejectedValue(conflict('MEMBERSHIP_PHONE_ALREADY_IN_USE')),
      enrollExisting: vi.fn(),
      searchCustomers: vi.fn(),
      updateCustomer: vi.fn(),
    };
    const done = vi.fn();
    render(
      <DToastProvider>
        <MemberEditor member={null} api={api} canLookupCustomers done={done} close={vi.fn()} />
      </DToastProvider>,
    );
    type('Name', 'Budi');
    type('Phone', '0811 1111 111');
    fireEvent.click(save());
    expect(
      await screen.findByText('Nomor telepon ini sudah terdaftar sebagai member.'),
    ).toBeTruthy();
    expect(api.searchCustomers).not.toHaveBeenCalled();
    expect(api.enrollExisting).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  });
});
