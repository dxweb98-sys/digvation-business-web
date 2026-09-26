import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PaymentRoute, Sale } from '../cashier-transaction.types';
import { amountFractionDigits, currencyInputFromAmount, normalizeCurrencyPaymentInput } from './pos-controls';
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

function saleFor(amount: string) {
  return {
    id: 'sale-1',
    saleNumber: 'TRX-1',
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'QUEUED',
    version: 1,
    totalAmount: amount,
    payments: [],
  } as unknown as Sale;
}

function linesFor(amount: string) {
  return [
    {
      id: 'line-1',
      itemNameSnapshot: 'Layanan',
      quantity: '1.0000',
      effectiveUnitPrice: amount,
      totalAmount: amount,
      lineDiscountAmount: '0.0000',
    },
  ] as never[];
}

function PaymentHarness({
  onConfirm,
  amount = '105224.0000',
}: {
  onConfirm: (amount: string) => Promise<void>;
  amount?: string;
}) {
  const [appliedAmount, setAppliedAmount] = useState(() => currencyInputFromAmount(amount));
  const [tender, setTender] = useState('');
  const sale = saleFor(amount);
  const lines = linesFor(amount);

  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <ReferencePaymentDialog
          open
          onClose={vi.fn()}
          sale={sale}
          lines={lines}
          total={amount}
          gross={amount}
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

afterEach(cleanup);

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

describe('ReferencePaymentDialog fractional Runtime amounts', () => {
  it('keeps a canonical fractional amount exact through Pas, cash entry, change and the payment payload without crashing', async () => {
    const onConfirm = vi.fn(async () => undefined);
    // Runtime tax on a discounted net legitimately yields fractions such as 328171.5000.
    render(<PaymentHarness onConfirm={onConfirm} amount="328171.5000" />);

    expect(screen.getByRole('button', { name: /Bayar.*328[.,]171[.,]5/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pas.*328[.,]171[.,]5/ }));
    expect((screen.getByLabelText('Uang diterima') as HTMLInputElement).value).toBe('328.171,5');

    fireEvent.change(screen.getByLabelText('Uang diterima'), { target: { value: '400.000' } });
    // Change is exact: 400000 - 328171.5 = 71828.5, never rounded to a whole unit.
    expect(screen.getByText(/Rp\s?71[.,]828[.,]5/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Bayar.*328[.,]171[.,]5/ }));
    fireEvent.click(screen.getByRole('button', { name: /Konfirmasi dan selesaikan/ }));
    expect(onConfirm).toHaveBeenCalledWith('328171.5');
  });

  it('keeps the manual quick amounts unchanged', () => {
    render(<PaymentHarness onConfirm={vi.fn(async () => undefined)} amount="105224.0000" />);
    for (const amount of ['50[.,]000', '100[.,]000', '150[.,]000', '200[.,]000', '500[.,]000'])
      expect(screen.getByRole('button', { name: new RegExp(`Rp\\s?${amount}`) })).toBeTruthy();
  });
});

describe('payment amount converters', () => {
  it('preserves canonical whole and fractional Runtime decimals exactly, never scaling them', () => {
    expect(currencyInputFromAmount('105224.0000')).toBe('105224');
    expect(currencyInputFromAmount('105224')).toBe('105224');
    expect(currencyInputFromAmount('328171.5000')).toBe('328171.5');
    expect(currencyInputFromAmount('340758.9000')).toBe('340758.9');
    expect(currencyInputFromAmount('0.0000')).toBe('0');
    expect(currencyInputFromAmount('0.5000')).toBe('0.5');
    expect(amountFractionDigits('105224.0000')).toBe(0);
    expect(amountFractionDigits('328171.5000')).toBe(1);
    expect(amountFractionDigits('12.3456')).toBe(4);
    expect(normalizeCurrencyPaymentInput('328171.5')).toBe('328171.5');
    expect(normalizeCurrencyPaymentInput('105224')).toBe('105224');
  });

  it('never turns malformed or display-formatted text into another amount', () => {
    for (const malformed of ['105.224,0000', '105,224', 'Rp105.224', '1e5', '12.3.4', '--5', 'abc'])
      expect(currencyInputFromAmount(malformed)).toBe('');
    for (const malformed of ['105.224,0', 'Rp105.224', '1e5', 'abc'])
      expect(normalizeCurrencyPaymentInput(malformed)).toBe('');
    // Extra typed fraction digits are dropped, not rounded; whole-only entry ignores a fraction.
    expect(normalizeCurrencyPaymentInput('10.99', 1)).toBe('10.9');
    expect(normalizeCurrencyPaymentInput('10.99', 0)).toBe('10');
  });
});
