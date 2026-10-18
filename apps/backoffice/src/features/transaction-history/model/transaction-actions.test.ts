import { describe, expect, it } from 'vitest';

import {
  isRefundAmountValid,
  transactionActionErrorKey,
  transactionActions,
} from './transaction-actions';
import { SCENARIOS, testPayment, testSale } from './transaction-test-fixtures';

const all = { refund: true, reverse: true };
/** May reverse but not return money: received money must be refunded by someone who may. */
const reverseOnly = { refund: false, reverse: true };
const finalized = (payments: ReturnType<typeof testPayment>[], total = '250000.0000') =>
  testSale({ status: 'FINALIZED', totalAmount: total, payments });

describe('transactionActions — reverse eligibility', () => {
  it('reverses a paid sale in one step, returning the money still held', () => {
    expect(transactionActions(SCENARIOS.paid, all)).toMatchObject({
      canRefund: true,
      showReverse: true,
      canReverse: true,
      reverseBlock: null,
      reverseRefundAmount: SCENARIOS.paid.totalAmount,
    });
    // Without the refund permission the money must be returned by someone who may, first.
    expect(transactionActions(SCENARIOS.paid, reverseOnly)).toMatchObject({
      canReverse: false,
      reverseBlock: 'REFUND_REQUIRED',
    });
  });

  it('returns only what is left after a partial refund', () => {
    const sale = finalized([
      testPayment('cash', 'SUCCEEDED', '250000.0000'),
      testPayment('refund', 'SUCCEEDED', '-100000.0000', { refundOfPaymentId: 'cash' }),
    ]);
    expect(transactionActions(sale, all)).toMatchObject({
      canRefund: true,
      canReverse: true,
      reverseRefundAmount: '150000.0000',
    });
    expect(transactionActions(sale, all).refundable[0]!.maxAmount).toBe('150000.0000');
    expect(transactionActions(sale, reverseOnly).reverseBlock).toBe('REFUND_REQUIRED');
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
      reverseRefundAmount: null,
    });
  });

  it('returns every uncompensated source of a split payment, whatever its method', () => {
    const cashRefunded = finalized(
      [
        testPayment('bca', 'SUCCEEDED', '174825.0000', { method: 'BANK_TRANSFER' }),
        testPayment('cash', 'SUCCEEDED', '535464.0000'),
        testPayment('refund', 'SUCCEEDED', '-535464.0000', { refundOfPaymentId: 'cash' }),
      ],
      '710289.0000',
    );
    // Manually recorded payments are all returnable: the bank transfer is still to be returned.
    expect(transactionActions(cashRefunded, all)).toMatchObject({
      canRefund: true,
      canReverse: true,
      reverseRefundAmount: '174825.0000',
    });
    expect(
      transactionActions(cashRefunded, all).refundable.map(({ payment }) => payment.id),
    ).toEqual(['bca']);
    const bothOpen = finalized(
      [
        testPayment('bca', 'SUCCEEDED', '174825.0000', { method: 'BANK_TRANSFER' }),
        testPayment('cash', 'SUCCEEDED', '535464.0000'),
      ],
      '710289.0000',
    );
    expect(transactionActions(bothOpen, all)).toMatchObject({
      canRefund: true,
      canReverse: true,
      reverseRefundAmount: '710289.0000',
    });
    expect(transactionActions(bothOpen, reverseOnly).reverseBlock).toBe('REFUND_REQUIRED');
    expect(
      transactionActions(bothOpen, all)
        .refundable.map(({ payment }) => payment.id)
        .sort(),
    ).toEqual(['bca', 'cash']);
  });

  it('treats a bank transfer with an operator reference like any other manual payment', () => {
    const referenced = finalized(
      [
        testPayment('bank', 'SUCCEEDED', '100000.0000', {
          method: 'BANK_TRANSFER',
          providerReference: 'TRX-889',
        }),
      ],
      '100000.0000',
    );
    expect(transactionActions(referenced, all)).toMatchObject({
      canRefund: true,
      reverseRefundAmount: '100000.0000',
    });
    expect(transactionActions(referenced, reverseOnly).reverseBlock).toBe('REFUND_REQUIRED');
  });

  it('offers QRIS and e-wallet money for a manual refund or a one-step reversal', () => {
    const qris = finalized(
      [testPayment('qris', 'SUCCEEDED', '100000.0000', { method: 'QRIS' })],
      '100000.0000',
    );
    const actions = transactionActions(qris, all);
    expect(actions).toMatchObject({
      canRefund: true,
      canReverse: true,
      reverseRefundAmount: '100000.0000',
    });
    expect(actions.refundable.map((entry) => [entry.payment.id, entry.maxAmount])).toEqual([
      ['qris', '100000.0000'],
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
