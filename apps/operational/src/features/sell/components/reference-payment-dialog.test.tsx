import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { PaymentRoute, Sale } from '../cashier-transaction.types';
import { currencyInputFromAmount } from './pos-controls';
import { ReferencePaymentDialog } from './replatformed-pos-workspace';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const route: PaymentRoute = {
  id: 'cash-route',
  sellingLocationId: 'location-1',
  paymentMethod: 'CASH',
  currency: 'IDR',
  financialAccountId: 'account-1',
  financialAccountCode: 'KAS',
  financialAccountName: 'Kas Utama',
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
};

const sale = {
  id: 'sale-1',
  saleNumber: 'TRX-1',
  currency: 'IDR',
  status: 'OPEN',
  operationalState: 'QUEUED',
  version: 1,
  totalAmount: '105224.0000',
  payments: [],
} as unknown as Sale;

const lines = [
  {
    id: 'line-1',
    itemNameSnapshot: 'Layanan',
    quantity: '1.0000',
    effectiveUnitPrice: '105224.0000',
    totalAmount: '105224.0000',
    lineDiscountAmount: '0.0000',
  },
] as never[];

function PaymentHarness({ onConfirm }: { onConfirm: (amount: string) => Promise<void> }) {
  const [appliedAmount, setAppliedAmount] = useState(() =>
    currencyInputFromAmount('105224.0000'),
  );
  const [tender, setTender] = useState('');

  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <ReferencePaymentDialog
          open
          onClose={vi.fn()}
          sale={sale}
          lines={lines}
          total="105224.0000"
          gross="105224.0000"
          discountAmount="0.0000"
          discountLabel="Diskon"
          taxAmount="0.0000"
          taxLabel="Pajak"
          locale="id-ID"
          customer={null}
          paymentRoutes={[route]}
          isPaymentRoutesLoading={false}
          method="CASH"
          paymentRouteId={route.id}
          appliedAmount={appliedAmount}
          paymentReference=""
          tender={tender}
          payNow
          onPayNowChange={vi.fn()}
          onMethod={vi.fn()}
          onPaymentRoute={vi.fn()}
          onAppliedAmount={setAppliedAmount}
          onPaymentReference={vi.fn()}
          onTender={setTender}
          onTransitionPayment={vi.fn()}
          quickTender={['50000', '100000', '150000', '200000', '500000']}
          isSubmitting={false}
          paymentError={null}
          onConfirmPayment={onConfirm}
          onQueue={vi.fn()}
          onQueueWithBalance={vi.fn()}
          loyaltyRedemption={null}
          loyaltyPointBalance={null}
          isLoyaltyBalanceLoading={false}
          canRedeemLoyalty={false}
          loyaltyPoints=""
          isLoyaltyMutating={false}
          onLoyaltyPointsChange={vi.fn()}
          onApplyLoyalty={async () => undefined}
          onRemoveLoyalty={vi.fn()}
        />
      </DToastProvider>
    </DeploymentBootstrapProvider>
  );
}

describe('ReferencePaymentDialog currency boundary', () => {
  it('keeps an authoritative IDR amount exact through Pas, cash entry, quick tender, change, and payment confirmation', async () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<PaymentHarness onConfirm={onConfirm} />);

    expect(screen.getByRole('button', { name: /Pas.*105[.,]224/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bayar.*105[.,]224/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Pas.*105[.,]224/ }));
    expect((screen.getByLabelText('Uang diterima') as HTMLInputElement).value).toBe('105.224');
    expect(screen.getAllByText(/Rp\s?0/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Uang diterima'), { target: { value: '150.000' } });
    expect(screen.getByText(/Rp\s?44[.,]776/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Rp\s?150[.,]000/ }));
    expect((screen.getByLabelText('Uang diterima') as HTMLInputElement).value).toBe('150.000');

    fireEvent.click(screen.getByRole('button', { name: /Bayar.*105[.,]224/ }));
    fireEvent.click(screen.getByRole('button', { name: /Konfirmasi dan selesaikan/ }));
    expect(onConfirm).toHaveBeenCalledWith('105224');
  });
});
