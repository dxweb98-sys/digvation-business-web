import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  defaultRefundDisbursement,
  type RefundDisbursementDraft,
} from '../../adjustment/refund-disbursement-picker';
import type { PaymentRoute, Sale } from '../model/cashier-transaction.types';
import { ReferenceCancelDialog } from './reference-cancel-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const route = (id: string, paymentMethod: string, financialAccountName: string) =>
  ({
    id,
    sellingLocationId: 'location-1',
    paymentMethod,
    currency: 'IDR',
    financialAccountId: `account-${id}`,
    financialAccountCode: null,
    financialAccountName,
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  }) as PaymentRoute;

const sale = (paid: string | null) =>
  ({
    id: 'sale-1',
    saleNumber: 'TRX-1',
    status: 'OPEN',
    operationalState: 'QUEUED',
    currency: 'IDR',
    version: 4,
    totalAmount: '218670.0000',
    payments: paid
      ? [
          {
            id: 'payment-1',
            status: 'SUCCEEDED',
            method: 'QRIS',
            appliedAmount: paid,
            tenderedAmount: null,
            changeAmount: null,
          },
        ]
      : [],
    lines: [],
  }) as unknown as Sale;

function renderCancel(target: Sale, routes: PaymentRoute[]) {
  const onConfirm = vi.fn();
  function Harness() {
    const [reason, setReason] = useState('');
    const [choice, setChoice] = useState<RefundDisbursementDraft | null>(null);
    return (
      <ReferenceCancelDialog
        sale={target}
        reason={reason}
        isMutating={false}
        onReasonChange={setReason}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        paymentRoutes={routes}
        disbursement={choice ?? defaultRefundDisbursement(routes)}
        onDisbursementChange={setChoice}
      />
    );
  }
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <Harness />
    </DeploymentBootstrapProvider>,
  );
  return { onConfirm };
}

const confirmButton = () =>
  screen.getByRole('button', { name: 'Batalkan transaksi' }) as HTMLButtonElement;

describe('ReferenceCancelDialog', () => {
  afterEach(cleanup);

  it('returns a paid Sale manually through a chosen account before it can be cancelled', () => {
    const { onConfirm } = renderCancel(sale('218670.0000'), [
      route('route-cash', 'CASH', 'Kas Laci'),
      route('route-bca', 'BANK_TRANSFER', 'BCA Operasional'),
    ]);
    const picker = screen.getByRole('region', { name: 'Pengembalian dana' });
    expect(picker.textContent).toContain('218.670');
    expect(within(picker).queryByRole('button', { name: 'QRIS' })).toBeNull();
    fireEvent.click(within(picker).getByRole('button', { name: 'Transfer bank' }));
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: /Alasan pembatalan/ }), {
      target: { value: 'Permintaan pelanggan' },
    });
    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cannot cancel a paid Sale when no cash or bank account can return the money', () => {
    renderCancel(sale('218670.0000'), [route('route-qris', 'QRIS', 'QRIS BRI')]);
    fireEvent.change(screen.getByRole('textbox', { name: /Alasan pembatalan/ }), {
      target: { value: 'Permintaan pelanggan' },
    });
    expect(confirmButton().disabled).toBe(true);
  });

  it('cancels an unpaid Sale without any refund choice', () => {
    renderCancel(sale(null), []);
    expect(screen.queryByRole('region', { name: 'Pengembalian dana' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: /Alasan pembatalan/ }), {
      target: { value: 'Permintaan pelanggan' },
    });
    expect(confirmButton().disabled).toBe(false);
  });
});
