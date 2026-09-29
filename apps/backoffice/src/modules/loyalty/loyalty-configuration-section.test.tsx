import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LoyaltyApi, LoyaltyConfiguration } from './loyalty-api';
import { LoyaltyConfigurationSection } from './loyalty-configuration-section';

afterEach(cleanup);

const perItem: LoyaltyConfiguration = {
  configured: true,
  earningMode: 'PER_ITEM',
  defaultEarningBehavior: 'FIXED',
  defaultFixedPointsPerUnit: 2,
  transactionAmountPerStep: null,
  transactionPointsPerStep: null,
  earnWhileRedeemingPolicy: 'NO_EARN_WHEN_REDEEMING',
  pointValue: '1000.0000',
  currency: 'IDR',
  version: 4,
};

function renderSection(configuration: LoyaltyConfiguration = perItem, canConfigure = true) {
  const api = {
    getConfiguration: vi.fn().mockResolvedValue(configuration),
    updateConfiguration: vi.fn().mockResolvedValue(configuration),
  };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DToastProvider>
        <LoyaltyConfigurationSection
          api={api as unknown as LoyaltyApi}
          canConfigure={canConfigure}
        />
      </DToastProvider>
    </QueryClientProvider>,
  );
  return api;
}

const openDialog = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Ubah pengaturan' }));
  return within(await screen.findByRole('dialog', { name: 'Pengaturan Loyalty' }));
};
const modeRadio = (dialog: ReturnType<typeof within>, name: string | RegExp) =>
  dialog.getByRole('radio', { name }) as HTMLInputElement;
const save = (dialog: ReturnType<typeof within>) =>
  dialog.getByRole('button', { name: 'Simpan' }) as HTMLButtonElement;

describe('Loyalty configuration: summary', () => {
  it('shows an existing tenant as Per Item, not earning while redeeming', async () => {
    renderSection();

    expect(await screen.findByText('Per Item')).toBeTruthy();
    expect(screen.getByText('Default: 2 poin / unit')).toBeTruthy();
    expect(screen.getByText('Tidak dapat poin baru')).toBeTruthy();
    expect(screen.getByText(/1 poin = 1000\.0000 IDR/)).toBeTruthy();
  });

  it('shows the transaction step and the earn-while-redeeming policy', async () => {
    renderSection({
      ...perItem,
      earningMode: 'TRANSACTION_TOTAL',
      transactionAmountPerStep: '200000.0000',
      transactionPointsPerStep: 1,
      earnWhileRedeemingPolicy: 'EARN_WHEN_REDEEMING',
    });

    expect(await screen.findByText('Berdasarkan Total Transaksi')).toBeTruthy();
    expect(screen.getByText('Setiap Rp200.000 → 1 poin')).toBeTruthy();
    expect(screen.getByText('Tetap dapat poin')).toBeTruthy();
  });

  it('offers no edit action without the configure permission', async () => {
    renderSection(perItem, false);
    await screen.findByText('Per Item');

    expect(screen.queryByRole('button', { name: 'Ubah pengaturan' })).toBeNull();
  });
});

describe('Loyalty configuration: dialog', () => {
  it('opens on the accepted per-item configuration with only the per-item fields', async () => {
    renderSection();
    const dialog = await openDialog();

    expect(modeRadio(dialog, /Per Item/).checked).toBe(true);
    expect(modeRadio(dialog, /Berdasarkan Total Transaksi/).checked).toBe(false);
    expect((dialog.getByLabelText('Poin per unit') as HTMLInputElement).value).toBe('2');
    expect(dialog.getByText('Perolehan poin default')).toBeTruthy();
    expect(dialog.queryByLabelText('Nominal transaksi per langkah')).toBeNull();
    expect(dialog.queryByLabelText('Poin per langkah')).toBeNull();
  });

  it('shows only the transaction fields and a readable example when Total Transaksi is chosen', async () => {
    renderSection();
    const dialog = await openDialog();

    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));
    fireEvent.change(dialog.getByLabelText('Nominal transaksi per langkah'), {
      target: { value: '200000' },
    });
    fireEvent.change(dialog.getByLabelText('Poin per langkah'), { target: { value: '1' } });

    expect(dialog.queryByLabelText('Poin per unit')).toBeNull();
    expect(dialog.queryByText('Perolehan poin default')).toBeNull();
    expect(dialog.getByText('Setiap Rp200.000 → 1 poin')).toBeTruthy();
    expect(dialog.getByText('Contoh: Rp400.000 → 2 poin')).toBeTruthy();
  });

  it('blocks saving a non-positive amount or a non-integer points step', async () => {
    renderSection();
    const dialog = await openDialog();
    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));

    expect(save(dialog).disabled).toBe(true);
    fireEvent.change(dialog.getByLabelText('Poin per langkah'), { target: { value: '1.5' } });
    fireEvent.change(dialog.getByLabelText('Nominal transaksi per langkah'), {
      target: { value: '0' },
    });
    expect(save(dialog).disabled).toBe(true);
    expect(dialog.getByText('Isi bilangan bulat lebih dari 0.')).toBeTruthy();

    fireEvent.change(dialog.getByLabelText('Poin per langkah'), { target: { value: '1' } });
    fireEvent.change(dialog.getByLabelText('Nominal transaksi per langkah'), {
      target: { value: '200000' },
    });
    expect(save(dialog).disabled).toBe(false);
  });

  it('keeps what was typed for the other mode when switching back and forth', async () => {
    renderSection();
    const dialog = await openDialog();

    fireEvent.change(dialog.getByLabelText('Poin per unit'), { target: { value: '5' } });
    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));
    fireEvent.change(dialog.getByLabelText('Poin per langkah'), { target: { value: '2' } });
    fireEvent.change(dialog.getByLabelText('Nominal transaksi per langkah'), {
      target: { value: '50000' },
    });
    fireEvent.click(modeRadio(dialog, /Per Item/));
    expect((dialog.getByLabelText('Poin per unit') as HTMLInputElement).value).toBe('5');

    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));
    expect((dialog.getByLabelText('Poin per langkah') as HTMLInputElement).value).toBe('2');
    expect(dialog.getByText('Setiap Rp50.000 → 2 poin')).toBeTruthy();
  });

  it('toggles earning while redeeming independently of the mode, with clear copy for both states', async () => {
    renderSection();
    const dialog = await openDialog();
    const toggle = () =>
      dialog.getByRole('switch', { name: 'Tetap dapat poin saat menggunakan poin' });

    expect(
      dialog.getByText(/Nonaktif: transaksi yang menggunakan poin tidak mendapatkan poin baru/),
    ).toBeTruthy();
    fireEvent.click(toggle());
    expect(dialog.getByText(/Aktif: menukarkan poin tidak menghalangi/)).toBeTruthy();

    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));
    expect(dialog.getByText(/Aktif: menukarkan poin tidak menghalangi/)).toBeTruthy();
    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('keeps the point value separate from the transaction step', async () => {
    renderSection();
    const dialog = await openDialog();

    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));
    fireEvent.change(dialog.getByLabelText('Nominal transaksi per langkah'), {
      target: { value: '200000' },
    });

    expect((dialog.getByLabelText('1 poin = (IDR)') as HTMLInputElement).value).toMatch(
      /^1[.,]?000$/,
    );
  });

  it('saves the complete configuration with the Runtime version', async () => {
    const api = renderSection();
    const dialog = await openDialog();

    fireEvent.click(modeRadio(dialog, /Berdasarkan Total Transaksi/));
    fireEvent.change(dialog.getByLabelText('Nominal transaksi per langkah'), {
      target: { value: '200000' },
    });
    fireEvent.change(dialog.getByLabelText('Poin per langkah'), { target: { value: '1' } });
    fireEvent.click(dialog.getByRole('switch', { name: 'Tetap dapat poin saat menggunakan poin' }));
    fireEvent.click(save(dialog));

    await waitFor(() =>
      expect(api.updateConfiguration).toHaveBeenCalledWith({
        expectedVersion: 4,
        pointValue: '1000',
        earningMode: 'TRANSACTION_TOTAL',
        defaultEarningBehavior: 'FIXED',
        defaultFixedPointsPerUnit: 2,
        earnWhileRedeemingPolicy: 'EARN_WHEN_REDEEMING',
        transactionAmountPerStep: '200000',
        transactionPointsPerStep: 1,
      }),
    );
  });

  it('closes on success and stays open with feedback when Runtime rejects the save', async () => {
    const api = renderSection();
    api.updateConfiguration.mockRejectedValueOnce(new Error('409'));
    const dialog = await openDialog();

    fireEvent.click(save(dialog));

    await waitFor(() => expect(api.updateConfiguration).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog', { name: 'Pengaturan Loyalty' })).toBeTruthy();

    fireEvent.click(save(dialog));
    await waitFor(() => expect(api.updateConfiguration).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Pengaturan Loyalty' })).toBeNull(),
    );
  });
});
