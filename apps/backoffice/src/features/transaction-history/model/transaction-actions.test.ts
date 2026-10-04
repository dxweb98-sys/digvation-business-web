import { describe, expect, it } from 'vitest';

import {
  isRefundAmountValid,
  transactionActionErrorKey,
  transactionActions,
} from './transaction-actions';
import { SCENARIOS, testPayment, testSale } from './transaction-test-fixtures';

const all = { refund: true, reverse: true };
const finalized = (payments: ReturnType<typeof testPayment>[], total = '250000.0000') =>
  testSale({ status: 'FINALIZED', totalAmount: total, payments });

describe('transactionActions — reverse eligibility', () => {
  it('blocks reversal while successful money is uncompensated and offers the refund', () => {
    expect(transactionActions(SCENARIOS.paid, all)).toMatchObject({
      canRefund: true,
      showReverse: true,
      canReverse: false,
      reverseBlock: 'REFUND_REQUIRED',
    });
  });

  it('keeps reversal blocked after a partial refund', () => {
    const sale = finalized([
      testPayment('cash', 'SUCCEEDED', '250000.0000'),
      testPayment('refund', 'SUCCEEDED', '-100000.0000', { refundOfPaymentId: 'cash' }),
    ]);
    expect(transactionActions(sale, all)).toMatchObject({
      canRefund: true,
      canReverse: false,
      reverseBlock: 'REFUND_REQUIRED',
    });
    expect(transactionActions(sale, all).refundable[0]!.maxAmount).toBe('150000.0000');
  });

  it('allows reversal once every successful payment is fully compensated', () => {
    const sale = finalized([
      testPayment('cash', 'SUCCEEDED', '250000.0000'),
      testPayment('refund', 'SUCCEEDED', '-250000.0000', { refundOfPaymentId: 'cash' }),
    ]);
    expect(transactionActions(sale, all)).toMatchObject({
      canRefund: false,
      canReverse: true,
      reverseBlock: null,
    });
  });

  it('requires every source of a split payment to be compensated', () => {
    const cashOnly = finalized(
      [
        testPayment('bca', 'SUCCEEDED', '174825.0000', { method: 'BANK_TRANSFER' }),
        testPayment('cash', 'SUCCEEDED', '535464.0000'),
        testPayment('refund', 'SUCCEEDED', '-535464.0000', { refundOfPaymentId: 'cash' }),
      ],
      '710289.0000',
    );
    // Cash is refunded; the bank transfer can only be refunded through its provider.
    expect(transactionActions(cashOnly, all)).toMatchObject({
      canRefund: false,
      canReverse: false,
      reverseBlock: 'PROVIDER_REFUND_REQUIRED',
    });
    const bothOpen = finalized(
      [
        testPayment('bca', 'SUCCEEDED', '174825.0000', { method: 'BANK_TRANSFER' }),
        testPayment('cash', 'SUCCEEDED', '535464.0000'),
      ],
      '710289.0000',
    );
    expect(transactionActions(bothOpen, all)).toMatchObject({
      canRefund: true,
      canReverse: false,
      reverseBlock: 'PROVIDER_REFUND_REQUIRED',
    });
    expect(transactionActions(bothOpen, all).refundable.map(({ payment }) => payment.id)).toEqual([
      'cash',
    ]);
  });

  it('never offers actions on a voided sale with no money, and never calls it refunded', () => {
    const voided = testSale({ status: 'VOIDED', payments: [] });
    expect(transactionActions(voided, all)).toMatchObject({
      canRefund: false,
      showReverse: false,
      canReverse: false,
      reverseBlock: null,
    });
  });

  it('hides everything on a reversed sale and follows the caller permissions', () => {
    expect(transactionActions(SCENARIOS.reversed, all)).toMatchObject({
      canRefund: false,
      showReverse: false,
    });
    expect(transactionActions(SCENARIOS.paid, { refund: false, reverse: true })).toMatchObject({
      canRefund: false,
      refundable: [],
      showReverse: true,
      canReverse: false,
    });
    expect(transactionActions(SCENARIOS.paid, { refund: true, reverse: false })).toMatchObject({
      showReverse: false,
      reverseBlock: null,
    });
  });
});

describe('isRefundAmountValid', () => {
  it('accepts an exact canonical amount within the refundable balance', () => {
    expect(isRefundAmountValid('535464', '535464.0000')).toBe(true);
    expect(isRefundAmountValid('0.5', '150000.0000')).toBe(true);
    expect(isRefundAmountValid('535464.0001', '535464.0000')).toBe(false);
    expect(isRefundAmountValid('0', '150000.0000')).toBe(false);
    // A display-formatted amount is never a canonical transport value.
    expect(isRefundAmountValid('535.464,00', '535464.0000')).toBe(false);
  });
});

describe('transactionActionErrorKey', () => {
  it('maps known Runtime refund/reversal codes and keeps unknown errors generic', () => {
    expect(
      transactionActionErrorKey('SALE_REVERSAL_PAYMENT_COMPENSATION_REQUIRED', 'fallback'),
    ).toBe('Refund all completed payments before reversing this transaction.');
    expect(transactionActionErrorKey('PAYMENT_REFUND_EXCEEDS_SOURCE', 'fallback')).toBe(
      'The amount is more than what is left to refund on this payment.',
    );
    expect(transactionActionErrorKey('SALE_VERSION_CONFLICT', 'fallback')).toBe(
      'This transaction changed in the meantime. Reload it and try again.',
    );
    expect(transactionActionErrorKey('DOMAIN_VALIDATION_ERROR', 'fallback')).toBe('fallback');
    expect(transactionActionErrorKey(undefined, 'fallback')).toBe('fallback');
  });
});
