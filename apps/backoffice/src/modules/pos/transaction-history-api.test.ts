import { TransactionHistoryApi } from './transaction-history-api';
import { describe, expect, it, vi } from 'vitest';

describe('TransactionHistoryApi reversal commands', () => {
  it('sends the Runtime refund command with a distinct idempotency key', async () => {
    const post = vi.fn().mockResolvedValue({});
    const api = new TransactionHistoryApi({ post } as never);

    await api.refundPayment('sale-1', 'payment-1', 4, '25.0000');

    expect(post).toHaveBeenCalledWith(
      '/api/v1/sales/sale-1/payments/payment-1/refund',
      { expectedVersion: 4, amount: '25.0000' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
      }),
    );
  });

  it('sends the Runtime reversal command with the required reason', async () => {
    const post = vi.fn().mockResolvedValue({});
    const api = new TransactionHistoryApi({ post } as never);

    await api.reverse('sale-1', 4, 'Customer refund completed');

    expect(post).toHaveBeenCalledWith(
      '/api/v1/sales/sale-1/reverse',
      { expectedVersion: 4, reason: 'Customer refund completed' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
      }),
    );
  });
});
