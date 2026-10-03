import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  OperationalReceiptDeliveryCommands,
  OperationalReceiptDeliveryStatus,
  ReceiptDeliveryAttempt,
} from '../operational-projection-client';
import { ReceiptDeliveryDialog, type ReceiptDeliveryTarget } from './receipt-delivery-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const TARGET: ReceiptDeliveryTarget = {
  saleId: 'sale-1',
  reference: 'TRX-20261003-000182',
  customerName: 'wirawan',
  customerPhone: '+6281231231231',
};

function attempt(overrides: Partial<ReceiptDeliveryAttempt> = {}): ReceiptDeliveryAttempt {
  return {
    deliveryId: 'delivery-1',
    status: 'FAILED',
    destinationMasked: '+62 •••• 1231',
    customerDestination: true,
    attemptCount: 1,
    failureCategory: 'TARGET_INVALID',
    requestedAt: '2026-10-03T13:00:00.000Z',
    sentAt: null,
    failedAt: '2026-10-03T13:00:05.000Z',
    requestedByName: 'Kasir 1',
    retryAllowed: true,
    ...overrides,
  };
}

function status(history: ReceiptDeliveryAttempt[] = []): OperationalReceiptDeliveryStatus {
  return {
    available: true,
    customerDestinationMasked: '+62 •••• 1231',
    delivery: history[0] ?? null,
    history,
  };
}

function setup(
  initial: OperationalReceiptDeliveryStatus,
  target: ReceiptDeliveryTarget = TARGET,
) {
  let current = initial;
  const commands = {
    getReceiptDeliveryStatus: vi.fn(async () => current),
    requestReceiptDelivery: vi.fn(async () => {
      // Runtime appends a new attempt; earlier attempts stay.
      current = status([
        attempt({ deliveryId: 'delivery-new', status: 'QUEUED', failureCategory: null, failedAt: null }),
        ...current.history,
      ]);
      return { deliveryId: 'delivery-new', channel: 'WHATSAPP' as const, state: 'QUEUED' as const };
    }),
  } satisfies OperationalReceiptDeliveryCommands;
  const onRequested = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider client={queryClient}>
        <ReceiptDeliveryDialog
          target={target}
          commands={commands}
          onClose={vi.fn()}
          onDeliveryChanged={onRequested}
        />
      </QueryClientProvider>
    </DeploymentBootstrapProvider>,
  );
  return {
    commands,
    onRequested,
    setStatus: (next: OperationalReceiptDeliveryStatus) => {
      current = next;
    },
  };
}

const lastRequest = (commands: { requestReceiptDelivery: ReturnType<typeof vi.fn> }) =>
  commands.requestReceiptDelivery.mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe('ReceiptDeliveryDialog', () => {
  afterEach(cleanup);

  it('offers the customer number for a never-sent receipt and sends without a destination override', async () => {
    const { commands, onRequested } = setup(status());

    expect(await screen.findByText('Belum pernah dikirim')).toBeTruthy();
    expect(screen.getByText('+62 812 3123 1231')).toBeTruthy();
    expect(
      screen.getByText(
        'Nomor ini hanya dipakai untuk pengiriman struk ini dan tidak mengubah data pelanggan atau transaksi.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Kirim WhatsApp/ }));

    await waitFor(() => expect(commands.requestReceiptDelivery).toHaveBeenCalledTimes(1));
    const request = lastRequest(commands);
    expect(request).toMatchObject({ channel: 'WHATSAPP' });
    expect(request).not.toHaveProperty('destination');
    expect(request).not.toHaveProperty('retryOfDeliveryId');
    expect(String(request.idempotencyKey)).toMatch(/^receipt-delivery-sale-1-/);
    // The new attempt is observed and announced, so the queue indicator follows.
    await waitFor(() => expect(onRequested).toHaveBeenCalledWith('sale-1'));
    expect(await screen.findByText('Mengirim…')).toBeTruthy();
  });

  it('sends only once on a double click while the first request is in flight', async () => {
    const { commands } = setup(status());
    let release: () => void = () => {};
    commands.requestReceiptDelivery.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ deliveryId: 'delivery-new', channel: 'WHATSAPP', state: 'QUEUED' });
        }),
    );
    const send = await screen.findByRole('button', { name: /Kirim WhatsApp/ });

    fireEvent.click(send);
    fireEvent.click(send);
    release();

    await waitFor(() => expect(commands.requestReceiptDelivery).toHaveBeenCalledTimes(1));
  });

  it('shows a pending send as in progress and blocks another send', async () => {
    const { commands } = setup(
      status([attempt({ status: 'SENDING', failedAt: null, failureCategory: null })]),
    );

    expect(await screen.findByText('Mengirim…')).toBeTruthy();
    const send = screen.getByRole('button', { name: /Kirim WhatsApp/ });
    expect(send.hasAttribute('disabled')).toBe(true);
    fireEvent.click(send);
    expect(commands.requestReceiptDelivery).not.toHaveBeenCalled();
  });

  it('presents provider acceptance truthfully and allows an intentional resend', async () => {
    const { commands } = setup(
      status([
        attempt({
          status: 'SENT',
          failureCategory: null,
          failedAt: null,
          sentAt: '2026-10-03T13:08:00.000Z',
        }),
      ]),
    );

    expect(await screen.findByText('Permintaan pengiriman berhasil')).toBeTruthy();
    expect(
      screen.getByText(
        'Diterima layanan WhatsApp. Sampainya pesan ke pelanggan belum terkonfirmasi.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Terkirim/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Kirim ulang/ }));
    await waitFor(() => expect(commands.requestReceiptDelivery).toHaveBeenCalledTimes(1));
  });

  it('explains a failure and retries the same customer number', async () => {
    const { commands } = setup(status([attempt()]));

    expect(await screen.findByText('Gagal mengirim')).toBeTruthy();
    expect(
      screen.getByText('Nomor ini tidak terdaftar di WhatsApp. Periksa nomor lalu coba lagi.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Coba lagi/ }));
    await waitFor(() => expect(commands.requestReceiptDelivery).toHaveBeenCalledTimes(1));
    expect(lastRequest(commands)).not.toHaveProperty('retryOfDeliveryId');
  });

  it('retries an earlier corrected number by reference, without knowing the number', async () => {
    const { commands } = setup(
      status([attempt({ deliveryId: 'delivery-7', customerDestination: false, destinationMasked: '+62 •••• 8888' })]),
    );

    expect(await screen.findByText('Nomor pengiriman terakhir')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Coba lagi/ }));

    await waitFor(() => expect(commands.requestReceiptDelivery).toHaveBeenCalledTimes(1));
    expect(lastRequest(commands)).toMatchObject({ retryOfDeliveryId: 'delivery-7' });
    expect(lastRequest(commands)).not.toHaveProperty('destination');
  });

  it('sends to a corrected number for this attempt and keeps the earlier attempt represented', async () => {
    const { commands } = setup(status([attempt()]));

    fireEvent.click(await screen.findByRole('button', { name: 'Ubah nomor' }));
    expect(screen.getByText('Struk sebelumnya dikirim ke +62 •••• 1231.')).toBeTruthy();
    const input = screen.getByLabelText('Nomor WhatsApp tujuan');
    fireEvent.change(input, { target: { value: '0812 9999 8888' } });
    fireEvent.click(screen.getByRole('button', { name: /Kirim ke nomor baru/ }));

    await waitFor(() => expect(commands.requestReceiptDelivery).toHaveBeenCalledTimes(1));
    expect(lastRequest(commands)).toMatchObject({ destination: '+6281299998888' });
  });

  it('rejects an unusable number before sending', async () => {
    const { commands } = setup(status());

    fireEvent.click(await screen.findByRole('button', { name: 'Ubah nomor' }));
    fireEvent.change(screen.getByLabelText('Nomor WhatsApp tujuan'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Kirim WhatsApp/ }));

    expect(
      await screen.findByText('Masukkan nomor WhatsApp yang valid, contoh 0812 3456 7890.'),
    ).toBeTruthy();
    expect(commands.requestReceiptDelivery).not.toHaveBeenCalled();
  });

  it('shows only the masked customer number to an operator who cannot read the completed Sale', async () => {
    setup(status(), { ...TARGET, customerPhone: null });

    expect(await screen.findByText('+62 •••• 1231')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/812 3123 1231|6281231231231/);
  });

  it('lists earlier attempts with their outcome', async () => {
    setup(
      status([
        attempt({ deliveryId: 'delivery-2', status: 'SENT', failureCategory: null, failedAt: null }),
        attempt({ deliveryId: 'delivery-1' }),
      ]),
    );

    expect(await screen.findByText(/Percobaan sebelumnya \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Gagal mengirim:/)).toBeTruthy();
  });
});
