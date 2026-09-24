import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TransactionFinancialSummary } from './transaction-financial-summary';
import type { Sale } from './transaction-history-api';

const sale = {
  id: 'sale-1',
  saleNumber: 'TRX-001',
  invoiceNumber: null,
  sellingLocationId: 'location-1',
  currency: 'IDR',
  status: 'FINALIZED',
  version: 1,
  grossAmount: '200000.0000',
  totalAmount: '197580.0000',
  taxAmount: '19580.0000',
  discountAmount: '20000.0000',
  createdAt: '2026-09-23T00:00:00.000Z',
  finalizedAt: '2026-09-23T00:00:00.000Z',
  voidedAt: null,
  reversal: { reason: 'Returned', reversedAt: '2026-09-23T01:00:00.000Z' },
  loyaltyRedemption: {
    membershipId: 'membership-1',
    points: '2',
    pointValue: '1000.0000',
    amount: '2000.0000',
  },
  lines: [],
  payments: [],
} satisfies Sale;

describe('TransactionFinancialSummary', () => {
  afterEach(cleanup);

  it('renders an authoritative loyalty redemption adjustment for a finalized reversed sale', () => {
    render(
      <TransactionFinancialSummary
        sale={sale}
        copy={(value) => value}
        formatMoney={(amount) => `Rp ${amount}`}
      />,
    );

    expect(screen.getByText('Loyalty redemption (2 points)')).toBeTruthy();
    expect(screen.getByText('−Rp 2000.0000')).toBeTruthy();
    expect(screen.getByText('Rp 197580.0000')).toBeTruthy();
  });

  it('does not render an empty loyalty row when the sale has no redemption', () => {
    render(
      <TransactionFinancialSummary
        sale={{ ...sale, loyaltyRedemption: null, reversal: null }}
        copy={(value) => value}
        formatMoney={(amount) => `Rp ${amount}`}
      />,
    );

    expect(screen.queryByText(/Loyalty redemption/)).toBeNull();
  });
});
