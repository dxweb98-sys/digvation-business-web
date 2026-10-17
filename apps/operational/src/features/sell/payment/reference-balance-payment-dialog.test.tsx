import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { currencyInputFromAmount } from '../lib/pos-controls';
import type { PaymentRoute, Sale } from '../transaction/model/cashier-transaction.types';
import { ReferenceBalancePaymentDialog } from './reference-balance-payment-dialog';

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

type PaymentFixture = { status: 'SUCCEEDED' | 'PENDING'; appliedAmount: string };

/** A queued Sale with tracked work: payment timing was decided at checkout. */
function queuedSale(payments: PaymentFixture[] = [], totalAmount = '166500.0000') {
  return {
    id: 'sale-1',
    saleNumber: 'TRX-1',
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'QUEUED',
    version: 1,
    totalAmount,
    payments: payments.map((payment, index) => ({
      id: `payment-${index}`,
      method: 'CASH',
      tenderedAmount: null,
      changeAmount: null,
      ...payment,
    })),
    lines: [{ id: 'line-1', removedAt: null, fulfillmentBehaviorSnapshot: 'TRACKED' }],
  } as unknown as Sale;
}

const paidFiftyThousand = [{ status: 'SUCCEEDED' as const, appliedAmount: '50000.0000' }];

/**
 * Mirrors the workspace: the amount it sends is its own `appliedAmount` state, and a recorded
 * payment resets that amount to the new outstanding balance.
 */
function QueuePaymentHarness({
  payments = [],
  availableToPay,
  totalAmount,
  initialAppliedAmount,
  paymentError = null,
  onPay,
}: {
  payments?: PaymentFixture[];
  availableToPay: string;
  totalAmount?: string;
  /** An amount the workspace still holds from before the Sale changed. */
  initialAppliedAmount?: string;
  paymentError?: string | null;
  onPay: (amount: string) => Promise<void>;
}) {
  const [appliedAmount, setAppliedAmount] = useState(() =>
    currencyInputFromAmount(initialAppliedAmount ?? availableToPay),
  );
  // Cash received follows the balance due (the workspace resets it whenever that balance changes).
  const [tender, setTender] = useState(() => currencyInputFromAmount(availableToPay));
  const [shownAvailable, setShownAvailable] = useState(availableToPay);
  if (availableToPay !== shownAvailable) {
    setShownAvailable(availableToPay);
    setAppliedAmount(currencyInputFromAmount(availableToPay));
    setTender(currencyInputFromAmount(availableToPay));
  }

  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <ReferenceBalancePaymentDialog
          sale={queuedSale(payments, totalAmount)}
          availableToPay={availableToPay}
          locale="id-ID"
          paymentRoutes={[route]}
          isPaymentRoutesLoading={false}
          method="CASH"
          paymentRouteId={route.id}
          appliedAmount={appliedAmount}
          paymentReference=""
          tender={tender}
          isMutating={false}
          paymentError={paymentError}
          onClose={vi.fn()}
          onMethod={vi.fn()}
          onPaymentRoute={vi.fn()}
          onAppliedAmount={(next) => {
            setAppliedAmount(next);
            setTender(next);
          }}
          onPaymentReference={vi.fn()}
          onTender={setTender}
          onTransitionPayment={vi.fn()}
          onPay={(allocation) => onPay(allocation)}
        />
      </DToastProvider>
    </DeploymentBootstrapProvider>
  );
}

const fullTab = () => screen.getByRole('tab', { name: 'Bayar penuh' });
const partialTab = () => screen.getByRole('tab', { name: 'Bayar sebagian' });
const payButton = () => screen.getByRole('button', { name: /^Bayar Rp/ });
const amountInput = () => screen.getByLabelText('Nominal pembayaran') as HTMLInputElement;

afterEach(cleanup);

describe('ReferenceBalancePaymentDialog payment from the queue', () => {
  it('offers Bayar penuh and Bayar sebagian for a never-paid queued Sale, defaulting to the full balance', () => {
    render(<QueuePaymentHarness availableToPay="166500.0000" onPay={vi.fn()} />);

    expect(fullTab().getAttribute('aria-selected')).toBe('true');
    expect(partialTab().getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('Bayar seluruh sisa tagihan')).toBeTruthy();
    expect(payButton().textContent).toMatch(/166[.,]500/);
    // Timing was decided at checkout: no second Pay now / Pay later choice.
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText('Bayar nanti')).toBeNull();
    expect(screen.queryByText('Bayar sekarang')).toBeNull();
  });

  it('uses the current outstanding balance, not the original total, for a partly paid Sale', () => {
    render(
      <QueuePaymentHarness
        availableToPay="116500.0000"
        payments={paidFiftyThousand}
        onPay={vi.fn()}
      />,
    );

    expect(fullTab().getAttribute('aria-selected')).toBe('true');
    expect(partialTab()).toBeTruthy();
    expect(payButton().textContent).toMatch(/116[.,]500/);
    expect(payButton().textContent).not.toMatch(/166[.,]500/);
  });

  it('switching to Bayar sebagian makes the amount editable and sends nothing', () => {
    const onPay = vi.fn(async () => undefined);
    render(
      <QueuePaymentHarness
        availableToPay="116500.0000"
        payments={paidFiftyThousand}
        onPay={onPay}
      />,
    );
    expect(screen.queryByLabelText('Nominal pembayaran')).toBeNull();

    fireEvent.click(partialTab());
    expect(partialTab().getAttribute('aria-selected')).toBe('true');
    expect(amountInput().value).toBe('116.500');

    fireEvent.change(amountInput(), { target: { value: '40.000' } });
    expect(payButton().textContent).toMatch(/40[.,]000/);
    expect(screen.getByText(/76[.,]500.*tersisa/)).toBeTruthy();
    expect(onPay).not.toHaveBeenCalled();
  });

  it('keeps the existing over-allocation validation for a partial amount', () => {
    render(<QueuePaymentHarness availableToPay="116500.0000" onPay={vi.fn()} />);
    fireEvent.click(partialTab());
    fireEvent.change(amountInput(), { target: { value: '200.000' } });

    expect(screen.getByRole('alert').textContent).toMatch(/116[.,]500/);
    expect((payButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('switching back to Bayar penuh restores the current outstanding balance and sends nothing', () => {
    const onPay = vi.fn(async () => undefined);
    render(
      <QueuePaymentHarness
        availableToPay="116500.0000"
        payments={paidFiftyThousand}
        onPay={onPay}
      />,
    );
    fireEvent.click(partialTab());
    fireEvent.change(amountInput(), { target: { value: '40.000' } });

    fireEvent.click(fullTab());
    expect(fullTab().getAttribute('aria-selected')).toBe('true');
    expect(payButton().textContent).toMatch(/116[.,]500/);
    fireEvent.click(partialTab());
    expect(amountInput().value).toBe('116.500');
    expect(onPay).not.toHaveBeenCalled();
  });

  it('confirms a full payment of the outstanding balance', async () => {
    const onPay = vi.fn(async () => undefined);
    render(
      <QueuePaymentHarness
        availableToPay="116500.0000"
        payments={paidFiftyThousand}
        onPay={onPay}
      />,
    );
    fireEvent.click(payButton());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi dan selesaikan' }));
    });
    expect(onPay).toHaveBeenCalledWith('116500');
  });

  it('confirms a partial payment, then offers the new balance in full once it is recorded', async () => {
    const onPay = vi.fn(async () => undefined);
    const { rerender } = render(<QueuePaymentHarness availableToPay="166500.0000" onPay={onPay} />);
    fireEvent.click(partialTab());
    fireEvent.change(amountInput(), { target: { value: '50.000' } });
    fireEvent.click(payButton());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi pembayaran' }));
    });
    expect(onPay).toHaveBeenCalledWith('50000');

    // Runtime recorded the payment: the balance changed, so the choice starts again at full.
    rerender(
      <QueuePaymentHarness
        availableToPay="116500.0000"
        payments={paidFiftyThousand}
        onPay={onPay}
      />,
    );
    expect(fullTab().getAttribute('aria-selected')).toBe('true');
    expect(payButton().textContent).toMatch(/116[.,]500/);
  });

  it('returns a failed partial payment to editing with the same choice and amount, and can retry', async () => {
    const onPay = vi.fn(async () => undefined);
    const { rerender } = render(<QueuePaymentHarness availableToPay="166500.0000" onPay={onPay} />);
    fireEvent.click(partialTab());
    fireEvent.change(amountInput(), { target: { value: '50.000' } });
    fireEvent.click(payButton());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi pembayaran' }));
    });

    // Nothing was recorded: the balance is unchanged and the error is shown.
    rerender(
      <QueuePaymentHarness availableToPay="166500.0000" paymentError="Ditolak." onPay={onPay} />,
    );
    expect(screen.getByText('Pembayaran tidak tercatat')).toBeTruthy();
    expect(partialTab().getAttribute('aria-selected')).toBe('true');
    expect(amountInput().value).toBe('50.000');

    fireEvent.click(payButton());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi pembayaran' }));
    });
    expect(onPay).toHaveBeenCalledTimes(2);
    expect(onPay).toHaveBeenLastCalledWith('50000');
  });

  it('after an item is added to a partly paid Sale, collects the new balance, never the old one', async () => {
    // Total 200.000, 80.000 already paid; a 50.000 item raises the total to 250.000. The workspace
    // still holds the 120.000 it prepared before the item was added.
    const onPay = vi.fn(async () => undefined);
    render(
      <QueuePaymentHarness
        totalAmount="250000.0000"
        payments={[{ status: 'SUCCEEDED', appliedAmount: '80000.0000' }]}
        availableToPay="170000.0000"
        initialAppliedAmount="120000.0000"
        onPay={onPay}
      />,
    );
    expect(fullTab().getAttribute('aria-selected')).toBe('true');
    expect(payButton().textContent).toMatch(/170[.,]000/);
    expect(screen.queryByText('Pembayaran kurang')).toBeNull();
    fireEvent.click(payButton());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi dan selesaikan' }));
    });
    // The confirmed amount is the amount sent: the 80.000 already paid is never charged again.
    expect(onPay).toHaveBeenCalledWith('170000');
  });
});
