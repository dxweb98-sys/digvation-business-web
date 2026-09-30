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
  };
  const done = vi.fn();
  const close = vi.fn();
  render(
    <DToastProvider>
      <MemberEditor member={member} api={api} done={done} close={close} />
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
