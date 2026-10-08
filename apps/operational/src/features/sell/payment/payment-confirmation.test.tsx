import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Payment, PaymentStatus } from '../transaction/model/cashier-transaction.types';
import { paymentIntent, paymentProgress } from '../transaction/model/sale-presentation';

import {
  PaymentIntentHint,
  PaymentLeaveNotice,
  PaymentReview,
  RecordedPaymentList,
} from './payment-confirmation';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'en-US', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

afterEach(cleanup);

const format = (amount: string) => `Rp${Number(amount).toLocaleString('id-ID')}`;

function withLocale(node: ReactNode) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>{node}</DeploymentBootstrapProvider>,
  );
}

function payment(
  id: string,
  status: PaymentStatus,
  appliedAmount: string,
  overrides: Partial<Payment> = {},
): Payment {
  return {
    id,
    saleId: 'sale-1',
    method: 'BANK_TRANSFER',
    status,
    currency: 'IDR',
    appliedAmount,
    tenderedAmount: null,
    changeAmount: null,
    providerReference: null,
    financeFinancialAccountNameSnapshot: 'BCA',
    idempotencyKey: `key-${id}`,
    createdByActorId: 'actor-1',
    createdByActorKind: 'USER',
    settledByActorId: null,
    settledByActorKind: null,
    terminalAt: null,
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('PaymentIntentHint', () => {
  it('tells the operator a full amount completes the transaction', () => {
    withLocale(
      <PaymentIntentHint
        intent={paymentIntent({ totalAmount: '500000', payments: [] }, '500000')}
        format={format}
        onPayRemaining={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Full payment');
    expect(screen.getByRole('status').textContent).toContain(
      'This payment completes the transaction.',
    );
  });

  it('announces a split and lets the operator go back to the full amount', () => {
    const onPayRemaining = vi.fn();
    withLocale(
      <PaymentIntentHint
        intent={paymentIntent({ totalAmount: '500000', payments: [] }, '300000')}
        format={format}
        onPayRemaining={onPayRemaining}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Split payment');
    expect(screen.getByRole('status').textContent).toContain('Rp200.000');
    fireEvent.click(screen.getByRole('button', { name: 'Pay full amount' }));
    expect(onPayRemaining).toHaveBeenCalledOnce();
  });
});

describe('PaymentReview', () => {
  it('shows what was already paid and states that the next payment completes the sale', () => {
    const payments = [payment('p1', 'SUCCEEDED', '300000')];
    withLocale(
      <PaymentReview
        intent={paymentIntent({ totalAmount: '500000', payments }, '200000')}
        total="500000"
        methodName="Cash"
        accountName="Cash drawer"
        tendered="200000"
        change="0"
        earlierPayments={payments}
        format={format}
      />,
    );
    expect(screen.getByText('Already paid')).toBeTruthy();
    expect(screen.queryByText(/Received ·/)).toBeNull();
    expect(screen.getByText('Remaining after this payment')).toBeTruthy();
    expect(screen.getByText('This payment completes the transaction.')).toBeTruthy();
  });

  it('keeps a first partial payment clearly unfinished', () => {
    withLocale(
      <PaymentReview
        intent={paymentIntent({ totalAmount: '500000', payments: [] }, '300000')}
        total="500000"
        methodName="Bank transfer"
        accountName="BCA"
        earlierPayments={[]}
        format={format}
      />,
    );
    expect(screen.getByText('You are receiving part of the total')).toBeTruthy();
    expect(
      screen.getByText('Rp200.000 will remain. You will continue with another payment method.'),
    ).toBeTruthy();
  });
});

describe('PaymentReview after refunds', () => {
  const refundOf = (id: string, method: Payment['method'], account: string, amount: string) =>
    payment(id, 'SUCCEEDED', `-${amount}`, {
      method,
      financeFinancialAccountNameSnapshot: account,
      refund: {
        id: `refund-${id}`,
        kind: 'MANUAL',
        reason: 'ORDER_ADJUSTMENT',
        externalReference: null,
        note: null,
        adjustmentId: 'adjustment-1',
        allocations: [{ sourcePaymentId: 'bca-in', amount }],
      },
    });
  // Total 593.850; received 205.350 + 410.700; refunded 38.850 + 38.850 + 166.500 => net 371.850.
  const payments = [
    payment('bca-in', 'SUCCEEDED', '205350'),
    payment('qris-in', 'SUCCEEDED', '410700', {
      method: 'QRIS',
      financeFinancialAccountNameSnapshot: 'QRIS BRI',
    }),
    refundOf('r1', 'BANK_TRANSFER', 'BCA Operasional', '38850'),
    refundOf('r22', 'CASH', 'Cash drawer', '38850'),
    refundOf('r333', 'BANK_TRANSFER', 'BCA Operasional', '166500'),
  ];

  function review() {
    return withLocale(
      <PaymentReview
        intent={paymentIntent({ totalAmount: '593850', payments }, '222000')}
        total="593850"
        methodName="Bank transfer"
        accountName="BCA"
        earlierPayments={payments}
        format={format}
      />,
    );
  }

  it('states total, net already paid, this payment and the remaining balance', () => {
    review();
    const value = (label: string) => screen.getByText(label).nextElementSibling!.textContent;
    expect(value('Transaction total')).toBe('Rp593.850');
    expect(value('Net already paid')).toBe('Rp371.850');
    expect(value('This payment')).toBe('Rp222.000');
    expect(value('Remaining after this payment')).toBe('Rp0');
  });

  it('never renders a movement as a misleading negative amount', () => {
    review();
    expect(document.body.textContent).not.toMatch(/[-−]\s*Rp/);
    expect(screen.queryByText(/Received ·/)).toBeNull();
  });

  it('lists payments received and refunds as separate groups', () => {
    review();
    const received = screen.getByText('Payment received').parentElement!;
    expect(received.textContent).toContain('QRIS BRI');
    expect(received.textContent).toContain('Rp410.700');
    expect(received.textContent).not.toContain('Refund');
    const refunds = screen.getByText('Refund', { selector: 'p' }).parentElement!;
    expect(refunds.textContent).toContain('BCA Operasional');
    expect(refunds.textContent).toContain('Bank transfer · Refund');
    expect(refunds.textContent).toContain('Cash · Refund');
    expect(refunds.textContent).toContain('Rp166.500');
    expect(refunds.textContent).not.toContain('QRIS');
  });
});

describe('RecordedPaymentList', () => {
  it('shows real payment status and never counts a failed attempt', () => {
    const sale = {
      totalAmount: '500000',
      payments: [
        payment('p1', 'SUCCEEDED', '300000'),
        payment('p2', 'FAILED', '200000', {
          method: 'CASH',
          financeFinancialAccountNameSnapshot: 'Cash',
        }),
      ],
    };
    withLocale(
      <RecordedPaymentList
        payments={sale.payments}
        totalAmount={sale.totalAmount}
        progress={paymentProgress(sale)}
        format={format}
        isMutating={false}
        onTransition={vi.fn()}
      />,
    );
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('Failed · not counted')).toBeTruthy();
    expect(screen.getByText(/Received payments cannot be edited or removed here/)).toBeTruthy();
    expect(paymentProgress(sale).remainingAmount).toBe('200000.0000');
  });

  it('shows a manual refund on the account the money left from, with its reference and note', () => {
    const sale = {
      totalAmount: '410700',
      payments: [
        payment('qris', 'SUCCEEDED', '616050', {
          method: 'QRIS',
          financeFinancialAccountNameSnapshot: 'QRIS BRI',
        }),
        payment('refund', 'SUCCEEDED', '-205350', {
          method: 'BANK_TRANSFER',
          financeFinancialAccountNameSnapshot: 'BCA Operasional',
          refund: {
            id: 'refund-1',
            kind: 'MANUAL',
            reason: 'ORDER_ADJUSTMENT',
            externalReference: 'TRF-0001',
            note: 'Wrong item',
            adjustmentId: 'adjustment-1',
            allocations: [{ sourcePaymentId: 'qris', amount: '205350.0000' }],
          },
        }),
      ],
    };
    withLocale(
      <RecordedPaymentList
        payments={sale.payments}
        totalAmount={sale.totalAmount}
        progress={paymentProgress(sale)}
        format={format}
        isMutating={false}
        onTransition={vi.fn()}
      />,
    );
    expect(screen.getByText('BCA Operasional')).toBeTruthy();
    expect(screen.getByText('Manual refund · TRF-0001 · Wrong item')).toBeTruthy();
    // A refund is a refund, not a payment "Received", and not a negative amount.
    const refundRow = screen.getByText('BCA Operasional').closest('li')!;
    expect(refundRow.textContent).not.toContain('Received');
    expect(refundRow.textContent).toContain('Refund');
    expect(screen.getAllByText('Received')).toHaveLength(1); // only the incoming QRIS payment
    expect(screen.getByText('Rp205.350')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/provider|automatic/i);
  });

  it('lets a waiting payment be confirmed or cancelled before it counts', () => {
    const onTransition = vi.fn();
    const sale = {
      totalAmount: '500000',
      payments: [
        payment('p1', 'SUCCEEDED', '300000'),
        payment('p2', 'PENDING', '200000', { financeFinancialAccountNameSnapshot: 'Mandiri' }),
      ],
    };
    withLocale(
      <RecordedPaymentList
        payments={sale.payments}
        totalAmount={sale.totalAmount}
        progress={paymentProgress(sale)}
        format={format}
        isMutating={false}
        onTransition={onTransition}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Received · complete payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel this payment' }));
    expect(onTransition.mock.calls.map(([, status]) => status)).toEqual(['SUCCEEDED', 'CANCELLED']);
  });

  it('disables payment actions while Runtime is processing', () => {
    const payments = [payment('p1', 'PENDING', '500000')];
    withLocale(
      <RecordedPaymentList
        payments={payments}
        totalAmount="500000"
        progress={paymentProgress({ totalAmount: '500000', payments })}
        format={format}
        isMutating
        onTransition={vi.fn()}
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('PaymentLeaveNotice', () => {
  it('reminds the operator that money is already recorded', () => {
    withLocale(
      <PaymentLeaveNotice
        progress={paymentProgress({
          totalAmount: '500000',
          payments: [payment('p1', 'SUCCEEDED', '300000')],
        })}
        format={format}
        hasPending={false}
      />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Rp300\.000 is already recorded for this transaction\./)).toBeTruthy();
    expect(screen.getByText(/Rp200\.000 is still unpaid\./)).toBeTruthy();
  });
});
