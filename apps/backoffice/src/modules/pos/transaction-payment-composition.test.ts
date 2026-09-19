import { describe, expect, it } from 'vitest';

import type { PaymentStatus } from './transaction-history-api';
import { transactionPaymentComposition } from './transaction-payment-composition';

const payment = (id: string, status: PaymentStatus, appliedAmount: string) => ({
  id,
  status,
  appliedAmount,
});

describe('transactionPaymentComposition', () => {
  it('keeps a single successful payment a single payment', () => {
    const result = transactionPaymentComposition({
      totalAmount: '500000.0000',
      payments: [payment('cash', 'SUCCEEDED', '500000.0000')],
    });
    expect(result).toMatchObject({ isSplit: false, settled: true, balanceDue: '0.0000' });
  });

  it('classifies payments that settle the sale together as a split payment', () => {
    const result = transactionPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'SUCCEEDED', '300000.0000'),
        payment('cash', 'SUCCEEDED', '200000.0000'),
      ],
    });
    expect(result).toMatchObject({ isSplit: true, totalPaid: '500000.0000' });
    expect(result.applied.map((item) => item.id)).toEqual(['bca', 'cash']);
  });

  it('separates failed and cancelled attempts from the payment that settled the sale', () => {
    const result = transactionPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'FAILED', '500000.0000'),
        payment('bni', 'CANCELLED', '300000.0000'),
        payment('cash', 'SUCCEEDED', '500000.0000'),
      ],
    });
    expect(result.isSplit).toBe(false);
    expect(result.applied.map((item) => item.id)).toEqual(['cash']);
    expect(result.notApplied.map((item) => item.id)).toEqual(['bca', 'bni']);
  });

  it('sums a three-way split exactly', () => {
    const result = transactionPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'SUCCEEDED', '200000.3333'),
        payment('cash', 'SUCCEEDED', '149999.6667'),
        payment('wallet', 'SUCCEEDED', '150000'),
      ],
    });
    expect(result).toMatchObject({ isSplit: true, totalPaid: '500000.0000', balanceDue: '0.0000' });
  });

  it('reports the open balance of a partly paid sale without calling it split', () => {
    const result = transactionPaymentComposition({
      totalAmount: '444000.0000',
      payments: [payment('bca', 'SUCCEEDED', '300000.0000'), payment('qris', 'PENDING', '144000')],
    });
    expect(result).toMatchObject({
      isSplit: false,
      settled: false,
      totalPaid: '300000.0000',
      balanceDue: '144000.0000',
    });
  });
});
