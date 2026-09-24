import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SaleFinancialSummary } from './sale-detail-presentation';
import { referenceTransactionDetailLayout } from './replatformed-pos-workspace';
import { referenceTransactionDetailPresentation } from './replatformed-pos-workspace';

afterEach(cleanup);

describe('SaleFinancialSummary', () => {
  it('keeps an authoritative loyalty redemption visible in the historical financial summary', () => {
    render(
      <SaleFinancialSummary
        title="Order summary"
        context={<p>Member context</p>}
        labels={{
          subtotal: 'Subtotal',
          total: 'Total',
          paid: 'Paid',
          balance: 'Remaining',
          settled: 'Settled',
          cashReceived: 'Cash received',
          change: 'Change',
          discount: 'Discount',
          discountContext: () => 'Transaction',
        }}
        gross="200000.0000"
        discounts={[]}
        adjustments={[
          {
            id: 'loyalty-redemption',
            label: 'Loyalty redemption',
            detail: '200 points used',
            amount: '20000.0000',
          },
        ]}
        tax={null}
        total="180000.0000"
        settlement={{
          paymentState: 'PAID',
          totalPaid: '180000.0000',
          balanceDue: '0.0000',
          cashTendered: null,
          cashChange: null,
        }}
        format={(amount) => `Rp ${amount}`}
        payment={{
          title: 'Payment',
          content: <p>Cash Rp 180000.0000</p>,
        }}
      />,
    );

    expect(screen.getByText('Loyalty redemption')).toBeTruthy();
    expect(screen.getByText('200 points used')).toBeTruthy();
    expect(document.querySelectorAll('.pos-financial-panel')).toHaveLength(1);
    expect(document.querySelectorAll('.pos-detail-panel')).toHaveLength(0);
    expect(screen.getByText('Order summary')).toBeTruthy();
    expect(screen.getByText('Member context')).toBeTruthy();
    expect(screen.getByText('Payment')).toBeTruthy();
    expect(screen.getByText('Cash Rp 180000.0000')).toBeTruthy();
    expect(screen.getByText('−Rp 20000.0000')).toBeTruthy();
  });
});

describe('reference transaction detail layout', () => {
  it('leaves sizing and scrolling to the shared Dialog body', () => {
    expect(referenceTransactionDetailLayout.dialog).toContain('lg:!max-w-[1060px]');
    expect(referenceTransactionDetailLayout.dialog).not.toContain('h-[92dvh]');
    expect(referenceTransactionDetailLayout.body).not.toContain('h-full');
    expect(referenceTransactionDetailLayout.body).not.toContain('overflow-hidden');
    expect(referenceTransactionDetailLayout.orderColumn).not.toContain('overflow-y-auto');
  });
});

describe('reference transaction detail presentation', () => {
  it('assigns the financial total only to the financial rail', () => {
    expect(referenceTransactionDetailPresentation.showTopTotal).toBe(false);
    expect(referenceTransactionDetailPresentation.showRightContext).toBe(true);
    expect(referenceTransactionDetailPresentation.emphasizePrimaryStatus).toBe(true);
  });
});
