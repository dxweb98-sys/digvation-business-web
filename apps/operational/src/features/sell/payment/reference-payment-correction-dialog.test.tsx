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
    totalAmount: '205350.0000',
    payments: [],
    paymentComposition: {
      entries: [
        entry('CASH', 'cash', 'Tunai', '5000.0000'),
        entry('QRIS', 'qris', 'QRIS BRI', '200350.0000'),
      ],
      totalReceived: '205350.0000',
      totalRefunded: '0.0000',
      totalPaid: '205350.0000',
    },
  }) as unknown as Sale;

const route = (id: string, method: PaymentRoute['paymentMethod'], name: string) =>
  ({
    id,
    sellingLocationId: 'location-1',
    paymentMethod: method,
    currency: 'IDR',
    financialAccountId: `account-${id}`,
    financialAccountCode: null,
    financialAccountName: name,
    status: 'ACTIVE',
    version: 1,
    createdAt: '',
    updatedAt: '',
  }) as PaymentRoute;

/** Every eligible route of the location, most of them holding nothing. */
const routes = [
  route('cash', 'CASH', 'Tunai'),
  route('qris', 'QRIS', 'QRIS BRI'),
  route('bca', 'BANK_TRANSFER', 'BCA'),
  route('bni', 'BANK_TRANSFER', 'Bank BNI'),
  route('akun1', 'BANK_TRANSFER', 'AKUN1'),
] as readonly PaymentRoute[];

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
const correctSection = () => screen.getByRole('region', { name: 'Pencatatan yang benar' });
const changesSection = () => screen.getByRole('region', { name: 'Perubahan' });
const addMethod = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Tambah metode pembayaran' }));
const chooseMethod = (name: RegExp) =>
  fireEvent.click(
    within(screen.getByRole('list', { name: 'Tambah metode pembayaran' })).getByRole('button', {
      name,
    }),
  );
const reasonOk = () =>
  fireEvent.change(reasonField(), { target: { value: 'Salah memasukkan nominal pembayaran' } });

describe('ReferencePaymentCorrectionDialog', () => {
  it('shows only routes that currently hold money, never the zero-value eligible ones', () => {
    renderDialog();
    const current = screen.getByRole('region', { name: 'Pencatatan saat ini' });
    expect(current.textContent).toMatch(/Tunai.*5[.,]000/);
    expect(current.textContent).toMatch(/QRIS BRI.*200[.,]350/);
    expect(current.textContent).not.toMatch(/BCA|BNI|AKUN1/);
    expect(within(correctSection()).queryByLabelText('BCA')).toBeNull();
    expect(within(correctSection()).queryByLabelText('Bank BNI')).toBeNull();
    expect(within(correctSection()).queryByLabelText('AKUN1')).toBeNull();
    expect(input('Tunai').value).toBe('5.000');
    expect(input('QRIS BRI').value).toBe('200.350');
    expect(screen.getByText('Belum ada perubahan.')).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it('balances the other of two routes automatically, in both directions', () => {
    renderDialog();
    type('Tunai', '10.000');
    expect(input('QRIS BRI').value).toBe('195.350');
    const changes = changesSection();
    expect(changes.textContent).toMatch(/Tunai.*\+\s?Rp\s?5[.,]000/);
    expect(changes.textContent).toMatch(/QRIS BRI.*−\s?Rp\s?5[.,]000/);
    type('QRIS BRI', '200.350');
    expect(input('Tunai').value).toBe('5.000');
    expect(screen.getByText('Belum ada perubahan.')).toBeTruthy();
  });

  it('shows only non-zero changes whose total is zero', () => {
    renderDialog();
    type('Tunai', '10.000');
    const changes = changesSection();
    expect(within(changes).getAllByRole('listitem')).toHaveLength(2);
    expect(changes.textContent).toMatch(/Total perubahan\s*Rp\s?0/);
  });

  it('adds an eligible route once; an already-selected route is not offered again', () => {
    renderDialog();
    addMethod();
    const offered = within(screen.getByRole('list', { name: 'Tambah metode pembayaran' }));
    expect(offered.queryByRole('button', { name: /Tunai/ })).toBeNull();
    expect(offered.queryByRole('button', { name: /QRIS BRI/ })).toBeNull();
    expect(offered.getByRole('button', { name: /BCA/ })).toBeTruthy();
    expect(offered.getByRole('button', { name: /Bank BNI/ })).toBeTruthy();
    chooseMethod(/BCA/);
    expect(within(correctSection()).getByLabelText('BCA')).toBeTruthy();
    addMethod();
    expect(
      within(screen.getByRole('list', { name: 'Tambah metode pembayaran' })).queryByRole('button', {
        name: /BCA/,
      }),
    ).toBeNull();
  });

  it('adds Cash to a single BCA and balances BCA once Cash is typed', () => {
    renderDialog({
      sale: {
        ...sale(),
        paymentComposition: {
          entries: [entry('BANK_TRANSFER', 'bca', 'BCA', '205350.0000')],
          totalReceived: '205350.0000',
          totalRefunded: '0.0000',
          totalPaid: '205350.0000',
        },
      } as Sale,
    });
    addMethod();
    chooseMethod(/Tunai/);
    type('Tunai', '5.000');
    expect(input('BCA').value).toBe('200.350');
    expect(changesSection().textContent).toMatch(/BCA.*−\s?Rp\s?5[.,]000/);
    expect(changesSection().textContent).toMatch(/Tunai.*\+\s?Rp\s?5[.,]000/);
  });

  it('removes a route from the target: the survivor receives the balancing amount', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Hapus metode pembayaran Tunai' }));
    expect(within(correctSection()).queryByLabelText('Tunai')).toBeNull();
    expect(input('QRIS BRI').value).toBe('205.350');
    expect(changesSection().textContent).toMatch(/Tunai.*−\s?Rp\s?5[.,]000/);
    // The last route cannot be removed.
    expect(screen.queryByRole('button', { name: /Hapus metode pembayaran/ })).toBeNull();
  });

  describe('three routes', () => {
    const threeRoutes = () => {
      renderDialog();
      addMethod();
      chooseMethod(/BCA/);
    };

    it('does not guess a balancing route: it shows what is left to allocate and blocks Save', () => {
      threeRoutes();
      // Adding BCA with nothing allocated keeps the total matched.
      type('BCA', '1.000');
      // Two routes before: now three, so nothing else moves.
      expect(input('Tunai').value).toBe('5.000');
      expect(input('QRIS BRI').value).toBe('200.350');
      expect(screen.getByRole('status').textContent).toMatch(
        /Alokasi melebihi total dibayar.*1[.,]000/,
      );
      reasonOk();
      expect(save().disabled).toBe(true);
    });

    it('saves once the operator allocates exactly the fixed total', () => {
      threeRoutes();
      type('BCA', '1.000');
      type('QRIS BRI', '199.350');
      expect(screen.queryByRole('status')).toBeNull();
      reasonOk();
      expect(save().disabled).toBe(false);
    });

    it('reports an amount still to allocate when less is allocated', () => {
      threeRoutes();
      type('QRIS BRI', '190.350');
      expect(screen.getByRole('status').textContent).toMatch(
        /Sisa yang perlu dialokasikan.*10[.,]000/,
      );
      expect(save().disabled).toBe(true);
    });
  });

  it('requires a reason before Save is enabled', () => {
    renderDialog();
    type('Tunai', '10.000');
    expect(save().disabled).toBe(true);
    fireEvent.change(reasonField(), { target: { value: '  ' } });
    expect(save().disabled).toBe(true);
    reasonOk();
    expect(save().disabled).toBe(false);
  });

  it('sends exactly one correction command with the derived moves, and reports success', async () => {
    const props = renderDialog();
    type('Tunai', '10.000');
    reasonOk();
    fireEvent.click(save());
    await waitFor(() => expect(props.onCorrected).toHaveBeenCalledOnce());
    expect(props.onCorrect).toHaveBeenCalledOnce();
    const [saleId, request, key] = props.onCorrect.mock.calls[0]!;
    expect(saleId).toBe('sale-1');
    expect(request).toEqual({
      expectedVersion: 4,
      reason: 'Salah memasukkan nominal pembayaran',
      moves: [
        { paymentRouteId: 'cash', delta: '5000' },
        { paymentRouteId: 'qris', delta: '-5000' },
      ],
    });
    expect(key).toMatch(/^cashier-payment-correction-/);
  });

  it('prevents a duplicate submit while saving', async () => {
    let resolve!: (value: Sale) => void;
    const pending = new Promise<Sale>((done) => {
      resolve = done;
    });
    const props = renderDialog({ onCorrect: vi.fn().mockReturnValue(pending) });
    type('Tunai', '10.000');
    reasonOk();
    fireEvent.click(save());
    fireEvent.click(save());
    fireEvent.click(save());
    expect(props.onCorrect).toHaveBeenCalledOnce();
    expect(save().disabled).toBe(true);
    resolve(sale(5));
    await waitFor(() => expect(props.onCorrected).toHaveBeenCalledOnce());
  });

  it('keeps every typed value and explains Runtime’s refusal; a retry keeps its key', async () => {
    const props = renderDialog({
      onCorrect: vi
        .fn()
        .mockRejectedValue(new ApiError(422, 'PAYMENT_CORRECTION_EXCEEDS_SOURCE', 'x')),
    });
    type('Tunai', '10.000');
    reasonOk();
    fireEvent.click(save());
    expect(await screen.findByText(/tidak dapat dikurangi melebihi yang tercatat/)).toBeTruthy();
    expect(input('Tunai').value).toBe('10.000');
    expect(input('QRIS BRI').value).toBe('195.350');
    expect((reasonField() as HTMLTextAreaElement).value).toBe(
      'Salah memasukkan nominal pembayaran',
    );
    expect(props.onCorrected).not.toHaveBeenCalled();
    fireEvent.click(save());
    await waitFor(() => expect(props.onCorrect).toHaveBeenCalledTimes(2));
    expect(props.onCorrect.mock.calls[0]![2]).toBe(props.onCorrect.mock.calls[1]![2]);
  });

  it('recovers from a stale version by reloading the latest transaction', async () => {
    const props = renderDialog({
      onCorrect: vi.fn().mockRejectedValue(new ApiError(409, 'SALE_VERSION_CONFLICT', 'x')),
    });
    type('Tunai', '10.000');
    reasonOk();
    fireEvent.click(save());
    const reload = await screen.findByRole('button', { name: 'Muat ulang transaksi' });
    expect(save().disabled).toBe(true);
    fireEvent.click(reload);
    await waitFor(() => expect(props.onReload).toHaveBeenCalledWith('sale-1'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Muat ulang transaksi' })).toBeNull(),
    );
    expect(screen.getByText('Belum ada perubahan.')).toBeTruthy();
    expect(input('Tunai').value).toBe('5.000');
  });

  it('shows no refund or additional-payment controls, and no transfer wording', () => {
    renderDialog();
    expect(document.body.textContent).not.toMatch(
      /Pengembalian|Bayar sisanya|Tambahan pembayaran|Pindahkan|Transfer dana/,
    );
  });

  describe('visual hierarchy', () => {
    const current = () => within(screen.getByRole('region', { name: 'Pencatatan saat ini' }));
    const hint = /Ubah salah satu nominal, metode lainnya akan menyesuaikan otomatis/;

    it('keeps the current recording read-only and apart from the editable target', () => {
      renderDialog();
      expect(current().queryByRole('textbox')).toBeNull();
      expect(current().queryByRole('button')).toBeNull();
      expect(current().getByText('Total dibayar')).toBeTruthy();
      expect(within(correctSection()).getAllByRole('textbox')).toHaveLength(2);
    });

    it('offers Add payment method inside the editable target only', () => {
      renderDialog();
      expect(
        within(correctSection()).getByRole('button', { name: 'Tambah metode pembayaran' }),
      ).toBeTruthy();
      expect(current().queryByRole('button', { name: 'Tambah metode pembayaran' })).toBeNull();
    });

    it('explains the automatic balance only while exactly two routes are selected', () => {
      renderDialog();
      expect(within(correctSection()).getByText(hint)).toBeTruthy();
      addMethod();
      chooseMethod(/BCA/);
      expect(screen.queryByText(hint)).toBeNull();
    });

    it('shows allocation feedback inside the target composition', () => {
      renderDialog();
      addMethod();
      chooseMethod(/BCA/);
      type('BCA', '1.000');
      const status = screen.getByRole('status');
      expect(within(correctSection()).getByRole('status')).toBe(status);
      expect(status.textContent).toMatch(/Alokasi melebihi total dibayar.*1\.000/);
    });

    it('keeps the change preview neutral until there are derived changes, then lists only them', () => {
      renderDialog();
      expect(within(changesSection()).getByText('Belum ada perubahan.')).toBeTruthy();
      expect(within(changesSection()).queryAllByRole('listitem')).toHaveLength(0);
      expect(screen.queryByRole('status')).toBeNull();
      type('Tunai', '10.000');
      const items = within(changesSection()).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]!.textContent).toMatch(/Tunai.*\+\s?Rp\s?5\.000/);
      expect(items[1]!.textContent).toMatch(/QRIS BRI.*−\s?Rp\s?5\.000/);
      expect(within(changesSection()).queryByText('Total dibayar')).toBeNull();
    });

    it('places the reason after the financial sections', () => {
      renderDialog();
      expect(
        changesSection().compareDocumentPosition(reasonField()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe('initial target composition', () => {
    const bcaAndCash = () =>
      ({
        ...sale(),
        paymentComposition: {
          entries: [
            entry('BANK_TRANSFER', 'bca', 'BCA', '105350.0000'),
            entry('CASH', 'cash', 'Tunai', '100000.0000'),
          ],
          totalReceived: '205350.0000',
          totalRefunded: '0.0000',
          totalPaid: '205350.0000',
        },
      }) as Sale;

    it('opens with an exact copy of every non-zero effective route, as editable rows', () => {
      renderDialog({ sale: bcaAndCash() });
      expect(input('BCA').value).toBe('105.350');
      expect(input('Tunai').value).toBe('100.000');
      expect(within(correctSection()).getAllByRole('textbox')).toHaveLength(2);
      expect(
        within(screen.getByRole('region', { name: 'Pencatatan saat ini' })).getByText(
          /Transfer bank/,
        ),
      ).toBeTruthy();
    });

    it('derives no movement until something is edited, and Save stays disabled', () => {
      renderDialog({ sale: bcaAndCash() });
      expect(within(changesSection()).getByText('Belum ada perubahan.')).toBeTruthy();
      reasonOk();
      expect(save().disabled).toBe(true);
    });

    it('balances the other of two routes only once one amount is edited', () => {
      renderDialog({ sale: bcaAndCash() });
      type('Tunai', '105.000');
      expect(input('BCA').value).toBe('100.350');
      expect(within(changesSection()).getAllByRole('listitem')).toHaveLength(2);
      expect(changesSection().textContent).toMatch(/Tunai\+\s?Rp\s?5[.,]000/);
      expect(changesSection().textContent).toMatch(/BCA−\s?Rp\s?5[.,]000/);
      expect(changesSection().textContent).toMatch(/Total perubahan.*Rp\s?0/);
    });

    it('keeps two accounts of one method as two routes and never merges them by method', () => {
      renderDialog({
        sale: {
          ...sale(),
          paymentComposition: {
            entries: [
              entry('BANK_TRANSFER', 'bca', 'BCA', '105350.0000'),
              entry('BANK_TRANSFER', 'bni', 'Bank BNI', '100000.0000'),
            ],
            totalReceived: '205350.0000',
            totalRefunded: '0.0000',
            totalPaid: '205350.0000',
          },
        } as Sale,
      });
      expect(input('BCA').value).toBe('105.350');
      expect(input('Bank BNI').value).toBe('100.000');
    });
  });
});
