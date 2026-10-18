import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberPointsAdjustDialog } from './member-points-adjust-dialog';

const member = {
  id: 'm1',
  memberNumber: 'MBR-000007',
  customer: {
    id: 'c1',
    name: 'Ani Wijaya',
    phoneE164: '+6281234567890',
    version: 1,
    status: 'ACTIVE' as const,
  },
};

function renderDialog(balance = '300.0000') {
  const api = {
    balance: vi.fn().mockResolvedValue({ membershipId: 'm1', pointsBalance: balance }),
    adjustPoints: vi.fn().mockResolvedValue({
      membershipId: 'm1',
      previousBalance: balance,
      pointsBalance: '500.0000',
    }),
  };
  const onAdjusted = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DToastProvider>
        <MemberPointsAdjustDialog
          member={member}
          api={api}
          onAdjusted={onAdjusted}
          onClose={onClose}
        />
      </DToastProvider>
    </QueryClientProvider>,
  );
  return { api, onAdjusted, onClose };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () =>
  screen.getByRole('button', { name: 'Simpan penyesuaian' }) as HTMLButtonElement;

afterEach(cleanup);

describe('MemberPointsAdjustDialog', () => {
  it('shows current, adjustment and result for an addition and sends it with the reason', async () => {
    const { api, onAdjusted, onClose } = renderDialog();
    await screen.findByText('300');
    type('Jumlah poin', '200');
    type('Alasan', '  Poin lama terlewat ');

    expect(screen.getByText('+200')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    expect(submit().disabled).toBe(false);
    fireEvent.click(submit());

    await waitFor(() => expect(api.adjustPoints).toHaveBeenCalled());
    expect(api.adjustPoints).toHaveBeenCalledWith('m1', {
      direction: 'ADD',
      points: '200',
      reason: 'Poin lama terlewat',
    });
    await waitFor(() => expect(onAdjusted).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('requires a positive amount and a reason', async () => {
    renderDialog();
    await screen.findByText('300');
    expect(submit().disabled).toBe(true);
    type('Jumlah poin', '0');
    type('Alasan', 'x');
    expect(submit().disabled).toBe(true);
    expect(screen.getByText('Masukkan jumlah poin lebih dari 0.')).toBeTruthy();
    type('Jumlah poin', '10');
    expect(submit().disabled).toBe(false);
    type('Alasan', '   ');
    expect(submit().disabled).toBe(true);
  });

  it('blocks a subtraction that would make the balance negative', async () => {
    const { api } = renderDialog('100.0000');
    await screen.findByText('100');
    fireEvent.click(screen.getByLabelText('Jenis penyesuaian'));
    fireEvent.click(screen.getByRole('option', { name: 'Kurangi poin' }));
    type('Jumlah poin', '100.5');
    type('Alasan', 'Koreksi');
    expect(
      screen.getByText('Pengurangan melebihi saldo poin. Saldo tidak boleh negatif.'),
    ).toBeTruthy();
    expect(submit().disabled).toBe(true);
    fireEvent.click(submit());
    expect(api.adjustPoints).not.toHaveBeenCalled();
  });
});
