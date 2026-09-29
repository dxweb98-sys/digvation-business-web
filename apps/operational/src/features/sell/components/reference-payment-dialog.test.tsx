import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { saleDisplayLines } from '../cart-draft';
import type { PaymentRoute, Sale, SaleLine } from '../cashier-transaction.types';
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

/** `tracked` keeps the original Service-work assumption; `instant` is a Product-only Sale. */
type SaleKind = 'tracked' | 'instant';
type PaymentFixture = { status: 'SUCCEEDED' | 'PENDING'; appliedAmount: string };

function saleFor(amount: string, kind: SaleKind = 'tracked', payments: PaymentFixture[] = []) {
  return {
    id: 'sale-1',
    saleNumber: 'TRX-1',
    currency: 'IDR',
    status: 'OPEN',
    operationalState: kind === 'tracked' ? 'QUEUED' : 'UNSUBMITTED',
    version: 1,
    totalAmount: amount,
    payments: payments.map((payment, index) => ({
      id: `payment-${index}`,
      method: 'CASH',
      tenderedAmount: null,
      changeAmount: null,
      ...payment,
    })),
    lines: [
      {
        id: 'line-1',
        removedAt: null,
        fulfillmentBehaviorSnapshot: kind === 'tracked' ? 'TRACKED' : 'INSTANT',
      },
    ],
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
  lines: customLines,
  onEditOrder,
  kind = 'tracked',
  payments = [],
  onQueue = vi.fn(),
  onClose = vi.fn(),
}: {
  onConfirm: (amount: string) => Promise<void>;
  amount?: string;
  lines?: never[];
  onEditOrder?: () => void;
  kind?: SaleKind;
  payments?: PaymentFixture[];
  onQueue?: () => void;
  onClose?: () => void;
}) {
  const [appliedAmount, setAppliedAmount] = useState(() => currencyInputFromAmount(amount));
  const [tender, setTender] = useState('');
  const sale = saleFor(amount, kind, payments);
  const lines = customLines ?? linesFor(amount);

  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <ReferencePaymentDialog
          open
          onClose={onClose}
          {...(onEditOrder ? { onEditOrder } : {})}
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
          onQueue={onQueue}
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
    expect((screen.getByLabelText('Uang tunai diterima') as HTMLInputElement).value).toBe('105.224');
    expect(screen.getAllByText(/Rp\s?0/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Uang tunai diterima'), { target: { value: '150.000' } });
    expect(screen.getByText(/Rp\s?44[.,]776/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Rp\s?150[.,]000/ }));
    expect((screen.getByLabelText('Uang tunai diterima') as HTMLInputElement).value).toBe('150.000');

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
    expect((screen.getByLabelText('Uang tunai diterima') as HTMLInputElement).value).toBe('328.171,5');

    fireEvent.change(screen.getByLabelText('Uang tunai diterima'), { target: { value: '400.000' } });
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

describe('ReferencePaymentDialog selected-addition breakdown', () => {
  const selected = {
    id: 'c-red',
    componentSource: 'SALE_SELECTED',
    fixedBomSource: null,
    itemNameSnapshot: 'Red Coloring BRAND',
    variantNameSnapshot: null,
    quantity: '1.0000',
    transactionUnitPrice: '26000.0000',
    unitContribution: '26000.0000',
    extendedContribution: '26000.0000',
  };
  const fixed = {
    id: 'c-dev',
    componentSource: 'FIXED_BOM',
    fixedBomSource: 'SERVICE_DEFAULT',
    itemNameSnapshot: 'Developer 20 vol',
    variantNameSnapshot: null,
    quantity: '1.0000',
    transactionUnitPrice: '99999.0000',
    unitContribution: '0.0000',
    extendedContribution: '0.0000',
  };
  const saleLine = (id: string, unit: string, components: unknown[]): SaleLine =>
    ({
      id,
      removedAt: null,
      itemNameSnapshot: 'Smoothing Curly',
      itemTypeSnapshot: 'SERVICE',
      variantNameSnapshot: null,
      quantity: '1.0000',
      effectiveUnitPrice: unit,
      grossAmount: unit,
      lineDiscountAmount: '0.0000',
      compositionComponents: components,
    }) as unknown as SaleLine;

  it('shows base item + selected addition = the authoritative amount, and never the fixed BOM', () => {
    const lines = saleDisplayLines([saleLine('l1', '211000.0000', [fixed, selected])]) as never[];
    render(<PaymentHarness onConfirm={vi.fn(async () => undefined)} amount="211000.0000" lines={lines} />);

    const breakdown = screen.getByRole('list', { name: /Item tambahan: Smoothing Curly/ });
    const rows = breakdown.querySelectorAll(':scope > li');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toMatch(/Harga item.*185[.,]000/);
    expect(rows[1]!.textContent).toContain('+ Red Coloring BRAND');
    expect(rows[1]!.textContent).toMatch(/1 × Rp\s?26[.,]000/);
    expect(rows[1]!.textContent).toMatch(/Rp\s?26[.,]000/);
    // The line keeps the authoritative amount; the breakdown only explains it.
    expect(screen.getAllByText(/211[.,]000/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Developer 20 vol/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/99[.,]999/);
  });

  it('keeps units with different additions apart: separate lines, exact amounts, no average', () => {
    const lines = saleDisplayLines([
      saleLine('l1', '210000.0000', [selected]),
      saleLine('l2', '215000.0000', [{ ...selected, id: 'c-blue', itemNameSnapshot: 'Blue Toner', transactionUnitPrice: '31000.0000', unitContribution: '31000.0000', extendedContribution: '31000.0000' }]),
    ]) as never[];
    // Base 210.000 - 26.000 = 184.000; 215.000 - 31.000 = 184.000
    render(<PaymentHarness onConfirm={vi.fn(async () => undefined)} amount="425000.0000" lines={lines} />);

    expect(screen.getAllByRole('list', { name: /Item tambahan: Smoothing Curly/ })).toHaveLength(2);
    expect(screen.getByText('+ Red Coloring BRAND')).toBeTruthy();
    expect(screen.getByText('+ Blue Toner')).toBeTruthy();
    expect(screen.getAllByText(/210[.,]000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/215[.,]000/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/212[.,]500/);
  });
});

describe('ReferencePaymentDialog returning to the order', () => {
  it('offers "Ubah pesanan" only when the Sale can still be edited, and hands control back without paying', () => {
    const onEditOrder = vi.fn();
    const first = render(
      <PaymentHarness onConfirm={vi.fn(async () => undefined)} onEditOrder={onEditOrder} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ubah pesanan' }));
    expect(onEditOrder).toHaveBeenCalledTimes(1);
    first.unmount();
    // A terminal Sale is given no way back: the caller passes no handler.
    render(<PaymentHarness onConfirm={vi.fn(async () => undefined)} />);
    expect(screen.queryByRole('button', { name: 'Ubah pesanan' })).toBeNull();
  });
});

describe('ReferencePaymentDialog for an all-INSTANT (Product-only) Sale', () => {
  it('offers no Pay later and no queue wording, only payment', () => {
    render(<PaymentHarness onConfirm={vi.fn(async () => undefined)} kind="instant" amount="200000.0000" />);
    expect(screen.queryByText('Bayar nanti')).toBeNull();
    expect(screen.queryByText('Bayar sekarang')).toBeNull();
    expect(screen.queryByText(/antrian/i)).toBeNull();
    expect(screen.queryByText(/Mulai pengerjaan/i)).toBeNull();
    expect(screen.getByRole('button', { name: /^Bayar/ })).toBeTruthy();
  });

  it('keeps Pay later and the queue for a Sale with tracked work', () => {
    render(<PaymentHarness onConfirm={vi.fn(async () => undefined)} kind="tracked" amount="200000.0000" />);
    expect(screen.getByText('Bayar nanti')).toBeTruthy();
  });

  it('after a partial payment shows paid and remaining and keeps payment controls available', () => {
    render(
      <PaymentHarness
        onConfirm={vi.fn(async () => undefined)}
        kind="instant"
        amount="200000.0000"
        payments={[{ status: 'SUCCEEDED', appliedAmount: '100000.0000' }]}
      />,
    );
    expect(document.body.textContent).toMatch(/Sisa/);
    expect(document.body.textContent).toMatch(/100[.,]000/);
    expect(screen.getByRole('button', { name: /^Bayar/ })).toBeTruthy();
    expect(screen.queryByText(/antrian/i)).toBeNull();
  });

  it('closing a partly paid Product Sale keeps it open, with no queue-and-collect-later step', () => {
    const onClose = vi.fn();
    render(
      <PaymentHarness
        onConfirm={vi.fn(async () => undefined)}
        kind="instant"
        amount="200000.0000"
        payments={[{ status: 'SUCCEEDED', appliedAmount: '100000.0000' }]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tinggalkan pembayaran' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/kumpulkan nanti|collect later/i)).toBeNull();
  });

  it('a settled Product Sale offers to complete the transaction, never to add it to a queue', () => {
    const onQueue = vi.fn();
    render(
      <PaymentHarness
        onConfirm={vi.fn(async () => undefined)}
        kind="instant"
        amount="200000.0000"
        payments={[{ status: 'SUCCEEDED', appliedAmount: '200000.0000' }]}
        onQueue={onQueue}
      />,
    );
    expect(screen.queryByRole('button', { name: /Masukkan ke antrian|Tambahkan ke antrian/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Selesaikan transaksi' }));
    expect(onQueue).toHaveBeenCalledTimes(1);
  });
});
