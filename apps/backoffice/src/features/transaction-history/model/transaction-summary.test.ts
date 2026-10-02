import { describe, expect, it } from 'vitest';

import {
  SCENARIOS,
  testLine,
  testPayment,
  testProductLine,
  testSale,
} from './transaction-test-fixtures';
import { paymentSummary, transactionStatusSummary, workSummary } from './transaction-summary';

describe('transactionStatusSummary', () => {
  it('maps the Sale lifecycle and derives a reversal from its fact', () => {
    expect(transactionStatusSummary(SCENARIOS.draft).kind).toBe('OPEN');
    expect(transactionStatusSummary(SCENARIOS.paid).kind).toBe('COMPLETED');
    expect(transactionStatusSummary(testSale({ status: 'VOIDED' })).kind).toBe('CANCELLED');
    expect(transactionStatusSummary(SCENARIOS.reversed).kind).toBe('REVERSED');
  });
});

describe('paymentSummary', () => {
  it('reports no payment as not paid', () => {
    expect(paymentSummary(SCENARIOS.draft).kind).toBe('NOT_PAID');
  });

  it('reports an authoritative pending payment with an open balance', () => {
    expect(paymentSummary(SCENARIOS.queued).kind).toBe('PENDING');
  });

  it('reports one settling payment as paid and several as a split', () => {
    expect(paymentSummary(SCENARIOS.paid).kind).toBe('PAID');
    expect(paymentSummary(SCENARIOS.split).kind).toBe('PAID_SPLIT');
  });

  it('never lets failed or cancelled attempts outweigh the payment that settled the sale', () => {
    const sale = testSale({
      payments: [
        testPayment('qris', 'FAILED', '250000.0000'),
        testPayment('bca', 'CANCELLED', '250000.0000'),
        testPayment('cash', 'SUCCEEDED', '250000.0000'),
      ],
    });
    expect(paymentSummary(sale)).toMatchObject({ kind: 'PAID', label: 'Paid' });
  });

  it('reports a part payment without a pending one as partially paid', () => {
    expect(paymentSummary(SCENARIOS.inProgress).kind).toBe('PARTIALLY_PAID');
  });

  it('reports refunds only from refund facts: full and partial', () => {
    expect(paymentSummary(SCENARIOS.reversed).kind).toBe('REFUNDED');
    const partial = testSale({
      status: 'FINALIZED',
      payments: [
        testPayment('cash', 'SUCCEEDED', '250000.0000'),
        testPayment('refund', 'SUCCEEDED', '-50000.0000', { refundOfPaymentId: 'cash' }),
      ],
    });
    expect(paymentSummary(partial).kind).toBe('PARTIALLY_REFUNDED');
  });

  it('never calls a void without money refunded', () => {
    const voided = testSale({
      status: 'VOIDED',
      payments: [testPayment('qris', 'EXPIRED', '250000.0000')],
    });
    expect(paymentSummary(voided).kind).toBe('NO_PAYMENT');
  });

  it('keeps a zero-total sale from reading as unpaid', () => {
    expect(paymentSummary(testSale({ status: 'FINALIZED', totalAmount: '0.0000' })).kind).toBe(
      'NOTHING_DUE',
    );
  });
});

describe('workSummary', () => {
  const tracked = (status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED', id: string) =>
    testLine({
      id,
      fulfillment: { status, startedAt: null, completedAt: null, canceledAt: null },
    });

  it('has no work state for a product-only sale', () => {
    expect(workSummary(SCENARIOS.productOnly).kind).toBe('NONE');
    expect(workSummary(testSale({ lines: [testProductLine()] })).label).toBe('No tracked work');
  });

  it('follows the Sale operational state while all tracked work is waiting', () => {
    expect(workSummary(SCENARIOS.draft).kind).toBe('DRAFT');
    expect(workSummary(SCENARIOS.queued).kind).toBe('WAITING');
    expect(
      workSummary(
        testSale({ operationalState: 'UNSUBMITTED', lines: [testLine({ fulfillment: null })] }),
      ).kind,
    ).toBe('DRAFT');
  });

  it('reports work in progress', () => {
    expect(workSummary(SCENARIOS.inProgress).kind).toBe('IN_PROGRESS');
  });

  it('reduces mixed line statuses to one truthful state', () => {
    const mixed = testSale({
      operationalState: 'IN_PROGRESS',
      lines: [tracked('COMPLETED', 'a'), tracked('WAITING', 'b'), tracked('COMPLETED', 'c')],
    });
    expect(workSummary(mixed).kind).toBe('IN_PROGRESS');
  });

  it('reports completion and cancellation once all tracked work has ended', () => {
    expect(workSummary(SCENARIOS.split).kind).toBe('COMPLETED');
    expect(
      workSummary(testSale({ lines: [tracked('COMPLETED', 'a'), tracked('CANCELED', 'b')] })).kind,
    ).toBe('COMPLETED');
    expect(
      workSummary(testSale({ status: 'VOIDED', lines: [tracked('CANCELED', 'a')] })).kind,
    ).toBe('CANCELLED');
    expect(workSummary(testSale({ status: 'VOIDED', lines: [tracked('WAITING', 'a')] })).kind).toBe(
      'CANCELLED',
    );
  });

  it('keeps completed work completed after the money is refunded and the sale reversed', () => {
    expect(workSummary(SCENARIOS.reversed).kind).toBe('COMPLETED');
  });

  it('ignores retired lines', () => {
    const sale = testSale({
      lines: [
        tracked('COMPLETED', 'a'),
        { ...tracked('WAITING', 'b'), removedAt: '2026-10-01T04:00:00.000Z' },
      ],
    });
    expect(workSummary(sale).kind).toBe('COMPLETED');
  });
});
