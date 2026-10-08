import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { ApiError } from '@digvation/pos-api';
import { DToastProvider } from '@digvation-labs/ui';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PaymentRoute, Sale } from '../transaction/model/cashier-transaction.types';
import { ReferencePaymentCorrectionDialog } from './reference-payment-correction-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

afterEach(cleanup);

const entry = (method: string, id: string, name: string, amount: string) => ({
  method,
  paymentRouteId: id,
  financialAccountId: `account-${id}`,
  financialAccountCode: null,
  financialAccountName: name,
  receivedAmount: amount,
  refundedAmount: '0.0000',
  effectiveAmount: amount,
});

const sale = (version = 4): Sale =>
  ({
    id: 'sale-1',
    saleNumber: 'TRX-20261008-000010',
    version,
    status: 'FINALIZED',
    sellingLocationId: 'location-1',
    currency: 'IDR',
    totalAmount: '110000.0000',
    payments: [],
    paymentComposition: {
      entries: [
        entry('CASH', 'cash', 'Tunai', '5000.0000'),
        entry('BANK_TRANSFER', 'bca', 'BCA', '105000.0000'),
      ],
      totalReceived: '110000.0000',
      totalRefunded: '0.0000',
      totalPaid: '110000.0000',
    },
  }) as unknown as Sale;

const routes = [] as readonly PaymentRoute[];

function renderDialog(
  overrides: Partial<Parameters<typeof ReferencePaymentCorrectionDialog>[0]> = {},
) {
  const mocks = {
    onClose: vi.fn(),
    onCorrect: vi.fn().mockResolvedValue(sale(5)),
    onCorrected: vi.fn(),
    onReload: vi.fn().mockResolvedValue(sale(6)),
  };
  const props = {
    sale: sale(),
    locale: 'id-ID',
    paymentRoutes: routes,
    ...mocks,
    ...overrides,
  };
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <ReferencePaymentCorrectionDialog {...props} />
      </DToastProvider>
    </DeploymentBootstrapProvider>,
  );
  // The mocks the dialog was given: an override replaces the default, and tests read the live one.
  return {
    onClose: overrides.onClose
      ? (overrides.onClose as unknown as typeof mocks.onClose)
      : mocks.onClose,
    onCorrect: (overrides.onCorrect ?? mocks.onCorrect) as unknown as typeof mocks.onCorrect,
    onCorrected: (overrides.onCorrected ??
      mocks.onCorrected) as unknown as typeof mocks.onCorrected,
    onReload: (overrides.onReload ?? mocks.onReload) as unknown as typeof mocks.onReload,
  };
}

const input = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(input(name), { target: { value } });
const reasonField = () => screen.getByPlaceholderText(/Salah memasukkan nominal pembayaran/);
const save = () => screen.getByRole('button', { name: 'Simpan koreksi' }) as HTMLButtonElement;

describe('ReferencePaymentCorrectionDialog', () => {
  it('shows the current effective composition and the same composition as the starting target', () => {
    renderDialog();
    const current = screen.getByRole('region', { name: 'Pencatatan saat ini' });
    expect(current.textContent).toMatch(/BCA.*105[.,]000/);
    expect(current.textContent).toMatch(/Tunai.*5[.,]000/);
    expect(input('BCA').value).toBe('105.000');
    expect(input('Tunai').value).toBe('5.000');
    // Nothing to save yet, and it says so.
    expect(screen.getByText('Belum ada perubahan.')).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it('derives the signed net-zero change from the correct composition', () => {
    renderDialog();
    type('Tunai', '10.000');
    type('BCA', '100.000');
    const changes = screen.getByRole('region', { name: 'Perubahan' });
    expect(changes.textContent).toMatch(/Tunai.*\+\s?Rp\s?5[.,]000/);
    expect(changes.textContent).toMatch(/BCA.*−\s?Rp\s?5[.,]000/);
  });

  it('warns while the total paid would change and refuses to save', () => {
    renderDialog();
    type('Tunai', '11.000');
    type('BCA', '100.000');
    fireEvent.change(reasonField(), { target: { value: 'Salah nominal' } });
    expect(screen.getByRole('alert').textContent).toContain('Total dibayar harus tetap sama.');
    expect(save().disabled).toBe(true);
  });

  it('requires a reason', () => {
    renderDialog();
    type('Tunai', '10.000');
    type('BCA', '100.000');
    expect(save().disabled).toBe(true);
    fireEvent.change(reasonField(), { target: { value: '  ' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(reasonField(), { target: { value: 'Salah memasukkan nominal pembayaran' } });
    expect(save().disabled).toBe(false);
  });

  it('sends exactly one correction command with the derived moves, and reports success', async () => {
    const props = renderDialog();
    type('Tunai', '10.000');
    type('BCA', '100.000');
    fireEvent.change(reasonField(), { target: { value: 'Salah memasukkan nominal pembayaran' } });
    fireEvent.click(save());
    await waitFor(() => expect(props.onCorrected).toHaveBeenCalledOnce());
    expect(props.onCorrect).toHaveBeenCalledOnce();
    const [saleId, request, key] = props.onCorrect.mock.calls[0]!;
    expect(saleId).toBe('sale-1');
    expect(request).toEqual({
      expectedVersion: 4,
      reason: 'Salah memasukkan nominal pembayaran',
      moves: [
        { paymentRouteId: 'bca', delta: '-5000.0000' },
        { paymentRouteId: 'cash', delta: '5000.0000' },
      ],
    });
    expect(key).toMatch(/^cashier-payment-correction-/);
    expect(props.onCorrected.mock.calls[0]![0].version).toBe(5);
  });

  it('prevents a duplicate submit while saving', async () => {
    let resolve!: (value: Sale) => void;
    const pending = new Promise<Sale>((done) => {
      resolve = done;
    });
    const props = renderDialog({ onCorrect: vi.fn().mockReturnValue(pending) });
    type('Tunai', '10.000');
    type('BCA', '100.000');
    fireEvent.change(reasonField(), { target: { value: 'Salah nominal' } });
    fireEvent.click(save());
    fireEvent.click(save());
    fireEvent.click(save());
    expect(props.onCorrect).toHaveBeenCalledOnce();
    expect(save().disabled).toBe(true);
    resolve(sale(5));
    await waitFor(() => expect(props.onCorrected).toHaveBeenCalledOnce());
  });

  it('keeps every typed value and explains Runtime’s refusal', async () => {
    const props = renderDialog({
      onCorrect: vi
        .fn()
        .mockRejectedValue(new ApiError(422, 'PAYMENT_CORRECTION_EXCEEDS_SOURCE', 'x')),
    });
    type('Tunai', '10.000');
    type('BCA', '100.000');
    fireEvent.change(reasonField(), { target: { value: 'Salah nominal' } });
    fireEvent.click(save());
    const alert = await screen.findByText(/tidak dapat dikurangi melebihi yang tercatat/);
    expect(alert).toBeTruthy();
    expect(input('Tunai').value).toBe('10.000');
    expect(input('BCA').value).toBe('100.000');
    expect((reasonField() as HTMLTextAreaElement).value).toBe('Salah nominal');
    expect(props.onCorrected).not.toHaveBeenCalled();
    // The same exact request retried keeps its idempotency key.
    fireEvent.click(save());
    await waitFor(() => expect(props.onCorrect).toHaveBeenCalledTimes(2));
    expect(props.onCorrect.mock.calls[0]![2]).toBe(props.onCorrect.mock.calls[1]![2]);
  });

  it('recovers from a stale version by reloading the latest transaction', async () => {
    const props = renderDialog({
      onCorrect: vi.fn().mockRejectedValue(new ApiError(409, 'SALE_VERSION_CONFLICT', 'x')),
    });
    type('Tunai', '10.000');
    type('BCA', '100.000');
    fireEvent.change(reasonField(), { target: { value: 'Salah nominal' } });
    fireEvent.click(save());
    const reload = await screen.findByRole('button', { name: 'Muat ulang transaksi' });
    // Saving stays off until the transaction is reloaded.
    expect(save().disabled).toBe(true);
    fireEvent.click(reload);
    await waitFor(() => expect(props.onReload).toHaveBeenCalledWith('sale-1'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Muat ulang transaksi' })).toBeNull(),
    );
    expect(
      within(screen.getByRole('region', { name: 'Perubahan' })).getByText('Belum ada perubahan.'),
    ).toBeTruthy();
  });

  it('shows no refund or additional-payment controls', () => {
    renderDialog();
    expect(document.body.textContent).not.toMatch(/Pengembalian|Bayar sisanya|Tambahan pembayaran/);
  });
});
