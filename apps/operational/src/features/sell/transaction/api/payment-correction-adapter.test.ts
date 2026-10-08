import { describe, expect, it, vi } from 'vitest';

import { HttpCashierTransactionAdapter } from './cashier-transaction.adapter';
import { attachOperationalProjection } from './operational-projection-client';

const input = {
  expectedVersion: 4,
  reason: 'Salah memasukkan nominal pembayaran',
  moves: [
    { paymentRouteId: 'cash', delta: '5000.0000' },
    { paymentRouteId: 'bca', delta: '-5000.0000' },
  ],
};

describe('payment correction transport', () => {
  it('posts the one correction command to Runtime with an idempotency key', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'sale-1' });
    const adapter = new HttpCashierTransactionAdapter({ post } as never);
    await adapter.correctPayments('sale-1', input, 'key-1');
    expect(post).toHaveBeenCalledWith('/api/v1/sales/sale-1/payment-corrections', input, {
      headers: { 'Idempotency-Key': 'key-1' },
    });
  });

  it('reaches the same authority through the Operational entry point', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'sale-1' });
    const client = { post, get: vi.fn() } as never;
    const port = attachOperationalProjection(client, new HttpCashierTransactionAdapter(client));
    await port.correctPayments!('sale-1', input, 'key-2');
    expect(post).toHaveBeenCalledWith(
      '/api/v1/operational/transactions/sale-1/payment-corrections',
      input,
      { headers: { 'Idempotency-Key': 'key-2' } },
    );
  });
});
